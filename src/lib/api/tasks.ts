import { request } from "./auth";
import type { ActivityItem } from "./activities";

/** A follow-up task with the contact it belongs to. Mirrors API.md (GET /tasks). Standalone tasks have no contact (contact_id null). */
export type TaskItem = ActivityItem & {
  contact_id: number | null;
  contact_name: string;
  contact_phone: string;
  contact_type: string;
  priority?: "high" | "medium" | "low";
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
