"use client";

/**
 * LeadDetailModal — opened by clicking a lead row.
 *
 * Header (always visible): name, source, status, phone, WhatsApp template and chat buttons, Convert to contact.
 * Tabs:
 *   Details & Timeline — lead details (Edit at the top right of the panel) and a timeline of what happened
 *   Activity Log       — every logged activity, with New activity at the top right
 *   Follow-ups         — every scheduled task with status and priority, with New follow-up at the top right
 *
 * The timeline comes from GET /leads/{id}/timeline (the record_logs table).
 */

import { useEffect, useState, useCallback } from "react";
import { ApiError } from "@/lib/api/auth";
import { useAuth } from "@/context/AuthContext";
import { getLead, updateLead, getLeadTimeline, isLeadConverted, type Lead, type LeadStatus, type LeadStatusOption, type LeadTimelineItem } from "@/features/leads/api/leads";
import type { BranchOption, LeadSource } from "@/features/contacts/api/contacts";
import { listLeadInteractions, type Interaction } from "@/lib/api/interactions";
import { useLeadEditor } from "@/features/leads/hooks/useLeadEditor";
import LeadStatusSelect from "./LeadStatusSelect";
import WhatsAppButton from "./WhatsAppButton";
import LeadForm from "./LeadForm";
import LeadActivityLogModal from "./LeadActivityLogModal";
import LeadFollowupModal from "./LeadFollowupModal";

type Tab = "details" | "activity" | "followups";

const TAB_LABELS: Record<Tab, string> = {
  details: "Details & Timeline",
  activity: "Activity Log",
  followups: "Follow-ups",
};

type Props = {
  leadId: number | null;
  statuses: LeadStatusOption[];
  branches: BranchOption[];
  leadSources: LeadSource[];
  onClose: () => void;
  onConverted: (lead: Lead) => void;
  onChanged: () => void;
};

export default function LeadDetailModal(props: Props) {
  if (props.leadId === null) return null;
  return <LeadDetailDialog key={props.leadId} {...props} leadId={props.leadId} />;
}

