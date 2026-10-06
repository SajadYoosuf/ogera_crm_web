"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { ActivityItem } from "@/lib/api/activities";
import { formatClock, formatDay, formatWhen, isoDate, typeLabel } from "./activities";

const svg = (children: ReactNode) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const ICONS: Record<string, ReactNode> = {
  phone_call: svg(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />),
  field_visit: svg(<><path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>),
  whatsapp: <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.5 0 .17 5.33.17 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.35-1.66a11.86 11.86 0 0 0 5.7 1.45h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.16-3.42-8.43ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.77.99 1-3.67-.24-.38a9.87 9.87 0 0 1-1.52-5.27c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.98 2.9a9.8 9.8 0 0 1 2.9 6.99c0 5.46-4.44 9.9-9.89 9.9Z" /></svg>,
  quote: svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>),
  demo: svg(<><path d="M3 4h18M5 4v10h14V4M12 14v5M8 21l4-2 4 2" /></>),
  internal_note: svg(<><path d="M5 4h14v10l-6 6H5Z" /><path d="M13 20v-6h6" /></>),
};

const CHIP: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  due_today: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
  done: "bg-green-50 text-green-700",
};

function chipLabel(item: ActivityItem) {
  if (item.task_state === "overdue") return `Overdue ${item.overdue_days}d`;
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
export default function ActivityList({ items, error, onRetry, onMarkDone, onReschedule }: {
  items: ActivityItem[] | null; error: string; onRetry: () => void;
  onMarkDone: (item: ActivityItem) => Promise<void>;
  onReschedule: (item: ActivityItem, date: string, time: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
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
      <p className="mt-4 text-center text-sm text-gray-400">
        No activity logged yet.<br />Use &quot;Log Activity&quot; to record a call, visit or message.
      </p>
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
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gray-50 text-gray-600">{ICONS[item.type] ?? ICONS.internal_note}</span>
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

            {open && (item.task_state === "due_today" || item.task_state === "overdue") && rescheduling?.id !== item.id && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busyId === item.id} onClick={() => void run(item.id, () => onMarkDone(item))} className="min-h-11 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">{busyId === item.id ? "Saving…" : "Mark Done"}</button>
                {item.task_state === "overdue" && (
                  <button type="button" onClick={() => setRescheduling({ id: item.id, date: "", time: "", error: "" })} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Reschedule</button>
                )}
              </div>
            )}

            {rescheduling?.id === item.id && (
              <div className="mt-3 space-y-3 rounded-xl bg-gray-50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="crm-field-label">Due date
                    <input type="date" value={rescheduling.date} min={today} onChange={(event) => setRescheduling({ ...rescheduling, date: event.target.value, error: "" })} className="crm-input" aria-invalid={Boolean(rescheduling.error)} />
                  </label>
                  <label className="crm-field-label">Due time (optional)
                    <input type="time" value={rescheduling.time} onChange={(event) => setRescheduling({ ...rescheduling, time: event.target.value })} className="crm-input" />
                  </label>
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
