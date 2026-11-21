"use client";

/**
 * LeadsView — the main client component for the /leads route.
 *
 * Styling matches the Contacts screen (same header, card and table language):
 * white sticky header, rounded-14px card, #F7F7F9 table head, sticky Action
 * column. The lead detail view is a single centered modal (LeadModal) that is
 * always editable — no separate side-drawer or read-only step.
 *
 * DATA FLOW:
 *   useLeadsList()     — paginated list from GET /leads
 *   useLeadConvert()   — confirmation modal → POST /leads/{id}/convert
 *   updateLead()       — inline status and assignee changes in table rows
 *   listEmployees()    — fetched once on mount for assignee dropdowns
 *   listLeadStatuses() — fetched once on mount; the status dropdown's only source of truth
 *   listBranches()     — fetched once on mount; shared with the Contacts branch dropdown
 *   listLeadSources()  — fetched once on mount; shared with the Contacts source dropdown
 *                        (same GET /lead-sources endpoint — nothing here is hardcoded)
 */

import { useState, useEffect, useRef } from "react";
import { useLeadsList, type LeadFilters } from "@/features/leads/hooks/useLeadsList";
import { useLeadConvert } from "@/features/leads/hooks/useLeadConvert";
import LeadModal from "@/features/leads/components/LeadModal";
import ConvertLeadModal from "@/features/leads/components/ConvertLeadModal";
import LeadScoreBar from "@/features/leads/components/LeadScoreBar";
import LeadStatusSelect from "@/features/leads/components/LeadStatusSelect";
import BulkAssignModal from "@/features/leads/components/BulkAssignModal";
import LeadsFilterMenu from "@/features/leads/components/LeadsFilterMenu";
import LeadsMoreMenu from "@/features/leads/components/LeadsMoreMenu";
import LeadImportModal from "@/features/leads/components/LeadImportModal";
import LeadExportModal from "@/features/leads/components/LeadExportModal";
import FilterSelect from "@/components/FilterSelect";
import DateRangePicker from "@/components/DateRangePicker";
import type { FilterGroup } from "@/components/FilterPanel";
import { updateLead, deleteLead, listLeadStatuses, type LeadStatus, type LeadStatusOption } from "@/lib/api/leads-module";
import LeadActionMenu from "@/features/leads/components/LeadActionMenu";
import LeadActivityLogModal from "@/features/leads/components/LeadActivityLogModal";
import LeadFollowupModal from "@/features/leads/components/LeadFollowupModal";
import LeadDetailModal from "@/features/leads/components/LeadDetailModal";
import { listEmployees, type Employee } from "@/lib/api/employees";
import { listBranches, listLeadSources, type BranchOption, type LeadSource } from "@/features/contacts/api/contacts";

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Format an ISO date string as a human-readable date, e.g. "15 Nov 2026".
 * WHY THE 'Z' APPEND: The backend returns naive datetime strings without a
 * timezone suffix. Without 'Z', JS treats the string as LOCAL time not UTC.
 */
