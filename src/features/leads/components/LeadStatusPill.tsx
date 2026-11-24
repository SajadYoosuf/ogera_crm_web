/**
 * LeadStatusPill — a small colour-coded badge showing a lead's current status,
 * plus the shared colour map other lead-status UI (the table's inline
 * dropdown, LeadStatusSelect) reuses so every status always looks the same
 * wherever it appears.
 *
 * Statuses themselves come from the lead_statuses table (GET /leads/statuses) —
 * this file only owns the COLOUR, since the backend doesn't have an opinion on
 * that. Any slug not in the map below (e.g. a brand new one just added in the
 * DB) falls back to a neutral grey instead of crashing.
 */

import type { LeadStatus } from "@/features/leads/api/leads";

/** badge background + text classes, keyed by status slug */
export const STATUS_BADGE_COLOR: Record<string, string> = {
  new:                "bg-blue-100 text-blue-700",
  attempt_to_contact: "bg-amber-100 text-amber-700",
  contact_in_future:  "bg-indigo-100 text-indigo-700",
  contacted:          "bg-yellow-100 text-yellow-700",
  pre_qualified:      "bg-green-100 text-green-700",
  not_qualified:      "bg-gray-100 text-gray-500",
  not_contacted:      "bg-orange-100 text-orange-700",
  junk_lead:          "bg-rose-100 text-rose-600",
  lost_lead:          "bg-gray-100 text-gray-500",
  converted:          "bg-teal-100 text-teal-700",
};

/** small solid dot colour, keyed by status slug — used in the status dropdown list */
export const STATUS_DOT_COLOR: Record<string, string> = {
  new:                "bg-blue-500",
  attempt_to_contact: "bg-amber-500",
  contact_in_future:  "bg-indigo-500",
  contacted:          "bg-yellow-400",
  pre_qualified:      "bg-green-500",
  not_qualified:      "bg-gray-400",
  not_contacted:      "bg-orange-500",
  junk_lead:          "bg-rose-500",
  lost_lead:          "bg-gray-400",
  converted:          "bg-teal-500",
};

export const STATUS_FALLBACK_BADGE = "bg-slate-100 text-slate-600";
export const STATUS_FALLBACK_DOT = "bg-slate-400";

export function statusBadgeClass(status: LeadStatus): string {
  return STATUS_BADGE_COLOR[status] ?? STATUS_FALLBACK_BADGE;
}

export function statusDotClass(status: LeadStatus): string {
  return STATUS_DOT_COLOR[status] ?? STATUS_FALLBACK_DOT;
}

export default function LeadStatusPill({ status, label }: { status: LeadStatus; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}>
      {label}
    </span>
  );
}
