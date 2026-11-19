"use client";

/**
 * useProductsList — all state for the Products page list.
 *
 * WHY this hook exists:
 *   The products page had all useState/useEffect logic inline and read the
 *   JWT directly from sessionStorage. Extracting state here makes the page
 *   pure UI and replaces all direct sessionStorage reads with useAuth().
 *
 * WHAT it manages:
 *   - Paginated list with debounced search, status filter and material filter
 *   - Material options for the filter panel
 *   - Modal open/close (editing state)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import { listProductOptions, listProducts, type ProductListItem, type ProductOption } from "../api/products";

export const PAGE_SIZE = 8;

export type StatusFilter = "all" | "active" | "archived";

export function useProductsList() {
  const { token } = useAuth();

  const [rows, setRows] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [materialId, setMaterialId] = useState<number | null>(null);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const latestRequest = useRef(0);

  // Debounce search: wait 300ms after typing stops, then reset to page 1.
  useEffect(() => {
    const timer = window.setTimeout(() => { setSubmittedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Any filter change resets to page 1.
  useEffect(() => {
    const timer = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [status, materialId]);

  // Load material options for the filter panel.
  useEffect(() => {
    if (!token) return;
    listProductOptions(token, "material")
      .then(setOptions)
      .catch(() => setOptions([]));
  }, [token, reloadKey]);

  // Load one page whenever page, search, filters, or reloadKey changes.
  const load = useCallback(() => {
    if (!token) { setError("Sign in to see the products."); setIsLoading(false); return; }
    const requestId = ++latestRequest.current;
    setIsLoading(true); setError("");
    listProducts(token, {
      q: submittedSearch || undefined,
      isActive: status === "all" ? undefined : status === "active",
      materialId: materialId ?? undefined,
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (requestId !== latestRequest.current) return;
        setRows(result.items); setTotal(result.total);
      })
      .catch((caught) => {
        if (requestId !== latestRequest.current) return;
        setRows([]); setTotal(0);
        setError(caught instanceof ApiError ? caught.message : "Could not load the products. Please try again.");
      })
      .finally(() => { if (requestId === latestRequest.current) setIsLoading(false); });
  }, [page, submittedSearch, status, materialId, token]);

  useEffect(() => { const t = window.setTimeout(load, 0); return () => window.clearTimeout(t); }, [load, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterCount = (status !== "all" ? 1 : 0) + (materialId !== null ? 1 : 0);
  const filtersActive = filterCount > 0 || submittedSearch !== "";

  const clearFilters = () => { setStatus("all"); setMaterialId(null); };

  return {
    rows, total, pages, page, setPage,
    search, setSearch,
    submittedSearch,
    status, setStatus,
    materialId, setMaterialId,
    options,
    isLoading, error,
    filterCount, filtersActive,
    clearFilters,
    reload,
    PAGE_SIZE,
  };
}
