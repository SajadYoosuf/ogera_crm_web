"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { isoDate } from "@/components/followups/activities";
import { useEnumOptions } from "@/hooks/useEnumOptions";
import { ApiError } from "@/lib/api/auth";
import { markFollowupDone, rescheduleFollowup } from "@/lib/api/activities";
import FollowupScheduleForm from "@/components/followups/FollowupScheduleForm";
import { isMonitoringRole, listAllEmployees } from "@/lib/api/employees";
import { listTasks, type TaskItem, type TaskList, type TaskStatus } from "@/lib/api/tasks";
import DateRangePicker from "@/components/DateRangePicker";
import { addDays, MAX_CUSTOM_DAYS, rangeFor, startOfWeek, type TaskView } from "./calendar";
import TaskCard from "./TaskCard";
import TaskTable, { useWide } from "./TaskTable";
import { CompleteTaskDialog, NextFollowupDialog, RescheduleTaskDialog } from "./TaskDialogs";

// Due date picks the range the list covers. Today is the day view on today's date.
type DueKey = "all" | "today" | "week" | "month" | "custom";
const DUE_OPTIONS: { value: DueKey; label: string }[] = [{ value: "all", label: "All dates" }, { value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" }, { value: "custom", label: "Custom range" }];
const STATUSES: { value: TaskStatus; label: string }[] = [{ value: "all", label: "All" }, { value: "todo", label: "To do" }, { value: "inprogress", label: "In Progress" }, { value: "completed", label: "Completed" }];
const LEAD_TYPES = [{ value: "", label: "All" }, { value: "consumer", label: "Consumer" }, { value: "partner", label: "Partner" }, { value: "dealer", label: "Dealer" }] as const;
const MANAGER_ROLES = ["admin", "manager", "sales_head"];

const errorText = (caught: unknown) => (caught instanceof ApiError ? caught.message : "Tasks could not be loaded. Please try again.");

function roleOf(stored: string | null) {
  try { return (JSON.parse(stored ?? "null") as { role?: string } | null)?.role ?? ""; } catch { return ""; }
}

const optionClass = (on: boolean) => `flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${on ? "bg-[rgba(14,122,79,0.08)] font-semibold text-[#0E4D3A]" : "text-[#3A3E4A] hover:bg-[#F3F3F5]"}`;
const groupLabel = "px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.02em] text-[#9AA0AC]";

export default function TasksBoard() {
  const { options: activityTypes } = useEnumOptions("activity_type"); // also re-renders task cards once labels load
  const [today] = useState(() => isoDate());
  const date = today; // the list covers ranges from today, so there is no day stepping
  // All dates by default, so upcoming and overdue follow-ups show without picking a range first.
  const [view, setView] = useState<TaskView>("all");
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null); // nothing is loaded for Custom until a range is picked
  const [rangeError, setRangeError] = useState("");
  const [status, setStatus] = useState<TaskStatus>("all");
  const [type, setType] = useState("");
  const [assignee, setAssignee] = useState("");
  const [leadType, setLeadType] = useState<"" | "consumer" | "partner" | "dealer">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // the debounced search that is sent to the server
  const [data, setData] = useState<TaskList | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [staff, setStaff] = useState<{ id: number; name: string }[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const wide = useWide();
  // sessionStorage is a browser-only store, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(() => () => {}, () => sessionStorage.getItem("ogera_user"), () => null);
  const isManager = MANAGER_ROLES.includes(roleOf(storedUser));
  const latest = useRef(0);

  const { from, to } = useMemo(() => (view === "custom" && custom ? custom : rangeFor(view, date)), [view, date, custom]);
  const awaitingRange = view === "custom" && !custom;
  // Open work from earlier days still shows on today's view, except in the Completed tab.
  const includeOverdue = view === "day" && date === today && status !== "completed";

  const load = useCallback(async (silent = false) => {
    if (awaitingRange) return;
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in to see your tasks."); setIsLoading(false); return; }
    const ticket = ++latest.current; // a slower, older response must not overwrite a newer one
    if (!silent) setIsLoading(true);
    try {
      const result = await listTasks(accessToken, { dateFrom: from, dateTo: to, status, type: type || undefined, contactType: leadType || undefined, q: query, assignedTo: assignee ? Number(assignee) : undefined, includeOverdue });
      if (ticket !== latest.current) return;
      setData(result);
      setError("");
    } catch (caught) {
      if (ticket === latest.current) setError(errorText(caught));
    } finally {
      if (ticket === latest.current) setIsLoading(false);
    }
  }, [awaitingRange, from, to, status, type, leadType, query, assignee, includeOverdue]);

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
      .then(({ employees }) => setStaff(employees.filter((employee) => employee.is_active && !isMonitoringRole(employee.role)).map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setStaff([])); // the employee filter just stays empty
  }, [isManager]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // The filter menu closes when a click lands outside it.
  useEffect(() => {
    if (!filterOpen) return;
    const onPointer = (event: MouseEvent) => { if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false); };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [filterOpen]);

  // One dialog at a time. Mark done runs: log the activity, then ask about the next follow-up. Reschedule is one dialog.
  const [dialog, setDialog] = useState<{ step: "complete" | "next" | "schedule" | "reschedule"; task: TaskItem } | null>(null);

  function accessTokenOrThrow() {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) throw new Error("Sign in again to continue.");
    return accessToken;
  }

  async function completeTask(task: TaskItem, notes: string) {
    const accessToken = accessTokenOrThrow();
    if (task.contact_id === null) throw new Error("This task is not linked to a lead, so it cannot be marked here.");
    try { await markFollowupDone(accessToken, task.contact_id, task.id, notes); }
    catch (caught) { throw new Error(caught instanceof ApiError ? caught.message : "Could not save. Please try again."); }
    setDialog({ step: "next", task });
    await load(true);
  }

  async function rescheduleTask(task: TaskItem, date: string, time: string) {
    const accessToken = accessTokenOrThrow();
    if (task.contact_id === null) throw new Error("This task is not linked to a lead, so it cannot be moved here.");
    try { await rescheduleFollowup(accessToken, task.contact_id, task.id, date, time || undefined); }
    catch (caught) { throw new Error(caught instanceof ApiError ? caught.message : "Could not reschedule. Please try again."); }
    setDialog(null);
    setNotice(`Moved to ${date}.`);
    await load(true);
  }

  const startMarkDone = (task: TaskItem) => setDialog({ step: "complete", task });
  const startReschedule = (task: TaskItem) => setDialog({ step: "reschedule", task });

  const dueKey: DueKey = view === "day" ? "today" : view;
  function pickDue(value: DueKey) { setRangeError(""); setView(value === "today" ? "day" : value); }
  function pickRange(start: string, end: string) {
    if (!start || !end) return;
    if ((new Date(end).getTime() - new Date(start).getTime()) / 86400000 > MAX_CUSTOM_DAYS) { setRangeError(`Pick a range of up to ${MAX_CUSTOM_DAYS} days.`); return; }
    setRangeError(""); setCustom({ from: start, to: end });
  }

  const hasFilters = Boolean(type || leadType || assignee || search.trim() || status !== "all");
  // Filters that are off the default, shown as the count on the Filter button
  const filterCount = (view !== "all" ? 1 : 0) + (leadType ? 1 : 0) + (type ? 1 : 0) + (assignee ? 1 : 0);
  // Said out loud when nothing matches, so it is clear what to switch off
  const activeFilterNames = [
    ...(status !== "all" ? [STATUSES.find((option) => option.value === status)?.label ?? status] : []),
    ...(leadType ? [LEAD_TYPES.find((option) => option.value === leadType)?.label ?? leadType] : []),
    ...(type ? [activityTypes.find((item) => item.value === type)?.label ?? type] : []),
    ...(assignee ? [staff.find((member) => String(member.id) === assignee)?.name ?? "One employee"] : []),
    ...(search.trim() ? [`"${search.trim()}"`] : []),
  ];
  const clearFilters = () => { setType(""); setLeadType(""); setAssignee(""); setSearch(""); setQuery(""); setStatus("all"); setView("all"); setRangeError(""); };
  const items = data?.items ?? [];

  // Shown in place of the rows when nothing matches. The table header stays above it.
  const emptyState = (
    <div role="status" className="px-6 py-14 text-center">
      <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold text-[#1A1C21]">{hasFilters ? "No tasks match" : status === "completed" ? "Nothing completed in this period" : "No follow-ups here"}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">{hasFilters ? `Filters on: ${activeFilterNames.join(", ")}.` : "Schedule a follow-up from a lead and it shows up on its day."}</p>
      {hasFilters && <button type="button" onClick={clearFilters} className="mt-5 min-h-11 rounded-lg border border-[#DEE1E5] bg-white px-4 text-sm font-medium text-[#3A3E4A] hover:bg-[#F3F3F5]">Clear filters</button>}
    </div>
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[#E5E7EA] bg-white pl-16 pr-4 sm:pr-7 lg:pl-7">
        <h1 className="shrink-0 whitespace-nowrap text-xl font-bold tracking-[-0.01em] text-[#1A1C21]">Tasks</h1>
        <button type="button" className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-[#0E7A4F] px-4 text-sm font-semibold text-white hover:bg-[#0B6A44]">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add New
        </button>
      </header>

      <div className="space-y-5 p-5 lg:p-6">
        <p className="text-[13.5px] leading-[1.5] text-[#6B7080]">Every call, WhatsApp, site visit and quotation reminder your team owes across Consumer, Partner and Dealer leads, all in one queue.</p>

        {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{notice}</p>}

        <section aria-label="Task list" className="flex min-h-[75vh] flex-1 flex-col overflow-hidden rounded-[18px] border border-[#E5E7EA] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {/* Toolbar: status tabs, search, filter menu and export */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFEFF2] p-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <div role="tablist" aria-label="Task status filter" className="flex w-full min-w-0 gap-0.5 sm:w-auto sm:shrink-0 rounded-[9px] border border-[#E5E7EA] bg-[#F2F3F5] p-[3px]">
                {STATUSES.map((option) => {
                  const on = status === option.value;
                  return (
                    <button key={option.value} type="button" role="tab" aria-selected={on} onClick={() => setStatus(option.value)}
                      className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 text-[13px] transition-colors sm:flex-none sm:px-3.5 sm:text-sm ${on ? "bg-white font-semibold text-[#1A1C21] shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "font-medium text-[#5F6473] hover:text-[#1A1C21]"}`}>
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="relative flex w-full min-w-0 items-center sm:w-auto sm:min-w-40 sm:max-w-[280px] sm:flex-1">
                <label className="sr-only" htmlFor="task-search">Search tasks</label>
                <svg aria-hidden="true" className="pointer-events-none absolute left-3 h-[15px] w-[15px] text-[#8A8F9C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
                <input
                  id="task-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tasks, leads or assignee…"
                  className={`h-[38px] w-full rounded-[8px] border border-[#DEE1E5] bg-[#F7F8F9] pl-[34px] text-[13.5px] text-[#1A1C21] outline-none focus:outline-2 focus:outline-[#BFE6D2] [&::-webkit-search-cancel-button]:hidden ${search ? "pr-9" : "pr-3"}`}
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2.5 rounded-md p-1 text-[#8A8F9C] hover:text-[#1A1C21]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
              <div className="relative flex-1 sm:flex-none" ref={filterRef}>
                <button type="button" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen} className="inline-flex h-[38px] w-full items-center justify-center gap-1.5 sm:w-auto rounded-lg border border-[#DEE1E5] bg-white px-3 text-sm font-medium text-[#3A3E4A] hover:bg-[#F3F3F5]">
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" /></svg>
                  Filter
                  {filterCount > 0 && <span aria-hidden="true" className="grid h-4 min-w-4 place-items-center rounded-full bg-[#0E7A4F] px-1 text-[10.5px] font-bold text-white">{filterCount}</span>}
                </button>
                {filterOpen && (
                  // Phones: a full-screen sheet with a Done button, so the panel is never cut off at the screen edge
                  <div className="fixed inset-0 z-[1100] flex flex-col items-stretch gap-3 overflow-y-auto bg-white p-5 sm:absolute sm:inset-auto sm:right-0 sm:top-[44px] sm:z-10 sm:flex-row sm:overflow-visible sm:rounded-[10px] sm:border sm:border-[#DEE1E5] sm:p-3 sm:shadow-[0_12px_28px_rgba(16,24,40,0.16)]">
                    <div className="flex items-center justify-between sm:hidden">
                      <span className="text-base font-bold text-[#1A1C21]">Filters</span>
                      <button type="button" onClick={() => setFilterOpen(false)} className="h-10 rounded-lg bg-[#0E7A4F] px-4 text-sm font-semibold text-white">Done</button>
                    </div>
                    <div className="flex w-full flex-col gap-0.5 sm:w-36">
                      <span className={groupLabel}>Due date</span>
                      {DUE_OPTIONS.map((option) => (
                        <button key={option.value} type="button" onClick={() => pickDue(option.value)} className={optionClass(dueKey === option.value)}>{option.label}</button>
                      ))}
                    </div>
                    <div className="h-px w-full shrink-0 bg-[#EFEFF2] sm:h-auto sm:w-px" />
                    <div className="flex w-full flex-col gap-0.5 sm:w-36">
                      <span className={groupLabel}>Lead type</span>
                      {LEAD_TYPES.map((option) => (
                        <button key={option.value} type="button" onClick={() => setLeadType(option.value)} className={optionClass(leadType === option.value)}>{option.label}</button>
                      ))}
                    </div>
                    <div className="h-px w-full shrink-0 bg-[#EFEFF2] sm:h-auto sm:w-px" />
                    <div className="flex max-h-56 w-full flex-col gap-0.5 sm:w-40 overflow-y-auto">
                      <span className={groupLabel}>Activity type</span>
                      <button type="button" onClick={() => setType("")} className={optionClass(type === "")}>All</button>
                      {activityTypes.filter((item) => item.value !== "internal_note").map((item) => (
                        <button key={item.value} type="button" onClick={() => setType(item.value)} className={optionClass(type === item.value)}>{item.label}</button>
                      ))}
                    </div>
                    {isManager && (
                      <>
                        <div className="h-px w-full shrink-0 bg-[#EFEFF2] sm:h-auto sm:w-px" />
                        <div className="flex max-h-56 w-full flex-col gap-0.5 sm:w-40 overflow-y-auto">
                          <span className={groupLabel}>Employee</span>
                          <button type="button" onClick={() => setAssignee("")} className={optionClass(assignee === "")}>All</button>
                          {staff.map((member) => (
                            <button key={member.id} type="button" onClick={() => setAssignee(String(member.id))} className={optionClass(assignee === String(member.id))}>{member.name}</button>
                          ))}
                        </div>
                      </>
                    )}
                    {hasFilters && (
                      <>
                        <div className="h-px w-full shrink-0 bg-[#EFEFF2] sm:h-auto sm:w-px" />
                        <button type="button" onClick={clearFilters} className="self-end px-1 py-0.5 text-xs font-semibold text-[#8A8F9C] hover:text-[#1A1C21]">Clear filters</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button type="button" disabled title="Export is not set up yet" className="inline-flex h-[38px] flex-1 cursor-not-allowed items-center justify-center gap-1.5 sm:flex-none rounded-lg border border-[#DEE1E5] bg-white px-3 text-sm font-medium text-[#3A3E4A] opacity-50">
                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg>
                Export
              </button>
            </div>
          </div>

          {view === "custom" && (
            <div className="border-b border-[#EFEFF2] px-4 py-3">
              <DateRangePicker label="Dates" from={custom?.from ?? ""} to={custom?.to ?? ""} onChange={pickRange} allowFuture clearable={false} defaultOpen={!custom} emptyLabel="Pick dates" className="w-full sm:w-72"
                presets={[
                  { label: "This week", from: startOfWeek(today), to: addDays(startOfWeek(today), 6) },
                  { label: "Next 7 days", from: today, to: addDays(today, 6) },
                  { label: "Next 30 days", from: today, to: addDays(today, 29) },
                  { label: "Last 7 days", from: addDays(today, -6), to: today },
                ]} />
              {rangeError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{rangeError}</p>}
            </div>
          )}

          {/* Body: the list, or the state that replaces it */}
          {awaitingRange ? (
            <div role="status" className="px-6 py-14 text-center">
              <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold text-[#1A1C21]">Pick a date range</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">Choose the first and last day to see the follow-ups scheduled in between.</p>
            </div>
          ) : error && !isLoading ? (
            <div role="alert" className="flex flex-col items-center px-6 py-14 text-center">
              <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold text-[#1A1C21]">Something went wrong</h2>
              <p className="mt-2 max-w-sm text-sm text-gray-500">{error}</p>
              <button type="button" onClick={() => void load()} className="mt-6 min-h-11 rounded-lg border border-[#DEE1E5] bg-white px-4 text-sm font-medium text-[#3A3E4A] hover:bg-[#F3F3F5]">Try again</button>
            </div>
          ) : isLoading && !data ? (
            <div aria-busy="true" aria-label="Loading tasks" className="space-y-3 p-4 animate-pulse">
              {[0, 1, 2].map((row) => (
                <div key={row} className="rounded-2xl border border-gray-200 bg-white p-4"><span className="block h-3.5 w-1/4 rounded bg-gray-200" /><span className="mt-3 block h-4 w-1/2 rounded bg-gray-200" /><span className="mt-2 block h-3 w-1/3 rounded bg-gray-100" /></div>
              ))}
            </div>
          ) : data && (
            <div className={`min-w-0 flex-1 ${isLoading ? "opacity-60 transition-opacity" : "transition-opacity"}`}>
              {wide ? (
                <TaskTable tasks={items} empty={items.length === 0 ? emptyState : undefined} onStartMarkDone={startMarkDone} onStartReschedule={startReschedule} />
              ) : items.length === 0 ? emptyState : (
                <ul className="space-y-3 p-4">
                  {items.map((task) => <li key={task.id}><TaskCard task={task} showAssignee={isManager || Boolean(assignee)} onStartMarkDone={startMarkDone} onStartReschedule={startReschedule} /></li>)}
                </ul>
              )}
            </div>
          )}

          {/* Count sits at the bottom edge of the card, whether there is one task or many */}
          {data && items.length > 0 && <div className="mt-auto border-t border-[#EFEFF2] px-4 py-3.5 text-sm text-[#3A3E4A]">Showing {items.length} {items.length === 1 ? "task" : "tasks"}</div>}
        </section>
      </div>

      {dialog?.step === "complete" && (
        <CompleteTaskDialog task={dialog.task} onSave={(notes) => completeTask(dialog.task, notes)} onCancel={() => setDialog(null)} />
      )}
      {dialog?.step === "next" && (
        <NextFollowupDialog task={dialog.task} onSchedule={() => setDialog({ step: "schedule", task: dialog.task })} onDone={() => { setDialog(null); setNotice(`Done. The activity was logged for ${dialog.task.contact_name}.`); }} />
      )}
      {dialog?.step === "schedule" && dialog.task.contact_id !== null && (
        <FollowupScheduleForm contactId={dialog.task.contact_id} contactName={dialog.task.contact_name}
          staff={isManager && staff.length > 0 ? staff : dialog.task.assigned_to === null ? [] : [{ id: dialog.task.assigned_to, name: dialog.task.assigned_to_name ?? "Assignee" }]}
          defaultAssignee={dialog.task.assigned_to} onCancel={() => setDialog(null)}
          onSaved={async () => { const { task } = dialog; setDialog(null); setNotice(`Follow-up scheduled for ${task.contact_name}.`); await load(true); }} />
      )}
      {dialog?.step === "reschedule" && (
        <RescheduleTaskDialog task={dialog.task} onSave={(date, time) => rescheduleTask(dialog.task, date, time)} onCancel={() => setDialog(null)} />
      )}
    </div>
  );
}