function LeadDetailDialog({ leadId, statuses, branches, leadSources, onClose, onConverted, onChanged }: Props & { leadId: number }) {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("details");
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [editing, setEditing] = useState(false);

  const [logs, setLogs] = useState<Interaction[]>([]);
  const [tasks, setTasks] = useState<Interaction[]>([]);
  const [timeline, setTimeline] = useState<LeadTimelineItem[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState("");

  const [showLogModal, setShowLogModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusJustUpdated, setStatusJustUpdated] = useState(false);
  const [statusError, setStatusError] = useState("");

  const editor = useLeadEditor(() => {
    setEditing(false);
    void refreshLead();
    onChanged();
  });

  const refreshLead = useCallback(async () => {
    if (!token) return;
    try {
      setLead(await getLead(token, leadId));
    } catch { /* keep the last loaded lead */ }
  }, [leadId, token]);

  const loadInteractions = useCallback(async () => {
    if (!token) return;
    setListsLoading(true);
    setListsError("");
    try {
      const [activity, followups, tl] = await Promise.all([
        listLeadInteractions(token, leadId, "log"),
        listLeadInteractions(token, leadId, "task"),
        getLeadTimeline(token, leadId),
      ]);
      setLogs(activity);
      setTasks(followups);
      setTimeline(tl);
    } catch (err) {
      setListsError(err instanceof ApiError ? err.message : "Could not load activity and follow-ups.");
    } finally {
      setListsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getLead(token, leadId)
      .then((data) => { if (!cancelled) setLead(data); })
      .catch((err) => { if (!cancelled) setFetchError(err instanceof ApiError ? err.message : "Could not load lead."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [leadId, token]);

  useEffect(() => {
    void loadInteractions();
  }, [loadInteractions]);

  async function handleStatusChange(value: LeadStatus) {
    if (!token) return;
    setStatusUpdating(true);
    setStatusError("");
    try {
      await updateLead(token, leadId, { status: value });
      await refreshLead();
      onChanged();
      setStatusJustUpdated(true);
      setTimeout(() => setStatusJustUpdated(false), 1500);
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : "Status update failed.");
    } finally {
      setStatusUpdating(false);
    }
  }

  function startEditing() {
    if (!lead) return;
    editor.open(lead);
    setEditing(true);
  }

  function handleInteractionSaved() {
    setShowLogModal(false);
    setShowFollowupModal(false);
    void loadInteractions();
  }

  const leadName = lead
    ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || `Lead #${leadId}`
    : `Lead #${leadId}`;
  const converted = !!lead && isLeadConverted(lead);
  const canConvert = !!lead && !converted && lead.status !== "lost_lead";

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-[rgba(17,18,20,0.45)] backdrop-blur-[3px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section
        className="flex max-h-[90dvh] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(16,24,40,0.28)]"
        role="dialog" aria-modal="true" aria-labelledby="lead-detail-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EFEFF2] px-6 py-4">
          <div className="min-w-0 space-y-2">
            <h2 id="lead-detail-title" className="truncate text-[19px] font-bold tracking-[-0.01em] text-[#1A1C21]">
              {isLoading ? "Loading…" : leadName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#3A3E4A]">
              <span>{lead?.source_name ?? "No source"}</span>
              <span className="tabular-nums">{lead?.phone ?? "No phone"}</span>
              {lead && (
                <LeadStatusSelect
                  status={lead.status}
                  statuses={statuses}
                  onChange={(value) => void handleStatusChange(value)}
                  isUpdating={statusUpdating}
                  justUpdated={statusJustUpdated}
                  label={leadName}
                  locked={converted}
                />
              )}
            </div>
            {statusError && <p className="text-xs text-red-500">{statusError}</p>}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {lead && <WhatsAppButton leadId={lead.id} alreadySent={lead.whatsapp_sent} onSent={() => void refreshLead()} />}
            {lead && <WhatsAppChatLink phone={lead.phone} firstName={lead.first_name} />}
            {canConvert && lead && (
              <button type="button" onClick={() => onConverted(lead)}
                className="h-9 rounded-[8px] bg-teal-50 px-4 text-sm font-semibold text-teal-700 hover:bg-teal-100">
                Convert to contact
              </button>
            )}
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-[8px] text-[#6B7080] transition-colors hover:bg-[#F0F0F3]"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 border-b border-[#EFEFF2] px-6" role="tablist" aria-label="Lead sections">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`mr-6 border-b-2 py-3 text-sm font-semibold transition-colors ${
                tab === t ? "border-[#0E4D3A] text-[#0E4D3A]" : "border-transparent text-[#6B7080] hover:text-[#3A3E4A]"
              }`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {fetchError && <p className="px-6 py-4 text-sm text-red-500">{fetchError}</p>}
          {listsError && <p className="px-6 pt-4 text-sm text-red-500">{listsError}</p>}

          {tab === "details" && (
            <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
              <section className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6B7080]">Details</h3>
                  {editing ? (
                    <div className="flex gap-2">
                      <button type="button" disabled={editor.isSaving} onClick={() => setEditing(false)}
                        className="h-8 rounded-[8px] border border-[#DEE1E5] bg-white px-3 text-xs font-semibold text-[#3A3E4A] hover:bg-[#F3F3F5] disabled:opacity-50">
                        Cancel
                      </button>
                      <button type="button" disabled={editor.isSaving} onClick={() => void editor.submit()}
                        className="h-8 rounded-[8px] bg-[#0E4D3A] px-3 text-xs font-semibold text-white hover:bg-[#0B3E2F] disabled:opacity-60">
                        {editor.isSaving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  ) : (
                    <button type="button" disabled={!lead} onClick={startEditing}
                      className="h-8 rounded-[8px] border border-[#DEE1E5] bg-white px-3 text-xs font-semibold text-[#3A3E4A] hover:bg-[#F3F3F5] disabled:opacity-50">
                      Edit
                    </button>
                  )}
                </div>

                {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
                {lead && !editing && <LeadDetails lead={lead} />}
                {lead && editing && (
                  <>
                    <LeadForm form={editor.form} isEdit statuses={statuses} branches={branches} leadSources={leadSources} setField={editor.setField} />
                    {editor.saveError && (
                      <p role="alert" className="mt-4 rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{editor.saveError}</p>
                    )}
                  </>
                )}
              </section>

              <section className="min-w-0">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7080]">Timeline</h3>
                {listsLoading && <p className="text-sm text-gray-400">Loading…</p>}
                {!listsLoading && timeline.length === 0 && (
                  <p className="rounded-xl border border-dashed border-[#DEE1E5] px-4 py-8 text-center text-sm text-gray-500">No history yet.</p>
                )}
                {!listsLoading && timeline.length > 0 && (
                  <ol className="space-y-4 border-l border-[#E1E4EA] pl-5">
                    {timeline.map((ev) => (
                      <li key={ev.id} className="relative">
                        <span aria-hidden="true" className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#0E4D3A]" />
                        <p className="text-sm font-semibold text-[#1A1C21]">{ev.label}</p>
                        <p className="mt-0.5 text-xs text-[#8A8F9C]">
                          {formatDateTime(ev.created_at)}{ev.actor_name ? ` · ${ev.actor_name}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}

          {tab === "activity" && (
            <div className="px-6 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6B7080]">Activity log · {logs.length}</h3>
                <button onClick={() => setShowLogModal(true)}
                  className="h-8 rounded-lg bg-[#0E4D3A] px-3 text-xs font-semibold text-white hover:bg-[#0B3E2F]">
                  New activity
                </button>
              </div>
              {listsLoading && <p className="text-sm text-gray-400">Loading…</p>}
              {!listsLoading && logs.length === 0 && (
                <p className="rounded-xl border border-dashed border-[#DEE1E5] px-4 py-8 text-center text-sm text-gray-500">No activity logged yet.</p>
              )}
              {logs.length > 0 && (
                <ul className="space-y-3">
                  {logs.map((ia) => <ActivityCard key={ia.id} interaction={ia} />)}
                </ul>
              )}
            </div>
          )}

          {tab === "followups" && (
            <div className="px-6 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6B7080]">Follow-ups · {tasks.length}</h3>
                <button onClick={() => setShowFollowupModal(true)}
                  className="h-8 rounded-lg bg-[#0E4D3A] px-3 text-xs font-semibold text-white hover:bg-[#0B3E2F]">
                  New follow-up
                </button>
              </div>
              {listsLoading && <p className="text-sm text-gray-400">Loading…</p>}
              {!listsLoading && tasks.length === 0 && (
                <p className="rounded-xl border border-dashed border-[#DEE1E5] px-4 py-8 text-center text-sm text-gray-500">No follow-ups scheduled.</p>
              )}
              {tasks.length > 0 && (
                <ul className="space-y-3">
                  {tasks.map((t) => <FollowupCard key={t.id} task={t} />)}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {showLogModal && (
        <LeadActivityLogModal
          leadId={leadId}
          leadName={leadName}
          onSaved={handleInteractionSaved}
          onCancel={() => setShowLogModal(false)}
        />
      )}
      {showFollowupModal && (
        <LeadFollowupModal
          leadId={leadId}
          leadName={leadName}
          onSaved={handleInteractionSaved}
          onCancel={() => setShowFollowupModal(false)}
        />
      )}
    </div>
  );
}

// ── WhatsApp chat link ─────────────────────────────────────────────────────────

/** wa.me click-to-chat link. Indian 10-digit numbers get the 91 country code. */
function whatsAppChatUrl(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function WhatsAppChatLink({ phone, firstName }: { phone: string | null; firstName: string | null }) {
  const label = "Message on WhatsApp";
  if (!phone) {
    return (
      <span title="This lead has no phone number" className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
        <WhatsAppIcon />
      </span>
    );
  }
  return (
    <a
      href={whatsAppChatUrl(phone, `Hi ${firstName ?? "there"}, `)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white transition-colors hover:bg-[#1EBE5A]"
    >
      <WhatsAppIcon />
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 2.6 1 2.6.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

// ── Read-only details ──────────────────────────────────────────────────────────

function LeadDetails({ lead }: { lead: Lead }) {
  return (
    <dl className="rounded-xl border border-[#EFEFF2] px-4">
      <DetailRow label="Phone" value={lead.phone} />
      <DetailRow label="Email" value={lead.email} />
      <DetailRow label="Address" value={lead.address} />
      <DetailRow label="Source" value={lead.source_name} />
      <DetailRow label="Branch" value={lead.branch_name} />
      <DetailRow label="Status" value={lead.status} />
      <DetailRow label="Score" value={String(lead.score)} />
      <DetailRow label="Assigned to" value={lead.assigned_name} />
      <DetailRow label="Created by" value={lead.created_by_name} />
      <DetailRow label="Created" value={formatDateTime(lead.created_at)} />
      <DetailRow label="WhatsApp sent" value={lead.whatsapp_sent ? (lead.whatsapp_sent_at ? formatDateTime(lead.whatsapp_sent_at) : "Yes") : "No"} />
      <DetailRow label="Tags" value={lead.tags && lead.tags.length > 0 ? lead.tags.join(", ") : null} />
      <DetailRow label="Notes" value={lead.notes} />
    </dl>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#F0F0F3] py-2.5 text-sm last:border-0">
      <dt className="shrink-0 text-[#6B7080]">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[#1A1C21]">{value || "—"}</dd>
    </div>
  );
}

// ── Activity and follow-up cards ───────────────────────────────────────────────

function parseIso(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}

function formatDateTime(iso: string): string {
  return parseIso(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return parseIso(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function typeLabel(ia: Interaction): string {
  if (ia.activity_type === "other" && ia.custom_label) return ia.custom_label;
  return ia.activity_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-green-50 text-green-700",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  inprogress: "In progress",
  completed: "Completed",
};
const TASK_STATUS_BADGE: Record<string, string> = {
  todo: "bg-gray-100 text-gray-600",
  inprogress: "bg-blue-50 text-blue-700",
  completed: "bg-teal-50 text-teal-700",
};

function ActivityCard({ interaction: ia }: { interaction: Interaction }) {
  return (
    <li className="rounded-xl border border-[#EFEFF2] bg-[#FAFAFA] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">{typeLabel(ia)}</span>
            {ia.outcome && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-gray-600">{ia.outcome.replace(/_/g, " ")}</span>}
          </div>
          {ia.title && <p className="mt-1.5 text-sm font-semibold text-[#1A1C21]">{ia.title}</p>}
          {ia.notes && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#3A3E4A]">{ia.notes}</p>}
        </div>
        <span className="shrink-0 text-xs text-[#8A8F9C]">{formatDateTime(ia.logged_at)}</span>
      </div>
      {ia.done_by_name && <p className="mt-2 text-xs text-[#8A8F9C]">Logged by {ia.done_by_name}</p>}
    </li>
  );
}

function FollowupCard({ task: t }: { task: Interaction }) {
  const isOverdue = t.overdue_days > 0 && t.status !== "completed";
  return (
    <li className="rounded-xl border border-[#EFEFF2] bg-[#FAFAFA] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">{typeLabel(t)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PRIORITY_BADGE[t.priority] ?? ""}`}>{t.priority} priority</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TASK_STATUS_BADGE[t.status] ?? ""}`}>{TASK_STATUS_LABEL[t.status] ?? t.status}</span>
          </div>
          {t.title && <p className="mt-1.5 text-sm font-semibold text-[#1A1C21]">{t.title}</p>}
          {t.notes && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#3A3E4A]">{t.notes}</p>}
        </div>
        {t.due_at && (
          <div className="shrink-0 text-right text-xs">
            <p className={isOverdue ? "font-semibold text-red-500" : "text-[#3A3E4A]"}>
              {isOverdue ? `${t.overdue_days}d overdue` : `Due ${formatDate(t.due_at)}`}
            </p>
            <p className="text-[#8A8F9C]">{parseIso(t.due_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-[#8A8F9C]">
        {t.assigned_to_name ? `Assigned to ${t.assigned_to_name}` : "Unassigned"}
        {t.created_by_name ? ` · Created by ${t.created_by_name}` : ""}
      </p>
    </li>
  );
}
