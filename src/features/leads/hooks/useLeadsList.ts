"use client";

/**
 * useLeadsList — fetches the paginated lead list with filters and search.
 *
 * HOW IT WORKS:
 *   - Reads the JWT from sessionStorage (same pattern as contacts).
 *   - Re-fetches whenever page, filters, or search term changes.
 *   - Debounces search input by 300ms so we don't hit the API on every keystroke.
 */

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import {
  listLeads,
  type LeadListItem,
  type LeadStatus,
} from "@/lib/api/leads-module";

export const PAGE_SIZE = 20;

export type LeadFilters = {
  status: LeadStatus | "";
  source_id: number | "";
  assigned_to: string;
};

export const NO_FILTERS: LeadFilters = { status: "", source_id: "", assigned_to: "" };

export function useLeadsList() {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [filters, setFilters] = useState<LeadFilters>(NO_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Object.values(filters).some(Boolean);

  const loadLeads = useCallback(async () => {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) {
      setLeads([]);
      setTotal(0);
      setError("Sign in to load leads.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const result = await listLeads(token, {
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        status: filters.status || undefined,
        source_id: filters.source_id !== "" ? filters.source_id : undefined,
        assigned_to: filters.assigned_to ? Number(filters.assigned_to) : undefined,
        search: submittedSearch || undefined,
      });
      setLeads(result.items);
      setTotal(result.total);
    } catch (caught) {
      setLeads([]);
      setTotal(0);
      setError(caught instanceof ApiError ? caught.message : "Leads could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [page, filters, submittedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLeads(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLeads]);

  // Debounce search
  useEffect(() => {
    const term = search.trim();
    const timer = window.setTimeout(() => { setSubmittedSearch(term); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const changeFilter = (key: keyof LeadFilters, value: string | number) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => { setFilters(NO_FILTERS); setPage(1); };

  return {
    leads, total, totalPages, page, setPage,
    search, setSearch, filters, hasFilters,
    isLoading, error, loadLeads, changeFilter, clearFilters,
  };
}
