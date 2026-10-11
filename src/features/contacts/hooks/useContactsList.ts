"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import { trace } from "@/lib/api/devlog";
import { listContacts, type ApiContactType, type ContactSort } from "@/features/contacts/api/contacts";
import { NO_FILTERS, PAGE_SIZE, fromApi, type Contact, type Filters } from "@/features/contacts/utils";

/** The contacts list: paging, search-as-you-type and filters, loaded from the API. */
export function useContactsList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<ContactSort>("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // Tab counts: totals for each contact type, unaffected by search and filters.
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const hasFilters = Object.values(filters).some(Boolean);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadContacts = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    trace("log", "[contacts page] load triggered", { page, filters, search: submittedSearch, hasToken: !!accessToken });
    if (!accessToken) { setContacts([]); setTotal(0); setError("Sign in to load your contacts."); setIsLoading(false); return; }
    setIsLoading(true); setError("");
    try {
      const result = await listContacts(accessToken, { skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, sort, contact_type: (filters.type || undefined) as ApiContactType | undefined,
        profession_type: filters.type === "partner" ? filters.profession || undefined : undefined,
        lead_source_id: filters.source ? Number(filters.source) : undefined,
        district: filters.district || undefined,
        assigned_to: filters.assignedTo ? Number(filters.assignedTo) : undefined,
        created_by: filters.createdBy ? Number(filters.createdBy) : undefined,
        verified: filters.verified ? filters.verified === "verified" : undefined,
        search: submittedSearch || undefined,
      });
      setContacts(result.items.map(fromApi)); setTotal(result.total);
      const [all, consumer, partner] = await Promise.all([
        listContacts(accessToken, { limit: 1 }),
        listContacts(accessToken, { limit: 1, contact_type: "consumer" }),
        listContacts(accessToken, { limit: 1, contact_type: "partner" }),
      ]);
      setTypeCounts({ "": all.total, consumer: consumer.total, partner: partner.total });
    } catch (caught) {
      setContacts([]); setTotal(0);
      setError(caught instanceof ApiError ? caught.message : "Contacts could not be loaded. Please try again.");
    } finally { setIsLoading(false); }
  }, [page, filters, submittedSearch, sort]);

  useEffect(() => { const timer = window.setTimeout(() => { void loadContacts(); }, 0); return () => window.clearTimeout(timer); }, [loadContacts]);

  // Search as you type: wait for a short pause, then query the API from the first page.
  useEffect(() => {
    const term = search.trim();
    const timer = window.setTimeout(() => { setSubmittedSearch(term); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const changeFilter = (key: string, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  // Partner type only applies to partners, so switching the contact type resets it.
  const changeType = (value: string) => { setFilters((current) => ({ ...current, type: value, profession: "" })); setPage(1); };
  const changeSort = (value: ContactSort) => { setSort(value); setPage(1); };
  const clearFilters = () => { setFilters(NO_FILTERS); setPage(1); };
  const clearSearchAndFilters = () => { setSearch(""); setSubmittedSearch(""); clearFilters(); };

  return {
    contacts, total, totalPages, typeCounts, page, setPage, search, setSearch, submittedSearch, filters, hasFilters, sort,
    isLoading, error, loadContacts, changeFilter, changeType, changeSort, clearFilters, clearSearchAndFilters,
  };
}
