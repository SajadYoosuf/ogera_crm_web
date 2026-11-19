"use client";

/**
 * LeadsView — the main client component for the /leads route.
 *
 * REDESIGN (2026-11):
 *   - Single-row filter bar: search + source (left) | status + assigned + Bulk Assign (right)
 *   - Table: added WhatsApp column (tick/dash), inline assignee dropdown
 *   - Removed inner table overflow-auto (double scroll fix); single page-level scroll remains
 *   - BulkAssignModal: source-based lead distribution to staff
 *
 * DATA FLOW:
 *   useLeadsList()  — paginated list from GET /leads
 *   useLeadEditor() — create/edit form state → POST or PUT /leads
 *   useLeadConvert()— confirmation modal → POST /leads/{id}/convert
 *   updateLead()    — inline status and assignee changes in table rows
 *   listEmployees() — fetched once on mount for assignee dropdowns
 */

import { useState, useEffect, useRef } from "react";
import { useLeadsList } from "@/features/leads/hooks/useLeadsList";
import { useLeadEditor } from "@/features/leads/hooks/useLeadEditor";
import { useLeadConvert } from "@/features/leads/hooks/useLeadConvert";
import LeadDrawer from "@/features/leads/components/LeadDrawer";
import ConvertLeadModal from "@/features/leads/components/ConvertLeadModal";
import LeadScoreBar from "@/features/leads/components/LeadScoreBar";
import LeadForm from "@/features/leads/components/LeadForm";
import BulkAssignModal from "@/features/leads/components/BulkAssignModal";
import { updateLead, type LeadStatus } from "@/lib/api/leads-module";
import { listEmployees, type Employee } from "@/lib/api/employees";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: LeadStatus | ""; label: string }[] = [
  { value: "",          label: "All statuses" },
  { value: "new",       label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "lost",      label: "Lost" },
];

/** Tailwind classes for each status pill/select. */
const STATUS_COLOR: Record<LeadStatus, string> = {
  new:       "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-green-100 text-green-700",
  converted: "bg-teal-100 text-teal-700",
  lost:      "bg-gray-100 text-gray-500",
};

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
  if (status !== "new") return "text-gray-500";
  const utc = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  const ageHrs = (Date.now() - new Date(utc).getTime()) / 3_600_000;
  if (ageHrs > 48) return "text-red-500 font-semibold";
  if (ageHrs > 24) return "text-amber-500 font-medium";
  return "text-gray-500";
}

// ── WhatsApp icon ─────────────────────────────────────────────────────────────

function WhatsAppIcon({ sent }: { sent: boolean }) {
  if (sent) {
    return (
      <span title="WhatsApp sent" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
        <svg className="h-3 w-3 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12 5 5L20 7" />
        </svg>
      </span>
    );
  }
  return (
    <span title="WhatsApp not sent" className="inline-block h-1.5 w-4 rounded bg-gray-200" aria-label="Not sent" />
  );
}

// ── Skeleton loading rows ─────────────────────────────────────────────────────

