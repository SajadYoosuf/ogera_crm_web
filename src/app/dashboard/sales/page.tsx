"use client";

/**
 * Sales page — renders the list and delegates all state to useSalesList().
 * This file is UI only: no API calls, no sessionStorage, no business logic.
 */

import { useState } from "react";
import { dmSans, sora } from "@/lib/auth-fonts";
import { pageItems } from "@/lib/shared/pagination";
import { avatarTint } from "@/lib/shared/avatar";
import { formatDate } from "@/lib/shared/format";
import { useSalesList } from "@/features/sales/hooks/useSalesList";
import SaleFormModal from "@/features/sales/components/SaleFormModal";
import type { Sale } from "@/features/sales/api/sales";

export default function SalesPage() {
  const {
    sales, total, pages, page, setPage,
    search, setSearch,
    employeeFilter, changeEmployeeFilter,
    productNames, employees, currentEmployeeId,
    employeesLoading, employeesError,
    isLoading, isExporting, error, errorKind,
    reload, exportCsv,
    PAGE_SIZE,
  } = useSalesList();

  const [editing, setEditing] = useState<Sale | "new" | null>(null);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className={`${dmSans.variable} ${sora.variable} flex min-h-full flex-col font-[family-name:var(--font-dm-sans)] text-[#1A1C21]`}>
      <header className="flex h-[72px] shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EA] bg-white px-7">
        <h1 className="whitespace-nowrap font-[family-name:var(--font-sora)] text-xl font-bold tracking-[-0.01em] text-[#1A1C21]">Sales Register</h1>
        <button type="button" onClick={() => setEditing("new")}
          className="flex h-10 shrink-0 items-center gap-2 rounded-[8px] bg-[#0E4D3A] px-4 text-sm font-semibold text-white hover:opacity-90">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add New Sale
        </button>
      </header>

      <div className="flex flex-col gap-3.5 px-7 pb-6 pt-[22px]">
        <p className="text-[13.5px] leading-normal text-[#6B7080]">Every walk-in and direct sale recorded for your team — who bought what, and when. Click a row to view, edit or remove an entry.</p>

        <section aria-label="Sales list" className="flex flex-col overflow-hidden rounded-[18px] border border-[#E5E7EA] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-[#EFEFF2] px-4 py-3.5">
            <label className="relative flex min-w-[240px] max-w-[400px] flex-1 items-center">
              <span className="sr-only">Search sales</span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8F9C" strokeWidth="1.9" strokeLinecap="round" className="pointer-events-none absolute left-3.5 shrink-0">
                <circle cx="11" cy="11" r="7.5" /><path d="M20.5 20.5l-3.8-3.8" />
              </svg>
              <input className="h-10 w-full rounded-xl border border-[#DEE1E5] bg-[#F7F8FA] py-0 pl-[38px] pr-9 text-[13.5px] text-[#1A1C21] shadow-[0_1px_3px_rgba(16,24,40,0.06)] outline-none transition-all placeholder:text-[#9AA0AC] focus:border-[#0E4D3A] focus:bg-white focus:shadow-[0_0_0_3px_rgba(14,77,58,0.10)]"
                type="search" placeholder="Search by name, phone or product…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => setSearch("")}
                  className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[#9AA0AC] hover:bg-[#EFEFF2] hover:text-[#4B5060]">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              )}
            </label>
            <select aria-label="Filter by employee" value={String(employeeFilter)} onChange={(e) => changeEmployeeFilter(e.target.value)} disabled={employeesLoading}
              className="h-10 min-w-[160px] rounded-xl border border-[#DEE1E5] bg-[#F7F8FA] px-3 text-[13.5px] text-[#3A3E4A] shadow-[0_1px_3px_rgba(16,24,40,0.06)] outline-none transition-all focus:border-[#0E4D3A] focus:bg-white focus:shadow-[0_0_0_3px_rgba(14,77,58,0.10)] disabled:opacity-50">
              <option value="">All employees</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}{emp.branch ? ` · ${emp.branch}` : ""}</option>)}
            </select>
            <div className="ml-auto">
              <button type="button" onClick={exportCsv} disabled={isExporting}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-[#DEE1E5] bg-white px-3.5 text-[13.5px] font-medium text-[#3A3E4A] shadow-[0_1px_3px_rgba(16,24,40,0.06)] hover:bg-[#F7F8F9] disabled:opacity-50">
                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg>
                Export
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table aria-busy={isLoading} className="w-full min-w-[1240px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#F7F7F9] text-left text-[13px] text-[#4B5060]">
                  {["Customer", "Phone", "Address", "Product Purchased", "Purchase Date", "Created By", "Branch", "Action"].map((h, i) => (
                    <th key={h} scope="col" className={`${i === 0 || i === 7 ? "px-4" : "px-3"} py-3 font-medium${i === 7 ? " text-center" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && sales.length === 0 && Array.from({ length: 6 }, (_, i) => (
                  <tr key={`skeleton-${i}`} aria-hidden="true" className="border-t border-[#EFEFF2] animate-pulse">
                    {Array.from({ length: 8 }, (_, c) => <td key={c} className="h-14 px-3"><span className={`block h-3 rounded bg-[#EEF0F2] ${c === 0 ? "w-32" : c === 3 ? "w-40" : "w-20"}`} /></td>)}
                  </tr>
                ))}
                {sales.map((sale) => (
                  <tr key={sale.id} onClick={() => setEditing(sale)} className="cursor-pointer border-t border-[#EFEFF2] hover:bg-[#FAFAFB]">
                    <td className="h-14 px-4">
                      <div className="flex items-center gap-2.5">
                        <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${avatarTint(sale.name)}`}>
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
                      <button type="button" aria-label={`Actions for ${sale.name}`} onClick={(e) => { e.stopPropagation(); setEditing(sale); }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-[#1A1C21] hover:bg-[#F1F2F4]">
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && (
              <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm ${errorKind === "offline" || errorKind === "network" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                <span>{errorKind === "offline" ? "You're offline. " : errorKind === "network" ? "Can't reach the server. " : ""}{error}</span>
                <button type="button" onClick={reload} className="rounded-[7px] border border-current px-3 py-1.5 text-xs font-semibold hover:bg-white/60">Try again</button>
              </div>
            )}
            {!isLoading && !error && sales.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-[#6B7080]">
                {search ? "No sales match your search." : "No sales recorded yet."}
              </p>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEFF2] px-4 py-3.5">
            <p className="text-sm text-[#3A3E4A]">Showing {from} to {to} of {total} sales</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="flex h-9 items-center gap-1.5 rounded-[8px] border border-[#DEE1E5] bg-white px-3 text-[13px] font-medium text-[#3A3E4A] hover:bg-[#F7F8F9] disabled:opacity-40">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                Previous
              </button>
              {pageItems(page, pages).map((item, i) =>
                item === "…" ? <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-[#8A8F9C]">…</span> : (
                  <button key={item} type="button" onClick={() => setPage(item)} aria-current={item === page ? "page" : undefined}
                    className={`h-9 w-9 rounded-[8px] text-[13px] ${item === page ? "bg-[#0E4D3A] font-semibold text-white" : "text-[#4B5060] hover:bg-[#F1F2F4]"}`}>{item}</button>
                )
              )}
              <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
                className="flex h-9 items-center gap-1.5 rounded-[8px] bg-[#0E4D3A] px-3.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40">
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
          onChanged={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}
