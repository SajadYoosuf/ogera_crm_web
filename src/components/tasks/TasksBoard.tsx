"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import FilterSelect from "@/components/FilterSelect";
import { ACTIVITY_TYPES, isoDate } from "@/components/followups/activities";
import { ApiError } from "@/lib/api/auth";
import { markFollowupDone, rescheduleFollowup } from "@/lib/api/activities";
import { listAllEmployees } from "@/lib/api/employees";
import { listTasks, type TaskItem, type TaskList, type TaskStatus } from "@/lib/api/tasks";
import { rangeFor, shift, titleFor, type TaskView } from "./calendar";
import { DayView, MonthView, WeekView } from "./TaskViews";

const VIEWS: { value: TaskView; label: string }[] = [{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }];
const STATUSES: { value: TaskStatus; label: string }[] = [{ value: "open", label: "Open" }, { value: "done", label: "Done" }, { value: "all", label: "All" }];
const MANAGER_ROLES = ["admin", "manager", "sales_head"];

const errorText = (caught: unknown) => (caught instanceof ApiError ? caught.message : "Tasks could not be loaded. Please try again.");

function roleOf(stored: string | null) {
  try { return (JSON.parse(stored ?? "null") as { role?: string } | null)?.role ?? ""; } catch { return ""; }
}

