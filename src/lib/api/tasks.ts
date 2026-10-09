import { request } from "./auth";
import type { ActivityItem } from "./activities";

/** A follow-up task with the contact it belongs to. Mirrors API.md (GET /tasks). */
export type TaskItem = ActivityItem & {
  contact_id: number;
  contact_name: string;
  contact_phone: string;
  contact_type: string;
};

export type TaskSummary = { overdue: number; today: number; upcoming: number; done: number };
export type TaskList = { items: TaskItem[]; total: number; summary: TaskSummary };

export type TaskStatus = "open" | "done" | "all";
export type TaskQuery = {
  dateFrom: string; dateTo: string; status: TaskStatus;
  assignedTo?: number; type?: string; q?: string; includeOverdue?: boolean;
};

export function listTasks(accessToken: string, query: TaskQuery) {
  const params = new URLSearchParams({ date_from: query.dateFrom, date_to: query.dateTo, status: query.status });
  if (query.assignedTo !== undefined) params.set("assigned_to", String(query.assignedTo));
  if (query.type) params.set("type", query.type);
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.includeOverdue) params.set("include_overdue", "true");
  return request<TaskList>(`/tasks?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
}
