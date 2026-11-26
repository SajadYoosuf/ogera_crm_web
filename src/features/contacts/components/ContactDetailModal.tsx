"use client";

/**
 * ContactDetailModal — opened by clicking a contact row.
 *
 * Header (always visible): name, type badge, phone, Edit and Delete buttons.
 * Tabs:
 *   Details     — read-only contact details with an Edit button
 *   Activity Log — every logged activity, with New activity at the top right
 *   Follow-ups   — every scheduled task with status and priority, with New follow-up at the top right
 */

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import { useAuth } from "@/context/AuthContext";
import { listContactInteractions, type Interaction } from "@/lib/api/interactions";
import { KIND_LABELS, type Contact } from "@/features/contacts/utils";
import { canDo, isLeadHead } from "@/lib/shared/roles";
import { useFollowupSettings } from "@/features/settings/hooks/useFollowupSettings";
import { FollowupCard, formatDateTime, typeLabel } from "@/features/leads/components/FollowupCard";
import ContactActivityLogModal from "./ContactActivityLogModal";
import ContactFollowupModal from "./ContactFollowupModal";
import VerifiedBadge from "./VerifiedBadge";
import { SpinnerRow } from "@/components/Spinner";

type Tab = "details" | "activity" | "followups";

const TAB_LABELS: Record<Tab, string> = {
  details: "Details",
  activity: "Activity Log",
  followups: "Follow-ups",
};

type Props = {
  contact: Contact | null;
  onClose: () => void;
  /** Open the edit form for this contact (opens the existing editor modal). */
  onEdit: (contact: Contact) => void;
  /** Open the delete confirmation for this contact. */
  onDelete: (contact: Contact) => void;
};

export default function ContactDetailModal({ contact, onClose, onEdit, onDelete }: Props) {
  if (!contact) return null;
  return <ContactDetailDialog key={contact.id} contact={contact} onClose={onClose} onEdit={onEdit} onDelete={onDelete} />;
}

