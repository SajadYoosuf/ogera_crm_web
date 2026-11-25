"use client";

/**
 * LeadModal — centered modal for creating and editing a lead.
 *
 * Replaces the old side-drawer (LeadDrawer): matches the centered-modal
 * pattern already used on the Contacts screen — one modal, always editable,
 * no separate read-only "view mode" to click through first.
 *
 * The dialog is only mounted while it is open, so every open starts from a
 * fresh form (a create form never keeps the values of the last lead).
 */

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import { useAuth } from "@/context/AuthContext";
import { getLead, deleteLead, isLeadConverted, type Lead, type LeadStatusOption } from "@/features/leads/api/leads";
import type { BranchOption, LeadSource } from "@/features/contacts/api/contacts";
import LeadStatusPill from "./LeadStatusPill";
import LeadScoreBar from "./LeadScoreBar";
import WhatsAppButton from "./WhatsAppButton";
import LeadForm from "./LeadForm";
import ErrorPopup from "@/components/ErrorPopup";
import { useLeadEditor } from "@/features/leads/hooks/useLeadEditor";

type Props = {
  /** Set to open the modal in edit mode for this lead; null/undefined with isCreateOpen=false keeps it closed. */
  leadId: number | null;
  /** Set to open the modal in create mode. */
  isCreateOpen: boolean;
  statuses: LeadStatusOption[];
  branches: BranchOption[];
  leadSources: LeadSource[];
  onClose: () => void;
  onConverted: (lead: Lead) => void;
  onDeleted: () => void;
  onSaved: () => void;
};

export default function LeadModal(props: Props) {
  const isOpen = props.leadId !== null || props.isCreateOpen;
  if (!isOpen) return null;
  return <LeadModalDialog key={props.leadId ?? "new"} {...props} />;
}

function LeadModalDialog({ leadId, statuses, branches, leadSources, onClose, onConverted, onDeleted, onSaved }: Props) {
  const { token } = useAuth();
  const isEdit = leadId !== null;
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [fetchError, setFetchError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const editor = useLeadEditor(() => {
    onSaved();
    onClose();
  });

  useEffect(() => {
    if (leadId === null) return;
    if (!token) return;
    let cancelled = false;
    getLead(token, leadId)
      .then((data) => {
        if (cancelled) return;
        setLead(data);
        editor.open(data);
      })
      .catch((err) => { if (!cancelled) setFetchError(err instanceof ApiError ? err.message : "Could not load lead."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // Create mode: set up the blank form once the modal opens, so it starts on the employee's own branch.
  useEffect(() => {
    if (leadId === null) editor.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshLead() {
    if (!token || leadId === null) return;
    try {
      setLead(await getLead(token, leadId));
    } catch (err) {
      setFetchError(err instanceof ApiError ? err.message : "Could not load lead.");
    }
  }

  async function handleDeleteConfirmed() {
    if (!lead) return;
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

  const currentStatusLabel = statuses.find((s) => s.value === lead?.status)?.label
    ?? (lead?.status === "converted" ? "Converted" : lead?.status ?? "");

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-[rgba(17,18,20,0.45)] backdrop-blur-[3px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section
        className="w-full max-w-[560px] max-h-[90dvh] bg-white rounded-2xl shadow-[0_24px_64px_rgba(16,24,40,0.28)] flex flex-col overflow-hidden"
        role="dialog" aria-modal="true" aria-labelledby="lead-form-title"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EFEFF2] px-6 py-5">
          <div>
            <h2 id="lead-form-title" className="text-[19px] font-bold tracking-[-0.01em] text-[#1A1C21]">
              {isEdit ? "Edit lead" : "New lead"}
            </h2>
            <p className="mt-0.5 text-[13px] text-[#6B7080]">
              {isEdit ? "Update this lead's details" : "Save a new lead to the pipeline"}
            </p>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[#6B7080] transition-colors hover:bg-[#F0F0F3]"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
            {fetchError && <p className="text-sm text-red-500">{fetchError}</p>}

            {/* Read-only summary row — status, score, WhatsApp. Only once the lead is loaded. */}
            {isEdit && lead && (
              <div className="flex items-center gap-3 flex-wrap">
                <LeadStatusPill status={lead.status} label={currentStatusLabel} />
                <LeadScoreBar score={lead.score} />
                <WhatsAppButton leadId={lead.id} alreadySent={lead.whatsapp_sent} onSent={() => void refreshLead()} />
              </div>
            )}

            {lead?.status === "converted" && lead.contact_id && (
              <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-700">
                Converted — linked to Contact #{lead.contact_id}
              </p>
            )}

            {(!isEdit || lead) && (
              <LeadForm form={editor.form} isEdit={isEdit} statuses={statuses} branches={branches} leadSources={leadSources} setField={editor.setField} />
            )}

            {editor.saveError && <ErrorPopup message={editor.saveError} onDismiss={editor.clearSaveError} />}
            {deleteError && (
              <div className="mt-1 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <span>{deleteError}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-2.5 border-t border-[#EFEFF2] px-6 py-4">
            <div>
              {isEdit && lead && (
                <div className="flex items-center gap-2">
                  {!isLeadConverted(lead) && lead.status !== "lost_lead" && (
                    <button
                      type="button" onClick={() => onConverted(lead)}
                      className="h-10 rounded-[8px] bg-teal-50 px-4 text-[14px] font-semibold text-teal-700 transition-colors hover:bg-teal-100"
                    >
                      Convert
                    </button>
                  )}
                  {confirmingDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600">Delete?</span>
                      <button
                        type="button" onClick={() => void handleDeleteConfirmed()} disabled={isDeleting}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {isDeleting ? "…" : "Yes"}
                      </button>
                      <button
                        type="button" onClick={() => { setConfirmingDelete(false); setDeleteError(""); }}
                        className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button" onClick={() => setConfirmingDelete(true)} disabled={isDeleting}
                      className="flex h-10 w-10 items-center justify-center rounded-[8px] text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                      title="Delete lead"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button" disabled={editor.isSaving} onClick={onClose}
                className="h-10 rounded-[8px] border border-[#DEE1E5] bg-white px-4 text-[14px] font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button" disabled={editor.isSaving || (isEdit && !lead)} onClick={() => void editor.submit()}
                className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0E4D3A] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#0B3E2F] disabled:opacity-60"
              >
                {editor.isSaving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />}
                {editor.isSaving ? "Saving…" : isEdit ? "Save changes" : "Add lead"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
