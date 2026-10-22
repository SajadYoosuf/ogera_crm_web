"use client";

import { useEffect, useRef, useState } from "react";
import ProductModal from "@/components/products/ProductModal";
import { ApiError } from "@/lib/api/auth";
import {
  listProductOptions,
  listProducts,
  type OptionKind,
  type ProductListItem,
  type ProductOption,
} from "@/lib/api/products";
import { dmSans, sora } from "@/lib/auth-fonts";

const PAGE_SIZE = 8;
const ACCENT = "#0E4D3A";

type StatusFilter = "all" | "active" | "archived";
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const rupees = (value: string | null) =>
  value === null ? "—" : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Page numbers to show: the first pages, the current one, and the last one, with gaps marked. */
function pageItems(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "…", pages];
  if (page >= pages - 3) return [1, "…", pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, "…", page - 1, page, page + 1, "…", pages];
}

const optionButtonClass = (selected: boolean) =>
  `w-full rounded-md px-2.5 py-1.5 text-left text-[13px] ${selected ? "bg-[#E7F5EE] font-semibold text-[#0E4D3A]" : "text-[#3A3E4A] hover:bg-[#F7F8F9]"}`;

export default function ProductsPage() {
  const [rows, setRows] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [materialId, setMaterialId] = useState<number | null>(null);
  const [options, setOptions] = useState<Record<OptionKind, ProductOption[]>>({ brand: [], category: [], material: [] });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const filterRef = useRef<HTMLDivElement>(null);


  // Search waits for a short pause in typing, then goes back to the first page.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSubmittedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Any filter change starts again from the first page.
  useEffect(() => {
    const timer = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [status, categoryId, brandId, materialId]);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) return;
    Promise.all([
      listProductOptions(accessToken, "brand"),
      listProductOptions(accessToken, "category"),
      listProductOptions(accessToken, "material"),
    ])
      .then(([brand, category, material]) => setOptions({ brand, category, material }))
      .catch(() => setOptions({ brand: [], category: [], material: [] }));
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const accessToken = sessionStorage.getItem("ogera_access_token");
      if (!accessToken) { setError("Sign in to see the products."); setIsLoading(false); return; }
      setIsLoading(true);
      setError("");
      listProducts(accessToken, {
        q: submittedSearch || undefined,
        isActive: status === "all" ? undefined : status === "active",
        categoryId: categoryId ?? undefined,
        brandId: brandId ?? undefined,
        materialId: materialId ?? undefined,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
        .then((result) => {
          if (cancelled) return;
          setRows(result.items);
          setTotal(result.total);
        })
        .catch((caught) => {
          if (cancelled) return;
          setRows([]);
          setTotal(0);
          setError(caught instanceof ApiError ? caught.message : "Could not load the products. Please try again.");
        })
        .finally(() => { if (!cancelled) setIsLoading(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [page, submittedSearch, status, categoryId, brandId, materialId, reloadKey]);

  // Close the filter menu on a click outside it or on Escape.
  useEffect(() => {
    if (!isFilterOpen) return;
    const onPointer = (event: MouseEvent) => { if (!filterRef.current?.contains(event.target as Node)) setIsFilterOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setIsFilterOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [isFilterOpen]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const filterCount = (status !== "all" ? 1 : 0) + [categoryId, brandId, materialId].filter((id) => id !== null).length;
  const filtersActive = filterCount > 0 || submittedSearch !== "";

  const clearFilters = () => {
    setStatus("all");
    setCategoryId(null);
    setBrandId(null);
    setMaterialId(null);
  };

  const closeModal = () => setEditing(null);
  const saved = () => {
    setEditing(null);
    setReloadKey((key) => key + 1);
  };

  const filterGroups: { title: string; value: number | null; onPick: (id: number | null) => void; items: ProductOption[] }[] = [
    { title: "Category", value: categoryId, onPick: setCategoryId, items: options.category },
    { title: "Brand", value: brandId, onPick: setBrandId, items: options.brand },
    { title: "Material", value: materialId, onPick: setMaterialId, items: options.material },
  ];

  return (
    <div className={`${dmSans.variable} ${sora.variable} flex min-h-full flex-col font-[family-name:var(--font-dm-sans)] text-[#1A1C21]`}>
      <header className="flex h-[72px] shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EA] bg-white px-7">
        <h1 className="whitespace-nowrap font-[family-name:var(--font-sora)] text-xl font-bold tracking-[-0.01em] text-[#1A1C21]">Products</h1>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white hover:opacity-90"
          style={{ background: ACCENT }}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add New Product
        </button>
      </header>

      <div className="flex flex-col gap-3.5 px-7 pb-6 pt-[22px]">
        <p className="text-[13.5px] leading-normal text-[#6B7080]">Every tank in your catalogue — pricing, specs and images in one place. Click a row to view, edit or archive it.</p>

        <section aria-label="Products list" className="flex flex-col overflow-hidden rounded-[18px] border border-[#E5E7EA] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFEFF2] p-4">
            <label className="relative flex min-w-[220px] max-w-[360px] flex-1 items-center">
              <span className="sr-only">Search products</span>
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A8F9C" strokeWidth="1.8" strokeLinecap="round" className="absolute left-3">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search by name, model or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-[38px] w-full rounded-[8px] border border-[#DEE1E5] bg-[#F7F8F9] py-0 pl-[34px] pr-3 text-[13.5px] text-[#1A1C21] outline-none focus:border-[#0E4D3A]"
              />
            </label>

            <div ref={filterRef} className="relative">
              <button
                type="button"
                onClick={() => setIsFilterOpen((open) => !open)}
                aria-expanded={isFilterOpen}
                className={`flex h-[38px] items-center gap-1.5 rounded-[8px] border px-3 text-sm font-medium hover:bg-[#F7F8F9] ${filterCount > 0 ? "border-[#0E4D3A] text-[#0E4D3A]" : "border-[#DEE1E5] bg-white text-[#3A3E4A]"}`}
              >
                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" /></svg>
                Filter
                {filterCount > 0 && (
                  <span aria-hidden="true" className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white" style={{ background: ACCENT }}>{filterCount}</span>
                )}
              </button>
              {isFilterOpen && (
                <div className="absolute right-0 top-11 z-[6] flex max-h-[420px] w-[min(260px,calc(100vw-48px))] flex-col gap-2.5 overflow-y-auto rounded-[10px] border border-[#DEE1E5] bg-white p-2.5 shadow-[0_12px_28px_rgba(16,24,40,0.16)]">
                  <div className="flex flex-col gap-0.5">
                    <span className="px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.02em] text-[#9AA0AC]">Status</span>
                    {STATUS_OPTIONS.map((option) => (
                      <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={optionButtonClass(status === option.value)}>{option.label}</button>
                    ))}
                  </div>
                  {filterGroups.map((group) => (
                    <div key={group.title} className="flex flex-col gap-0.5 border-t border-[#EFEFF2] pt-2.5">
                      <span className="px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.02em] text-[#9AA0AC]">{group.title}</span>
                      <button type="button" onClick={() => group.onPick(null)} className={optionButtonClass(group.value === null)}>All</button>
                      {group.items.map((item) => (
                        <button key={item.id} type="button" onClick={() => group.onPick(item.id)} className={optionButtonClass(group.value === item.id)}>{item.name}</button>
                      ))}
                    </div>
                  ))}
                  {filtersActive && (
                    <button type="button" onClick={() => { clearFilters(); setSearch(""); }} className="self-end px-1 py-0.5 text-xs font-semibold text-[#8A8F9C] hover:text-[#3A3E4A]">Clear filters</button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#F7F7F9] text-left text-[13px] text-[#4B5060]">
                  <th scope="col" className="px-4 py-3 font-medium">Product</th>
                  <th scope="col" className="px-3 py-3 font-medium">Category</th>
                  <th scope="col" className="px-3 py-3 font-medium">Brand</th>
                  <th scope="col" className="px-3 py-3 font-medium">Price</th>
                  <th scope="col" className="px-3 py-3 font-medium">Orientation</th>
                  <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const onSale = product.special_price_active && product.sale_price !== null;
                  return (
                    <tr key={product.id} onClick={() => setEditing(product.id)} className="cursor-pointer border-t border-[#EFEFF2] hover:bg-[#FAFAFB]">
                      <td className="h-[60px] px-4">
                        <div className="flex items-center gap-2.5">
                          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#EAF2FE]">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1565D8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10v4a2 2 0 0 1-1 1.7V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8.7A2 2 0 0 1 7 7z" /></svg>
                          </span>
                          <div className="min-w-0">
                            <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(product.id); }} className="block max-w-[240px] truncate text-left text-[13.5px] font-semibold text-[#1A1C21] hover:underline">{product.name}</button>
                            <p className="mt-px max-w-[240px] truncate text-[11px] text-[#9AA0AC]">{product.tagline ?? ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 text-[#3A3E4A]">{product.category?.name ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 text-[#3A3E4A]">{product.brand?.name ?? "—"}</td>
                      <td className="whitespace-nowrap px-3">
                        {onSale ? (
                          <>
                            <span className="font-bold text-[#1A1C21]">{rupees(product.sale_price)}</span>
                            <span className="ml-1.5 text-xs text-[#9AA0AC] line-through">{rupees(product.mrp)}</span>
                          </>
                        ) : (
                          <span className="font-bold text-[#1A1C21]">{rupees(product.mrp)}</span>
                        )}
                      </td>
                      <td className="px-3">
                        {product.orientation ? (
                          <span className="rounded-md bg-[#F1F3F6] px-2 py-0.5 text-xs font-medium capitalize text-[#4B5060]">{product.orientation}</span>
                        ) : <span className="text-[#9AA0AC]">—</span>}
                      </td>
                      <td className="px-3">
                        {product.is_active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F5EE] px-2.5 py-0.5 text-xs font-semibold text-[#0E4D3A]">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#0E4D3A]" />Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F3F6] px-2.5 py-0.5 text-xs font-semibold text-[#6B7080]">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#9AA0AC]" />Archived
                          </span>
                        )}
                      </td>
                      <td className="px-4 text-center">
                        <button
                          type="button"
                          aria-label={`Open ${product.name}`}
                          onClick={(e) => { e.stopPropagation(); setEditing(product.id); }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#1A1C21] hover:bg-[#F1F3F6]"
                        >
                          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!isLoading && !error && rows.length === 0 && (
              <p className="m-0 px-4 py-10 text-center text-sm text-[#6B7080]">
                {filtersActive ? "No products match your filters." : "No products yet. Add the first one to start the catalogue."}
              </p>
            )}
            {isLoading && <p className="m-0 px-4 py-10 text-center text-sm text-[#6B7080]">Loading products…</p>}
            {error && <p role="alert" className="m-0 px-4 py-10 text-center text-sm text-[#B42318]">{error}</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEFF2] px-4 py-3.5">
            <p className="m-0 text-sm text-[#3A3E4A]">
              {total === 0 ? "No products to show" : `Showing ${from} to ${to} of ${total} products`}
            </p>
            <nav aria-label="Pages" className="flex flex-wrap items-center gap-1.5">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#DEE1E5] bg-white px-3 text-[13px] font-medium text-[#3A3E4A] hover:bg-[#F7F8F9] disabled:opacity-40">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                Previous
              </button>
              {pageItems(page, pages).map((item, index) =>
                item === "…" ? (
                  <span key={`gap-${index}`} className="px-1 text-[#9AA0AC]">…</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    aria-current={item === page ? "page" : undefined}
                    onClick={() => setPage(item)}
                    className={`h-9 w-9 rounded-lg text-[13px] ${item === page ? "font-semibold text-white" : "text-[#4B5060] hover:bg-[#F1F3F6]"}`}
                    style={item === page ? { background: ACCENT } : undefined}
                  >
                    {item}
                  </button>
                ),
              )}
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40" style={{ background: ACCENT }}>
                Next
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </nav>
          </div>
        </section>
      </div>

      {editing !== null && (
        <ProductModal
          productId={editing === "new" ? null : editing}
          onClose={closeModal}
          onChanged={saved}
        />
      )}
    </div>
  );
}
