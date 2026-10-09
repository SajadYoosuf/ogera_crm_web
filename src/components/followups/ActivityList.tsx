"use client";

import { useState } from "react";
import { DatePickerField, TimePickerField } from "@/components/SchedulePickers";
import type { ActivityItem } from "@/lib/api/activities";
import { ActivityTypeIcon } from "./ActivityIcons";
import OutcomeForm from "./OutcomeForm";
import { formatClock, formatDay, formatWhen, isoDate, typeLabel } from "./activities";

const CHIP: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  due_today: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
  done: "bg-green-50 text-green-700",
};

function chipLabel(item: ActivityItem) {
  if (item.task_state === "overdue") return item.overdue_days > 0 ? `Overdue ${item.overdue_days}d` : "Overdue";
  if (item.task_state === "due_today") return "Due today";
  if (item.task_state === "done") return "Done";
  return "Pending";
}

const dueText = (item: ActivityItem) =>
  `${formatDay(item.scheduled_date ?? "")}${item.scheduled_time ? ` · ${formatClock(item.scheduled_time)}` : ""}`;

function Skeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading activity" className="mt-4 space-y-3 animate-pulse">
      {[0, 1, 2].map((row) => (
        <li key={row} className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm">
          <span className="block h-3.5 w-1/3 rounded bg-gray-200" />
          <span className="mt-2 block h-3 w-3/4 rounded bg-gray-100" />
          <span className="mt-2 block h-3 w-1/2 rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}

/** The combined list: finished activity entries and follow-up tasks, newest first. */
export default function ActivityList({ items, error, emptyText, onRetry, onMarkDone, onReschedule }: {
  items: ActivityItem[] | null; error: string; emptyText: string; onRetry: () => void;
  onMarkDone: (item: ActivityItem, outcome: string) => Promise<void>;
  onReschedule: (item: ActivityItem, date: string, time: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [completing, setCompleting] = useState<number | null>(null);
  const [rescheduling, setRescheduling] = useState<{ id: number; date: string; time: string; error: string } | null>(null);
  const [today] = useState(() => isoDate());

  async function run(id: number, action: () => Promise<void>) {
    setBusyId(id);
    try { await action(); } finally { setBusyId(null); }
  }

  async function saveReschedule() {
    if (!rescheduling) return;
    if (!rescheduling.date) { setRescheduling({ ...rescheduling, error: "Pick the new due date." }); return; }
    if (rescheduling.date < today) { setRescheduling({ ...rescheduling, error: "The due date cannot be in the past." }); return; }
    const item = items?.find((entry) => entry.id === rescheduling.id);
    if (!item) return;
    try {
      await run(item.id, () => onReschedule(item, rescheduling.date, rescheduling.time));
      setRescheduling(null);
    } catch (caught) {
      setRescheduling({ ...rescheduling, error: caught instanceof Error ? caught.message : "Could not reschedule. Please try again." });
    }
  }

  if (error) {
    return (
      <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>{error}</span>
        <button type="button" onClick={onRetry} className="shrink-0 min-h-9 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold hover:bg-red-100">Retry</button>
      </div>
    );
  }
  if (items === null) return <Skeleton />;
  if (items.length === 0) {
    return (
      <p className="mt-4 text-center text-sm text-gray-400">{emptyText}</p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => {
        const isTask = item.scheduled_date !== null;
        const open = isTask && item.status === "pending";
        return (
          <li key={item.id} className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#0a192f]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gray-50 text-gray-600"><ActivityTypeIcon type={item.type} /></span>
                <span className="truncate">{typeLabel(item.type)}</span>
              </p>
              {isTask && <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CHIP[item.task_state]}`}>{chipLabel(item)}</span>}
            </div>

            {item.notes && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">&ldquo;{item.notes}&rdquo;</p>}

            <p className="mt-1.5 text-xs text-gray-500">
              {!isTask && `${item.created_by_name ?? "Someone"} · ${formatWhen(item.completed_at ?? item.created_at)}`}
              {isTask && item.task_state === "done" && `Done by ${item.completed_by_name ?? "someone"} · ${item.completed_at ? formatWhen(item.completed_at) : ""}`}
              {isTask && item.task_state !== "done" && `Assigned: ${item.assigned_to_name ?? "Unassigned"} · ${item.task_state === "overdue" ? "Was due" : "Due"} ${dueText(item)}`}
            </p>
            {!isTask && item.coordinates && (
              <a href={`https://www.google.com/maps?q=${item.coordinates.lat},${item.coordinates.lng}`} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs font-semibold text-blue-600 hover:underline">View visit location</a>
            )}

            {completing === item.id && (
              <OutcomeForm onCancel={() => setCompleting(null)} onSave={async (outcome) => { await onMarkDone(item, outcome); setCompleting(null); }} />
            )}

            {open && (item.task_state === "due_today" || item.task_state === "overdue") && rescheduling?.id !== item.id && completing !== item.id && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setCompleting(item.id)} className="min-h-11 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700">Mark Done</button>
                {item.task_state === "overdue" && (
                  <button type="button" onClick={() => setRescheduling({ id: item.id, date: "", time: "", error: "" })} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Reschedule</button>
                )}
              </div>
            )}

            {rescheduling?.id === item.id && (
              <div className="mt-3 space-y-3 rounded-xl bg-gray-50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="crm-field-label"><span>Due date</span>
                    <DatePickerField label="Due date" value={rescheduling.date} min={today} invalid={Boolean(rescheduling.error)} onChange={(value) => setRescheduling({ ...rescheduling, date: value, error: "" })} />
                  </div>
                  <div className="crm-field-label"><span>Due time (optional)</span>
                    <TimePickerField label="Due time" value={rescheduling.time} onChange={(value) => setRescheduling({ ...rescheduling, time: value })} />
                  </div>
                </div>
                {rescheduling.error && <p role="alert" className="text-xs font-semibold text-red-600">{rescheduling.error}</p>}
                <div className="flex items-center gap-2">
                  <button type="button" disabled={busyId === item.id} onClick={() => void saveReschedule()} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busyId === item.id ? "Saving…" : "Save"}</button>
                  <button type="button" onClick={() => setRescheduling(null)} className="min-h-11 px-3 text-sm font-semibold text-blue-600 underline-offset-2 hover:underline">Cancel</button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
