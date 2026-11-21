"use client";

/**
 * LeadDetailModal — 3-tab modal opened by clicking a lead row.
 *
 * Tabs:
 *   Details        — edit form (same as LeadModal); shows status pill, score, WhatsApp button
 *   Activity & History — list of past activities (kind='log') + "Log Activity" button
 *   Follow-ups     — list of scheduled tasks (kind='task') + "Add Follow-up" button
 *
 * Opening the modal with initialTab lets the kebab "Edit" action land directly on Details.
 *
 * Data fetched here:
 *   - Lead detail: GET /leads/{id}
 *   - Interactions: GET /leads/{id}/interactions?kind=log|task (fetched lazily per tab)
 */

import { useEffect, useState, useCallback } from "react";
import { ApiError } from "@/lib/api/auth";
import { getLead, deleteLead, type Lead, type LeadStatusOption } from "@/lib/api/leads-module";
import type { BranchOption, LeadSource } from "@/features/contacts/api/contacts";
import { listLeadInteractions, type Interaction } from "@/lib/api/interactions";
import LeadStatusPill from "./LeadStatusPill";
import LeadScoreBar from "./LeadScoreBar";
import WhatsAppButton from "./WhatsAppButton";
import LeadForm from "./LeadForm";
import { useLeadEditor } from "@/features/leads/hooks/useLeadEditor";
import LeadActivityLogModal from "./LeadActivityLogModal";
import LeadFollowupModal from "./LeadFollowupModal";

type Tab = "details" | "activity" | "followups";

type Props = {
  leadId: number | null;
  initialTab?: Tab;
  statuses: LeadStatusOption[];
  branches: BranchOption[];
  leadSources: LeadSource[];
  onClose: () => void;
  onConverted: (leadId: number) => void;
  onDeleted: () => void;
  onSaved: () => void;
};

export default function LeadDetailModal(props: Props) {
  if (props.leadId === null) return null;
  return <LeadDetailDialog key={props.leadId} {...props} leadId={props.leadId} />;
}