const iconProps = { className: "w-4 h-4", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export default function TasksBoard() {
  const [today] = useState(() => isoDate());
  const [view, setView] = useState<TaskView>("day");
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState<TaskStatus>("open");
  const [type, setType] = useState("");
  const [assignee, setAssignee] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // the debounced search that is sent to the server
  const [data, setData] = useState<TaskList | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [staff, setStaff] = useState<{ id: number; name: string }[]>([]);
  // sessionStorage is a browser-only store, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(() => () => {}, () => sessionStorage.getItem("ogera_user"), () => null);
  const isManager = MANAGER_ROLES.includes(roleOf(storedUser));
  const latest = useRef(0);

  const { from, to } = useMemo(() => rangeFor(view, date), [view, date]);
  const includeOverdue = view === "day" && date === today && status !== "done";

  const load = useCallback(async (silent = false) => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in to see your tasks."); setIsLoading(false); return; }
    const ticket = ++latest.current; // a slower, older response must not overwrite a newer one
    if (!silent) setIsLoading(true);
    try {
      const result = await listTasks(accessToken, { dateFrom: from, dateTo: to, status, type: type || undefined, q: query, assignedTo: assignee ? Number(assignee) : undefined, includeOverdue });
      if (ticket !== latest.current) return;
      setData(result);
      setError("");
    } catch (caught) {
      if (ticket === latest.current) setError(errorText(caught));
    } finally {
      if (ticket === latest.current) setIsLoading(false);
    }
  }, [from, to, status, type, query, assignee, includeOverdue]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!isManager || !accessToken) return;
    listAllEmployees(accessToken)
      .then(({ employees }) => setStaff(employees.filter((employee) => employee.is_active).map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setStaff([])); // the employee filter just stays empty
  }, [isManager]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function markDone(task: TaskItem, outcome: string) {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) throw new Error("Sign in again to continue.");
    try { await markFollowupDone(accessToken, task.contact_id, task.id, outcome); }
    catch (caught) { throw new Error(caught instanceof ApiError ? caught.message : "Could not save. Please try again."); }
    setNotice(`Done. The outcome was logged for ${task.contact_name}.`);
    await load(true);
  }

  async function reschedule(task: TaskItem, newDate: string, time: string) {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) throw new Error("Sign in again to continue.");
    try { await rescheduleFollowup(accessToken, task.contact_id, task.id, newDate, time || undefined); }
    catch (caught) { throw new Error(caught instanceof ApiError ? caught.message : "Could not reschedule. Please try again."); }
    setNotice(`Moved to ${newDate}.`);
    await load(true);
  }

  const openDay = (day: string) => { setView("day"); setDate(day); };
  const hasFilters = Boolean(type || assignee || search.trim() || status !== "open");
  const clearFilters = () => { setType(""); setAssignee(""); setSearch(""); setQuery(""); setStatus("open"); };
  const summary = data?.summary;
  const common = { date, today, showAssignee: isManager || Boolean(assignee), onMarkDone: markDone, onReschedule: reschedule, onOpenDay: openDay };

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] text-white shadow-xl shadow-blue-950/10">
        <div className="relative p-5 sm:p-7">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-sky-300">Follow-up schedule</p>
          <h1 className="mt-2 text-[26px] sm:text-[34px] font-extrabold tracking-tight leading-tight">Tasks</h1>
          <p className="mt-2 text-sm sm:text-[15px] text-white/65">{isManager ? "Follow-ups scheduled for the team, by day, week and month." : "Your scheduled follow-ups. Log what happened when you finish one."}</p>
          {summary && (
            <dl className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <button type="button" onClick={() => { setView("day"); setDate(today); }} className="rounded-full bg-red-500/20 px-3 py-1.5 text-red-100 hover:bg-red-500/30"><dd className="inline">{summary.overdue}</dd> <dt className="inline font-semibold">overdue</dt></button>
              <span className="rounded-full bg-amber-400/20 px-3 py-1.5 text-amber-100"><dd className="inline">{summary.today}</dd> <dt className="inline font-semibold">due today</dt></span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/80"><dd className="inline">{summary.upcoming}</dd> <dt className="inline font-semibold">upcoming</dt></span>
            </dl>
          )}
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Calendar view" className="inline-flex rounded-xl bg-gray-100 p-1">
            {VIEWS.map((option) => (
              <button key={option.value} type="button" aria-pressed={view === option.value} onClick={() => setView(option.value)}
                className={`min-h-9 flex-1 rounded-lg px-4 text-sm font-bold transition-colors sm:flex-none ${view === option.value ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>{option.label}</button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button type="button" aria-label={`Previous ${view}`} onClick={() => setDate(shift(view, date, -1))} className="grid h-11 w-11 place-items-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"><svg {...iconProps}><path d="m15 6-6 6 6 6" /></svg></button>
            <p aria-live="polite" className="min-w-0 flex-1 text-center text-sm font-extrabold text-[#0a192f] sm:w-56 sm:flex-none">{titleFor(view, date)}</p>
            <button type="button" aria-label={`Next ${view}`} onClick={() => setDate(shift(view, date, 1))} className="grid h-11 w-11 place-items-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"><svg {...iconProps}><path d="m9 6 6 6-6 6" /></svg></button>
            <button type="button" onClick={() => setDate(today)} disabled={date === today} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Today</button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="flex h-11 w-full items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 lg:max-w-xs">
            <label className="sr-only" htmlFor="task-search">Search tasks</label>
            <svg className="ml-3.5 mr-2 h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
            <input id="task-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or phone" className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
          </div>
          {isManager && (
            <FilterSelect label="Employee" value={assignee} onChange={setAssignee} className="w-full lg:w-52"
              options={[{ value: "", label: "All employees" }, ...staff.map((member) => ({ value: String(member.id), label: member.name }))]}
              icon={<><circle cx="12" cy="8" r="3.25" /><path d="M5 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1" /></>} />
          )}
          <FilterSelect label="Type" value={type} onChange={setType} className="w-full lg:w-52"
            options={[{ value: "", label: "All types" }, ...ACTIVITY_TYPES.filter((item) => item.value !== "internal_note").map((item) => ({ value: item.value, label: item.label }))]}
            icon={<path d="M4 6h16M7 12h10M10 18h4" />} />
          <div role="group" aria-label="Status" className="inline-flex rounded-xl bg-gray-100 p-1 lg:ml-auto">
            {STATUSES.map((option) => (
              <button key={option.value} type="button" aria-pressed={status === option.value} onClick={() => setStatus(option.value)}
                className={`min-h-9 flex-1 rounded-lg px-3.5 text-sm font-bold transition-colors lg:flex-none ${status === option.value ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>{option.label}</button>
            ))}
          </div>
          {hasFilters && <button type="button" onClick={clearFilters} className="min-h-11 px-3 text-sm font-bold text-blue-600 hover:text-blue-700">Clear filters</button>}
        </div>
      </section>

      {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{notice}</p>}

      {error && !isLoading ? (
        <div role="alert" className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
          <h2 className="text-lg font-extrabold text-[#0a192f]">Something went wrong</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-6 min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Try again</button>
        </div>
      ) : isLoading && !data ? (
        <div aria-busy="true" aria-label="Loading tasks" className="space-y-3 animate-pulse">
          {[0, 1, 2].map((row) => (
            <div key={row} className="rounded-2xl border border-gray-200 bg-white p-4"><span className="block h-3.5 w-1/4 rounded bg-gray-200" /><span className="mt-3 block h-4 w-1/2 rounded bg-gray-200" /><span className="mt-2 block h-3 w-1/3 rounded bg-gray-100" /></div>
          ))}
        </div>
      ) : data && (
        <div className={isLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {data.items.length === 0 && view !== "month" ? (
            <div role="status" className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
              <h2 className="text-lg font-extrabold text-[#0a192f]">{hasFilters ? "No tasks match" : status === "done" ? "Nothing completed in this period" : "No follow-ups here"}</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">{hasFilters ? "Try different filters." : "Schedule a follow-up from a lead and it shows up on its day."}</p>
              {hasFilters && <button type="button" onClick={clearFilters} className="mt-5 min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Clear filters</button>}
            </div>
          ) : view === "day" ? <DayView tasks={data.items} {...common} />
            : view === "week" ? <WeekView tasks={data.items} {...common} />
              : <MonthView tasks={data.items} {...common} />}
        </div>
      )}
    </div>
  );
}