function ContactDetailDialog({ contact, onClose, onEdit, onDelete }: Props & { contact: Contact }) {
  const { token, user } = useAuth();
  const canEdit = canDo(user, "contacts", "u");
  const canDelete = canDo(user, "contacts", "d");
  const { settings: followupSettings } = useFollowupSettings();
  const canCreateFollowup = isLeadHead(user) || followupSettings.allow_staff_create_followup;
  const [tab, setTab] = useState<Tab>("details");

  const [logs, setLogs] = useState<Interaction[]>([]);
  const [tasks, setTasks] = useState<Interaction[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState("");

  const [showLogModal, setShowLogModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);

  const loadInteractions = useCallback(async () => {
    if (!token) return;
    setListsLoading(true);
    setListsError("");
    try {
      const [activity, followups] = await Promise.all([
        listContactInteractions(token, contact.id, "log"),
        listContactInteractions(token, contact.id, "task"),
      ]);
      setLogs(activity);
      setTasks(followups);
    } catch (err) {
      setListsError(err instanceof ApiError ? err.message : "Could not load activity and follow-ups.");
    } finally {
      setListsLoading(false);
    }
  }, [contact.id, token]);

  useEffect(() => {
    void loadInteractions();
  }, [loadInteractions]);

  function handleInteractionSaved() {
    setShowLogModal(false);
    setShowFollowupModal(false);
    void loadInteractions();
  }

  const contactName = contact.name || contact.phone;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-[rgba(17,18,20,0.45)] backdrop-blur-[3px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section
        className="flex max-h-[90dvh] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(16,24,40,0.28)]"
        role="dialog" aria-modal="true" aria-labelledby="contact-detail-title"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EFEFF2] px-6 py-4">
          <div className="min-w-0 space-y-2">
            <h2 id="contact-detail-title" className="flex items-center gap-2 truncate text-[19px] font-bold tracking-[-0.01em] text-[#1A1C21]">
              {contactName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[#3A3E4A]">
              <span className={`inline-flex items-center rounded-[6px] px-2.5 py-0.5 text-xs font-semibold ${contact.kind === "partner" ? "bg-[#E7F5EE] text-[#0E4D3A]" : "bg-[#EEF4FF] text-[#1D5BBF]"}`}>
                {KIND_LABELS[contact.kind] ?? contact.kind}
              </span>
              <span className="tabular-nums">{contact.phone}</span>
              {contact.branch && <span className="capitalize">{contact.branch}</span>}
              <VerifiedBadge contact={contact} />
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {canEdit && (
              <button type="button" onClick={() => onEdit(contact)}
                className="h-9 rounded-[8px] border border-[#DEE1E5] bg-white px-4 text-sm font-semibold text-[#3A3E4A] hover:bg-[#F3F3F5]">
                Edit
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={() => onDelete(contact)}
                className="h-9 rounded-[8px] border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                Delete
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

        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-[#EFEFF2] px-6" role="tablist" aria-label="Contact sections">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`mr-6 border-b-2 py-3 text-sm font-semibold transition-colors ${
                tab === t ? "border-[#0E4D3A] text-[#0E4D3A]" : "border-transparent text-[#6B7080] hover:text-[#3A3E4A]"
              }`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {listsError && <p className="px-6 pt-4 text-sm text-red-500">{listsError}</p>}

          {tab === "details" && (
            <div className="px-6 py-5">
              <ContactDetails contact={contact} />
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
              {listsLoading && <SpinnerRow label="Loading activity…" />}
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
                {canCreateFollowup && (
                  <button onClick={() => setShowFollowupModal(true)}
                    className="h-8 rounded-lg bg-[#0E4D3A] px-3 text-xs font-semibold text-white hover:bg-[#0B3E2F]">
                    New follow-up
                  </button>
                )}
              </div>
              {listsLoading && <SpinnerRow label="Loading follow-ups…" />}
              {!listsLoading && tasks.length === 0 && (
                <p className="rounded-xl border border-dashed border-[#DEE1E5] px-4 py-8 text-center text-sm text-gray-500">No follow-ups scheduled.</p>
              )}
              {tasks.length > 0 && (
                <ul className="space-y-3">
                  {tasks.map((t) => (
                    <FollowupCard key={t.id} task={t} compact />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {showLogModal && (
        <ContactActivityLogModal
          contactId={contact.id}
          contactName={contactName}
          onSaved={handleInteractionSaved}
          onCancel={() => setShowLogModal(false)}
        />
      )}
      {showFollowupModal && (
        <ContactFollowupModal
          contactId={contact.id}
          contactName={contactName}
          onSaved={handleInteractionSaved}
          onCancel={() => setShowFollowupModal(false)}
        />
      )}
    </div>
  );
}

// ── Read-only details ──────────────────────────────────────────────────────────

function ContactDetails({ contact }: { contact: Contact }) {
  return (
    <dl className="rounded-xl border border-[#EFEFF2] px-4 max-w-lg">
      <DetailRow label="Phone" value={contact.phone} />
      <DetailRow label="Type" value={KIND_LABELS[contact.kind] ?? contact.kind} />
      {contact.partnerType && <DetailRow label="Partner type" value={contact.partnerType.replace(/_/g, " ")} />}
      <DetailRow label="Branch" value={contact.branch} />
      <DetailRow label="District" value={contact.district} />
      <DetailRow label="Address" value={contact.address} />
      <DetailRow label="Source" value={contact.source} />
      <DetailRow label="Stage" value={contact.stage ? contact.stage.replace(/_/g, " ") : null} />
      <DetailRow label="Assigned to" value={contact.assignedTo} />
      <DetailRow label="Created by" value={contact.createdBy} />
      <DetailRow label="Added" value={formatDateTime(contact.createdAt)} />
      <DetailRow label="Verified" value={contact.isVerified ? "Yes" : "No"} />
      {contact.missingFields.length > 0 && (
        <DetailRow label="Missing" value={contact.missingFields.join(", ")} />
      )}
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

// ── Activity card ──────────────────────────────────────────────────────────────

function ActivityCard({ interaction: ia }: { interaction: Interaction }) {
  return (
    <li className="rounded-xl border border-[#EFEFF2] bg-[#FAFAFA] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">{typeLabel(ia.activity_type, ia.custom_label)}</span>
            {ia.outcome && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-gray-600">{ia.outcome.replace(/_/g, " ")}</span>}
          </div>
          {ia.title && <p className="mt-1.5 text-sm font-semibold text-[#1A1C21]">{ia.title}</p>}
          {ia.notes && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#3A3E4A]">{ia.notes}</p>}
        </div>
        <span className="shrink-0 text-xs text-[#8A8F9C]">{formatDateTime(ia.logged_at)}</span>
      </div>
      {ia.done_by_name && (
        <p className="mt-2 text-xs text-[#8A8F9C]">Logged by {ia.done_by_name}</p>
      )}
    </li>
  );
}