function LeadDetailDialog({
  leadId, initialTab = "details",
  statuses, branches, leadSources,
  onClose, onConverted, onDeleted, onSaved,
}: Props & { leadId: number }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Interaction lists — loaded per-tab on first visit
  const [logs, setLogs] = useState<Interaction[] | null>(null);
  const [tasks, setTasks] = useState<Interaction[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [tasksError, setTasksError] = useState("");

  // Sub-modals shown over this modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);

  const editor = useLeadEditor(() => {
    onSaved();
    onClose();
  });

  // Load lead detail
  useEffect(() => {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    let cancelled = false;
    setIsLoading(true);
    getLead(token, leadId)
      .then((data) => {
        if (cancelled) return;
        setLead(data);
        editor.open(data);
      })
      .catch((err) => {
        if (!cancelled) setFetchError(err instanceof ApiError ? err.message : "Could not load lead.");
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // Refresh lead detail (after WhatsApp send, etc.)
  async function refreshLead() {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token || !leadId) return;
    try {
      setLead(await getLead(token, leadId));
    } catch { /* silent */ }
  }

  // Load activity logs
  const loadLogs = useCallback(async () => {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    setLogsLoading(true);
    setLogsError("");
    try {
      setLogs(await listLeadInteractions(token, leadId, "log"));
    } catch (err) {
      setLogsError(err instanceof ApiError ? err.message : "Could not load activity history.");
    } finally {
      setLogsLoading(false);
    }
  }, [leadId]);

  // Load tasks (follow-ups)
  const loadTasks = useCallback(async () => {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    setTasksLoading(true);
    setTasksError("");
    try {
      setTasks(await listLeadInteractions(token, leadId, "task"));
    } catch (err) {
      setTasksError(err instanceof ApiError ? err.message : "Could not load follow-ups.");
    } finally {
      setTasksLoading(false);
    }
  }, [leadId]);

  // Lazy-load per-tab on first visit
  useEffect(() => {
    if (tab === "activity" && logs === null) void loadLogs();
    if (tab === "followups" && tasks === null) void loadTasks();
  }, [tab, logs, tasks, loadLogs, loadTasks]);

  async function handleDeleteConfirmed() {
    if (!lead) return;
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    setIsDeleting(true);
    try {
      await deleteLead(token, lead.id);
      onDeleted();
      onClose();
    } catch (err) {
      setConfirmingDelete(false);
      setDeleteError(err instanceof ApiError ? err.message : "Delete failed.");
    } finally {
      setIsDeleting(false);
    }
  }

  const leadName = lead
    ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || `Lead #${leadId}`
    : `Lead #${leadId}`;
  const currentStatusLabel = statuses.find((s) => s.value === lead?.status)?.label
    ?? (lead?.status === "converted" ? "Converted" : lead?.status ?? "");

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-[rgba(17,18,20,0.45)] backdrop-blur-[3px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section
        className="w-full max-w-[600px] max-h-[90dvh] bg-white rounded-2xl shadow-[0_24px_64px_rgba(16,24,40,0.28)] flex flex-col overflow-hidden"
        role="dialog" aria-modal="true" aria-labelledby="lead-detail-title"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EFEFF2] px-6 pt-5 pb-0">
          <div className="pb-4">
            <h2 id="lead-detail-title" className="text-[19px] font-bold tracking-[-0.01em] text-[#1A1C21]">
              {isLoading ? "Loading…" : leadName}
            </h2>
            {lead && (
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <LeadStatusPill status={lead.status} label={currentStatusLabel} />
                <LeadScoreBar score={lead.score} />
                <WhatsAppButton leadId={lead.id} alreadySent={lead.whatsapp_sent} onSent={() => void refreshLead()} />
              </div>
            )}
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[#6B7080] transition-colors hover:bg-[#F0F0F3]"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex shrink-0 border-b border-[#EFEFF2] px-6" role="tablist" aria-label="Lead sections">
          {(["details", "activity", "followups"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = { details: "Details", activity: "Activity & History", followups: "Follow-ups" };
            return (
              <button key={t} role="tab" aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`mr-6 border-b-2 py-3 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "border-[#0E4D3A] text-[#0E4D3A]"
                    : "border-transparent text-[#6B7080] hover:text-[#3A3E4A]"
                }`}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* ── Details tab ── */}
          {tab === "details" && (
            <div className="flex flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
                {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
                {fetchError && <p className="text-sm text-red-500">{fetchError}</p>}

                {lead?.status === "converted" && lead.contact_id && (
                  <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-700">
                    Converted — linked to Contact #{lead.contact_id}
                  </p>
                )}

                {lead && (
                  <LeadForm form={editor.form} isEdit statuses={statuses} branches={branches} leadSources={leadSources} setField={editor.setField} />
                )}

                {editor.saveError && (
                  <div role="alert" className="flex items-start gap-3 rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                    </svg>
                    <span>{editor.saveError}</span>
                  </div>
                )}
                {deleteError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    {deleteError}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2.5 border-t border-[#EFEFF2] px-6 py-4">
                <div className="flex items-center gap-2">
                  {lead && lead.status !== "converted" && lead.status !== "lost_lead" && (
                    <button type="button" onClick={() => onConverted(lead.id)}
                      className="h-10 rounded-[8px] bg-teal-50 px-4 text-[14px] font-semibold text-teal-700 hover:bg-teal-100 transition-colors">
                      Convert
                    </button>
                  )}
                  {lead && (confirmingDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600">Delete?</span>
                      <button type="button" onClick={() => void handleDeleteConfirmed()} disabled={isDeleting}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                        {isDeleting ? "…" : "Yes"}
                      </button>
                      <button type="button" onClick={() => { setConfirmingDelete(false); setDeleteError(""); }}
                        className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                        No
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmingDelete(true)} disabled={isDeleting}
                      className="flex h-10 w-10 items-center justify-center rounded-[8px] text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      title="Delete lead">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2.5">
                  <button type="button" disabled={editor.isSaving} onClick={onClose}
                    className="h-10 rounded-[8px] border border-[#DEE1E5] bg-white px-4 text-[14px] font-semibold text-[#3A3E4A] hover:bg-[#F3F3F5] disabled:opacity-50 transition-colors">
                    Cancel
                  </button>
                  <button type="button" disabled={editor.isSaving || !lead}
                    onClick={() => void editor.submit()}
                    className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0E4D3A] px-5 text-[14px] font-bold text-white hover:bg-[#0B3E2F] disabled:opacity-60 transition-colors">
                    {editor.isSaving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                    {editor.isSaving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Activity & History tab ── */}
          {tab === "activity" && (
            <div className="flex flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between border-b border-[#EFEFF2] px-6 py-3">
                <span className="text-sm font-medium text-gray-500">{logs ? `${logs.length} ${logs.length === 1 ? "entry" : "entries"}` : ""}</span>
                <button onClick={() => setShowLogModal(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0E4D3A] px-3 text-xs font-semibold text-white hover:bg-[#0B3E2F] transition-colors">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  Log Activity
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {logsLoading && <p className="text-sm text-gray-400">Loading…</p>}
                {logsError && <p className="text-sm text-red-500">{logsError}</p>}
                {!logsLoading && !logsError && logs !== null && logs.length === 0 && (
                  <div className="flex flex-col items-center py-10 text-center">
                    <svg className="h-10 w-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M9 12h6M9 16h6M5 8h14M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                    </svg>
                    <p className="mt-3 text-sm font-medium text-gray-500">No activity logged yet</p>
                    <p className="mt-1 text-xs text-gray-400">Log the first interaction above.</p>
                  </div>
                )}
                {logs && logs.length > 0 && (
                  <ul className="space-y-3">
                    {logs.map((ia) => (
                      <InteractionRow key={ia.id} interaction={ia} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* ── Follow-ups tab ── */}
          {tab === "followups" && (
            <div className="flex flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between border-b border-[#EFEFF2] px-6 py-3">
                <span className="text-sm font-medium text-gray-500">{tasks ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}` : ""}</span>
                <button onClick={() => setShowFollowupModal(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0E4D3A] px-3 text-xs font-semibold text-white hover:bg-[#0B3E2F] transition-colors">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  Add Follow-up
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {tasksLoading && <p className="text-sm text-gray-400">Loading…</p>}
                {tasksError && <p className="text-sm text-red-500">{tasksError}</p>}
                {!tasksLoading && !tasksError && tasks !== null && tasks.length === 0 && (
                  <div className="flex flex-col items-center py-10 text-center">
                    <svg className="h-10 w-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    <p className="mt-3 text-sm font-medium text-gray-500">No follow-ups scheduled</p>
                    <p className="mt-1 text-xs text-gray-400">Schedule the first one above.</p>
                  </div>
                )}
                {tasks && tasks.length > 0 && (
                  <ul className="space-y-3">
                    {tasks.map((ia) => (
                      <TaskRow key={ia.id} task={ia} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sub-modals rendered at a higher z-index */}
      {showLogModal && (
        <LeadActivityLogModal
          leadId={leadId}
          leadName={leadName}
          onSaved={() => { setShowLogModal(false); setLogs(null); void loadLogs(); }}
          onCancel={() => setShowLogModal(false)}
        />
      )}
      {showFollowupModal && (
        <LeadFollowupModal
          leadId={leadId}
          leadName={leadName}
          onSaved={() => { setShowFollowupModal(false); setTasks(null); void loadTasks(); }}
          onCancel={() => setShowFollowupModal(false)}
        />
      )}
    </div>
  );
}

// ── Interaction display rows ───────────────────────────────────────────────────

function typeLabel(ia: Interaction): string {
  if (ia.activity_type === "other" && ia.custom_label) return ia.custom_label;
  return ia.activity_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function InteractionRow({ interaction: ia }: { interaction: Interaction }) {
  const when = new Date(ia.logged_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return (
    <li className="rounded-xl border border-[#EFEFF2] bg-[#FAFAFA] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
            {typeLabel(ia)}
          </span>
          {ia.title && <p className="mt-1.5 text-sm font-semibold text-[#1A1C21]">{ia.title}</p>}
          {ia.notes && <p className="mt-1 text-sm leading-relaxed text-[#3A3E4A]">{ia.notes}</p>}
        </div>
        <span className="shrink-0 text-xs text-[#8A8F9C]">{when}</span>
      </div>
      {ia.done_by_name && (
        <p className="mt-2 text-xs text-[#8A8F9C]">By {ia.done_by_name}</p>
      )}
    </li>
  );
}

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-green-50 text-green-700",
};
const STATUS_BADGE: Record<string, string> = {
  todo: "bg-gray-100 text-gray-600",
  inprogress: "bg-blue-50 text-blue-700",
  completed: "bg-teal-50 text-teal-700",
};

function TaskRow({ task: ia }: { task: Interaction }) {
  const dueLabel = ia.due_at
    ? new Date(ia.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const isOverdue = ia.overdue_days > 0 && ia.status !== "completed";
  return (
    <li className="rounded-xl border border-[#EFEFF2] bg-[#FAFAFA] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
              {typeLabel(ia)}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PRIORITY_BADGE[ia.priority] ?? ""}`}>
              {ia.priority}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_BADGE[ia.status] ?? ""}`}>
              {ia.status === "inprogress" ? "In Progress" : ia.status}
            </span>
          </div>
          {ia.title && <p className="mt-1.5 text-sm font-semibold text-[#1A1C21]">{ia.title}</p>}
          {ia.notes && <p className="mt-1 text-sm leading-relaxed text-[#3A3E4A]">{ia.notes}</p>}
        </div>
        {dueLabel && (
          <span className={`shrink-0 text-xs ${isOverdue ? "font-semibold text-red-500" : "text-[#8A8F9C]"}`}>
            {isOverdue ? `${ia.overdue_days}d overdue` : `Due ${dueLabel}`}
          </span>
        )}
      </div>
      {ia.assigned_to_name && (
        <p className="mt-2 text-xs text-[#8A8F9C]">Assigned to {ia.assigned_to_name}</p>
      )}
    </li>
  );
}
