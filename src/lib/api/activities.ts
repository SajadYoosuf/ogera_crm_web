import { request } from "./auth";

/** Mirrors the activity shape in API.md (GET /contacts/{id}/activities). */
export type ActivityItem = {
  id: number;
  title: string | null; // the task name; null on older records
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
  task_id: number | null; // on an outcome log entry: the follow-up it records
  created_by: number;
  created_by_name: string | null;
  created_at: string;
  task_state: "pending" | "due_today" | "overdue" | "done";
  overdue_days: number;
};

export type LogActivityInput = { activity_type: string; notes: string; coordinates?: { lat: number; lng: number } };
export type ScheduleInput = { title?: string; type: string; priority?: "high" | "medium" | "low"; scheduled_date: string; scheduled_time?: string; notes?: string; assigned_to: number };

/** Activity types that cannot be scheduled. Every other active type in Settings can be. */
export const NOT_SCHEDULABLE = ["internal_note"] as const;

const headers = (accessToken: string, json = false) => ({ Authorization: `Bearer ${accessToken}`, ...(json ? { "Content-Type": "application/json" } : {}) });

/** A logged activity from GET /contacts/{id}/activities (backend ActivityLogResponse). */
type LoggedActivity = {
  id: number;
  title: string | null;
  done_by: number;
  done_by_name: string | null;
  activity_type: string;
  notes: string | null;
  followup_id: number | null;
  logged_at: string;
};

/** A scheduled follow-up from GET /contacts/{id}/followups (backend FollowupScheduleResponse). */
export type FollowupItem = {
  id: number;
  title: string | null;
  assigned_to: number;
  assigned_to_name: string | null;
  due_at: string;
  status: string;
  channel: string | null;
  notes: string | null;
  created_at: string;
  task_state: string;
  overdue_days: number;
};

const CHANNEL_TO_TYPE: Record<string, string> = { call: "phone_call", visit: "field_visit", whatsapp: "whatsapp" };

const fromLogged = (row: LoggedActivity): ActivityItem => ({
  id: row.id,
  title: row.title,
  type: row.activity_type,
  notes: row.notes,
  status: "done",
  scheduled_date: null,
  scheduled_time: null,
  assigned_to: null,
  assigned_to_name: null,
  completed_at: row.logged_at,
  completed_by: row.done_by,
  completed_by_name: row.done_by_name,
  coordinates: null,
  task_id: row.followup_id,
  created_by: row.done_by,
  created_by_name: row.done_by_name,
  created_at: row.logged_at,
  task_state: "done",
  overdue_days: 0,
});

/** The API calls an open task "todo" or "inprogress"; the UI only knows pending, due today and overdue. */
const taskStateOf = (state: string): ActivityItem["task_state"] => (state === "due_today" || state === "overdue" ? state : "pending");

const fromFollowup = (row: FollowupItem): ActivityItem => {
  const done = row.status === "completed";
  return {
    id: row.id,
    title: row.title,
    type: row.channel ? (CHANNEL_TO_TYPE[row.channel] ?? row.channel) : "other",
    notes: row.notes,
    status: done ? "done" : "pending",
    scheduled_date: row.due_at.slice(0, 10),
    scheduled_time: row.due_at.slice(11, 19) || null,
    assigned_to: row.assigned_to,
    assigned_to_name: row.assigned_to_name,
    completed_at: null,
    completed_by: null,
    completed_by_name: null,
    coordinates: null,
    task_id: row.id,
    created_by: row.assigned_to,
    created_by_name: row.assigned_to_name,
    created_at: row.created_at,
    task_state: done ? "done" : taskStateOf(row.task_state),
    overdue_days: row.overdue_days,
  };
};

/** Logged activities and scheduled follow-ups for one contact, in the shape the lead panel renders. */
export const listActivities = async (accessToken: string, contactId: number): Promise<ActivityItem[]> => {
  const [logged, followups] = await Promise.all([
    request<LoggedActivity[]>(`/contacts/${contactId}/activities`, { headers: headers(accessToken) }),
    request<FollowupItem[]>(`/contacts/${contactId}/followups`, { headers: headers(accessToken) }),
  ]);
  return [...logged.map(fromLogged), ...followups.map(fromFollowup)];
};

/** Log something that already happened; the server stamps the time. */
export const logActivity = (accessToken: string, contactId: number, input: LogActivityInput) =>
  request<ActivityItem>(`/contacts/${contactId}/activities`, { method: "POST", headers: headers(accessToken, true), body: JSON.stringify(input) });

/** Schedule a follow-up task for a staff member. */
export const scheduleFollowup = async (accessToken: string, contactId: number, input: ScheduleInput): Promise<ActivityItem> => {
  // No time chosen: the follow-up stays due for the whole day.
  const dueAt = `${input.scheduled_date}T${input.scheduled_time ?? "23:59"}:00`;
  const row = await request<FollowupItem>(`/contacts/${contactId}/followups`, {
    method: "POST",
    headers: headers(accessToken, true),
    body: JSON.stringify({ title: input.title || undefined, channel: input.type, due_at: dueAt, assigned_to: input.assigned_to, notes: input.notes }),
  });
  return fromFollowup(row);
};

/** Mark a pending follow-up done. `notes` is what happened; the server logs it as an activity (backend outcome "done"). */
export const markFollowupDone = (accessToken: string, contactId: number, followupId: number, notes: string) =>
  request<FollowupItem>(`/contacts/${contactId}/followups/${followupId}`, {
    method: "PATCH", headers: headers(accessToken, true), body: JSON.stringify({ status: "completed", outcome: "done", notes }),
  });

/** Move a pending follow-up to a new due date. No time means the whole day (23:59, as when scheduling). */
export const rescheduleFollowup = (accessToken: string, contactId: number, followupId: number, date: string, time?: string) =>
  request<FollowupItem>(`/contacts/${contactId}/followups/${followupId}`, {
    method: "PATCH", headers: headers(accessToken, true), body: JSON.stringify({ due_at: `${date}T${time || "23:59"}:00` }),
  });
