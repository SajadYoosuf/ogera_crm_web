"use client";

/**
 * LeadsView — the main client component for the /leads route.
 *
 * WHAT IT SHOWS:
 *   - A filter bar: status tabs, source dropdown, search box
 *   - A table of lead rows with score, age indicator, WhatsApp tick, convert button
 *   - A slide-over LeadDrawer for detail + edit
 *   - A ConvertLeadModal for the conversion flow
 *   - A "New Lead" button that opens the editor
 *
 * DATA FLOW:
 *   useLeadsList() — paginated list from GET /leads
 *   useLeadEditor() — create/edit form state → POST or PUT /leads
 *   useLeadConvert() — confirmation modal → POST /leads/{id}/convert
 */

import { useState } from "react";
import { useLeadsList, type LeadFilters } from "@/features/leads/hooks/useLeadsList";
import { useLeadEditor } from "@/features/leads/hooks/useLeadEditor";
import { useLeadConvert } from "@/features/leads/hooks/useLeadConvert";
import LeadDrawer from "@/features/leads/components/LeadDrawer";
import ConvertLeadModal from "@/features/leads/components/ConvertLeadModal";
import LeadStatusPill from "@/features/leads/components/LeadStatusPill";
import LeadSourceBadge from "@/features/leads/components/LeadSourceBadge";
import LeadScoreBar from "@/features/leads/components/LeadScoreBar";
import LeadAgeIndicator from "@/features/leads/components/LeadAgeIndicator";
import LeadForm from "@/features/leads/components/LeadForm";
import type { LeadStatus } from "@/lib/api/leads-module";

const STATUS_TABS: { value: LeadStatus | ""; label: string }[] = [
  { value: "",          label: "All" },
  { value: "new",       label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "lost",      label: "Lost" },
];

const SOURCE_OPTIONS: { value: number | ""; label: string }[] = [
  { value: "",  label: "All sources" },
  { value: 1,   label: "Walk-in" },
  { value: 2,   label: "Referral" },
  { value: 3,   label: "Meta Ads" },
  { value: 4,   label: "Website" },
  { value: 5,   label: "WhatsApp" },
  { value: 6,   label: "JustDial" },
  { value: 7,   label: "GMB" },
  { value: 8,   label: "Field Visit" },
];

export default function LeadsView() {
  const list = useLeadsList();
  const [openLeadId, setOpenLeadId] = useState<number | null>(null);

  // Create modal (separate from drawer editing)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const editor = useLeadEditor(() => {
    setIsCreateOpen(false);
    void list.loadLeads();
  });

  const converter = useLeadConvert(() => {
    void list.loadLeads();
  });

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0a192f]">Leads</h1>
          <p className="mt-0.5 text-sm text-[#64748b]">{list.total} total</p>
        </div>
        <button
          onClick={() => { setIsCreateOpen(true); editor.open(); }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0E4D3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3a2b] transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Lead
        </button>
      </div>

      {/* Filters */}
      <div className="shrink-0 space-y-3 border-b border-gray-200 bg-[#f8fafc] px-6 py-3">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => list.changeFilter("status", tab.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                list.filters.status === tab.value
                  ? "bg-[#0E4D3A] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Source filter + search */}
        <div className="flex flex-wrap gap-2">
          <label htmlFor="leads-source-filter" className="sr-only">Filter by source</label>
          <select
            id="leads-source-filter"
            value={list.filters.source_id}
            onChange={(e) => list.changeFilter("source_id", e.target.value ? Number(e.target.value) : "")}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <label htmlFor="leads-search" className="sr-only">Search leads</label>
            <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              id="leads-search"
              type="search"
              placeholder="Search by name, phone, email…"
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {list.hasFilters && (
            <button
              onClick={list.clearFilters}
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {list.isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">Loading…</div>
        ) : list.error ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{list.error}</div>
        ) : list.leads.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            {list.hasFilters || list.search ? "No leads match the current filters." : "No leads yet. Create the first one."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-[#f8fafc] text-left">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Name</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] hidden sm:table-cell">Source</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Status</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] hidden md:table-cell">Score</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] hidden md:table-cell">Age</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] hidden lg:table-cell">Assigned</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {list.leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 focus-visible:outline-offset-[-2px]"
                    onClick={() => setOpenLeadId(lead.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenLeadId(lead.id); } }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View lead ${`${lead.first_name ?? ""}${lead.last_name ? " " + lead.last_name : ""}`.trim() || "unnamed"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0a192f]">
                        {`${lead.first_name ?? ""}${lead.last_name ? " " + lead.last_name : ""}`.trim() || "—"}
                      </div>
                      {lead.phone && (
                        <div className="mt-0.5 text-xs text-[#64748b]">{lead.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <LeadSourceBadge sourceName={lead.source_name ?? null} />
                    </td>
                    <td className="px-4 py-3">
                      <LeadStatusPill status={lead.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <LeadScoreBar score={lead.score} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <LeadAgeIndicator createdAt={lead.created_at} status={lead.status} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-[#64748b]">
                      {lead.assigned_name ?? "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {lead.whatsapp_sent ? (
                          <span title="WhatsApp sent" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="m5 12 5 5L20 7" />
                            </svg>
                          </span>
                        ) : null}
                        {lead.status !== "converted" && lead.status !== "lost" && (
                          <button
                            onClick={() => converter.openModal(lead.id)}
                            className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors"
                          >
                            Convert
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {list.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-gray-500">Page {list.page} of {list.totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => list.setPage(list.page - 1)}
                disabled={list.page === 1}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => list.setPage(list.page + 1)}
                disabled={list.page === list.totalPages}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lead detail drawer */}
      <LeadDrawer
        leadId={openLeadId}
        onClose={() => setOpenLeadId(null)}
        onConverted={(id) => { setOpenLeadId(null); converter.openModal(id); }}
        onDeleted={() => { void list.loadLeads(); }}
        onSaved={() => { void list.loadLeads(); }}
      />

      {/* Convert modal */}
      <ConvertLeadModal converter={converter} />

      {/* Create lead modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New Lead</h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <LeadForm form={editor.form} isEdit={false} setField={editor.setField} />
            {editor.saveError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editor.saveError}</p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => void editor.submit()}
                disabled={editor.isSaving || !editor.form.first_name}
                className="flex-1 rounded-xl bg-[#0E4D3A] py-2.5 text-sm font-semibold text-white hover:bg-[#0a3a2b] disabled:opacity-50 transition-colors"
              >
                {editor.isSaving ? "Saving…" : "Create Lead"}
              </button>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