function formatCreatedAt(iso: string): string {
  const utc = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  const d = new Date(utc);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Returns urgency CSS class for new leads that have been waiting too long.
 *   > 48h → red     (critical — lead going cold)
 *   > 24h → amber   (warning — needs attention)
 *   else  → muted
 */
function createdAtClass(iso: string, status: LeadStatus): string {
  if (status !== "new") return "text-[#6B7080]";
  const utc = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  const ageHrs = (Date.now() - new Date(utc).getTime()) / 3_600_000;
  if (ageHrs > 48) return "text-red-500 font-semibold";
  if (ageHrs > 24) return "text-amber-500 font-medium";
  return "text-[#6B7080]";
}

// ── WhatsApp cell: phone number + sent/not-sent icon (not a full text requirement) ──

function WhatsAppCell({ phone, sent }: { phone: string | null; sent: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="truncate tabular-nums text-[#3A3E4A]">{phone || <span className="text-[#B4B8C2]">—</span>}</span>
      {sent ? (
        <span title="WhatsApp sent" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-100">
          <svg className="h-2.5 w-2.5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 5 5L20 7" />
          </svg>
        </span>
      ) : (
        <span title="WhatsApp not sent" className="inline-block h-1.5 w-3 shrink-0 rounded bg-gray-200" aria-label="Not sent" />
      )}
    </div>
  );
}

// ── Skeleton loading rows ─────────────────────────────────────────────────────

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-t border-[#EFEFF2]">
          {Array.from({ length: columns }).map((__, col) => (
            <td key={col} className="px-3 py-3.5">
              <div className="h-3.5 w-20 rounded-md bg-[#ECECF0] animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Error / empty states ──────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="status" className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </span>
      <h2 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A1C21]">Unable to load leads</h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[#6B7080]">{message}</p>
      <button type="button" onClick={onRetry} className="mt-5 inline-flex h-9 items-center justify-center rounded-lg border border-[#E1E1E6] bg-white px-4 text-[13px] font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5]">Try again</button>
    </div>
  );
}

function EmptyState({ hasFilters, onClear, onCreate }: { hasFilters: boolean; onClear: () => void; onCreate: () => void }) {
  return (
    <div role="status" className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E7F5EE] text-[#0E4D3A]">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      </span>
      <h2 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A1C21]">{hasFilters ? "No matches found" : "No leads yet"}</h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[#6B7080]">
        {hasFilters ? "Try a different search term or adjust your filters." : "Add your first lead to get started."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        {hasFilters
          ? <button type="button" onClick={onClear} className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E1E1E6] bg-white px-4 text-[13px] font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5]">Clear filters</button>
          : <button type="button" onClick={onCreate} className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0E4D3A] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#0B3E2F]">Add your first lead</button>}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LeadsView() {
  const list = useLeadsList();
  const [openLeadId, setOpenLeadId] = useState<number | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [ioDialog, setIoDialog] = useState<"import" | "export" | null>(null);

  // Inline update tracking: which row is mid-request, and which one just
  // succeeded (briefly shows a checkmark instead of the spinner).
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [justUpdatedStatusId, setJustUpdatedStatusId] = useState<number | null>(null);
  const [updatingAssigneeId, setUpdatingAssigneeId] = useState<number | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toast for inline update failures — auto-dismisses after 4 s
  const [updateError, setUpdateError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setUpdateError(msg);
    toastTimer.current = setTimeout(() => setUpdateError(null), 4000);
  }

  // Reference data, fetched once on mount — nothing here is hardcoded in the frontend;
  // every dropdown's options come from the backend table that owns them.
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  useEffect(() => {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    listEmployees(token, { is_active: true, limit: 100 }).then((res) => setEmployees(res.items)).catch(() => {});
    listLeadStatuses(token).then(setStatuses).catch(() => {});
    listBranches(token).then(setBranches).catch(() => {});
    listLeadSources(token).then(setLeadSources).catch(() => {});
  }, []);

  // Source / Status / Assigned, grouped for the single "Filter" button (LeadsFilterMenu)
  // instead of three separate dropdowns competing for space in the toolbar row.
  const filterGroups: FilterGroup[] = [
    { key: "source_id", label: "Source", value: list.filters.source_id === "" ? "" : String(list.filters.source_id), options: leadSources.map((s) => ({ value: String(s.id), label: s.name })) },
    {
      key: "status", label: "Status", value: list.filters.status,
      options: [...statuses.map((s) => ({ value: s.value, label: s.label })), { value: "converted", label: "Converted" }],
    },
    { key: "assigned_to", label: "Assigned to", value: list.filters.assigned_to, options: employees.map((emp) => ({ value: String(emp.id), label: emp.name })) },
  ];

  function handleFilterMenuChange(key: string, value: string) {
    if (key === "source_id") list.changeFilter("source_id", value ? Number(value) : "");
    else list.changeFilter(key as keyof LeadFilters, value);
  }

  const converter = useLeadConvert(() => { void list.loadLeads(); });

  // Activity log and follow-up modals — track which lead's id each is open for
  const [activityLogLeadId, setActivityLogLeadId] = useState<number | null>(null);
  const [followupLeadId, setFollowupLeadId] = useState<number | null>(null);

  /** Called when the user changes the status dropdown inline in a table row. */
  async function handleStatusChange(leadId: number, newStatus: LeadStatus) {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    setUpdatingStatusId(leadId);
    try {
      await updateLead(token, leadId, { status: newStatus });
      void list.loadLeads();
      if (successTimer.current) clearTimeout(successTimer.current);
      setJustUpdatedStatusId(leadId);
      successTimer.current = setTimeout(() => setJustUpdatedStatusId(null), 1500);
    } catch {
      showToast("Status update failed. Please try again.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  /** Called when the user changes the assignee dropdown inline in a table row. */
  async function handleAssignChange(leadId: number, value: string) {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    const assigned_to = value ? Number(value) : null;
    setUpdatingAssigneeId(leadId);
    try {
      await updateLead(token, leadId, { assigned_to: assigned_to ?? undefined });
      void list.loadLeads();
    } catch {
      showToast("Assignee update failed. Please try again.");
    } finally {
      setUpdatingAssigneeId(null);
    }
  }

  async function handleDeleteLead(leadId: number) {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    try {
      await deleteLead(token, leadId);
      void list.loadLeads();
    } catch {
      showToast("Delete failed. Please try again.");
    }
  }

  const tableColumns = ["Name", "Source", "Branch", "Tags", "WhatsApp", "Status", "Assigned", "Created by", "Score", "Created"];

  return (
    <div className="flex min-h-full flex-col bg-[#F4FBF7]">
      {/* aria-live region — announces async feedback to screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{updateError}</div>

      {/* Toast banner for inline update failures */}
      {updateError && (
        <div role="alert" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl bg-[#0a192f] px-4 py-3 text-sm text-white shadow-xl">
          <svg className="h-4 w-4 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{updateError}</span>
          <button onClick={() => setUpdateError(null)} className="ml-2 rounded-md p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-[#E7E7EA] bg-white pl-16 pr-3 sm:gap-4 sm:pr-7 lg:pl-7">
        <div>
          <h1 className="truncate text-[22px] font-bold tracking-[-0.01em] text-[#1A1C21] sm:text-[26px]">Leads</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <LeadsMoreMenu onImport={() => setIoDialog("import")} onExport={() => setIoDialog("export")} />
          <button
            type="button" onClick={() => setIsBulkAssignOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#0E4D3A] px-3 text-sm font-medium text-[#0E4D3A] hover:bg-[#0E4D3A]/5 transition-colors sm:px-4"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="hidden sm:inline">Bulk Assign</span>
          </button>
          <button type="button" aria-label="Add Lead" onClick={() => setIsCreateOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0E4D3A] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#0E4D3A] sm:px-4">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span className="hidden sm:inline">Add Lead</span>
          </button>
        </div>
      </header>

      <div className="min-w-0 space-y-4 p-4 sm:px-7 sm:py-6">
        <section aria-label="Lead list" className="flex flex-col rounded-[14px] border border-[#E7E7EA] bg-white">
          {/* Toolbar: search + filters — same row structure as the Contacts screen */}
          <div className="flex flex-col gap-3 border-b border-[#EFEFF2] p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <form onSubmit={(e) => e.preventDefault()} className="relative flex w-full sm:w-auto">
                <label className="sr-only" htmlFor="leads-search">Search leads</label>
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8F9C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
                <input
                  id="leads-search" value={list.search} onChange={(e) => list.setSearch(e.target.value)}
                  placeholder="Search by name, phone…"
                  className="h-[38px] w-full rounded-[8px] border border-[#E1E1E6] bg-white pl-9 pr-3 text-sm text-[#1A1C21] outline-none focus:outline-2 focus:outline-[#7EE2A8] sm:w-[260px]"
                />
              </form>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
              <DateRangePicker
                label="Created" bare
                from={list.filters.date_from} to={list.filters.date_to}
                onChange={list.setDateRange}
                emptyLabel="All time"
                className="w-auto"
              />
              <LeadsFilterMenu groups={filterGroups} onChange={handleFilterMenuChange} onClear={list.clearFilters} />
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-b-[14px]">
            {list.error ? (
              <ErrorState message={list.error} onRetry={() => void list.loadLeads()} />
            ) : (
              <>
                <div className="w-full min-w-0 overflow-x-auto">
                  <table className="w-max min-w-full border-collapse text-sm">
                    <thead className="bg-[#F7F7F9] text-left text-[13px] font-medium text-[#4B5060]">
                      <tr>
                        {tableColumns.map((column) => (
                          <th key={column} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">{column}</th>
                        ))}
                        <th scope="col" className="sticky right-0 z-10 bg-[#F7F7F9] px-4 py-3 text-center font-medium shadow-[-8px_0_8px_-8px_rgba(16,24,40,0.18)]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.isLoading ? (
                        <SkeletonRows columns={tableColumns.length} />
                      ) : list.leads.length === 0 ? (
                        <tr>
                          <td colSpan={tableColumns.length + 1}>
                            <EmptyState hasFilters={list.hasFilters || !!list.search} onClear={list.clearFilters} onCreate={() => setIsCreateOpen(true)} />
                          </td>
                        </tr>
                      ) : (
                        list.leads.map((lead) => (
                          <tr
                            key={lead.id}
                            onClick={() => setDetailLeadId(lead.id)}
                            className="group cursor-pointer border-t border-[#EFEFF2] transition-colors hover:bg-[#FAFAFB] [&_td]:py-3.5"
                          >
                            {/* Name — the row's own cursor-pointer isn't obvious enough on its own, so the
                                name itself looks like a link (teal + underline on hover) to show where to click */}
                            <td className="px-3">
                              <div className="min-w-0 truncate font-semibold text-[#1A1C21] underline decoration-transparent decoration-2 underline-offset-2 transition-colors group-hover:text-[#0E4D3A] group-hover:decoration-[#0E4D3A]">
                                {`${lead.first_name ?? ""}${lead.last_name ? " " + lead.last_name : ""}`.trim() || "—"}
                              </div>
                            </td>

                            {/* Source */}
                            <td className="px-3">
                              {lead.source_name
                                ? <span className="inline-flex items-center rounded-[6px] bg-[#EEF4FF] px-2.5 py-[3px] text-xs font-semibold text-[#1D5BBF]">{lead.source_name}</span>
                                : <span className="text-[#B4B8C2]">—</span>}
                            </td>

                            {/* Branch */}
                            <td className="whitespace-nowrap px-3 capitalize text-[#3A3E4A]">{lead.branch_name || <span className="text-[#B4B8C2]">—</span>}</td>

                            {/* Tags — e.g. Meta Ads campaign/ad set labels. Display only, no editing here. */}
                            <td className="px-3">
                              {lead.tags && lead.tags.length > 0 ? (
                                <div className="flex max-w-[180px] flex-wrap gap-1">
                                  {lead.tags.slice(0, 2).map((tag) => (
                                    <span key={tag} className="inline-flex items-center truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-[#4B5060]">{tag}</span>
                                  ))}
                                  {lead.tags.length > 2 && (
                                    <span title={lead.tags.slice(2).join(", ")} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-[#8A8F9C]">+{lead.tags.length - 2}</span>
                                  )}
                                </div>
                              ) : <span className="text-[#B4B8C2]">—</span>}
                            </td>

                            {/* WhatsApp: number + icon */}
                            <td className="px-3" onClick={(e) => e.stopPropagation()}>
                              <WhatsAppCell phone={lead.phone} sent={lead.whatsapp_sent} />
                            </td>

                            {/* Status — one colour-coded control, loading → success state, options from the API */}
                            <td className="px-3" onClick={(e) => e.stopPropagation()}>
                              <LeadStatusSelect
                                status={lead.status}
                                statuses={statuses}
                                onChange={(value) => void handleStatusChange(lead.id, value)}
                                isUpdating={updatingStatusId === lead.id}
                                justUpdated={justUpdatedStatusId === lead.id}
                                label={lead.first_name ?? `lead ${lead.id}`}
                              />
                            </td>

                            {/* Assigned — inline dropdown */}
                            <td className="px-3" onClick={(e) => e.stopPropagation()}>
                              <span className={updatingAssigneeId === lead.id ? "pointer-events-none inline-block opacity-50" : "inline-block"}>
                                <FilterSelect
                                  fit clearable label="Assign" className="w-auto"
                                  value={lead.assigned_to != null ? String(lead.assigned_to) : ""}
                                  onChange={(value) => void handleAssignChange(lead.id, value)}
                                  options={employees.map((emp) => ({ value: String(emp.id), label: emp.name }))}
                                />
                              </span>
                            </td>

                            {/* Created by */}
                            <td className="whitespace-nowrap px-3 text-[#3A3E4A]">{lead.created_by_name || <span className="text-[#B4B8C2]">—</span>}</td>

                            {/* Score */}
                            <td className="px-3"><LeadScoreBar score={lead.score} /></td>

                            {/* Created At — urgency colour for ageing new leads */}
                            <td className="px-3">
                              <span className={`text-xs tabular-nums ${createdAtClass(lead.created_at, lead.status)}`} title={new Date(lead.created_at).toLocaleString("en-IN")}>
                                {formatCreatedAt(lead.created_at)}
                              </span>
                            </td>

                            {/* Action */}
                            <td className="sticky right-0 z-10 bg-white px-3 text-center transition-colors group-hover:bg-[#FAFAFB] shadow-[-8px_0_8px_-8px_rgba(16,24,40,0.18)]" onClick={(e) => e.stopPropagation()}>
                              <LeadActionMenu
                                lead={lead}
                                onEdit={() => setOpenLeadId(lead.id)}
                                onActivityLog={() => setActivityLogLeadId(lead.id)}
                                onFollowup={() => setFollowupLeadId(lead.id)}
                                onConvert={() => converter.openModal(lead.id, lead)}
                                onDelete={handleDeleteLead}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!list.isLoading && list.total > 0 && (
                  <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEFF2] px-3 py-3 sm:px-4 sm:py-3.5" aria-label="Leads pagination">
                    <p className="text-sm text-[#3A3E4A]">Page {list.page} of {list.totalPages} · {list.total.toLocaleString()} leads</p>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => list.setPage(list.page - 1)} disabled={list.page === 1} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#E1E1E6] bg-white px-3 text-[13px] font-medium text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] disabled:cursor-not-allowed disabled:opacity-40">
                        Previous
                      </button>
                      <button onClick={() => list.setPage(list.page + 1)} disabled={list.page === list.totalPages} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#0E4D3A] px-3.5 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40">
                        Next
                      </button>
                    </div>
                  </nav>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* 3-tab lead detail modal — opened by clicking a lead row */}
      <LeadDetailModal
        leadId={detailLeadId}
        statuses={statuses}
        branches={branches}
        leadSources={leadSources}
        onClose={() => setDetailLeadId(null)}
        onConverted={(id) => { setDetailLeadId(null); converter.openModal(id); }}
        onDeleted={() => { setDetailLeadId(null); void list.loadLeads(); }}
        onSaved={() => { void list.loadLeads(); }}
      />

      {/* Edit-only modal — opened via "Edit" in the kebab menu or "New Lead" */}
      <LeadModal
        leadId={openLeadId}
        isCreateOpen={isCreateOpen}
        statuses={statuses}
        branches={branches}
        leadSources={leadSources}
        onClose={() => { setOpenLeadId(null); setIsCreateOpen(false); }}
        onConverted={(id) => { setOpenLeadId(null); setIsCreateOpen(false); converter.openModal(id); }}
        onDeleted={() => { void list.loadLeads(); }}
        onSaved={() => { void list.loadLeads(); }}
      />

      <ConvertLeadModal converter={converter} />
      <BulkAssignModal isOpen={isBulkAssignOpen} leadSources={leadSources} onClose={() => setIsBulkAssignOpen(false)} onDone={() => { void list.loadLeads(); }} />

      {ioDialog === "import" && (
        <LeadImportModal leadSources={leadSources} onClose={() => setIoDialog(null)} onImported={() => { list.setPage(1); void list.loadLeads(); }} />
      )}
      {/* Activity log modal */}
      {activityLogLeadId !== null && (() => {
        const lead = list.leads.find((l) => l.id === activityLogLeadId);
        const name = lead ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || `Lead #${lead.id}` : `Lead #${activityLogLeadId}`;
        return (
          <LeadActivityLogModal
            leadId={activityLogLeadId}
            leadName={name}
            onSaved={() => setActivityLogLeadId(null)}
            onCancel={() => setActivityLogLeadId(null)}
          />
        );
      })()}

      {/* Follow-up modal */}
      {followupLeadId !== null && (() => {
        const lead = list.leads.find((l) => l.id === followupLeadId);
        const name = lead ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || `Lead #${lead.id}` : `Lead #${followupLeadId}`;
        return (
          <LeadFollowupModal
            leadId={followupLeadId}
            leadName={name}
            onSaved={() => setFollowupLeadId(null)}
            onCancel={() => setFollowupLeadId(null)}
          />
        );
      })()}

      {ioDialog === "export" && (
        <LeadExportModal
          statuses={statuses}
          sources={leadSources}
          onClose={() => setIoDialog(null)}
          initial={{
            status: list.filters.status || undefined,
            source_id: list.filters.source_id !== "" ? list.filters.source_id : undefined,
            assigned_to: list.filters.assigned_to ? Number(list.filters.assigned_to) : undefined,
            date_from: list.filters.date_from || undefined,
            date_to: list.filters.date_to || undefined,
            search: list.search || undefined,
          }}
          extraFilterCount={[list.filters.assigned_to, list.search].filter(Boolean).length}
        />
      )}
    </div>
  );
}
