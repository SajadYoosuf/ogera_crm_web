"use client";

/**
 * LeadDrawer — a slide-over panel showing full lead details with inline editing.
 *
 * HOW IT WORKS:
 *   - Opens from the right when the user clicks a lead row.
 *   - Shows read-only details by default.
 *   - "Edit" button switches to LeadForm for updating the lead.
 *   - "Convert" button opens ConvertLeadModal.
 *   - "Delete" does a soft-delete and closes the drawer.
 */

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import { getLead, deleteLead, type Lead } from "@/lib/api/leads-module";
import LeadStatusPill from "./LeadStatusPill";
import LeadSourceBadge from "./LeadSourceBadge";
import LeadScoreBar from "./LeadScoreBar";
import WhatsAppButton from "./WhatsAppButton";
import LeadForm from "./LeadForm";
import { useLeadEditor } from "@/features/leads/hooks/useLeadEditor";

type Props = {
  leadId: number | null;
  onClose: () => void;
  onConverted: (leadId: number) => void;
  onDeleted: () => void;
  onSaved: () => void;
};

export default function LeadDrawer({ leadId, onClose, onConverted, onDeleted, onSaved }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const editor = useLeadEditor(() => {
    setIsEditing(false);
    onSaved();
    if (leadId) loadLead(leadId);
  });

  async function loadLead(id: number) {
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    setIsLoading(true);
    setFetchError("");
    try {
      const data = await getLead(token, id);
      setLead(data);
    } catch (err) {
      setFetchError(err instanceof ApiError ? err.message : "Could not load lead.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (leadId) {
      setIsEditing(false);
      void loadLead(leadId);
    } else {
      setLead(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function handleDelete() {
    if (!lead) return;
    const token = sessionStorage.getItem("ogera_access_token");
    if (!token) return;
    if (!confirm(`Delete lead "${lead.first_name ?? "this lead"}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await deleteLead(token, lead.id);
      onDeleted();
      onClose();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Delete failed.");
    } finally {
      setIsDeleting(false);
    }
  }

  const isOpen = leadId !== null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={onClose}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lead details"
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {isLoading ? "Loading…" : lead ? `${lead.first_name ?? ""}${lead.last_name ? " " + lead.last_name : ""}`.trim() || "Lead" : "Lead"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {fetchError && <p className="text-sm text-red-500">{fetchError}</p>}

          {lead && !isEditing && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <LeadStatusPill status={lead.status} />
                <LeadSourceBadge sourceName={lead.source_name ?? null} />
                <LeadScoreBar score={lead.score} />
              </div>

              <dl className="space-y-3 text-sm">
                {lead.phone && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Phone</dt>
                    <dd className="mt-0.5 text-gray-900">{lead.phone}</dd>
                  </div>
                )}
                {lead.email && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Email</dt>
                    <dd className="mt-0.5 text-gray-900">{lead.email}</dd>
                  </div>
                )}
                {lead.assigned_name && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Assigned to</dt>
                    <dd className="mt-0.5 text-gray-900">{lead.assigned_name}</dd>
                  </div>
                )}
                {lead.address && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Address</dt>
                    <dd className="mt-0.5 text-gray-900">{lead.address}</dd>
                  </div>
                )}
                {lead.notes && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Notes</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-gray-900">{lead.notes}</dd>
                  </div>
                )}
                {lead.tags && lead.tags.length > 0 && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Tags</dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {lead.tags.map((t) => (
                        <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{t}</span>
                      ))}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-gray-500">Created</dt>
                  <dd className="mt-0.5 text-gray-900">{new Date(lead.created_at).toLocaleString()}</dd>
                </div>
              </dl>

              <WhatsAppButton
                leadId={lead.id}
                alreadySent={lead.whatsapp_sent}
                onSent={() => loadLead(lead.id)}
              />

              {lead.status === "converted" && lead.contact_id && (
                <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-700">
                  Converted — linked to Contact #{lead.contact_id}
                </p>
              )}
            </div>
          )}

          {lead && isEditing && (
            <LeadForm
              form={editor.form}
              isEdit
              setField={editor.setField}
            />
          )}
        </div>

        {/* Footer actions */}
        {lead && (
          <div className="shrink-0 border-t border-gray-100 px-5 py-4">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={() => void editor.submit()}
                  disabled={editor.isSaving}
                  className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  {editor.isSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setIsEditing(false); editor.close(); }}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => { setIsEditing(true); editor.open(lead); }}
                  className="flex-1 rounded-xl bg-[#0E4D3A] py-2.5 text-sm font-semibold text-white hover:bg-[#0a3a2b] transition-colors"
                >
                  Edit
                </button>
                {lead.status !== "converted" && lead.status !== "lost" && (
                  <button
                    onClick={() => onConverted(lead.id)}
                    className="flex-1 rounded-xl bg-teal-50 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
                  >
                    Convert
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  title="Delete lead"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            )}
            {editor.saveError && (
              <p className="mt-2 text-xs text-red-500">{editor.saveError}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
