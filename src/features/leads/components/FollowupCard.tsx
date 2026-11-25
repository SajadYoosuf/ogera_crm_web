"use client";

/**
 * FollowupCard and helpers shared by the lead detail (Follow-ups tab) and the Tasks page.
 *
 * Status labels come from Settings (enum category task_status) and colours from the
 * follow-up settings; the stored values (todo, inprogress, completed) never change.
 */

import type { ReactNode } from "react";
import type { Interaction } from "@/lib/api/interactions";
import { staticOptions, useEnumOptions } from "@/hooks/useEnumOptions";
import { useFollowupSettings } from "@/features/settings/hooks/useFollowupSettings";
import type { StatusColor } from "@/features/settings/api/followupSettings";

/** API times without an offset are UTC. */
export function parseIso(iso: string): Date {
  return new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + "Z");
}

export function formatDateTime(iso: string): string {
  return parseIso(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return parseIso(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(iso: string): string {
  return parseIso(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function typeLabel(activityType: string, customLabel?: string | null, labelOf?: (v: string) => string): string {
  if (activityType === "other" && customLabel) return customLabel;
  if (labelOf) return labelOf(activityType);
  return activityType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "45m overdue", "3h overdue", "2d overdue". */
export function overdueText(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, minutes)}m overdue`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h overdue`;
  return `${Math.floor(minutes / (60 * 24))}d overdue`;
}

/** Minutes overdue, from the API when present, else derived from the due time. */
export function overdueMinutes(t: Interaction): number {
  if (t.status === "completed" || !t.due_at) return 0;
  if (typeof t.overdue_minutes === "number") return t.overdue_minutes;
  return Math.max(0, Math.floor((Date.now() - parseIso(t.due_at).getTime()) / 60000));
}

export const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-green-50 text-green-700",
};

export const COLOR_BADGE: Record<StatusColor, string> = {
  gray: "bg-gray-100 text-gray-600",
  blue: "bg-blue-50 text-blue-700",
  teal: "bg-teal-50 text-teal-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  purple: "bg-purple-50 text-purple-700",
};

export const TASK_STATUS_FALLBACK = staticOptions([
  { value: "todo", label: "To do" },
  { value: "inprogress", label: "In progress" },
  { value: "completed", label: "Completed" },
]);

const PRIORITY_FALLBACK = staticOptions([
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]);

/** Status label and badge classes as configured in Settings. */
export function useTaskStatusStyle() {
  const { labelOf } = useEnumOptions("task_status", TASK_STATUS_FALLBACK);
  const { settings } = useFollowupSettings();
  return (status: string) => ({
    label: labelOf(status),
    className: COLOR_BADGE[settings.status_colors[status as keyof typeof settings.status_colors] ?? "gray"] ?? COLOR_BADGE.gray,
  });
}

export function FollowupCard({ task: t, heading, onOpen, compact = false, children }: {
  task: Interaction;
  /** Shown above the title (the lead's name on the Tasks page). */
  heading?: ReactNode;
  /** Makes the card body a button, e.g. to open the lead. */
  onOpen?: () => void;
  /** Only the type, title, assignee and due date and time. */
  compact?: boolean;
  children?: ReactNode;
}) {
  const statusStyle = useTaskStatusStyle()(t.status);
  const { labelOf: priorityLabel } = useEnumOptions("task_priority", PRIORITY_FALLBACK);
  const { labelOf: activityLabel } = useEnumOptions("activity_type");
  const minutes = overdueMinutes(t);

  if (compact) {
    return (
      <li className="rounded-xl border border-[#EFEFF2] bg-[#FAFAFA] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">{typeLabel(t.activity_type, t.custom_label, activityLabel)}</span>
          {t.title && <p className="text-sm font-semibold text-[#1A1C21]">{t.title}</p>}
        </div>
        <p className="mt-1.5 text-xs text-[#6B7080]">
          {t.assigned_to_name ?? "Unassigned"}
          {t.due_at && ` · Due ${formatDate(t.due_at)}, ${formatTime(t.due_at)}`}
        </p>
        {children}
      </li>
    );
  }
  const isOverdue = minutes > 0;
  const actual = t.status === "completed" && t.actual_activity_type && t.actual_activity_type !== t.activity_type
    ? typeLabel(t.actual_activity_type, t.actual_custom_label, activityLabel)
    : null;

  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {heading}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">{typeLabel(t.activity_type, t.custom_label, activityLabel)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_BADGE[t.priority] ?? ""}`}>{priorityLabel(t.priority)} priority</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle.className}`}>{statusStyle.label}</span>
          {actual && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">Done via {actual}</span>}
        </div>
        {t.title && <p className="mt-1.5 text-sm font-semibold text-[#1A1C21]">{t.title}</p>}
        {t.notes && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#3A3E4A]">{t.notes}</p>}
      </div>
      {t.due_at && (
        <div className="shrink-0 text-right text-xs">
          <p className={isOverdue ? "font-semibold text-red-600" : "text-[#3A3E4A]"}>
            {isOverdue ? overdueText(minutes) : `Due ${formatDate(t.due_at)}`}
          </p>
          <p className="text-[#8A8F9C]">{isOverdue ? `${formatDate(t.due_at)}, ${formatTime(t.due_at)}` : formatTime(t.due_at)}</p>
          {t.completed_at && <p className="mt-0.5 text-[#8A8F9C]">Done {formatDateTime(t.completed_at)}</p>}
        </div>
      )}
    </div>
  );

  return (
    <li className={`rounded-xl border bg-[#FAFAFA] p-4 ${isOverdue ? "border-red-200" : "border-[#EFEFF2]"}`}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="block w-full rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
          {body}
        </button>
      ) : body}
      <p className="mt-2 text-xs text-[#8A8F9C]">
        {t.assigned_to_name ? `Assigned to ${t.assigned_to_name}` : "Unassigned"}
        {t.created_by_name ? ` · Created by ${t.created_by_name}` : ""}
      </p>
      {children}
    </li>
  );
}
