/**
 * Interactions API — unified activity logs and follow-up tasks for leads and contacts.
 *
 * HOW IT WORKS:
 *   Two kinds of interaction exist:
 *     kind = 'log'  — a past activity that already happened (phone call, visit, etc.)
 *     kind = 'task' — a scheduled future follow-up (assigned to someone, has a due date)
 *
 *   Both are stored in one table on the backend. The entity type tells the backend
 *   which entity it belongs to:
 *     entity_type = 'lead'    → linked to a Lead (pre-conversion)
 *     entity_type = 'contact' → linked to a Contact (post-conversion or direct)
 *
 * HOW "OTHER" TYPE WORKS:
 *   When activity_type = 'other', also send custom_label with the free-text name
 *   the manager types (e.g. "Site measurement", "Demo visit").
 *
 * USAGE:
 *   Always pass the JWT token from useAuth().token as the first argument.
 *   Every function throws ApiError on failure — catch it at the call site.
 */

import { apiCall } from "@/lib/api/auth";

// ── Types ────────────────────────────────────────────────────────────────────

export type InteractionKind = "log" | "task";
export type InteractionEntityType = "lead" | "contact";
export type InteractionPriority = "high" | "medium" | "low";
export type InteractionStatus = "todo" | "inprogress" | "completed";
export type InteractionOutcome = "done" | "not_now" | "no_answer";

/** A single interaction as returned by the API. */
export type Interaction = {
  id: number;
  entity_type: InteractionEntityType;
  entity_id: number;
  kind: InteractionKind;
  activity_type: string;
  /** Filled only when activity_type = 'other'. */
  custom_label: string | null;
  title: string | null;
  notes: string | null;
  // People
  done_by: number | null;
  done_by_name: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by: number | null;
  created_by_name: string | null;
  // Task fields (null for logs)
  due_at: string | null;
  priority: InteractionPriority;
  status: InteractionStatus;
  // Completion
  outcome: InteractionOutcome | null;
  parent_task_id: number | null;
  // Timestamps
  logged_at: string;
  created_at: string;
  // Computed
  overdue_days: number;
  /** Open task whose due time has passed (by the minute, not the day). */
  is_overdue?: boolean;
  overdue_minutes?: number;
  /** Completed tasks: when it was completed and how it was actually done (from the linked activity). */
  completed_at?: string | null;
  actual_activity_type?: string | null;
  actual_custom_label?: string | null;
};

/** A task row from GET /lead-tasks: the interaction plus its lead. */
export type LeadTask = Interaction & {
  lead_name: string;
  lead_phone: string | null;
  lead_status: string | null;
};

export type LeadTaskBucket = "today" | "overdue" | "upcoming" | "completed";

export type LeadTaskList = {
  items: LeadTask[];
  total: number;
  skip: number;
  limit: number;
  bucket: LeadTaskBucket;
  summary: Record<LeadTaskBucket, number>;
};

/** Body for POST .../interactions/log */
export type LogActivityInput = {
  activity_type: string;
  /** Required when activity_type = 'other'. */
  custom_label?: string;
  title?: string;
  notes: string;
  outcome?: InteractionOutcome;
  /** Admin/manager only: log on behalf of another employee. */
  done_by?: number;
  /** Override the timestamp (for importing historical logs). */
  logged_at?: string;
};

/** Body for POST .../interactions/task */
export type ScheduleTaskInput = {
  activity_type: string;
  /** Required when activity_type = 'other'. */
  custom_label?: string;
  title?: string;
  notes?: string;
  due_at: string;        // ISO datetime string
  assigned_to: number;
  priority?: InteractionPriority;
};

/** Body for PATCH /interactions/{id} */
export type UpdateTaskInput =
  | {
      status: "completed";
      outcome: InteractionOutcome;
      notes?: string;
      /** How it was actually done; defaults to the task's planned type. */
      actual_activity_type?: string;
      /** Required when actual_activity_type = 'other'. */
      custom_label?: string;
    }
  | { status: "todo" | "inprogress" };

// ── Lead interactions ─────────────────────────────────────────────────────────

/** POST /leads/{id}/interactions/log — log a past activity on a lead. */
export const logLeadActivity = (token: string, leadId: number, input: LogActivityInput): Promise<Interaction> =>
  apiCall<Interaction>(token, "POST", `/leads/${leadId}/interactions/log`, input);

/** POST /leads/{id}/interactions/task — schedule a follow-up task on a lead. */
export const scheduleLeadTask = (token: string, leadId: number, input: ScheduleTaskInput): Promise<Interaction> =>
  apiCall<Interaction>(token, "POST", `/leads/${leadId}/interactions/task`, input);

