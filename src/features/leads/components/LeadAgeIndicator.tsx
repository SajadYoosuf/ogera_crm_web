/**
 * LeadAgeIndicator — shows how old a lead is as a human string,
 * and adds a visual urgency ring for new leads that have been waiting too long.
 *
 * URGENCY RULES (only for status="new"):
 *   > 48 hours → red (critical)
 *   > 24 hours → yellow (warning)
 *   otherwise  → no highlight
 */

import type { LeadStatus } from "@/features/leads/api/leads";

function ageLabel(createdAt: string): string {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ageMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function urgencyClass(createdAt: string, status: LeadStatus): string {
  if (status !== "new") return "text-gray-400";
  const ageHrs = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  if (ageHrs > 48) return "text-red-500 font-semibold";
  if (ageHrs > 24) return "text-yellow-500 font-medium";
  return "text-gray-400";
}

type Props = { createdAt: string; status: LeadStatus };

export default function LeadAgeIndicator({ createdAt, status }: Props) {
  return (
    <span
      className={`text-xs tabular-nums ${urgencyClass(createdAt, status)}`}
      title={new Date(createdAt).toLocaleString()}
    >
      {ageLabel(createdAt)}
    </span>
  );
}
