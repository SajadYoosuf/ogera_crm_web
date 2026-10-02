"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import SaleDetailModal from "@/components/SaleDetailModal";
import SaleEditorDrawer from "@/components/SaleEditorDrawer";
import { MALAPPURAM_PANCHAYATHS } from "@/lib/panchayaths";
import {
  downloadSalesCsv, downloadSalesExcel, printSalesPdf,
  type ExportFormatMode,
} from "@/lib/salesExport";
import {
  formatCurrency, formatSaleDate, SOURCE_LABEL, WATER_LABEL,
  type Sale, type SalesResponse,
} from "@/lib/saleTypes";

interface Filters { panchayath: string; ward: string; startDate: string; endDate: string }

const blankFilters: Filters = { panchayath: "", ward: "", startDate: "", endDate: "" };

const AVATAR_COLORS = ["bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600"];
const avatarColor = (name: string) => AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];

const inputClass = "w-full h-11 px-3 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg outline-none transition-colors focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15 placeholder:text-gray-400";
const labelClass = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600";

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [metrics, setMetrics] = useState({ totalSales: 0, totalRevenue: 0, totalTanks: 0, activePanchayaths: 0 });

  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [draftFilters, setDraftFilters] = useState<Filters>(blankFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const [editor, setEditor] = useState<{ sale?: Sale } | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMode, setExportMode] = useState<ExportFormatMode>("normal");
  const [exportRange, setExportRange] = useState({ startDate: "", endDate: "" });
  const exportContainer = useRef<HTMLDivElement>(null);
  const filterContainer = useRef<HTMLDivElement>(null);

  const isFilterActive = filters.panchayath !== "" || filters.ward !== "" || filters.startDate !== "" || filters.endDate !== "";

  const buildQuery = useCallback((overrides: Record<string, string> = {}) => {
    const parameters = new URLSearchParams();
    if (submittedSearch) parameters.set("query", submittedSearch);
    if (filters.panchayath) parameters.set("panchayath", filters.panchayath);
    if (filters.ward) parameters.set("ward", filters.ward);
    if (filters.startDate) parameters.set("startDate", filters.startDate);
    if (filters.endDate) parameters.set("endDate", filters.endDate);
    for (const [key, value] of Object.entries(overrides)) {
      if (value) parameters.set(key, value); else parameters.delete(key);
    }
    return parameters;
  }, [submittedSearch, filters]);

  const loadSales = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setSales([]); setError("Sign in to load the sales ledger."); setIsLoading(false); return; }
    setIsLoading(true); setError("");
    const parameters = buildQuery({ page: String(page) });
    try {
      const response = await fetch(`/api/sales?${parameters}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json() as SalesResponse;
      if (!response.ok || !result.success || !result.data) {
        setSales([]); setTotal(0); setTotalPages(1);
        setError(result.error?.message || "Sales could not be loaded. Please try again.");
        return;
      }
      setSales(result.data.sales);
      setTotal(result.data.total);
      setTotalPages(result.data.totalPages);
      setMetrics({
        totalSales: result.data.totalSales,
        totalRevenue: result.data.totalRevenue,
        totalTanks: result.data.totalTanks,
        activePanchayaths: result.data.activePanchayaths,
      });
    } catch {
      setSales([]); setTotal(0); setTotalPages(1);
      setError("Sales could not be loaded. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSales(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSales]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (exportContainer.current && !exportContainer.current.contains(event.target as Node)) setIsExportOpen(false);
      if (filterContainer.current && !filterContainer.current.contains(event.target as Node)) setIsFilterOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedSearch(search.trim());
    setPage(1);
  };

  const applyFilters = () => { setFilters(draftFilters); setPage(1); setIsFilterOpen(false); };
  const resetFilters = () => { setDraftFilters(blankFilters); setFilters(blankFilters); setPage(1); setIsFilterOpen(false); };
  const updateDate = (field: "startDate" | "endDate", value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setDraftFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };

  async function fetchExportRows() {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) throw new Error("Sign in again before exporting.");
    const parameters = buildQuery({
      export: "true",
      ...(exportRange.startDate ? { startDate: exportRange.startDate } : {}),
      ...(exportRange.endDate ? { endDate: exportRange.endDate } : {}),
    });
    const response = await fetch(`/api/sales?${parameters}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json() as SalesResponse;
    if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message || "Export failed.");
    return result.data.sales;
  }

  async function runExport(kind: "csv" | "excel" | "pdf") {
    setIsExporting(true); setIsExportOpen(false); setActionError("");
    try {
      const rows = await fetchExportRows();
      if (rows.length === 0) { setActionError("No sales match the current filters, so nothing was exported."); return; }
      if (kind === "csv") downloadSalesCsv(rows, exportMode);
      else if (kind === "excel") downloadSalesExcel(rows, exportMode);
      else if (!printSalesPdf(rows, exportMode)) setActionError("Allow pop-ups for this site to print or save the ledger as PDF.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  async function deleteSale() {
    if (!deleteTarget) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setActionError("Sign in again before deleting this sale."); return; }
    setIsDeleting(true); setActionError("");
    try {
      const response = await fetch(`/api/sales/${deleteTarget.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json() as { success: boolean; error?: { message?: string } };
      if (!response.ok || !result.success) { setActionError(result.error?.message || "Sale could not be deleted. Please try again."); return; }
      setDeleteTarget(null);
      await loadSales();
    } catch {
      setActionError("Sale could not be deleted. Please check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  const startIndex = (page - 1) * 10;
  const metricCards = useMemo(() => ([
    { label: "Total revenue", value: formatCurrency(metrics.totalRevenue) },
    { label: "Total tanks sold", value: String(metrics.totalTanks) },
    { label: "Active panchayaths", value: String(metrics.activePanchayaths) },
  ]), [metrics]);

  const filterPanel = (
    <div className="absolute top-full right-0 mt-2 w-72 z-30 bg-white rounded-xl border border-gray-200 shadow-xl p-4 space-y-3">
      <label className={labelClass}>
        Panchayath
        <input value={draftFilters.panchayath} onChange={(event) => setDraftFilters((current) => ({ ...current, panchayath: event.target.value }))} placeholder="e.g. Parappur" list="filter-panchayath-options" className={inputClass} />
        <datalist id="filter-panchayath-options">{MALAPPURAM_PANCHAYATHS.map((name) => <option key={name} value={name} />)}</datalist>
      </label>
      <label className={labelClass}>
        Ward
        <input value={draftFilters.ward} onChange={(event) => setDraftFilters((current) => ({ ...current, ward: event.target.value }))} placeholder="e.g. Ward 4" className={inputClass} />
      </label>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={resetFilters} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Reset</button>
        <button type="button" onClick={applyFilters} className="flex-[2] px-3 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">Apply filters</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-5 pt-20 lg:p-6 lg:pt-6">
      <header className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-[22px] sm:text-[28px] font-extrabold text-[#0a192f] tracking-tight leading-tight">Sales Ledger</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and monitor sales transactions and water tank distributions.</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none" ref={exportContainer}>
            <button
              type="button"
              onClick={() => setIsExportOpen((open) => !open)}
              disabled={isExporting}
              aria-expanded={isExportOpen}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
              {isExporting ? "Exporting…" : "Export"}
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExportOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>

            {isExportOpen && (
              <div className="absolute top-full right-0 mt-2 w-72 z-30 bg-white rounded-xl border border-gray-200 shadow-xl py-2.5">
                <div className="px-4 pb-3 mb-2 border-b border-gray-100 space-y-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date range</div>
                  <label className="flex flex-col gap-1 text-[10px] font-semibold text-gray-500">
                    Start date
                    <input type="date" value={exportRange.startDate} onChange={(event) => setExportRange((current) => ({ ...current, startDate: event.target.value }))} className="w-full px-2 py-1.5 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-600" />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-semibold text-gray-500">
                    End date
                    <input type="date" value={exportRange.endDate} onChange={(event) => setExportRange((current) => ({ ...current, endDate: event.target.value }))} className="w-full px-2 py-1.5 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-600" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { const value = new Date().toISOString().split("T")[0]; setExportRange({ startDate: value, endDate: value }); }} className="flex-1 py-1.5 rounded-lg border border-blue-200 text-[10px] font-bold text-blue-600 hover:bg-blue-50 transition-colors">Today</button>
                    {(exportRange.startDate || exportRange.endDate) && (
                      <button type="button" onClick={() => setExportRange({ startDate: "", endDate: "" })} className="flex-1 py-1.5 rounded-lg border border-gray-200 text-[10px] font-bold text-gray-500 hover:bg-gray-50 transition-colors">Clear</button>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-3 mb-1.5 border-b border-gray-100 space-y-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Export format</div>
                  {([["normal", "Normal export"], ["whatsapp", "WhatsApp automation"]] as const).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2.5 text-xs font-medium text-gray-700 cursor-pointer select-none">
                      <input type="radio" name="sales-export-format" value={value} checked={exportMode === value} onChange={() => setExportMode(value)} className="w-3.5 h-3.5 accent-blue-600" />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="px-2 space-y-0.5">
                  {([
                    { kind: "csv" as const, name: "CSV", hint: exportMode === "whatsapp" ? "Name, Mobile, ORGANIC, Tags" : "Full sales ledger", tone: "bg-emerald-50 text-emerald-600" },
                    { kind: "excel" as const, name: "Excel", hint: exportMode === "whatsapp" ? "WhatsApp sheet layout" : "Full spreadsheet (.xls)", tone: "bg-green-50 text-green-700" },
                    { kind: "pdf" as const, name: "PDF", hint: "Opens print dialog — save as PDF", tone: "bg-rose-50 text-rose-600" },
                  ]).map((option) => (
                    <button key={option.kind} type="button" onClick={() => void runExport(option.kind)} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-left hover:bg-gray-50 transition-colors">
                      <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${option.tone}`}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-800">{option.name}</span>
                        <span className="text-[10px] text-gray-400">{option.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setEditor({})}
            className="hidden sm:inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:bg-blue-700 active:scale-[.98] transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add sale
          </button>
        </div>
      </header>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <form onSubmit={submitSearch} className="flex items-center h-11 w-full lg:max-w-sm rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
          <label className="sr-only" htmlFor="sales-search">Search sales</label>
          <svg className="w-4 h-4 ml-3 mr-2 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
          <input id="sales-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by buyer name, phone, or panchayath" className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
          <button type="submit" className="h-full px-4 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">Search</button>
        </form>

        <div className="flex flex-wrap items-center gap-2.5 lg:ml-auto">
          <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-500">
            From
            <input type="date" value={filters.startDate} onChange={(event) => updateDate("startDate", event.target.value)} className="h-11 px-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-600" />
          </label>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-500">
            To
            <input type="date" value={filters.endDate} onChange={(event) => updateDate("endDate", event.target.value)} className="h-11 px-2.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-600" />
          </label>

          <div className="relative" ref={filterContainer}>
            <button
              type="button"
              onClick={() => { setDraftFilters(filters); setIsFilterOpen((open) => !open); }}
              aria-expanded={isFilterOpen}
              className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-sm font-semibold transition-colors ${isFilterActive ? "border-blue-200 bg-blue-50 text-blue-600" : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" /></svg>
              Filter
            </button>
            {isFilterOpen && filterPanel}
          </div>

          {isFilterActive && (
            <button type="button" onClick={resetFilters} className="h-11 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors">Clear all</button>
          )}

          <div className="flex items-center gap-2.5 h-11 px-4 rounded-xl bg-gray-50 border border-gray-200">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total sales</span>
            <span className="text-base font-extrabold text-[#0a192f]">{metrics.totalSales}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metricCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{card.label}</div>
            <div className="text-2xl font-extrabold text-[#0a192f]">{card.value}</div>
          </div>
        ))}
      </div>

      {actionError && (
        <p role="alert" className="px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">{actionError}</p>
      )}

      {error ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold">!</span>
          <h2 className="mt-4 text-base font-bold text-[#0a192f]">Unable to load sales</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">{error}</p>
          <button type="button" onClick={() => void loadSales()} className="mt-5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-blue-600 animate-spin" />
          <h2 className="mt-4 text-base font-bold text-[#0a192f]">Loading sales</h2>
          <p className="mt-2 text-sm text-gray-500">Fetching the latest transactions from your workspace.</p>
        </div>
      ) : sales.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
          </span>
          <h2 className="mt-4 text-base font-bold text-[#0a192f]">{submittedSearch || isFilterActive ? "No sales found" : "No sales yet"}</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">
            {submittedSearch ? `We could not find any sale matching "${submittedSearch}".` : isFilterActive ? "No sale matches the current filters." : "Record your first transaction to start the ledger."}
          </p>
          {!submittedSearch && !isFilterActive && (
            <button type="button" onClick={() => setEditor({})} className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">Add your first sale</button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Buyer", "Phone", "Source of sale", "Tank", "Panchayath", "Ward", "Water source", "Value"].map((heading) => (
                      <th key={heading} className="px-5 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{heading}</th>
                    ))}
                    <th className="px-5 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((sale) => (
                    <tr key={sale.id} onClick={() => setSelectedSale(sale)} className="bg-white hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">{sale.buyerName}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{formatSaleDate(sale.saleDate)}</div>
                      </td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{sale.buyerPhone}</td>
                      <td className="px-5 py-4">
                        {sale.sourceOfSale ? (
                          <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap">{SOURCE_LABEL[sale.sourceOfSale] || sale.sourceOfSale}</span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-4 font-medium text-gray-900">{sale.tankSize || "—"}</td>
                      <td className="px-5 py-4 text-gray-600">{sale.panchayath || "—"}</td>
                      <td className="px-5 py-4 text-gray-600">{sale.ward || "—"}</td>
                      <td className="px-5 py-4 text-gray-600">
                        {sale.waterSource ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-4-7-12-7-12S5 11 5 15a7 7 0 0 0 7 7Z" /></svg>
                            {WATER_LABEL[sale.waterSource] || sale.waterSource}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(sale.totalPrice)}</td>
                      <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => { setActionError(""); setEditor({ sale }); }} className="p-1.5 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors" aria-label={`Edit sale for ${sale.buyerName}`}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          <button type="button" onClick={() => { setActionError(""); setDeleteTarget(sale); }} className="p-1.5 rounded-lg text-gray-600 hover:bg-rose-50 hover:text-rose-600 transition-colors" aria-label={`Delete sale for ${sale.buyerName}`}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {sales.map((sale) => (
              <article key={sale.id} onClick={() => setSelectedSale(sale)} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:border-blue-200 active:scale-[.99] transition-all">
                <div className="flex items-start gap-3">
                  <span className={`w-10 h-10 shrink-0 rounded-xl text-white flex items-center justify-center text-sm font-bold ${avatarColor(sale.buyerName)}`}>
                    {sale.buyerName.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#0a192f] truncate">{sale.buyerName}</span>
                      {sale.tankSize && <span className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded">{sale.tankSize}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>{sale.buyerPhone}</span>
                      {sale.panchayath && <span className="font-semibold text-blue-600">{sale.panchayath}</span>}
                      {sale.totalPrice ? <span className="font-semibold text-gray-700">{formatCurrency(sale.totalPrice)}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0" onClick={(event) => event.stopPropagation()}>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{formatSaleDate(sale.saleDate, "short")}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setActionError(""); setEditor({ sale }); }} className="p-1.5 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors" aria-label={`Edit sale for ${sale.buyerName}`}>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button type="button" onClick={() => { setActionError(""); setDeleteTarget(sale); }} className="p-1.5 rounded-lg text-gray-600 hover:bg-rose-50 hover:text-rose-600 transition-colors" aria-label={`Delete sale for ${sale.buyerName}`}>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3">
              <p className="hidden sm:block text-xs text-gray-500">
                Showing {startIndex + 1}–{Math.min(startIndex + 10, total)} of {total} records
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Previous</button>
                <span className="text-xs font-semibold text-gray-500">Page {page} of {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedSale && <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}

      {editor && (
        <SaleEditorDrawer
          sale={editor.sale}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); void loadSales(); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4 bg-slate-900/50 backdrop-blur-xs">
          <section className="w-full max-w-md bg-white rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="delete-sale-title">
            <div className="px-6 pt-6">
              <h2 id="delete-sale-title" className="text-lg font-bold text-[#0a192f]">Delete sale record?</h2>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                This permanently removes the sale for <strong className="text-gray-900">{deleteTarget.buyerName}</strong> and cannot be undone.
              </p>
              {actionError && <p role="alert" className="mt-4 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{actionError}</p>}
            </div>
            <footer className="flex justify-end gap-2.5 px-6 py-4 mt-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" disabled={isDeleting} onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
              <button type="button" disabled={isDeleting} onClick={() => void deleteSale()} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 transition-colors">{isDeleting ? "Deleting…" : "Delete sale"}</button>
            </footer>
          </section>
        </div>
      )}

      <button
        type="button"
        onClick={() => setEditor({})}
        aria-label="Add sale"
        className="sm:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all"
      >
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}
