"use client";

import { useState } from "react";
import { DatePickerField, TimePickerField } from "@/components/SchedulePickers";
import type { ActivityItem } from "@/lib/api/activities";
import { ActivityTypeIcon } from "./ActivityIcons";
import { useEnumOptions } from "@/hooks/useEnumOptions";
import OutcomeForm from "./OutcomeForm";
import { formatClock, formatDay, formatWhen, isoDate, typeLabel } from "./activities";
import { AVATAR_COLORS, initials } from "./stages";
import { ACTIVITY_TILE, ACTIVITY_TILE_DEFAULT, BUTTON_PRIMARY, COLOR, TASK_STATUS, TYPE } from "./designTokens";

const TILE = ACTIVITY_TILE;
const DEFAULT_TILE = ACTIVITY_TILE_DEFAULT;

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
    <ul aria-busy="true" aria-label="Loading activity" className="space-y-3 animate-pulse">
      {[0, 1, 2].map((row) => (
        <li key={row} className="rounded-xl border border-gray-200 bg-white p-3.5">
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
  useEnumOptions("activity_type"); // typeLabel reads the same cache, so names refresh once loaded
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
      <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>{error}</span>
        <button type="button" onClick={onRetry} className="shrink-0 min-h-9 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold hover:bg-red-100">Retry</button>
      </div>
    );
  }
  if (items === null) return <Skeleton />;
  if (items.length === 0) {
    return <p className="text-center text-sm text-gray-400">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const isTask = item.scheduled_date !== null;
        const tile = TILE[item.type] ?? DEFAULT_TILE;
        const avatar = AVATAR_COLORS[item.id % AVATAR_COLORS.length];

        if (!isTask) {
          return (
            <li key={item.id} className="flex gap-2.5 py-2.5" style={{ borderBottom: `1px solid ${COLOR.borderDefault}` }}>
              <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: tile.bg, color: tile.fg }}>
                <ActivityTypeIcon type={item.type} className="h-3.5 w-3.5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span style={{ ...TYPE.bodyMd, fontWeight: 700, color: COLOR.textBody }}>{item.title || typeLabel(item.type)}</span>
                {item.notes && <p className="whitespace-pre-line" style={{ ...TYPE.bodySm, color: COLOR.textMuted }}>{item.notes}</p>}
                <span style={{ ...TYPE.caption, color: COLOR.textFaint }}>{`${item.created_by_name ?? "Someone"} · ${formatWhen(item.completed_at ?? item.created_at)}`}</span>
                {item.coordinates && (
                  <a href={`https://www.google.com/maps?q=${item.coordinates.lat},${item.coordinates.lng}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-xs font-semibold text-[#0E4D3A] hover:underline">View visit location</a>
                )}
              </div>
            </li>
          );
        }

        const open = item.status === "pending";
        return (
          <li key={item.id} className="rounded-[10px] bg-white px-3 py-2.5" style={{ border: `1px solid ${COLOR.borderDefault}` }}>
            <div className="flex items-start justify-between gap-2">
              <span style={{ ...TYPE.bodyMd, fontWeight: 700, color: COLOR.textBody }}>{item.title || typeLabel(item.type)}</span>
              <span className="shrink-0 rounded-full px-2 py-0.5" style={{ ...TYPE.caption, fontWeight: 600, background: (TASK_STATUS[item.task_state] ?? TASK_STATUS.pending).bg, color: (TASK_STATUS[item.task_state] ?? TASK_STATUS.pending).fg }}>{chipLabel(item)}</span>
            </div>
            {item.notes && <p className="mt-1 whitespace-pre-line" style={{ ...TYPE.bodySm, color: COLOR.textMuted }}>{item.notes}</p>}

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span aria-hidden="true" className="grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full text-[10px] font-bold" style={{ background: avatar.bg, color: avatar.fg }}>
                  {initials(item.assigned_to_name ?? "?")}
                </span>
                <span className="truncate text-[11.5px] text-[#4B5060]">{item.assigned_to_name ?? "Unassigned"}</span>
              </div>
              <span className="shrink-0 text-[11px] text-[#9AA0AC]">
                {item.task_state === "done"
                  ? `Done by ${item.completed_by_name ?? "someone"}`
                  : `${item.task_state === "overdue" ? "Was due" : "Due"} ${dueText(item)}`}
              </span>
            </div>

            {completing === item.id && (
              <div className="mt-3">
                <OutcomeForm onCancel={() => setCompleting(null)} onSave={async (outcome) => { await onMarkDone(item, outcome); setCompleting(null); }} />
              </div>
            )}

            {open && (item.task_state === "due_today" || item.task_state === "overdue") && rescheduling?.id !== item.id && completing !== item.id && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setCompleting(item.id)} style={{ ...BUTTON_PRIMARY, padding: "6px 14px" }}>Mark Done</button>
                {item.task_state === "overdue" && (
                  <button type="button" onClick={() => setRescheduling({ id: item.id, date: "", time: "", error: "" })} className="min-h-9 rounded-lg border border-[#DEE1E5] bg-white px-3.5 text-xs font-semibold text-[#3A3E4A] hover:bg-gray-50">Reschedule</button>
                )}
              </div>
            )}

            {rescheduling?.id === item.id && (
              <div className="mt-3 space-y-3 rounded-xl bg-white p-3">
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
                  <button type="button" disabled={busyId === item.id} onClick={() => void saveReschedule()} className="min-h-9 rounded-lg bg-[#0E4D3A] px-3.5 text-xs font-semibold text-white hover:bg-[#0B3E2F] disabled:opacity-60">{busyId === item.id ? "Saving…" : "Save"}</button>
                  <button type="button" onClick={() => setRescheduling(null)} className="min-h-9 px-2 text-xs font-semibold text-[#0E4D3A] underline-offset-2 hover:underline">Cancel</button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
