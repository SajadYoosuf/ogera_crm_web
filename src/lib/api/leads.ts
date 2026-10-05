import { request } from "./auth";
import type { ApiContact } from "./contacts";

/** Mirrors LeadStageResponse in API.md (GET /contacts/{id}/stages). */
export type StageEntry = {
  id: number;
  stage: string;
  loss_reason: string | null;
  loss_notes: string | null;
  awareness_note: string | null;
  changed_by: number;
  changed_at: string;
};

export type StageChange = { stage: string; loss_reason?: string; loss_notes?: string; awareness_note?: string };

const authHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });
const PAGE = 100; // the backend's maximum page size

/** Every consumer contact, fetched page by page, since the board shows all stages at once. */
export async function listConsumerLeads(accessToken: string): Promise<ApiContact[]> {
  const leads: ApiContact[] = [];
  for (let skip = 0; ; skip += PAGE) {
    const page = await request<{ items: ApiContact[]; total: number }>(`/contacts?contact_type=consumer&skip=${skip}&limit=${PAGE}`, { headers: authHeader(accessToken) });
    leads.push(...page.items);
    if (page.items.length < PAGE || leads.length >= page.total) return leads;
  }
}

export const getStageHistory = (accessToken: string, contactId: number) =>
  request<StageEntry[]>(`/contacts/${contactId}/stages`, { headers: authHeader(accessToken) });

/** Mirrors the activity shape in API.md (GET /contacts/{id}/activities). */
export type ActivityEntry = {
  id: number;
  kind: string;
  subtype: string | null;
  notes: string | null;
  due_at: string | null;
  status: "pending" | "done";
  done_at: string | null;
  latitude: number | null;
  longitude: number | null;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
  task_state: "pending" | "due_today" | "overdue" | "done";
};

export type ActivityInput = { kind: string; subtype?: string; notes?: string; due_at?: string; latitude?: number; longitude?: number };

export const listActivities = (accessToken: string, contactId: number) =>
  request<ActivityEntry[]>(`/contacts/${contactId}/activities`, { headers: authHeader(accessToken) });

export const createActivity = (accessToken: string, contactId: number, input: ActivityInput) =>
  request<ActivityEntry>(`/contacts/${contactId}/activities`, {
    method: "POST",
    headers: { ...authHeader(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

/** PATCH — marks a pending task done; the outcome is appended to its notes. */
export const completeActivity = (accessToken: string, contactId: number, activityId: number, outcome?: string) =>
  request<ActivityEntry>(`/contacts/${contactId}/activities/${activityId}`, {
    method: "PATCH",
    headers: { ...authHeader(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ outcome: outcome || null }),
  });

/** POST /contacts/{id}/stages — appends to the history; the newest entry is the current stage. */
export const changeStage = (accessToken: string, contactId: number, changedBy: number, change: StageChange) =>
  request<StageEntry>(`/contacts/${contactId}/stages`, {
    method: "POST",
    headers: { ...authHeader(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ ...change, changed_by: changedBy }),
  });
