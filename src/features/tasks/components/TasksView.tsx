"use client";

/**
 * /dashboard/tasks — every lead follow-up in one place, table layout matching the Leads page.
 *
 *   Toolbar   search + bucket dropdown (Today/Overdue/Upcoming/Completed) + assignee filter
 *   Table     Lead, Title, Type, Priority, Status, Due, Assigned To, Action
 *   Status    dropdown only the assignee can change; choosing Completed opens the completion form
 *   Action    three-dot menu: View Lead, Reschedule, Reassign, Delete (by role rules)
 *   Detail    clicking a row opens the task card; the menu opens each action directly
 */

import { useEffect, useState, type MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import { listAllEmployees } from "@/lib/api/employees";
import {
  ACTIVITY_TYPE_FALLBACK,
  updateInteraction,
  type InteractionStatus,
  type LeadTask,
  type LeadTaskBucket,
} from "@/lib/api/interactions";
import { isLeadHead } from "@/lib/shared/roles";
import {
  FollowupCard,
  PRIORITY_BADGE,
  TASK_STATUS_FALLBACK,
  formatDate,
  formatTime,
  overdueMinutes,
  overdueText,
  useTaskStatusStyle,
} from "@/features/leads/components/FollowupCard";
import LeadTaskActions, { type TaskActionMode } from "@/features/leads/components/LeadTaskActions";
import { useFollowupSettings } from "@/features/settings/hooks/useFollowupSettings";
import { useLeadTasks } from "../hooks/useLeadTasks";
import { staticOptions, useEnumOptions } from "@/hooks/useEnumOptions";

// ── Constants ─────────────────────────────────────────────────────────────────

const BUCKETS: { key: LeadTaskBucket; label: string; emptyMsg: string }[] = [
  { key: "today",    label: "Today",    emptyMsg: "Nothing due today." },
  { key: "overdue",  label: "Overdue",  emptyMsg: "No overdue follow-ups. Nice work." },
  { key: "upcoming", label: "Upcoming", emptyMsg: "No upcoming follow-ups scheduled." },
  { key: "completed",label: "Completed",emptyMsg: "No completed follow-ups yet." },
];

const isBucket = (v: string | null): v is LeadTaskBucket => BUCKETS.some((b) => b.key === v);

const PRIORITY_FALLBACK = staticOptions([
  { value: "high",   label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low",    label: "Low" },
]);

const FALLBACK_TYPES = staticOptions(ACTIVITY_TYPE_FALLBACK);

type Employee = { id: number; name: string };
type ActionMenu = { task: LeadTask; top: number; right: number };
type Detail = { task: LeadTask; mode: TaskActionMode };

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-t border-[#EFEFF2]">
          {Array.from({ length: columns }).map((__, col) => (
            <td key={col} className="px-3 py-3.5">
              <div className="h-3.5 w-20 animate-pulse rounded-md bg-[#ECECF0]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function StatusSelect({ task, editable, onChange }: {
  task: LeadTask;
  editable: boolean;
  onChange: (status: InteractionStatus) => void;
}) {
  const { options } = useEnumOptions("task_status", TASK_STATUS_FALLBACK);
  const { className } = useTaskStatusStyle()(task.status);
  const locked = !editable || task.status === "completed";
  return (
    <select
      aria-label="Task status"
      value={task.status}
      disabled={locked}
      onChange={(e) => onChange(e.target.value as InteractionStatus)}
      className={`h-7 rounded-full border-0 px-2 text-[11px] font-semibold outline-none focus:outline-2 focus:outline-[#7EE2A8] disabled:cursor-default ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function MenuItem({ label, danger, onClick }: { label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#F3F3F5] ${danger ? "text-red-600" : "text-[#3A3E4A]"}`}
    >
      {label}
    </button>
  );
}

function TaskDetailModal({
  detail,
  employees,
  onClose,
  onChanged,
}: {
  detail: Detail;
  employees: Employee[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { task, mode } = detail;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Task: ${task.title ?? task.activity_type}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#EFEFF2] px-5 py-4">
          <div>
            <p className="mb-0.5 text-sm font-bold text-[#0E4D3A]">{task.lead_name}</p>
            {task.lead_phone && <p className="text-xs text-[#6B7080]">{task.lead_phone}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-[#6B7080] hover:bg-[#F3F3F5] hover:text-[#1A1C21]"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <ul>
            <FollowupCard task={task}>
              {mode !== "idle" && (
                <LeadTaskActions
                  task={task}
                  leadId={task.entity_id}
                  leadName={task.lead_name}
                  employees={employees}
                  initialMode={mode}
                  onCancel={onClose}
                  onChanged={onChanged}
                />
              )}
            </FollowupCard>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function TasksView() {
  const { token, user } = useAuth();
  const head = isLeadHead(user);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const bucket: LeadTaskBucket = isBucket(tabParam) ? tabParam : "today";

  const [search, setSearch]     = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [menu, setMenu] = useState<ActionMenu | null>(null);
  const [statusError, setStatusError] = useState("");

  const assignedTo = head && assignee ? Number(assignee) : null;
  const { settings } = useFollowupSettings();

  const { labelOf: activityLabel } = useEnumOptions("activity_type", FALLBACK_TYPES);
  const { labelOf: priorityLabel } = useEnumOptions("task_priority", PRIORITY_FALLBACK);

  const { items, summary, total, isLoading, isLoadingMore, error, reload, loadMore, hasMore } =
    useLeadTasks(bucket, assignedTo, search);

  useEffect(() => {
    if (!token || !head) return;
    let cancelled = false;
    listAllEmployees(token)
      .then(({ employees: list }) => {
        if (!cancelled)
          setEmployees(list.filter((e) => e.is_active !== false).map((e) => ({ id: e.id, name: e.name })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, head]);

  function selectBucket(key: LeadTaskBucket) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const openLead = (leadId: number) => router.push(`/dashboard/leads?lead=${leadId}`);
  const isAssignee = (task: LeadTask) => user != null && task.assigned_to === user.id;

  function openMenu(e: MouseEvent<HTMLButtonElement>, task: LeadTask) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ task, top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }

  function pick(task: LeadTask, mode: TaskActionMode) {
    setMenu(null);
    setDetail({ task, mode });
  }

  async function changeStatus(task: LeadTask, status: InteractionStatus) {
    if (!token) return;
    if (status === "completed") {
      setDetail({ task, mode: "complete" });
      return;
    }
    setStatusError("");
    try {
      await updateInteraction(token, task.id, { status });
      reload();
    } catch (caught) {
      setStatusError(caught instanceof ApiError ? caught.message : "Could not update the status. Try again.");
    }
  }

  const offline =
    error instanceof ApiError &&
    (error.kind === "offline" || error.kind === "network" || error.kind === "timeout");
  const filtered = Boolean(search.trim() || assignedTo);
  const currentBucket = BUCKETS.find((b) => b.key === bucket)!;

  const tableColumns = ["Lead", "Title", "Type", "Priority", "Status", "Due", ...(head ? ["Assigned To"] : [])];

  const menuTask = menu?.task;
  const menuOpen = menuTask !== undefined && menuTask.status !== "completed";
  const menuCanReschedule = menuTask !== undefined && (head || (isAssignee(menuTask) && settings.allow_staff_reschedule));

  return (
    <div className="flex min-h-full flex-col bg-[#F4FBF7]">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-[#E7E7EA] bg-white pl-16 pr-3 sm:gap-4 sm:pr-7 lg:pl-7">
        <div>
          <h1 className="truncate text-[22px] font-bold tracking-[-0.01em] text-[#1A1C21] sm:text-[26px]">Tasks</h1>
          <p className="text-xs text-[#8A8F9C]">
            {head ? "Follow-ups across all leads" : "Your follow-ups across all your leads"}
          </p>
        </div>
      </header>

      <div className="min-w-0 space-y-4 p-4 sm:px-7 sm:py-6">
        <section aria-label="Task list" className="flex flex-col rounded-[14px] border border-[#E7E7EA] bg-white">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-[#EFEFF2] p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8F9C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lead name, phone or task"
                aria-label="Search tasks"
                className="h-[38px] w-full rounded-[8px] border border-[#E1E1E6] bg-white pl-9 pr-3 text-sm text-[#1A1C21] outline-none focus:outline-2 focus:outline-[#7EE2A8] sm:w-[280px]"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <select
                value={bucket}
                onChange={(e) => selectBucket(e.target.value as LeadTaskBucket)}
                aria-label="Task group"
                className="h-9 rounded-[8px] border border-[#E1E1E6] bg-white px-2.5 text-sm text-[#1A1C21] outline-none focus:outline-2 focus:outline-[#7EE2A8]"
              >
                {BUCKETS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label} ({summary[b.key]})
                  </option>
                ))}
              </select>

              {head && (
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  aria-label="Assigned to"
                  className="h-9 rounded-[8px] border border-[#E1E1E6] bg-white px-2.5 text-sm text-[#1A1C21] outline-none focus:outline-2 focus:outline-[#7EE2A8]"
                >
                  <option value="">Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={String(e.id)}>{e.name}</option>
                  ))}
                </select>
              )}

              {filtered && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setAssignee(""); }}
                  className="h-[38px] rounded-[8px] border border-[#E1E1E6] bg-white px-3 text-sm font-medium text-[#3A3E4A] hover:bg-[#F3F3F5]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="min-w-0 overflow-hidden rounded-b-[14px]">
            {error ? (
              <div role="alert" className="flex flex-col items-center px-6 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </span>
                <h2 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A1C21]">Unable to load tasks</h2>
                <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[#6B7080]">
                  {offline ? "You're offline or the server can't be reached." : (error as Error).message || "Could not load tasks."}
                </p>
                <button
                  type="button"
                  onClick={reload}
                  className="mt-5 inline-flex h-9 items-center justify-center rounded-lg border border-[#E1E1E6] bg-white px-4 text-[13px] font-semibold text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5]"
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                {statusError && <p role="alert" className="px-4 pt-3 text-sm text-red-600">{statusError}</p>}
                <div className="w-full overflow-x-auto">
                  <table className="w-max min-w-full border-collapse text-base [&_td]:whitespace-nowrap">
                    <thead className="bg-[#F7F7F9] text-left text-sm font-medium text-[#4B5060]">
                      <tr>
                        {tableColumns.map((col) => (
                          <th key={col} scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                            {col}
                          </th>
                        ))}
                        <th scope="col" className="sticky right-0 z-10 bg-[#F7F7F9] px-4 py-3 text-center font-medium shadow-[-8px_0_8px_-8px_rgba(16,24,40,0.18)]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <SkeletonRows columns={tableColumns.length + 1} />
                      ) : items.length === 0 ? (
                        <tr>
                          <td colSpan={tableColumns.length + 1}>
                            <div className="flex flex-col items-center px-6 py-14 text-center">
                              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E7F5EE] text-[#0E4D3A]">
                                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
                                </svg>
                              </span>
                              <h2 className="mt-4 text-[15px] font-bold tracking-tight text-[#1A1C21]">
                                {filtered ? "No tasks match these filters." : currentBucket.emptyMsg}
                              </h2>
                              {filtered && (
                                <button
                                  type="button"
                                  onClick={() => { setSearch(""); setAssignee(""); }}
                                  className="mt-2 text-sm font-semibold text-[#0E4D3A] hover:underline"
                                >
                                  Clear filters
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        items.map((task) => {
                          const minutes = overdueMinutes(task);
                          const isOverdue = minutes > 0;
                          const actType =
                            task.activity_type === "other" && task.custom_label
                              ? task.custom_label
                              : activityLabel(task.activity_type);
                          return (
                            <tr
                              key={task.id}
                              onClick={() => setDetail({ task, mode: "idle" })}
                              className="group cursor-pointer border-t border-[#EFEFF2] transition-colors hover:bg-[#FAFAFB] [&_td]:py-3.5"
                            >
                              <td className="px-3">
                                <div className="max-w-[200px]">
                                  <div className="truncate font-semibold text-[#1A1C21] underline decoration-transparent decoration-2 underline-offset-2 transition-colors group-hover:text-[#0E4D3A] group-hover:decoration-[#0E4D3A]">
                                    {task.lead_name}
                                  </div>
                                  {task.lead_phone && (
                                    <div className="text-xs tabular-nums text-[#6B7080]">{task.lead_phone}</div>
                                  )}
                                </div>
                              </td>

                              <td className="px-3">
                                {task.title ? (
                                  <span className="block max-w-[200px] truncate text-sm text-[#3A3E4A]">{task.title}</span>
                                ) : (
                                  <span className="text-[#B4B8C2]">—</span>
                                )}
                              </td>

                              <td className="px-3">
                                <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-[3px] text-xs font-semibold text-teal-700">
                                  {actType}
                                </span>
                              </td>

                              <td className="px-3">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-xs font-semibold ${PRIORITY_BADGE[task.priority] ?? ""}`}>
                                  {priorityLabel(task.priority)}
                                </span>
                              </td>

                              <td className="px-3" onClick={(e) => e.stopPropagation()}>
                                <StatusSelect
                                  task={task}
                                  editable={isAssignee(task)}
                                  onChange={(status) => void changeStatus(task, status)}
                                />
                              </td>

                              <td className="px-3">
                                {task.due_at ? (
                                  <div className="text-xs">
                                    {isOverdue ? (
                                      <p className="font-semibold text-red-600">{overdueText(minutes)}</p>
                                    ) : (
                                      <p className="text-[#3A3E4A]">{formatDate(task.due_at)}</p>
                                    )}
                                    <p className="text-[#8A8F9C]">{formatTime(task.due_at)}</p>
                                  </div>
                                ) : (
                                  <span className="text-[#B4B8C2]">—</span>
                                )}
                              </td>

                              {head && (
                                <td className="px-3 text-sm text-[#3A3E4A]">
                                  {task.assigned_to_name ?? <span className="text-[#B4B8C2]">Unassigned</span>}
                                </td>
                              )}

                              <td
                                className="sticky right-0 z-10 bg-white px-4 text-center transition-colors group-hover:bg-[#FAFAFB] shadow-[-8px_0_8px_-8px_rgba(16,24,40,0.18)]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  aria-label="Task actions"
                                  aria-haspopup="menu"
                                  onClick={(e) => openMenu(e, task)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E1E1E6] bg-white text-[#3A3E4A] hover:bg-[#F3F3F5]"
                                >
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {!isLoading && total > 0 && (
                  <nav
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFEFF2] px-3 py-3 sm:px-4 sm:py-3.5"
                    aria-label="Tasks pagination"
                  >
                    <p className="text-sm text-[#3A3E4A]">
                      Showing {items.length} of {total} tasks
                    </p>
                    {hasMore && (
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={isLoadingMore}
                        className="inline-flex h-9 items-center rounded-[8px] bg-[#0E4D3A] px-4 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isLoadingMore ? "Loading…" : "Load more"}
                      </button>
                    )}
                  </nav>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {menu && menuTask && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} aria-hidden="true" />
          <div
            role="menu"
            aria-label="Task actions"
            className="fixed z-50 w-44 rounded-lg border border-[#E5E7EA] bg-white py-1 shadow-lg"
            style={{ top: menu.top, right: menu.right }}
          >
            <MenuItem label="View Lead" onClick={() => { setMenu(null); openLead(menuTask.entity_id); }} />
            {menuOpen && menuCanReschedule && <MenuItem label="Reschedule" onClick={() => pick(menuTask, "reschedule")} />}
            {menuOpen && head && employees.length > 0 && <MenuItem label="Reassign" onClick={() => pick(menuTask, "reassign")} />}
            {head && <MenuItem label="Delete" danger onClick={() => pick(menuTask, "delete")} />}
          </div>
        </>
      )}

      {detail && (
        <TaskDetailModal
          detail={detail}
          employees={employees}
          onClose={() => setDetail(null)}
          onChanged={() => { reload(); setDetail(null); }}
        />
      )}
    </div>
  );
}
