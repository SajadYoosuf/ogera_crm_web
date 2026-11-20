"use client";

/**
 * LeadForm — shared form for creating and editing leads.
 *
 * Renders inside the lead modal. The parent (useLeadEditor) owns all state;
 * this component is pure UI that calls setField on each change.
 */

import PhoneField from "@/components/PhoneField";
import SelectField from "@/components/SelectField";
import { todayDate, type LeadFormState } from "@/features/leads/hooks/useLeadEditor";
import type { LeadStatusOption } from "@/lib/api/leads-module";
import type { BranchOption, LeadSource } from "@/features/contacts/api/contacts";

type Props = {
  form: LeadFormState;
  isEdit: boolean;
  statuses: LeadStatusOption[];
  branches: BranchOption[];
  /** From GET /lead-sources — the same endpoint and data the Contacts source picker uses. */
  leadSources: LeadSource[];
  setField: <K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) => void;
};

const inputClass =
  "block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function LeadForm({ form, isEdit, statuses, branches, leadSources, setField }: Props) {
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
        <SelectField
          label="Status"
          value={form.status}
          onChange={(value) => setField("status", value)}
          options={[
            ...statuses.map((s) => ({ value: s.value, label: s.label })),
            // "converted" isn't in lead_statuses (it's set by the Convert action), but an
            // already-converted lead must still show its current status in this list.
            ...(form.status === "converted" ? [{ value: "converted", label: "Converted" }] : []),
          ]}
        />
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

      {/* Tags + Lead date — 2-col on wider modal (create mode) */}
      {!isEdit ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div>
            <label htmlFor="lead-date" className={labelClass}>
              Lead date <span className="text-gray-400">(for older leads)</span>
            </label>
            <input
              id="lead-date"
              type="date"
              className={inputClass}
              value={form.lead_date}
              max={todayDate()}
              onChange={(e) => setField("lead_date", e.target.value)}
            />
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
