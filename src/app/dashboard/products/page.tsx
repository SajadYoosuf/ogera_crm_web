"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import FilterSelect from "@/components/FilterSelect";
import PageHeader from "@/components/products/PageHeader";
import {
  listProductOptions, listProducts,
  type ProductList, type ProductOption,
} from "@/lib/api/products";

const PAGE_SIZE = 20;
const rupees = (value: string | null) => (value === null ? "-" : `₹${Number(value).toLocaleString("en-IN")}`);
const tagIcon = <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />;

export default function ProductsPage() {
  const [data, setData] = useState<ProductList | null>(null);
  const [brands, setBrands] = useState<ProductOption[]>([]);
  const [categories, setCategories] = useState<ProductOption[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // the debounced search that is sent to the server
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    Promise.all([listProductOptions(accessToken, "brand"), listProductOptions(accessToken, "category")])
      .then(([b, c]) => { setBrands(b); setCategories(c); })
      .catch(() => { /* the filters just stay empty; the list reports its own errors */ });
  }, []);

  const load = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in to see products."); setIsLoading(false); return; }
    setIsLoading(true); setError("");
    try {
      setData(await listProducts(accessToken, {
        q: query,
        brandId: brandId ? Number(brandId) : undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Products could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [query, brandId, categoryId, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const brandOptions = useMemo(() => [{ value: "", label: "All" }, ...brands.map((b) => ({ value: String(b.id), label: b.name }))], [brands]);
  const categoryOptions = useMemo(() => [{ value: "", label: "All" }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))], [categories]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(search || query || brandId || categoryId);
  const clearFilters = () => { setSearch(""); setQuery(""); setBrandId(""); setCategoryId(""); setPage(0); };

  return (
    <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
      <PageHeader eyebrow="Product catalogue" title="Products" subtitle="Manage tank models, pricing and specifications in one place.">
        <Link href="/dashboard/products/new" className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-white text-[#0a192f] text-sm font-bold shadow-lg shadow-black/20 hover:bg-sky-50 active:scale-[.98] transition-all">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Add product
        </Link>
      </PageHeader>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex items-center h-11 w-full lg:max-w-md rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
          <label className="sr-only" htmlFor="product-search">Search products</label>
          <svg className="w-4 h-4 ml-3.5 mr-2 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
          <input id="product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, model or SKU" className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="p-2 mr-1 text-gray-400 hover:text-gray-700"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto">
          <FilterSelect label="Brand" value={brandId} onChange={(v) => { setBrandId(v); setPage(0); }} options={brandOptions} icon={tagIcon} className="w-full sm:w-52" />
          <FilterSelect label="Category" value={categoryId} onChange={(v) => { setCategoryId(v); setPage(0); }} options={categoryOptions} icon={tagIcon} className="w-full sm:w-52" />
          {hasFilters && <button type="button" onClick={clearFilters} className="min-h-11 px-3 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">Clear filters</button>}
        </div>
      </section>

      {total > 0 && !error && !isLoading && (
        <div className="flex justify-between px-1 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{total} product{total === 1 ? "" : "s"}</span>
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</span>
        </div>
      )}

      {error ? (
        <div role="status" className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold">!</span>
          <h2 className="mt-5 text-lg font-extrabold text-[#0a192f] tracking-tight">Unable to load products</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-6 inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Try again</button>
        </div>
      ) : isLoading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true" aria-label="Loading products">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 animate-pulse flex gap-4">
              <span className="w-20 h-20 rounded-xl bg-gray-200" />
              <div className="flex-1 space-y-2.5"><div className="h-3.5 w-2/3 rounded bg-gray-200" /><div className="h-3 w-1/2 rounded bg-gray-100" /><div className="h-3 w-1/3 rounded bg-gray-100" /></div>
            </div>
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <div role="status" className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>
          </span>
          <h2 className="mt-5 text-lg font-extrabold text-[#0a192f] tracking-tight">{hasFilters ? "No matches found" : "No products yet"}</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">{hasFilters ? "Try a different search term or filter." : "Add your first product to start the catalogue."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {hasFilters
              ? <button type="button" onClick={clearFilters} className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Clear filters</button>
              : <Link href="/dashboard/products/new" className="inline-flex items-center justify-center min-h-11 px-5 rounded-xl bg-gradient-to-br from-[#1d7ac4] to-[#1462a0] text-white text-sm font-bold shadow-md shadow-blue-600/25 hover:opacity-90 transition-all">Add your first product</Link>}
          </div>
        </div>
      ) : (
        <ul className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isLoading ? "opacity-60" : ""}`}>
          {data?.items.map((product) => (
            <li key={product.id}>
              <Link href={`/dashboard/products/${product.id}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex gap-4 transition-colors hover:border-blue-300">
                {product.main_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- an admin-pasted URL can be any host
                  <img src={product.main_image_url} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-gray-100 object-contain" />
                ) : (
                  <span className="h-20 w-20 shrink-0 rounded-xl bg-gray-100" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-[#0a192f]">{product.name}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {[product.brand?.name, product.category?.name, product.capacity_display].filter(Boolean).join(" · ") || "No details yet"}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-extrabold text-gray-900">{rupees(product.sale_price ?? product.mrp)}</span>
                    {product.sale_price !== null && product.mrp !== null && product.sale_price !== product.mrp && (
                      <span className="text-xs text-gray-400 line-through">{rupees(product.mrp)}</span>
                    )}
                    {product.is_popular && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Popular</span>}
                    {!product.is_active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">Inactive</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && !error && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">Previous</button>
          <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
          <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
        </nav>
      )}
    </div>
  );
}
