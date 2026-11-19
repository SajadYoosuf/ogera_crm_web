/**
 * LeadStatusPill — a small colour-coded badge showing a lead's current status.
 *
 * Colour meaning:
 *   new       → blue (just arrived, needs attention)
 *   contacted → yellow (someone reached out)
 *   qualified → green (promising)
 *   converted → teal (done — became a contact)
 *   lost      → gray (no longer active)
 */

import type { LeadStatus } from "@/lib/api/leads-module";

const COLOR: Record<LeadStatus, string> = {
  new:       "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-green-100 text-green-700",
  converted: "bg-teal-100 text-teal-700",
  lost:      "bg-gray-100 text-gray-500",
};

const LABEL: Record<LeadStatus, string> = {
  new:       "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  lost:      "Lost",
};

export default function LeadStatusPill({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR[status]}`}>
      {LABEL[status]}
    </span>
  );
}
