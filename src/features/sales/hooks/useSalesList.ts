"use client";

/**
 * useSalesList — all state for the Sales page list.
 *
 * WHY this hook exists:
 *   The sales page had ~150 lines of useState/useEffect/callbacks inline.
 *   Extracting them here keeps the page file as pure UI, and makes the
 *   data logic reusable and testable on its own.
 *
 * WHAT it manages:
 *   - Paginated list with search and employee filter
 *   - Race-condition safety (ignores stale responses)
 *   - Retry on reconnect
 *   - CSV export
 *   - Employee dropdown and product name list for the form
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import { listAllEmployees, type Employee } from "@/lib/api/employees";
import { listProducts } from "@/lib/api/products";
import { downloadCsv } from "@/lib/shared/csv";
import { todayIso } from "@/lib/shared/format";
import { listSales, type Sale } from "../api/sales";

const PAGE_SIZE = 8;
const EXPORT_PAGE_SIZE = 100;

export function useSalesList() {
  const { token, user } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState<number | "">("");
  const [productNames, setProductNames] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<ApiError["kind"] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const latestRequest = useRef(0);

  // Debounce search: wait 300ms after typing stops, then reset to page 1.
  useEffect(() => {
    const timer = window.setTimeout(() => { setSubmittedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const changeEmployeeFilter = (value: string) => { setEmployeeFilter(value === "" ? "" : Number(value)); setPage(1); };

  // Load one page of sales whenever page, search, filter, or reloadKey changes.
  const load = useCallback(() => {
    if (!token) { setError("Sign in to see the sales."); setIsLoading(false); return; }
    const requestId = ++latestRequest.current;
    setIsLoading(true); setError(""); setErrorKind(null);
    listSales(token, { search: submittedSearch || undefined, skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, employee_id: employeeFilter !== "" ? employeeFilter : undefined })
      .then((result) => {
        if (requestId !== latestRequest.current) return;
        setSales(result.items); setTotal(result.total);
      })
      .catch((caught) => {
        if (requestId !== latestRequest.current) return;
        const err = caught instanceof ApiError ? caught : null;
        setErrorKind(err?.kind ?? "unknown");
        setError(err?.message ?? "Could not load the sales. Please try again.");
      })
      .finally(() => { if (requestId === latestRequest.current) setIsLoading(false); });
  }, [page, submittedSearch, employeeFilter, token]);

  useEffect(() => { const t = window.setTimeout(load, 0); return () => window.clearTimeout(t); }, [load, reloadKey]);

  // Reload automatically once the browser comes back online.
  useEffect(() => {
    const onOnline = () => setReloadKey((k) => k + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Load employees and product names for the form dropdowns.
  useEffect(() => {
    if (!token) { setEmployeesLoading(false); return; }
    setEmployeesLoading(true); setEmployeesError("");
    listAllEmployees(token)
      .then((r) => setEmployees(r.employees))
      .catch(() => setEmployeesError("Employee list could not be loaded."))
      .finally(() => setEmployeesLoading(false));
  }, [token, reloadKey]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const run = async () => {
      const names: string[] = [];
      let skip = 0, totalItems = Infinity;
      while (skip < totalItems) {
        const result = await listProducts(token, { skip, limit: 100 });
        names.push(...result.items.map((p) => p.name));
        totalItems = result.total;
        if (result.items.length === 0) break;
        skip += result.items.length;
      }
      if (!cancelled) setProductNames(names);
    };
    run().catch(() => { if (!cancelled) setProductNames([]); });
    return () => { cancelled = true; };
  }, [token, reloadKey]);

  const exportCsv = async () => {
    if (!token) return;
    setIsExporting(true); setError(""); setErrorKind(null);
    try {
      const rows: Sale[] = [];
      for (let skip = 0; ; skip += EXPORT_PAGE_SIZE) {
        const result = await listSales(token, { search: submittedSearch || undefined, skip, limit: EXPORT_PAGE_SIZE, employee_id: employeeFilter !== "" ? employeeFilter : undefined });
        rows.push(...result.items);
        if (result.items.length === 0 || rows.length >= result.total) break;
      }
      downloadCsv(
        `sales-${todayIso()}.csv`,
        ["Customer", "Phone", "Alternate phone", "Address", "Product purchased", "Purchase date", "Created by", "Branch"],
        rows.map((r) => [r.name, r.phone, r.alt_phone, r.address, r.purchased_product, r.purchase_date, r.created_by?.name ?? null, r.created_by?.branch ?? null]),
      );
    } catch (caught) {
      const err = caught instanceof ApiError ? caught : null;
      setErrorKind(err?.kind ?? "unknown");
      setError(err?.message ?? "Could not export the sales. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const reload = () => setReloadKey((k) => k + 1);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentEmployeeId = user?.id ?? null;

  return {
    sales, total, pages, page, setPage,
    search, setSearch,
    employeeFilter, changeEmployeeFilter,
    productNames, employees, currentEmployeeId,
    employeesLoading, employeesError,
    isLoading, isExporting, error, errorKind,
    reload, exportCsv,
    PAGE_SIZE,
  };
}
