"use client";

/**
 * LeadForm — shared form for creating and editing leads.
 *
 * Renders inside LeadDrawer. The parent (useLeadEditor) owns all state;
 * this component is pure UI that calls setField on each change.
 */

import type { LeadFormState } from "@/features/leads/hooks/useLeadEditor";
import type { LeadStatus } from "@/lib/api/leads-module";

// Hardcoded from seed data in lead_sources table
const SOURCES: { value: number; label: string }[] = [
  { value: 1, label: "Walk-in" },
  { value: 2, label: "Referral" },
  { value: 3, label: "Meta Ads" },
  { value: 4, label: "Website" },
  { value: 5, label: "WhatsApp" },
  { value: 6, label: "JustDial" },
  { value: 7, label: "GMB" },
  { value: 8, label: "Field Visit" },
];

const STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new",       label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "lost",      label: "Lost" },
];

type Props = {
  form: LeadFormState;
  isEdit: boolean;
  setField: <K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) => void;
};

const inputClass =
  "block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function LeadForm({ form, isEdit, setField }: Props) {
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

      {/* Phone + Email — 2-col on wider modal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="lead-phone" className={labelClass}>Phone</label>
          <input
            id="lead-phone"
            className={inputClass}
            type="tel"
            name="tel"
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="e.g. 9876543210"
          />
        </div>
        <div>
          <label htmlFor="lead-email" className={labelClass}>Email</label>
          <input
            id="lead-email"
            className={inputClass}
            type="email"
            name="email"
            autoComplete="email"
            spellCheck={false}
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="optional"
          />
        </div>
      </div>

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
        <div>
          <label htmlFor="lead-source" className={labelClass}>Source</label>
          <select
            id="lead-source"
            className={inputClass}
            value={form.source_id}
            onChange={(e) => setField("source_id", Number(e.target.value))}
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status — edit mode only, full width */}
      {isEdit && (
        <div>
          <label htmlFor="lead-status" className={labelClass}>Status</label>
          <select
            id="lead-status"
            className={inputClass}
            value={form.status}
            onChange={(e) => setField("status", e.target.value as LeadStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
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
              max={new Date().toISOString().slice(0, 10)}
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
