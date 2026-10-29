"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SaleFormModal from "@/components/SaleFormModal";
import { ApiError } from "@/lib/api/auth";
import { listAllEmployees, type Employee } from "@/lib/api/employees";
import { listSales, type Sale } from "@/lib/api/sales";
import { listProducts } from "@/lib/api/products";
import { dmSans, sora } from "@/lib/auth-fonts";

const PAGE_SIZE = 8;
const EXPORT_PAGE_SIZE = 100; // the largest page the API allows
const AVATAR_TINTS = [
  "bg-[#E7F5EE] text-[#0E4D3A]",
  "bg-[#E0F2FE] text-[#075985]",
  "bg-[#FEF3C7] text-[#92400E]",
  "bg-[#FFE4E6] text-[#9F1239]",
];

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "—";

/** Page numbers to show: the first pages, the current one, and the last one, with gaps marked. */
function pageItems(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "…", pages];
  if (page >= pages - 3) return [1, "…", pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, "…", page - 1, page, page + 1, "…", pages];
}

const toCsvCell = (value: string | null) => `"${(value ?? "").replace(/"/g, '""')}"`;

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [productNames, setProductNames] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number | null>(null);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<ApiError["kind"] | null>(null);
  const [editing, setEditing] = useState<Sale | "new" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const latestRequest = useRef(0);


  // Search waits for a short pause in typing, then goes back to the first page.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSubmittedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in to see the sales."); setIsLoading(false); return; }
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError("");
    setErrorKind(null);
    listSales(accessToken, { search: submittedSearch || undefined, skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE })
      .then((result) => {
        if (requestId !== latestRequest.current) return; // a newer request has replaced this one
        setSales(result.items);
        setTotal(result.total);
      })
      .catch((caught) => {
        if (requestId !== latestRequest.current) return;
        if (caught instanceof ApiError) {
          setErrorKind(caught.kind);
          setError(caught.message);
        } else {
          setErrorKind("unknown");
          setError("Could not load the sales. Please try again.");
        }
      })
      .finally(() => {
        if (requestId === latestRequest.current) setIsLoading(false);
      });
  }, [page, submittedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, reloadKey]);

  // Retry a failed request automatically once the browser reconnects.
  useEffect(() => {
    const onOnline = () => setReloadKey((key) => key + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    let cancelled = false;
    const loadAllProducts = async () => {
      const names: string[] = [];
      let skip = 0;
      let total = Number.POSITIVE_INFINITY;
      while (skip < total) {
        const result = await listProducts(accessToken, { skip, limit: 100 });
        names.push(...result.items.map((product) => product.name));
        total = result.total;
        if (result.items.length === 0) break;
        skip += result.items.length;
      }
      if (!cancelled) setProductNames(names);
    };
    loadAllProducts().catch(() => { if (!cancelled) setProductNames([]); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem("ogera_user") ?? "null") as { id?: number } | null;
      setCurrentEmployeeId(typeof stored?.id === "number" ? stored.id : null);
    } catch {
      setCurrentEmployeeId(null);
    }
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setEmployeesLoading(false); return; }
    setEmployeesLoading(true);
    setEmployeesError("");
    listAllEmployees(accessToken)
      .then((result) => setEmployees(result.employees))
      .catch(() => setEmployeesError("Employee list could not be loaded."))
      .finally(() => setEmployeesLoading(false));
  }, [reloadKey]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const exportCsv = async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    setIsExporting(true);
    setError("");
    setErrorKind(null);
    try {
      // Every row that matches the search, not only the page on screen.
      const rows: Sale[] = [];
      for (let skip = 0; ; skip += EXPORT_PAGE_SIZE) {
        const result = await listSales(accessToken, { search: submittedSearch || undefined, skip, limit: EXPORT_PAGE_SIZE });
        rows.push(...result.items);
        if (result.items.length === 0 || rows.length >= result.total) break;
      }
      const header = ["Customer", "Phone", "Alternate phone", "Address", "Product purchased", "Purchase date", "Created by", "Branch"];
      const body = rows.map((r) => [r.name, r.phone, r.alt_phone, r.address, r.purchased_product, r.purchase_date, r.created_by?.name ?? null, r.created_by?.branch ?? null]);
      const csv = [header, ...body].map((line) => line.map(toCsvCell).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales-${todayIso()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrorKind(caught.kind);
        setError(caught.message);
      } else {
        setErrorKind("unknown");
        setError("Could not export the sales. Please try again.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`${dmSans.variable} ${sora.variable} flex min-h-full flex-col font-[family-name:var(--font-dm-sans)] text-[#1A1C21]`}>
      <header className="flex h-[72px] shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EA] bg-white px-7">
        <h1 className="whitespace-nowrap font-[family-name:var(--font-sora)] text-xl font-bold tracking-[-0.01em] text-[#1A1C21]">Sales Register</h1>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex h-10 shrink-0 items-center gap-2 rounded-[8px] bg-[#0E4D3A] px-4 text-sm font-semibold text-white hover:opacity-90"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add New Sale
        </button>
      </header>

      <div className="flex flex-col gap-3.5 px-7 pb-6 pt-[22px]">
        <p className="text-[13.5px] leading-normal text-[#6B7080]">Every walk-in and direct sale recorded for your team — who bought what, and when. Click a row to view, edit or remove an entry.</p>

        <section aria-label="Sales list" className="flex flex-col overflow-hidden rounded-[18px] border border-[#E5E7EA] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFEFF2] p-4">
            <label className="relative flex min-w-[220px] max-w-[360px] flex-1 items-center">
              <span className="sr-only">Search sales</span>
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A8F9C" strokeWidth="1.8" strokeLinecap="round" className="absolute left-3">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                className="sr-search h-[38px] w-full rounded-[8px] border border-[#DEE1E5] bg-[#F7F8F9] py-0 pl-[34px] pr-3 text-[13.5px] text-[#1A1C21] outline-none focus:border-[#0E4D3A]"
                type="search"
                placeholder="Search by name, phone or product…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={exportCsv}
              disabled={isExporting}
              className="flex h-[38px] items-center gap-1.5 rounded-[8px] border border-[#DEE1E5] bg-white px-3 text-sm font-medium text-[#3A3E4A] hover:bg-[#F7F8F9] disabled:opacity-50"
            >
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg>
              Export
            </button>
          </div>

          <div className="overflow-x-auto">
            <table aria-busy={isLoading} className="w-full min-w-[1240px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#F7F7F9] text-left text-[13px] text-[#4B5060]">
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-3 py-3 font-medium">Phone</th>
                  <th scope="col" className="px-3 py-3 font-medium">Address</th>
                  <th scope="col" className="px-3 py-3 font-medium">Product Purchased</th>
                  <th scope="col" className="px-3 py-3 font-medium">Purchase Date</th>
                  <th scope="col" className="px-3 py-3 font-medium">Created By</th>
                  <th scope="col" className="px-3 py-3 font-medium">Branch</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && sales.length === 0 && Array.from({ length: 6 }, (_, index) => (
                  <tr key={`loading-${index}`} aria-hidden="true" className="border-t border-[#EFEFF2] animate-pulse">
                    {Array.from({ length: 8 }, (_, cell) => <td key={cell} className="h-14 px-3"><span className={`block h-3 rounded bg-[#EEF0F2] ${cell === 0 ? "w-32" : cell === 3 ? "w-40" : "w-20"}`} /></td>)}
                  </tr>
                ))}
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => setEditing(sale)}
                    className="cursor-pointer border-t border-[#EFEFF2] hover:bg-[#FAFAFB]"
                  >
                    <td className="h-14 px-4">
                      <div className="flex items-center gap-2.5">
                        <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${AVATAR_TINTS[sale.name.charCodeAt(0) % AVATAR_TINTS.length]}`}>
                          {sale.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="whitespace-nowrap font-semibold text-[#1A1C21]">{sale.name}</span>
                      </div>
                    </td>
                    <td className="px-3">
                      <div className="flex flex-col gap-px">
                        <span className="whitespace-nowrap text-[#3A3E4A]">{sale.phone ?? "—"}</span>
                        {sale.alt_phone && <span className="whitespace-nowrap text-[11px] text-[#9AA0AC]">Alt: {sale.alt_phone}</span>}
                      </div>
                    </td>
                    <td className="max-w-[220px] truncate whitespace-nowrap px-3 text-[#6B7080]" title={sale.address ?? undefined}>{sale.address ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 text-[#3A3E4A]">{sale.purchased_product ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 text-[#6B7080]">{formatDate(sale.purchase_date)}</td>
                    <td className="whitespace-nowrap px-3 text-[#3A3E4A]">{sale.created_by?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 capitalize text-[#6B7080]">{sale.created_by?.branch ?? "—"}</td>
                    <td className="px-4 text-center">
                      <button
                        type="button"
                        aria-label={`Actions for ${sale.name}`}
                        onClick={(e) => { e.stopPropagation(); setEditing(sale); }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-[#1A1C21] hover:bg-[#F1F2F4]"
                      >
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && (
              <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm ${errorKind === "offline" || errorKind === "network" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                <span>{errorKind === "offline" ? "You’re offline. " : errorKind === "network" ? "Can’t reach the server. " : ""}{error}</span>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="rounded-[7px] border border-current px-3 py-1.5 text-xs font-semibold hover:bg-white/60">Try again</button>
              </div>
            )}
            {!isLoading && !error && sales.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-[#6B7080]">
                {submittedSearch ? "No sales match your search." : "No sales recorded yet."}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEFF2] px-4 py-3.5">
            <p className="text-sm text-[#3A3E4A]">Showing {from} to {to} of {total} sales</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-9 items-center gap-1.5 rounded-[8px] border border-[#DEE1E5] bg-white px-3 text-[13px] font-medium text-[#3A3E4A] hover:bg-[#F7F8F9] disabled:opacity-40"
              >
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                Previous
              </button>
              {pageItems(page, pages).map((item, index) =>
                item === "…" ? (
                  <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-[#8A8F9C]">…</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-current={item === page ? "page" : undefined}
                    className={`h-9 w-9 rounded-[8px] text-[13px] ${item === page ? "bg-[#0E4D3A] font-semibold text-white" : "text-[#4B5060] hover:bg-[#F1F2F4]"}`}
                  >
                    {item}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="flex h-9 items-center gap-1.5 rounded-[8px] bg-[#0E4D3A] px-3.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
              >
                Next
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </div>
        </section>
      </div>

      {editing && (
        <SaleFormModal
          sale={editing === "new" ? null : editing}
          productNames={productNames}
          employees={employees}
          currentEmployeeId={currentEmployeeId}
          employeesLoading={employeesLoading}
          employeesError={employeesError}
          onClose={() => setEditing(null)}
          onChanged={() => { setEditing(null); setReloadKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}
