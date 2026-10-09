"use client";

import type { TaskItem } from "@/lib/api/tasks";
import { addDays, fromISO, monthWeeks, startOfWeek } from "./calendar";
import TaskCard, { CompactTask, timeText } from "./TaskCard";

type Actions = {
  showAssignee: boolean;
  onMarkDone: (task: TaskItem, outcome: string) => Promise<void>;
  onReschedule: (task: TaskItem, date: string, time: string) => Promise<void>;
  /** Jump to the day view of a date. */
  onOpenDay: (date: string) => void;
};

const groupByDate = (tasks: TaskItem[]) => {
  const groups = new Map<string, TaskItem[]>();
  for (const task of tasks) groups.set(task.scheduled_date ?? "", [...(groups.get(task.scheduled_date ?? "") ?? []), task]);
  return groups;
};

const weekday = (date: string, style: "short" | "long" = "short") => fromISO(date).toLocaleDateString("en-GB", { weekday: style });

/** One day as a work list in time order. Open tasks from earlier days that were missed come first. */
export function DayView({ tasks, date, today, ...actions }: { tasks: TaskItem[]; date: string; today: string } & Actions) {
  const missed = tasks.filter((task) => (task.scheduled_date ?? date) < date);
  const planned = tasks.filter((task) => (task.scheduled_date ?? date) >= date);
  const card = (task: TaskItem) => <li key={task.id}><TaskCard task={task} showAssignee={actions.showAssignee} onMarkDone={actions.onMarkDone} onReschedule={actions.onReschedule} /></li>;
  return (
    <div className="space-y-6">
      {missed.length > 0 && (
        <section aria-label="Missed earlier">
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-red-600">Missed earlier · {missed.length}</h2>
          <ul className="space-y-3">{missed.map(card)}</ul>
        </section>
      )}
      <section aria-label={date === today ? "Today" : "Scheduled"}>
        {missed.length > 0 && <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-gray-500">{date === today ? "Today" : "Scheduled"} · {planned.length}</h2>}
        {planned.length > 0 ? <ul className="space-y-3">{planned.map(card)}</ul> : <p className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">Nothing scheduled for this day.</p>}
      </section>
    </div>
  );
}

/** Seven days side by side on a desktop, stacked on a phone. */
export function WeekView({ tasks, date, today, ...actions }: { tasks: TaskItem[]; date: string; today: string } & Actions) {
  const groups = groupByDate(tasks);
  const days = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date), index));
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
      {days.map((day) => {
        const dayTasks = groups.get(day) ?? [];
        return (
          <section key={day} aria-label={`${weekday(day, "long")} ${fromISO(day).getDate()}`} className={`rounded-2xl border bg-gray-50 ${day === today ? "border-blue-300" : "border-gray-200"}`}>
            <button type="button" onClick={() => actions.onOpenDay(day)} className={`flex w-full min-h-11 items-center justify-between gap-2 rounded-t-2xl px-3 py-2 text-left ${day === today ? "bg-blue-600 text-white" : "bg-white text-[#0a192f]"}`}>
              <span className="text-xs font-extrabold">{weekday(day)} {fromISO(day).getDate()}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${day === today ? "bg-white/20" : "bg-gray-100 text-gray-600"}`}>{dayTasks.length}</span>
            </button>
            <div className="space-y-2 p-2 lg:min-h-32">
              {dayTasks.map((task) => <CompactTask key={task.id} task={task} showAssignee={actions.showAssignee} onOpen={() => actions.onOpenDay(day)} />)}
              {dayTasks.length === 0 && <p className="py-3 text-center text-[11px] text-gray-400">No tasks</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Month grid; a day shows its first tasks, and tapping it opens that day. */
export function MonthView({ tasks, date, today, ...actions }: { tasks: TaskItem[]; date: string; today: string } & Actions) {
  const groups = groupByDate(tasks);
  const month = fromISO(date).getMonth();
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {monthWeeks(date)[0].map((day) => <span key={day} className="py-2 text-center text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{weekday(day)}</span>)}
      </div>
      {monthWeeks(date).map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
          {week.map((day) => {
            const dayTasks = groups.get(day) ?? [];
            const hasOverdue = dayTasks.some((task) => task.task_state === "overdue");
            const inMonth = fromISO(day).getMonth() === month;
            return (
              <button key={day} type="button" onClick={() => actions.onOpenDay(day)} aria-label={`${fromISO(day).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}, ${dayTasks.length} tasks`}
                className={`min-h-16 border-r border-gray-100 p-1.5 text-left align-top last:border-r-0 hover:bg-blue-50/50 sm:min-h-28 ${inMonth ? "" : "bg-gray-50/70"}`}>
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${day === today ? "bg-blue-600 text-white" : inMonth ? "text-gray-800" : "text-gray-400"}`}>{fromISO(day).getDate()}</span>
                {dayTasks.length > 0 && (
                  <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[11px] font-bold sm:hidden ${hasOverdue ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{dayTasks.length}</span>
                )}
                <span className="mt-1 hidden space-y-1 sm:block">
                  {dayTasks.slice(0, 3).map((task) => (
                    <span key={task.id} className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-semibold ${task.task_state === "done" ? "bg-green-50 text-green-700 line-through" : task.task_state === "overdue" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                      {timeText(task) === "Any time" ? "" : `${timeText(task)} `}{task.contact_name}
                    </span>
                  ))}
                  {dayTasks.length > 3 && <span className="block px-1 text-[11px] font-bold text-gray-500">+{dayTasks.length - 3} more</span>}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
