"use client";

import type { TaskItem } from "@/lib/api/tasks";
import { ActivityTypeIcon } from "@/components/followups/ActivityIcons";
import { formatClock, formatWhen, typeLabel } from "@/components/followups/activities";
import { whatsappLink } from "@/components/followups/stages";
import { fromISO } from "./calendar";

export const STATE_STYLE: Record<TaskItem["task_state"], { chip: string; bar: string; border: string }> = {
  pending: { chip: "bg-[#F0F0F3] text-[#4B5060]", bar: "bg-gray-300", border: "border-gray-300" },
  due_today: { chip: "bg-[#FFF7E6] text-[#9A5B00]", bar: "bg-amber-400", border: "border-amber-400" },
  overdue: { chip: "bg-[#FDECEC] text-[#B42323]", bar: "bg-red-500", border: "border-red-500" },
  done: { chip: "bg-[#EAF8EF] text-[#17703F]", bar: "bg-green-500", border: "border-green-500" },
};

export function stateLabel(task: TaskItem) {
  if (task.task_state === "overdue") return task.overdue_days > 0 ? `Overdue ${task.overdue_days}d` : "Overdue";
  if (task.task_state === "due_today") return "Due today";
  if (task.task_state === "done") return "Done";
  return "To do";
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
        <span className={`block truncate text-xs font-bold ${task.task_state === "done" ? "text-gray-400 line-through" : "text-[#1A1C21]"}`}>{task.contact_name}</span>
        {showAssignee && <span className="block truncate text-[11px] text-gray-500">{task.assigned_to_name ?? "Unassigned"}</span>}
      </span>
    </button>
  );
}

/** Full task card with the actions: call / WhatsApp, Mark done and Reschedule. Both open a dialog owned by the Tasks screen. */
export default function TaskCard({ task, showAssignee, showDate = false, onStartMarkDone, onStartReschedule }: {
  task: TaskItem; showAssignee: boolean; showDate?: boolean;
  onStartMarkDone: (task: TaskItem) => void;
  onStartReschedule: (task: TaskItem) => void;
}) {
  const open = task.status === "pending";
  const style = STATE_STYLE[task.task_state];

  return (
    <article className="flex overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <span className={`w-1.5 shrink-0 ${style.bar}`} />
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gray-50 text-gray-600"><ActivityTypeIcon type={task.type} /></span>
              <span>{showDate && task.scheduled_date ? `${fromISO(task.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ` : ""}{timeText(task)}</span><span aria-hidden="true">·</span><span className="truncate">{typeLabel(task.type)}</span>
            </p>
            <h3 className="mt-1.5 truncate font-[family-name:var(--font-sora)] text-sm font-bold text-[#1A1C21]">{task.contact_name}</h3>
            {task.title && <p className="truncate text-sm font-semibold text-[#3A3E4A]">{task.title}</p>}
            <p className="text-xs text-gray-500">{task.contact_phone}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.chip}`}>{stateLabel(task)}</span>
        </div>

        {task.notes && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">&ldquo;{task.notes}&rdquo;</p>}
        <p className="mt-1.5 text-xs text-gray-500">
          {task.task_state === "done"
            ? `Done by ${task.completed_by_name ?? "someone"}${task.completed_at ? ` · ${formatWhen(task.completed_at)}` : ""}`
            : showAssignee && `Assigned to ${task.assigned_to_name ?? "no one"}`}
        </p>

        {open && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onStartMarkDone(task)} className="h-[38px] rounded-lg bg-[#0E7A4F] px-4 text-sm font-semibold text-white hover:bg-[#0B6A44]">Mark done</button>
            <button type="button" onClick={() => onStartReschedule(task)} className="h-[38px] rounded-lg border border-[#DEE1E5] bg-white px-4 text-sm font-medium text-[#3A3E4A] hover:bg-[#F3F3F5]">Reschedule</button>
            <a href={`tel:${task.contact_phone}`} aria-label={`Call ${task.contact_name}`} className="grid h-[38px] w-[38px] place-items-center rounded-lg text-[#0E7A4F] hover:bg-[#F3F3F5]"><ActivityTypeIcon type="phone_call" className="h-[18px] w-[18px]" /></a>
            <a href={whatsappLink(task.contact_phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${task.contact_name}`} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-emerald-50"><ActivityTypeIcon type="whatsapp" className="h-[18px] w-[18px]" /></a>
          </div>
        )}
      </div>
    </article>
  );
}
