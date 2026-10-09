"use client";

import { useState } from "react";
import { DatePickerField, TimePickerField } from "@/components/SchedulePickers";
import type { TaskItem } from "@/lib/api/tasks";
import { ActivityTypeIcon } from "@/components/followups/ActivityIcons";
import OutcomeForm from "@/components/followups/OutcomeForm";
import { formatClock, formatWhen, isoDate, typeLabel } from "@/components/followups/activities";
import { whatsappLink } from "@/components/followups/stages";

const STATE_STYLE: Record<TaskItem["task_state"], { chip: string; bar: string }> = {
  pending: { chip: "bg-gray-100 text-gray-600", bar: "bg-gray-300" },
  due_today: { chip: "bg-amber-50 text-amber-700", bar: "bg-amber-400" },
  overdue: { chip: "bg-red-50 text-red-700", bar: "bg-red-500" },
  done: { chip: "bg-green-50 text-green-700", bar: "bg-green-500" },
};

export function stateLabel(task: TaskItem) {
  if (task.task_state === "overdue") return task.overdue_days > 0 ? `Overdue ${task.overdue_days}d` : "Overdue";
  if (task.task_state === "due_today") return "Due today";
  if (task.task_state === "done") return "Done";
  return "Upcoming";
}

export const timeText = (task: TaskItem) => (task.scheduled_time ? formatClock(task.scheduled_time) : "Any time");

/** Small card for the week view: time, who, and what; tapping it opens that day. */
export function CompactTask({ task, showAssignee, onOpen }: { task: TaskItem; showAssignee: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full min-h-11 items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm hover:border-blue-200 hover:shadow-md transition-all">
      <span className={`w-1 shrink-0 ${STATE_STYLE[task.task_state].bar}`} />
      <span className="min-w-0 flex-1 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
          <ActivityTypeIcon type={task.type} className="h-3.5 w-3.5" /> {timeText(task)}
        </span>
        <span className={`block truncate text-xs font-bold ${task.task_state === "done" ? "text-gray-400 line-through" : "text-[#0a192f]"}`}>{task.contact_name}</span>
        {showAssignee && <span className="block truncate text-[11px] text-gray-500">{task.assigned_to_name ?? "Unassigned"}</span>}
      </span>
    </button>
  );
}

/** Full task card with the actions: call / WhatsApp, Mark done (asks for the outcome) and Reschedule. */
export default function TaskCard({ task, showAssignee, onMarkDone, onReschedule }: {
  task: TaskItem; showAssignee: boolean;
  onMarkDone: (task: TaskItem, outcome: string) => Promise<void>;
  onReschedule: (task: TaskItem, date: string, time: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"completing" | "rescheduling" | null>(null);
  const [today] = useState(() => isoDate());
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const open = task.status === "pending";
  const style = STATE_STYLE[task.task_state];

  async function saveReschedule() {
    if (!date) { setError("Pick the new due date."); return; }
    if (date < today) { setError("The due date cannot be in the past."); return; }
    setSaving(true);
    setError("");
    try { await onReschedule(task, date, time); setMode(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reschedule. Please try again."); }
    finally { setSaving(false); }
  }

  return (
    <article className="flex overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <span className={`w-1.5 shrink-0 ${style.bar}`} />
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gray-50 text-gray-600"><ActivityTypeIcon type={task.type} /></span>
              <span>{timeText(task)}</span><span aria-hidden="true">·</span><span className="truncate">{typeLabel(task.type)}</span>
            </p>
            <h3 className="mt-1.5 truncate text-sm font-bold text-[#0a192f]">{task.contact_name}</h3>
            <p className="text-xs text-gray-500">{task.contact_phone}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${style.chip}`}>{stateLabel(task)}</span>
        </div>

        {task.notes && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">&ldquo;{task.notes}&rdquo;</p>}
        <p className="mt-1.5 text-xs text-gray-500">
          {task.task_state === "done"
            ? `Done by ${task.completed_by_name ?? "someone"}${task.completed_at ? ` · ${formatWhen(task.completed_at)}` : ""}`
            : showAssignee && `Assigned to ${task.assigned_to_name ?? "no one"}`}
        </p>

        {open && mode === null && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setMode("completing")} className="min-h-11 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700">Mark done</button>
            <button type="button" onClick={() => { setMode("rescheduling"); setError(""); }} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Reschedule</button>
            <a href={`tel:${task.contact_phone}`} aria-label={`Call ${task.contact_name}`} className="grid h-11 w-11 place-items-center rounded-xl text-blue-600 hover:bg-blue-50"><ActivityTypeIcon type="phone_call" className="h-[18px] w-[18px]" /></a>
            <a href={whatsappLink(task.contact_phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${task.contact_name}`} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-emerald-50"><ActivityTypeIcon type="whatsapp" className="h-[18px] w-[18px]" /></a>
          </div>
        )}

        {mode === "completing" && <OutcomeForm onCancel={() => setMode(null)} onSave={(outcome) => onMarkDone(task, outcome)} />}

        {mode === "rescheduling" && (
          <div className="mt-3 space-y-3 rounded-xl bg-gray-50 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="crm-field-label"><span>Due date</span>
                <DatePickerField label="Due date" value={date} min={today} invalid={Boolean(error)} onChange={(value) => { setDate(value); setError(""); }} />
              </div>
              <div className="crm-field-label"><span>Due time (optional)</span>
                <TimePickerField label="Due time" value={time} onChange={setTime} />
              </div>
            </div>
            {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
            <div className="flex items-center gap-2">
              <button type="button" disabled={saving} onClick={() => void saveReschedule()} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setMode(null)} className="min-h-11 px-3 text-sm font-semibold text-blue-600 underline-offset-2 hover:underline">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
