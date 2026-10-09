"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import SaleFormModal from "@/components/SaleFormModal";
import SelectField from "@/components/SelectField";
import { ApiError } from "@/lib/api/auth";
import { listProducts, type ProductListItem } from "@/lib/api/products";
import { canEditSales, deleteSale, listSaleProducts, listSales, type Sale } from "@/lib/api/sales";

const PAGE_SIZE = 20;
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "—";

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [product, setProduct] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [products, setProducts] = useState<string[]>([]);
  const [catalogue, setCatalogue] = useState<ProductListItem[]>([]); // active products the form can link to
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Sale | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const latestRequest = useRef(0);

  const storedUser = useSyncExternalStore(() => () => {}, () => sessionStorage.getItem("ogera_user"), () => null);
  const viewerRole = useMemo(() => { try { return (JSON.parse(storedUser ?? "null") as { role?: string } | null)?.role; } catch { return undefined; } }, [storedUser]);
  const canEdit = canEditSales(viewerRole);

  const load = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setSales([]); setError("Sign in to see the sales."); setIsLoading(false); return; }
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError("");
    try {
      const result = await listSales(accessToken, {
        skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, search: submittedSearch || undefined, product: product || undefined,
        purchased_from: range.from || undefined, purchased_to: range.to || undefined,
      });
      if (requestId !== latestRequest.current) return; // a newer search is already running
      setSales(result.items);
      setTotal(result.total);
    } catch (caught) {
      if (requestId !== latestRequest.current) return;
      setSales([]);
      setError(caught instanceof ApiError ? caught.message : "Could not load the sales. Please try again.");
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  }, [page, submittedSearch, product, range]);

  const loadProducts = useCallback(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    listSaleProducts(accessToken).then(setProducts).catch(() => setProducts([]));
    listProducts(accessToken, { limit: 100 }).then((result) => setCatalogue(result.items.filter((item) => item.is_active))).catch(() => setCatalogue([])); // the form still works as plain text
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { const timer = window.setTimeout(loadProducts, 0); return () => window.clearTimeout(timer); }, [loadProducts]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(submittedSearch || product || range.from || range.to);

  const submitSearch = (event: FormEvent) => { event.preventDefault(); setPage(1); setSubmittedSearch(search.trim()); };
  const clearFilters = () => { setSearch(""); setSubmittedSearch(""); setProduct(""); setRange({ from: "", to: "" }); setPage(1); };

  const confirmDelete = async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!deleteTarget || !accessToken) return;
    setIsDeleting(true);
    setActionError("");
    try {
      await deleteSale(accessToken, deleteTarget.id);
      setDeleteTarget(null);
      if (sales.length === 1 && page > 1) setPage(page - 1); else void load();
      loadProducts();
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : "Could not delete the sale. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const saved = () => { setEditing(null); void load(); loadProducts(); };

  const rowActions = (sale: Sale) => canEdit && (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={() => setEditing(sale)} aria-label={`Edit sale of ${sale.name}`} title="Edit" className="p-2 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
      </button>
      <button type="button" onClick={() => { setActionError(""); setDeleteTarget(sale); }} aria-label={`Delete sale of ${sale.name}`} title="Delete" className="p-2 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></svg>
      </button>
    </div>
  );

  return (
    <div className="p-5 pt-20 lg:p-6 lg:pt-6 flex flex-col gap-5">
      <header className="relative overflow-hidden rounded-2xl bg-[#0a192f] text-white">
        <div className="pointer-events-none absolute -top-24 -left-16 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-xl">
            <h1 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight leading-tight">Sales</h1>
            <p className="mt-2 text-sm sm:text-[15px] text-white/65 leading-relaxed">Who bought what, and when. Kept separate from contacts.</p>
          </div>
          {canEdit && (
            <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-white text-[#0a192f] text-sm font-bold shadow-lg shadow-black/20 hover:bg-sky-50 active:scale-[.98] transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Add sale
            </button>
          )}
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <form onSubmit={submitSearch} className="flex items-center h-11 w-full lg:max-w-md rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
          <label className="sr-only" htmlFor="sale-search">Search sales</label>
          <svg className="w-4 h-4 ml-3.5 mr-2 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
          <input id="sale-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, address or product" className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
        </form>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <DateRangePicker label="Purchased" from={range.from} to={range.to} className="w-full sm:w-64" onChange={(from, to) => { setRange({ from, to }); setPage(1); }} />
          <div className="sm:w-56">
            <SelectField label="Product" value={product} options={[{ value: "", label: "All products" }, ...products.map((item) => ({ value: item, label: item }))]} onChange={(value) => { setProduct(value); setPage(1); }} />
          </div>
          {hasFilters && <button type="button" onClick={clearFilters} className="min-h-11 px-3 text-sm font-semibold text-blue-700 hover:underline">Clear filters</button>}
        </div>
      </section>

      {error ? (
        <div role="alert" className="bg-white rounded-2xl border border-rose-200 p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-3 min-h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Try again</button>
        </div>
      ) : isLoading && sales.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100" aria-busy="true" aria-label="Loading sales">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="p-4 animate-pulse flex items-center gap-4"><span className="h-3.5 w-40 rounded bg-gray-100" /><span className="h-3.5 w-24 rounded bg-gray-100" /><span className="h-3.5 w-32 rounded bg-gray-100 ml-auto" /></div>
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <p className="text-sm font-bold text-[#0a192f]">{hasFilters ? "No sales match these filters." : "No sales yet."}</p>
          {hasFilters ? <button type="button" onClick={clearFilters} className="mt-3 min-h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Clear filters</button>
            : canEdit && <button type="button" onClick={() => setEditing("new")} className="mt-3 min-h-11 px-4 rounded-xl bg-[#1d7ac4] text-sm font-bold text-white hover:opacity-90">Add the first sale</button>}
        </div>
      ) : (
        <div className={isLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <p className="mb-2 text-xs text-gray-500">{total.toLocaleString("en-IN")} sale{total === 1 ? "" : "s"}</p>
          <div className="hidden lg:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 text-[11px] font-extrabold tracking-wider uppercase border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Buyer</th>
                  <th scope="col" className="px-4 py-3.5">Phone</th>
                  <th scope="col" className="px-4 py-3.5">Product</th>
                  <th scope="col" className="px-4 py-3.5">Purchased</th>
                  <th scope="col" className="px-4 py-3.5">Address</th>
                  <th scope="col" className="px-4 py-3.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3.5 font-bold text-[#0a192f]">{sale.name}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{sale.phone ?? "—"}{sale.alt_phone && <span className="block text-xs text-gray-400">{sale.alt_phone}</span>}</td>
                    <td className="px-4 py-3.5 text-gray-600">{sale.purchased_product ?? "—"}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{formatDate(sale.purchase_date)}</td>
                    <td className="px-4 py-3.5 text-gray-500 max-w-[18rem] truncate" title={sale.address ?? undefined}>{sale.address ?? "—"}</td>
                    <td className="px-4 py-3.5">{rowActions(sale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {sales.map((sale) => (
              <article key={sale.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-bold text-[#0a192f] truncate">{sale.name}</h2>
                    <p className="text-xs text-gray-500">{formatDate(sale.purchase_date)}</p>
                  </div>
                  {rowActions(sale)}
                </div>
                {sale.purchased_product && <p className="mt-2 inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">{sale.purchased_product}</p>}
                {sale.phone && <p className="mt-2 text-sm"><a href={`tel:${sale.phone}`} className="text-blue-700 font-semibold">{sale.phone}</a>{sale.alt_phone && <span className="text-gray-400"> · {sale.alt_phone}</span>}</p>}
                {sale.address && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{sale.address}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      {!error && total > PAGE_SIZE && (
        <nav className="flex items-center justify-between gap-4" aria-label="Sales pagination">
          <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page === 1} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Previous</button>
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
          </div>
        </nav>
      )}

      {editing && <SaleFormModal sale={editing === "new" ? null : editing} products={products} catalogue={catalogue} onClose={() => setEditing(null)} onSaved={saved} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <section className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="delete-sale-title">
            <h2 id="delete-sale-title" className="text-lg font-extrabold text-[#0a192f]">Delete this sale?</h2>
            <p className="mt-2 text-sm text-gray-600">The sale of {deleteTarget.purchased_product ?? "an item"} to {deleteTarget.name} will be removed for good.</p>
            {actionError && <p role="alert" className="mt-3 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{actionError}</p>}
            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={() => void confirmDelete()} disabled={isDeleting} className="min-h-11 px-5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-60">{isDeleting ? "Deleting…" : "Delete"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