/**
 * Animated placeholder rows shown while leads are loading.
 * Matches the table's column layout so there's no layout shift on load.
 */
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          <td className="px-4 py-3">
            <div className="h-3.5 w-28 rounded-md bg-gray-100 animate-pulse" />
            <div className="mt-1.5 h-3 w-20 rounded-md bg-gray-100 animate-pulse" />
          </td>
          <td className="px-4 py-3 hidden sm:table-cell">
            <div className="h-5 w-16 rounded-full bg-gray-100 animate-pulse" />
          </td>
          <td className="px-4 py-3 hidden md:table-cell">
            <div className="h-5 w-5 rounded-full bg-gray-100 animate-pulse" />
          </td>
          <td className="px-4 py-3">
            <div className="h-5 w-20 rounded-full bg-gray-100 animate-pulse" />
          </td>
          <td className="px-4 py-3 hidden lg:table-cell">
            <div className="h-6 w-28 rounded-lg bg-gray-100 animate-pulse" />
          </td>
          <td className="px-4 py-3 hidden md:table-cell">
            <div className="h-3 w-16 rounded-md bg-gray-100 animate-pulse" />
          </td>
          <td className="px-4 py-3 hidden md:table-cell">
            <div className="h-3 w-14 rounded-md bg-gray-100 animate-pulse" />
          </td>
          <td className="px-4 py-3">
            <div className="h-6 w-14 rounded-lg bg-gray-100 animate-pulse" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <svg className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-gray-800">Failed to load leads</p>
        <p className="mt-1 text-sm text-gray-500">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-xl bg-[#0E4D3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3a2b] motion-safe:transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear, onCreate }: { hasFilters: boolean; onClear: () => void; onCreate: () => void }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-gray-800">No results found</p>
          <p className="mt-1 text-sm text-gray-500">No leads match the current filters.</p>
        </div>
        <button
          onClick={onClear}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 motion-safe:transition-colors"
        >
          Clear Filters
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
        <svg className="h-6 w-6 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-gray-800">No leads yet</p>
        <p className="mt-1 text-sm text-gray-500">Add your first lead to get started.</p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 rounded-xl bg-[#0E4D3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3a2b] motion-safe:transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add First Lead
      </button>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LeadsView() {
  const list = useLeadsList();
  const [openLeadId, setOpenLeadId] = useState<number | null>(null);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);

  // Inline update tracking
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [updatingAssigneeId, setUpdatingAssigneeId] = useState<number | null>(null);

  // Toast for inline update failures — auto-dismisses after 4 s
  const [updateError, setUpdateError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setUpdateError(msg);
    toastTimer.current = setTimeout(() => setUpdateError(null), 4000);
  }

  // Employees for assignee dropdowns — fetched once on mount
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    listEmployees(token, { is_active: true, limit: 100 })
      .then((res) => setEmployees(res.items))
      .catch(() => {});
  }, []);

  // Create lead modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const editor = useLeadEditor(() => {
    setIsCreateOpen(false);
    void list.loadLeads();
  });

  const converter = useLeadConvert(() => {
    void list.loadLeads();
  });

  function openCreate() {
    setIsCreateOpen(true);
    editor.open();
  }

  /**
   * Called when user changes the status dropdown inline in a table row.
   * Shows a toast if the server call fails so the user knows to retry.
   */
  async function handleStatusChange(leadId: number, newStatus: LeadStatus) {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    setUpdatingStatusId(leadId);
    try {
      await updateLead(token, leadId, { status: newStatus });
      void list.loadLeads();
    } catch {
      showToast("Status update failed. Please try again.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  /**
   * Called when user changes the assignee dropdown inline in a table row.
   */
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

  return (
    <div className="flex flex-col">
      {/* aria-live region — announces async feedback to screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {updateError}
      </div>

      {/* Toast banner for inline update failures */}
      {updateError && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl bg-[#0a192f] px-4 py-3 text-sm text-white shadow-xl motion-safe:animate-fade-in"
        >
          <svg className="h-4 w-4 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{updateError}</span>
          <button
            onClick={() => setUpdateError(null)}
            className="ml-2 rounded-md p-0.5 opacity-70 hover:opacity-100 motion-safe:transition-opacity"
            aria-label="Dismiss"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0a192f]" style={{ textWrap: "balance" } as React.CSSProperties}>Leads</h1>
          <p className="mt-0.5 text-sm text-[#64748b] tabular-nums">
            {list.isLoading ? <span className="inline-block h-3.5 w-16 rounded-md bg-gray-100 animate-pulse align-middle" /> : `${list.total} total`}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0E4D3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3a2b] motion-safe:transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Lead
        </button>
      </div>

      {/* ── Single-row filter bar ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-gray-200 bg-[#f8fafc] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* LEFT: search + source */}
          <div className="relative min-w-[160px] flex-1">
            <label htmlFor="leads-search" className="sr-only">Search leads</label>
            <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              id="leads-search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search by name, phone, email…"
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

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

          {/* RIGHT: status + assigned + Bulk Assign */}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <label htmlFor="leads-status-filter" className="sr-only">Filter by status</label>
            <select
              id="leads-status-filter"
              value={list.filters.status}
              onChange={(e) => list.changeFilter("status", e.target.value as LeadStatus | "")}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <label htmlFor="leads-assigned-filter" className="sr-only">Filter by assignee</label>
            <select
              id="leads-assigned-filter"
              value={list.filters.assigned_to ?? ""}
              onChange={(e) => list.changeFilter("assigned_to", e.target.value ? Number(e.target.value) : "")}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">All staff</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>

            <button
              onClick={() => setIsBulkAssignOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 motion-safe:transition-colors shadow-sm"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Bulk Assign
            </button>

            {list.hasFilters && (
              <button
                onClick={list.clearFilters}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 motion-safe:transition-colors"
              >
                × Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 py-4 sm:px-6">
        {list.error ? (
          <ErrorState message={list.error} onRetry={() => void list.loadLeads()} />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-[#f8fafc] text-left">
                      <th scope="col" className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Name</th>
                      <th scope="col" className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] hidden sm:table-cell">Source</th>
                      <th scope="col" className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] hidden md:table-cell">WA</th>
                      <th scope="col" className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Status</th>
                      <th scope="col" className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] hidden lg:table-cell">Assigned</th>
                      <th scope="col" className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] hidden md:table-cell">Score</th>
                      <th scope="col" className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] hidden md:table-cell">Created</th>
                      <th scope="col" className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {list.isLoading ? (
                      <SkeletonRows />
                    ) : list.leads.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <EmptyState
                            hasFilters={list.hasFilters || !!list.search}
                            onClear={list.clearFilters}
                            onCreate={openCreate}
                          />
                        </td>
                      </tr>
                    ) : (
                      list.leads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="hover:bg-gray-50 motion-safe:transition-colors cursor-pointer touch-manipulation select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 focus-visible:outline-offset-[-2px]"
                          onClick={() => setOpenLeadId(lead.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenLeadId(lead.id); } }}
                          tabIndex={0}
                          role="button"
                          aria-label={`View lead ${`${lead.first_name ?? ""}${lead.last_name ? " " + lead.last_name : ""}`.trim() || "unnamed"}`}
                        >
                          {/* Name + phone */}
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-[#0a192f]">
                                {`${lead.first_name ?? ""}${lead.last_name ? " " + lead.last_name : ""}`.trim() || "—"}
                              </div>
                              {lead.phone && (
                                <div className="mt-0.5 truncate text-xs text-[#64748b] tabular-nums">{lead.phone}</div>
                              )}
                            </div>
                          </td>

                          {/* Source badge */}
                          <td className="px-4 py-3 hidden sm:table-cell" onClick={(e) => e.stopPropagation()}>
                            {lead.source_name ? (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                {lead.source_name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>

                          {/* WhatsApp column */}
                          <td className="px-4 py-3 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                            <WhatsAppIcon sent={lead.whatsapp_sent} />
                          </td>

                          {/* Status — inline select */}
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <label htmlFor={`status-${lead.id}`} className="sr-only">
                              Change status for {lead.first_name ?? `lead ${lead.id}`}
                            </label>
                            <select
                              id={`status-${lead.id}`}
                              value={lead.status}
                              disabled={updatingStatusId === lead.id}
                              onChange={(e) => void handleStatusChange(lead.id, e.target.value as LeadStatus)}
                              className={`cursor-pointer rounded-full border-0 px-2.5 py-0.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 disabled:opacity-60 disabled:cursor-wait appearance-none ${STATUS_COLOR[lead.status]}`}
                            >
                              {STATUS_OPTIONS.filter((t) => t.value !== "").map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          </td>

                          {/* Assigned — inline dropdown */}
                          <td className="px-4 py-3 hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                            <label htmlFor={`assign-${lead.id}`} className="sr-only">
                              Assign {lead.first_name ?? `lead ${lead.id}`}
                            </label>
                            <select
                              id={`assign-${lead.id}`}
                              value={lead.assigned_to ?? ""}
                              disabled={updatingAssigneeId === lead.id}
                              onChange={(e) => void handleAssignChange(lead.id, e.target.value)}
                              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/20 disabled:opacity-60 disabled:cursor-wait max-w-[140px]"
                            >
                              <option value="">Unassigned</option>
                              {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                              ))}
                            </select>
                          </td>

                          {/* Score */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <LeadScoreBar score={lead.score} />
                          </td>

                          {/* Created At — urgency colour for ageing new leads */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span
                              className={`text-xs tabular-nums ${createdAtClass(lead.created_at, lead.status)}`}
                              title={new Date(lead.created_at).toLocaleString("en-IN")}
                            >
                              {formatCreatedAt(lead.created_at)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {lead.status !== "converted" && lead.status !== "lost" && (
                              <button
                                onClick={() => converter.openModal(lead.id)}
                                className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 motion-safe:transition-colors"
                              >
                                Convert
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {!list.isLoading && list.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-gray-500 tabular-nums">
                  Page {list.page} of {list.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => list.setPage(list.page - 1)}
                    disabled={list.page === 1}
                    aria-label="Previous page"
                    className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-gray-50 motion-safe:transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => list.setPage(list.page + 1)}
                    disabled={list.page === list.totalPages}
                    aria-label="Next page"
                    className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-gray-50 motion-safe:transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
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

      {/* Bulk assign modal */}
      <BulkAssignModal
        isOpen={isBulkAssignOpen}
        onClose={() => setIsBulkAssignOpen(false)}
        onDone={() => { void list.loadLeads(); }}
      />

      {/* Create lead modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="w-full max-w-md sm:max-w-xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">New Lead</h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 motion-safe:transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <LeadForm form={editor.form} isEdit={false} setField={editor.setField} />
              {editor.saveError && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editor.saveError}</p>
              )}
            </div>

            {/* Sticky footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button
                onClick={() => void editor.submit()}
                disabled={editor.isSaving || !editor.form.first_name}
                className="flex-1 rounded-xl bg-[#0E4D3A] py-2.5 text-sm font-semibold text-white hover:bg-[#0a3a2b] disabled:opacity-50 motion-safe:transition-colors"
              >
                {editor.isSaving ? "Saving…" : "Create Lead"}
              </button>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 motion-safe:transition-colors"
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
