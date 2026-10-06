import { request } from "./auth";

/** Mirrors the activity shape in API.md (GET /contacts/{id}/activities). */
export type ActivityItem = {
  id: number;
  type: string;
  notes: string | null;
  status: "pending" | "done";
  scheduled_date: string | null;
  scheduled_time: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  completed_at: string | null;
  completed_by: number | null;
  completed_by_name: string | null;
  coordinates: { lat: number; lng: number } | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
  task_state: "pending" | "due_today" | "overdue" | "done";
  overdue_days: number;
};

export type LogActivityInput = { type: string; notes: string; coordinates?: { lat: number; lng: number } };
export type ScheduleInput = { type: string; scheduled_date: string; scheduled_time?: string; notes?: string; assigned_to: number };

const headers = (accessToken: string, json = false) => ({ Authorization: `Bearer ${accessToken}`, ...(json ? { "Content-Type": "application/json" } : {}) });

export const listActivities = (accessToken: string, contactId: number) =>
  request<ActivityItem[]>(`/contacts/${contactId}/activities`, { headers: headers(accessToken) });

/** Log something that already happened; the server stamps the time. */
export const logActivity = (accessToken: string, contactId: number, input: LogActivityInput) =>
  request<ActivityItem>(`/contacts/${contactId}/activities`, { method: "POST", headers: headers(accessToken, true), body: JSON.stringify(input) });

/** Schedule a follow-up task for a staff member. */
export const scheduleFollowup = (accessToken: string, contactId: number, input: ScheduleInput) =>
  request<ActivityItem>(`/contacts/${contactId}/activities`, { method: "POST", headers: headers(accessToken, true), body: JSON.stringify({ ...input, status: "pending" }) });

/** Mark a pending follow-up done; the server records who and when. */
export const markFollowupDone = (accessToken: string, contactId: number, activityId: number) =>
  request<ActivityItem>(`/contacts/${contactId}/activities/${activityId}`, { method: "PATCH", headers: headers(accessToken, true), body: JSON.stringify({ status: "done" }) });

/** Move a pending follow-up; no time means a date-only task. */
export const rescheduleFollowup = (accessToken: string, contactId: number, activityId: number, date: string, time?: string) =>
  request<ActivityItem>(`/contacts/${contactId}/activities/${activityId}`, {
    method: "PATCH", headers: headers(accessToken, true), body: JSON.stringify({ scheduled_date: date, ...(time ? { scheduled_time: time } : {}) }),
  });
