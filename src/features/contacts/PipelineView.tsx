"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { FilterOption } from "@/components/FilterSelect";
import PipelineTabBar, { type PipelineTab } from "./components/PipelineTabBar";
import PipelineBoard from "./components/PipelineBoard";
import PipelineFilterBar, { NO_PIPELINE_FILTERS, type PipelineFilterValues } from "./components/PipelineFilterBar";
import { useContactLookups } from "./hooks/useContactLookups";
import {
  listPipelineStages,
  listPipelineContacts,
  type PipelineFilters,
  type PipelineStageItem,
  type PipelineContact,
} from "./api/contacts";

const SEARCH_DELAY_MS = 300;

export default function PipelineView() {
  const { token } = useAuth();
  const { leadSources, branches, employees, canAssign } = useContactLookups();
  const [tab, setTab] = useState<PipelineTab>("consumer");
  const [filters, setFilters] = useState<PipelineFilterValues>(NO_PIPELINE_FILTERS);
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [stages, setStages] = useState<PipelineStageItem[]>([]);
  const [contacts, setContacts] = useState<PipelineContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<PipelineTab, number>>({ consumer: 0, partner: 0, dealer: 0 });
  const requestSeq = useRef(0);

  const hasFilters = Object.values(filters).some(Boolean);

  // Search waits for a short pause after typing, so the board is not reloaded on every key.
  useEffect(() => {
    const term = filters.search.trim();
    const timer = window.setTimeout(() => setSubmittedSearch(term), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const apiFilters = useMemo<PipelineFilters>(() => ({
    search: submittedSearch || undefined,
    lead_source_id: filters.source ? Number(filters.source) : undefined,
    assigned_to: filters.assignedTo ? Number(filters.assignedTo) : undefined,
    branch_id: filters.branch ? Number(filters.branch) : undefined,
    created_from: filters.from || undefined,
    created_to: filters.to || undefined,
  }), [submittedSearch, filters.source, filters.assignedTo, filters.branch, filters.from, filters.to]);

  const load = useCallback(
    async (contactType: PipelineTab) => {
      if (!token) return;
      // Only the newest request may update the board, so a slow earlier response cannot overwrite newer filters.
      const seq = ++requestSeq.current;
      setIsLoading(true);
      setError(null);
      // Settled separately: the stage columns must still show when only the contacts request fails.
      const [stagesResult, contactsResult] = await Promise.allSettled([
        listPipelineStages(token, contactType),
        listPipelineContacts(token, contactType, apiFilters),
      ]);
      if (seq !== requestSeq.current) return;
      const loadedContacts = contactsResult.status === "fulfilled" ? contactsResult.value : [];
      // Cleared on failure, so another tab's columns are never left on screen.
      setStages(stagesResult.status === "fulfilled" ? stagesResult.value : []);
      setContacts(loadedContacts);
      setCounts((prev) => ({ ...prev, [contactType]: loadedContacts.length }));
      if (stagesResult.status === "rejected") setError("Failed to load pipeline. Please try again.");
      else if (contactsResult.status === "rejected") setError("Failed to load contacts. Please try again.");
      setIsLoading(false);
    },
    [token, apiFilters],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(tab); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, tab]);

  const handleTabChange = (next: PipelineTab) => {
    setTab(next);
  };

  const sourceOptions: FilterOption[] = leadSources.map((item) => ({ value: String(item.id), label: item.name }));
  const branchOptions: FilterOption[] = branches.map((item) => ({ value: String(item.id), label: item.name }));
  const employeeOptions: FilterOption[] = employees
    .filter((employee) => employee.is_active)
    .map((employee) => ({ value: String(employee.id), label: employee.name }));

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 backdrop-blur-sm px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-[#1A1C21]">Pipeline</h1>
          <p className="mt-0.5 text-sm text-[#6B7080]">Track contacts through your sales pipeline</p>
        </div>
        <div className="w-[300px]">
          <PipelineTabBar active={tab} onChange={handleTabChange} />
        </div>
      </div>

      {/* Filter header: search, created date, lead source, branch, employee */}
      <PipelineFilterBar
        values={filters}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        onClear={() => setFilters(NO_PIPELINE_FILTERS)}
        sourceOptions={sourceOptions}
        branchOptions={branchOptions}
        employeeOptions={employeeOptions}
        canAssign={canAssign}
      />

      {/* Count row */}
      <div className="shrink-0 flex items-center gap-6 px-6 py-3 border-b border-gray-100">
        <span className="text-sm text-[#6B7080]">
          <span className="font-semibold text-[#1A1C21]">{counts[tab]}</span> contacts
        </span>
        {stages.length > 0 && (
          <span className="text-sm text-[#6B7080]">
            <span className="font-semibold text-[#1A1C21]">{stages.length}</span> stages
          </span>
        )}
        {!isLoading && !error && hasFilters && contacts.length === 0 && (
          <span className="text-sm text-[#6B7080]">No contacts match these filters.</span>
        )}
      </div>

      {/* Board area */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-3 text-[#6B7080]">
              <svg className="h-5 w-5 animate-spin text-[#0E4D3A]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
              Loading pipeline…
            </div>
          </div>
        )}

        {!isLoading && error && (
          <div role="alert" className="mb-3 flex justify-center">
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
              {error}
              <button
                type="button"
                onClick={() => load(tab)}
                className="ml-3 font-semibold underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!isLoading && stages.length > 0 && (
          <PipelineBoard
            stages={stages}
            contacts={contacts}
            onCardClick={(c) => {
              // TODO: open contact detail modal (phase 8c)
              void c;
            }}
          />
        )}

        {!isLoading && !error && stages.length === 0 && (
          <p className="py-10 text-center text-sm text-[#6B7080]">
            No stages are set up for this pipeline. An admin can add them in Settings.
          </p>
        )}
      </div>
    </div>
  );
}
