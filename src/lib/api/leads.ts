import { request } from "./auth";
import type { ApiContact } from "@/features/contacts/api/contacts";

/** Mirrors LeadStageResponse in the backend (GET /contacts/{id}/stages). */
export type StageEntry = {
  id: number;
  stage_id: number;
  stage_slug: string;
  stage_name: string;
  contact_type: string;
  loss_reason: string | null;
  loss_notes: string | null;
  awareness_note: string | null;
  changed_by: number;
  changed_at: string;
};

/** Mirrors StageTypeItem in the backend (GET /contacts/stage-types). */
export type StageTypeItem = {
  id: number;
  slug: string;
  label: string;
  order_index: number;
  contact_type: string;
};

export type StageChange = { stage_id: number; loss_reason?: string; loss_notes?: string; awareness_note?: string };

export type LeadKind = "consumer" | "partner" | "dealer";

const authHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });
const PAGE = 100;

/** Every contact of one type in the given date window (created_from/created_to), fetched page by page. */
export async function listLeads(accessToken: string, kind: LeadKind, dateFrom?: string, dateTo?: string): Promise<ApiContact[]> {
  const leads: ApiContact[] = [];
  const base = new URLSearchParams({ contact_type: kind, limit: String(PAGE) });
  if (dateFrom) base.set("created_from", dateFrom);
  if (dateTo) base.set("created_to", dateTo);
  for (let skip = 0; ; skip += PAGE) {
    base.set("skip", String(skip));
    const page = await request<{ items: ApiContact[]; total: number }>(`/contacts?${base.toString()}`, { headers: authHeader(accessToken) });
    leads.push(...page.items);
    if (page.items.length < PAGE || leads.length >= page.total) return leads;
  }
}

/** Pipeline stages for one contact type in board order. */
export const listStageTypes = (accessToken: string, contactType: LeadKind) =>
  request<StageTypeItem[]>(`/contacts/stage-types?contact_type=${contactType}`, { headers: authHeader(accessToken) });

/** One row of GET /contacts/{id}/history (backend HistoryItem). Fields not used by an event type are null. */
export type HistoryEvent = {
  event_type: "stage" | "activity" | "followup" | "followup_rescheduled" | "assignment";
  timestamp: string;
  actor_id: number | null;
  actor_name: string | null;
  stage_slug: string | null;
  stage_name: string | null;
  previous_stage_name: string | null;
  stage_note: string | null;
  activity_type: string | null;
  title: string | null;
  outcome: string | null;
  notes: string | null;
  followup_id: number | null;
  channel: string | null;
  due_at: string | null;
  /** For a reschedule: the due date before the move (due_at is the new one). */
  previous_due_at?: string | null;
  followup_status: string | null;
  assigned_to_name: string | null;
  assigned_from_name: string | null;
};

/** Stages, scheduled follow-ups, logged activities and owner changes for one lead, newest first. */
export const getLeadHistory = (accessToken: string, contactId: number) =>
  request<HistoryEvent[]>(`/contacts/${contactId}/history`, { headers: authHeader(accessToken) });

export const getStageHistory = (accessToken: string, contactId: number) =>
  request<StageEntry[]>(`/contacts/${contactId}/stages`, { headers: authHeader(accessToken) });

/** POST /contacts/{id}/stages — moves to a stage by stage_id. */
export const changeStage = (accessToken: string, contactId: number, changedBy: number, change: StageChange) =>
  request<StageEntry>(`/contacts/${contactId}/stages`, {
    method: "POST",
    headers: { ...authHeader(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ ...change, changed_by: changedBy }),
  });

export const listConsumerLeads = (accessToken: string) => listLeads(accessToken, "consumer");
