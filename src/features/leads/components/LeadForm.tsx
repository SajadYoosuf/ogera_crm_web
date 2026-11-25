"use client";

/**
 * LeadForm — shared form for creating and editing leads.
 *
 * Renders inside the lead modal. The parent (useLeadEditor) owns all state;
 * this component is pure UI that calls setField on each change.
 */

import PhoneField from "@/components/PhoneField";
import SelectField from "@/components/SelectField";
import type { LeadFormState } from "@/features/leads/hooks/useLeadEditor";
import type { LeadStatusOption } from "@/features/leads/api/leads";
import type { BranchOption, LeadSource } from "@/features/contacts/api/contacts";

type Props = {
  form: LeadFormState;
  isEdit: boolean;
  statuses: LeadStatusOption[];
  branches: BranchOption[];
  /** From GET /lead-sources — the same endpoint and data the Contacts source picker uses. */
  leadSources: LeadSource[];
  setField: <K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) => void;
  /** Admin/manager: may backdate and pick the assignee on create. Staff see neither field. */
  canManage?: boolean;
  /** Options for the "Assign to" picker (create mode, admin/manager only). */
  /** Admin/manager only: null = auto-assign on create or keep current on edit. */
  assignees?: { id: number; name: string; role_name?: string }[];
};

const inputClass =
  "block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function LeadForm({ form, isEdit, statuses, branches, leadSources, setField, canManage = false, assignees = [] }: Props) {
  return (
    <div className="space-y-4">
      {/* Name row — always 2-col */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lead-first-name" className={labelClass}>First name *</label>
          <input
            id="lead-first-name"
            className={inputClass}
            name="given-name"
            autoComplete="given-name"
            value={form.first_name}
            onChange={(e) => setField("first_name", e.target.value)}
            placeholder="e.g. Ravi"
            required
          />
        </div>
        <div>
          <label htmlFor="lead-last-name" className={labelClass}>Last name</label>
          <input
            id="lead-last-name"
            className={inputClass}
            name="family-name"
            autoComplete="family-name"
            value={form.last_name}
            onChange={(e) => setField("last_name", e.target.value)}
            placeholder="e.g. Kumar"
          />
        </div>
      </div>

      {/* Phone — required, with country code */}
      <PhoneField key={isEdit ? "edit" : "new"} value={form.phone} onChange={(value) => setField("phone", value)} />

      {/* Address + Source — 2-col on wider modal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="lead-address" className={labelClass}>Address / Location</label>
          <input
            id="lead-address"
            className={inputClass}
            name="street-address"
            autoComplete="street-address"
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
            placeholder="e.g. Calicut, Kerala"
          />
        </div>
        <SelectField
          label="Source"
          value={String(form.source_id)}
          onChange={(value) => setField("source_id", Number(value))}
          options={leadSources.map((s) => ({ value: String(s.id), label: s.name }))}
        />
      </div>

      {/* Branch — optional; blank means "default to my own branch" (set server-side) */}
      {branches.length > 0 && (
        <SelectField
          label="Branch"
          value={form.branch_id != null ? String(form.branch_id) : ""}
          onChange={(value) => setField("branch_id", value ? Number(value) : null)}
          placeholder={isEdit ? "Not assigned" : "Your branch (default)"}
          options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
        />
      )}

      {/* Status — edit mode only, full width. Options come from GET /leads/statuses. */}
      {isEdit && statuses.length > 0 && (
        form.status === "converted" ? (
          // A converted lead's status is locked (the backend returns 409 for changes).
          // Show it as text so the user is not offered a change that will fail.
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-700">Status</span>
            <p className="text-sm text-gray-600">Converted — status is locked. Change the contact instead.</p>
          </div>
        ) : (
          <SelectField
            label="Status"
            value={form.status}
            onChange={(value) => setField("status", value)}
            options={statuses.map((s) => ({ value: s.value, label: s.label }))}
          />
        )
      )}

      <div>
        <label htmlFor="lead-notes" className={labelClass}>Notes</label>
        <textarea
          id="lead-notes"
          className={`${inputClass} resize-none`}
          rows={3}
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          placeholder="Any extra context about this lead…"
        />
      </div>

      {/* Assign to — admin/manager on create (blank = auto-assign) and edit (blank = keep current). */}
      {canManage && assignees.length > 0 && (
        <SelectField
          label="Assign to"
          value={form.assigned_to != null ? String(form.assigned_to) : ""}
          onChange={(value) => setField("assigned_to", value ? Number(value) : null)}
          placeholder={isEdit ? "Keep current" : "Auto-assign"}
          options={assignees.map((e) => ({ value: String(e.id), label: e.role_name ? `${e.name} · ${e.role_name}` : e.name }))}
        />
      )}

      <div>
        <label htmlFor="lead-tags" className={labelClass}>Tags <span className="text-gray-400">(comma-separated)</span></label>
        <input
          id="lead-tags"
          className={inputClass}
          value={form.tags}
          onChange={(e) => setField("tags", e.target.value)}
          placeholder="e.g. hot, plumber, calicut"
        />
      </div>
    </div>
  );
}
