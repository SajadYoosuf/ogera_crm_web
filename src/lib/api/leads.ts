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

/** POST /contacts/{id}/stages — appends to the history; the newest entry is the current stage. */
export const changeStage = (accessToken: string, contactId: number, changedBy: number, change: StageChange) =>
  request<StageEntry>(`/contacts/${contactId}/stages`, {
    method: "POST",
    headers: { ...authHeader(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ ...change, changed_by: changedBy }),
  });