/** GET /leads/{id}/interactions — list all interactions for a lead. */
export function listLeadInteractions(token: string, leadId: number, kind?: InteractionKind): Promise<Interaction[]> {
  const q = kind ? `?kind=${kind}` : "";
  return apiCall<Interaction[]>(token, "GET", `/leads/${leadId}/interactions${q}`);
}

// ── Contact interactions ──────────────────────────────────────────────────────

/** POST /contacts/{id}/interactions/log — log a past activity on a contact. */
export const logContactActivity = (token: string, contactId: number, input: LogActivityInput): Promise<Interaction> =>
  apiCall<Interaction>(token, "POST", `/contacts/${contactId}/interactions/log`, input);

/** POST /contacts/{id}/interactions/task — schedule a follow-up task on a contact. */
export const scheduleContactTask = (token: string, contactId: number, input: ScheduleTaskInput): Promise<Interaction> =>
  apiCall<Interaction>(token, "POST", `/contacts/${contactId}/interactions/task`, input);

/** GET /contacts/{id}/interactions — list all interactions for a contact. */
export function listContactInteractions(token: string, contactId: number, kind?: InteractionKind): Promise<Interaction[]> {
  const q = kind ? `?kind=${kind}` : "";
  return apiCall<Interaction[]>(token, "GET", `/contacts/${contactId}/interactions${q}`);
}

// ── Task update ───────────────────────────────────────────────────────────────

/** PATCH /interactions/{id} — update a task (status or complete). Assignee or admin/manager. */
export const updateInteraction = (token: string, interactionId: number, input: UpdateTaskInput): Promise<Interaction> =>
  apiCall<Interaction>(token, "PATCH", `/interactions/${interactionId}`, input);

/** PATCH /leads/{id}/interactions/{iid}/reschedule — move a task's due time (not into the past). Assignee or admin/manager. */
export const rescheduleLeadTask = (token: string, leadId: number, interactionId: number, dueAt: string, reason?: string): Promise<Interaction> =>
  apiCall<Interaction>(token, "PATCH", `/leads/${leadId}/interactions/${interactionId}/reschedule`, {
    due_at: dueAt,
    ...(reason && reason.trim() ? { reason: reason.trim() } : {}),
  });

/** GET /lead-tasks — follow-ups across leads for the Tasks page. Staff get only their own. */
export function listLeadTasks(
  token: string,
  params: { bucket: LeadTaskBucket; assignedTo?: number | null; q?: string; skip?: number; limit?: number },
): Promise<LeadTaskList> {
  const query = new URLSearchParams({ bucket: params.bucket });
  if (params.assignedTo != null) query.set("assigned_to", String(params.assignedTo));
  if (params.q && params.q.trim()) query.set("q", params.q.trim());
  if (params.skip) query.set("skip", String(params.skip));
  if (params.limit) query.set("limit", String(params.limit));
  return apiCall<LeadTaskList>(token, "GET", `/lead-tasks?${query.toString()}`);
}

/** PATCH /leads/{id}/interactions/{iid}/reassign — admin/manager only. */
export const reassignLeadTask = (token: string, leadId: number, interactionId: number, assignedTo: number): Promise<Interaction> =>
  apiCall<Interaction>(token, "PATCH", `/leads/${leadId}/interactions/${interactionId}/reassign`, { assigned_to: assignedTo });

/** DELETE /leads/{id}/interactions/{iid} — admin/manager only. */
export const deleteLeadInteraction = (token: string, leadId: number, interactionId: number): Promise<void> =>
  apiCall<void>(token, "DELETE", `/leads/${leadId}/interactions/${interactionId}`);

/**
 * Activity types shown until /settings/enums/activity_type answers (or if it fails),
 * so the log and follow-up forms are never empty.
 */
export const ACTIVITY_TYPE_FALLBACK = [
  { value: "phone_call", label: "Phone Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "field_visit", label: "Field Visit" },
  { value: "message", label: "Message" },
  { value: "quotation", label: "Quotation" },
  { value: "note", label: "Note" },
  { value: "other", label: "Other" },
];

/**
 * A local date ("2026-11-30") and optional time ("14:30") as a UTC ISO string.
 * The backend reads offset-less times as UTC, so the browser's timezone must be applied here.
 */
export function localDateTimeToIso(date: string, time?: string, defaultTime = "09:00"): string {
  return new Date(`${date}T${time || defaultTime}:00`).toISOString();
}
