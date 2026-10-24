import { request } from "./auth";
import type { ActivityItem } from "./activities";

/** The status values a user can pick from the task dropdown. */
export type TaskFollowupStatus = "todo" | "inprogress" | "completed";

/**
 * A follow-up task with the contact it belongs to. Mirrors API.md (GET /tasks). Standalone tasks have no contact (contact_id null).
 * `followup_status` is the real stored status (todo / inprogress / completed). The dropdown must read this,
 * not `status`, because `status` is only "pending" or "done".
 */
export type TaskItem = ActivityItem & {
  contact_id: number | null;
  contact_name: string;
  contact_phone: string;
  contact_type: string;
  priority?: "high" | "medium" | "low";
  followup_status?: TaskFollowupStatus | null;
};

export type TaskSummary = { overdue: number; today: number; upcoming: number; done: number };
export type TaskList = { items: TaskItem[]; total: number; summary: TaskSummary };

/** "due_today" and "overdue" are open tasks that are due today or already late; they ignore the date range. */
export type TaskStatus = "todo" | "inprogress" | "completed" | "all";
export type TaskQuery = {
  /** Leave both out for every date. */
  dateFrom?: string; dateTo?: string; status: TaskStatus;
  assignedTo?: number; type?: string; contactType?: "consumer" | "partner" | "dealer"; q?: string; includeOverdue?: boolean;
};

/**
 * Change a follow-up's status.
 * - "completed" marks it done (outcome = "done").
 * - "todo" | "inprogress" | "pending" are plain status moves.
 * Calls PATCH /contacts/{contactId}/followups/{id}.
 */
export function changeTaskStatus(accessToken: string, contactId: number, taskId: number, status: TaskFollowupStatus) {
  const body = status === "completed"
    ? { status: "completed", outcome: "done" }
    : { status };
  return request<unknown>(`/contacts/${contactId}/followups/${taskId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function listTasks(accessToken: string, query: TaskQuery) {
  const params = new URLSearchParams({ status: query.status });
  if (query.dateFrom) params.set("date_from", query.dateFrom);
  if (query.dateTo) params.set("date_to", query.dateTo);
  if (query.assignedTo !== undefined) params.set("assigned_to", String(query.assignedTo));
  if (query.type) params.set("type", query.type);
  if (query.contactType) params.set("contact_type", query.contactType);
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.includeOverdue) params.set("include_overdue", "true");
  return request<TaskList>(`/tasks?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
}
