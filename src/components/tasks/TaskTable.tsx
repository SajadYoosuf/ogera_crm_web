"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { typeLabel } from "@/components/followups/activities";
import type { TaskItem } from "@/lib/api/tasks";
import { fromISO } from "./calendar";
import { stateLabel, timeText } from "./TaskCard";

const WIDE = "(min-width: 768px)";

/** True from tablet width up, where a table fits. Phones and the first render get the cards. */
export function useWide() {
  return useSyncExternalStore(
    (notify) => { const query = window.matchMedia?.(WIDE); query?.addEventListener("change", notify); return () => query?.removeEventListener("change", notify); },
    () => window.matchMedia?.(WIDE).matches ?? false,
    () => false,
  );
}

// Status pill and dot colours from the design system (tokens.json).
const STATUS_PILL: Record<TaskItem["task_state"], { pill: string; dot: string }> = {
  pending: { pill: "bg-[#F0F0F3] text-[#4B5060]", dot: "bg-[#9AA0AC]" },
  due_today: { pill: "bg-[#FFF7E6] text-[#9A5B00]", dot: "bg-[#E59A1A]" },
  overdue: { pill: "bg-[#FDECEC] text-[#B42323]", dot: "bg-[#E5484D]" },
  done: { pill: "bg-[#EAF8EF] text-[#17703F]", dot: "bg-[#2DB565]" },
};

// Task type dot colours, from the design. Types not listed fall back to grey.
const TYPE_DOT: Record<string, string> = {
  phone_call: "bg-[#1565D8]",
  call: "bg-[#1565D8]",
  whatsapp: "bg-[#1F9254]",
  field_visit: "bg-[#B45309]",
  quotation: "bg-[#0E7A4F]",
  meeting: "bg-[#5B3FD6]",
};

const AVATAR = ["bg-[#EDE9FE] text-[#5B3FD6]", "bg-[#E0F2FE] text-[#0B6AA8]", "bg-[#DCFCE7] text-[#167A44]", "bg-[#FEF3C7] text-[#9A6200]", "bg-[#FCE7F3] text-[#A8326E]"];

const PRIORITY: Record<string, { label: string; pill: string }> = {
  high: { label: "High", pill: "bg-[#FDECEC] text-[#B42323]" },
  medium: { label: "Medium", pill: "bg-[#FFF7E6] text-[#9A5B00]" },
  low: { label: "Low", pill: "bg-[#EAF8EF] text-[#17703F]" },
};

const STATUS_OPTIONS: { value: "todo" | "inprogress" | "pending" | "completed"; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "inprogress", label: "In Progress" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
];

type TaskAction = { onChangeStatus: (task: TaskItem, status: "todo" | "inprogress" | "pending" | "completed") => void; onStartReschedule: (task: TaskItem) => void };

function TaskRow({ task, onChangeStatus, onStartReschedule }: { task: TaskItem } & TaskAction) {
  const done = task.task_state === "done";
  const priority = PRIORITY[task.priority ?? "medium"] ?? PRIORITY.medium;
  const name = task.assigned_to_name ?? "Unassigned";
  const initial = name.charAt(0).toUpperCase();
  const avatar = AVATAR[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR.length];
  const title = task.title || task.notes?.split("\n")[0] || typeLabel(task.type);
  const due = task.scheduled_date ? fromISO(task.scheduled_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "";
  return (
    <tr className="border-t border-[#EFEFF2] hover:bg-[#F5F8F6]">
      <td className="h-14 px-4 align-middle">
        <div className="flex max-w-72 flex-col gap-0.5">
          <span className={`truncate font-semibold ${done ? "text-[#9AA0AC] line-through" : "text-[#1A1C21]"}`}>{title}</span>
          <span className="truncate text-[11px] text-[#8A8F9C]">↳ {task.contact_name}</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 align-middle">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold ${avatar}`}>{initial}</span>
          <span className="text-[#3A3E4A]">{name}</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 align-middle">
        <span className="inline-flex items-center gap-1.5 text-[#3A3E4A]">
          <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${TYPE_DOT[task.type] ?? "bg-[#4B5060]"}`} />
          {typeLabel(task.type)}
        </span>
      </td>
      {/* Status column: dropdown for open tasks, read-only pill for done */}
      <td className="whitespace-nowrap px-3 align-middle">
        {done ? (
          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_PILL[task.task_state].pill}`}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATUS_PILL[task.task_state].dot}`} />
            {stateLabel(task)}
          </span>
        ) : (
          <select
            aria-label="Change task status"
            value={task.status}
            onChange={(e) => onChangeStatus(task, e.target.value as "todo" | "inprogress" | "pending" | "completed")}
            className="h-8 rounded-lg border border-[#DEE1E5] bg-white pl-2.5 pr-6 text-[13px] font-medium text-[#3A3E4A] hover:bg-[#F3F3F5] focus:outline-none focus:ring-2 focus:ring-[#BFE6D2]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
      </td>
      <td className="whitespace-nowrap px-3 align-middle text-[#6B7080]">
        {due}{due && <span aria-hidden="true"> · </span>}{timeText(task)}
      </td>
      <td className="whitespace-nowrap px-3 align-middle">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priority.pill}`}>{priority.label}</span>
      </td>
      <td className="whitespace-nowrap px-3 align-middle">
        {!done && (
          <button type="button" onClick={() => onStartReschedule(task)} aria-label={`Reschedule ${title}`}
            className="h-8 rounded-lg border border-[#DEE1E5] bg-white px-3 text-[13px] font-medium text-[#3A3E4A] hover:bg-[#F3F3F5]">
            Reschedule
          </button>
        )}
      </td>
    </tr>
  );
}

/** Follow-ups as a table: task, lead, assigned staff, task type, status, due date and actions. */
export default function TaskTable({ tasks, empty, onChangeStatus, onStartReschedule }: { tasks: TaskItem[]; empty?: ReactNode } & TaskAction) {
  const head = "px-3 py-3 text-left text-[13px] font-medium text-[#4B5060]";
  return (
    // relative: the scroll box contains its table, so a wide table scrolls inside it and never widens the page
    <div className="relative w-full min-w-0 max-w-full overflow-x-auto">
      <table className="w-full min-w-[1040px] border-collapse text-sm">
        <thead className="bg-[#F7F7F9]">
          <tr>
            <th scope="col" className={`${head} pl-4`}>Task Title</th>
            <th scope="col" className={head}>Assigned</th>
            <th scope="col" className={head}>Task Type</th>
            <th scope="col" className={head}>Status</th>
            <th scope="col" className={head}>Due Date</th>
            <th scope="col" className={head}>Priority</th>
            <th scope="col" className={head}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && empty
            ? <tr><td colSpan={7}>{empty}</td></tr>
            : tasks.map((task) => <TaskRow key={task.id} task={task} onChangeStatus={onChangeStatus} onStartReschedule={onStartReschedule} />)}
        </tbody>
      </table>
    </div>
  );
}
