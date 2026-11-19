/**
 * Leads Module API — TypeScript types and fetch functions for the Leads feature.
 *
 * WHY A SEPARATE FILE FROM leads.ts?
 *   The existing lib/api/leads.ts handles the contact pipeline stage/history API.
 *   This file is for the new Lead entity (pre-contact funnel). Never merge them.
 *
 * USAGE:
 *   Always pass the JWT token from sessionStorage as the first argument.
 *   Every function throws ApiError on failure — catch it at the call site.
 */

import { request } from "@/lib/api/auth";

// ── Enum types ───────────────────────────────────────────────────────────────

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";

/** A row from lead_sources (id + name + slug). */
export type LeadSourceItem = {
  id: number;
  name: string;
  slug: string;
  is_active: number;
};

// ── Core lead shape ─────────────────────────────────────────────────────────

/** A single lead as returned by GET /leads/{id}. */
export type Lead = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_key: string | null;
  email: string | null;
  source_id: number | null;
  source_name: string | null;
  status: LeadStatus;
  score: number;
  notes: string | null;
  address: string | null;
  tags: string[] | null;
  raw_payload: Record<string, unknown> | null;
  whatsapp_sent: boolean;
  whatsapp_sent_at: string | null;
  converted_at: string | null;
  contact_id: number | null;
  assigned_to: number | null;
  assigned_name: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Slim row returned by GET /leads (the list endpoint). */
export type LeadListItem = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  source_id: number | null;
  source_name: string | null;
  status: LeadStatus;
  score: number;
  tags: string[] | null;
  whatsapp_sent: boolean;
  assigned_to: number | null;
  assigned_name: string | null;
  created_at: string;
  updated_at: string;
};

/** Paginated list response. */
export type LeadListResponse = {
  items: LeadListItem[];
  total: number;
  skip: number;
  limit: number;
};

// ── Create / Update shapes ───────────────────────────────────────────────────

export type LeadCreate = {
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  source_id?: number;
  notes?: string;
  address?: string;
  tags?: string[];
  /** ISO datetime override — set when importing historical leads to preserve the original date */
  created_at?: string;
};

export type LeadUpdate = Partial<{
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: LeadStatus;
  source_id: number;
  notes: string;
  address: string;
  tags: string[];
  assigned_to: number;
}>;

// ── Response shapes for special actions ─────────────────────────────────────

export type ConvertLeadResponse = {
  lead_id: number;
  contact_id: number;
  created: boolean;
};

export type LeadStatsResponse = {
  by_status: Record<LeadStatus, number>;
  by_source: Record<string, number>;
  total: number;
  /** source_name → count of unassigned leads for that source */
  unassigned_by_source: Record<string, number>;
};

// ── Bulk-assign shapes ────────────────────────────────────────────────────────

/** One assignment rule: assign `count` unassigned leads from `source_id` to employee `assigned_to`. */
export type BulkAssignRule = {
  source_id: number | null;
  assigned_to: number;
  count: number;
};

export type BulkAssignRequest = {
  assignments: BulkAssignRule[];
};

export type BulkAssignResponse = {
  assigned: number;
};

// ── Employee slim type (for assignee dropdowns) ───────────────────────────────

export type EmployeeOption = {
  id: number;
  name: string;
  /** Number of currently assigned (open) leads — provided by the UI for Bulk Assign display. */
  assigned_count?: number;
};

// ── API key management ───────────────────────────────────────────────────────

export type TenantApiKey = {
  id: number;
  label: string;
  is_active: boolean;
  created_at: string;
};

export type TenantApiKeyCreated = TenantApiKey & {
  /** Raw key — shown once at creation. Store it immediately. */
  raw_key: string;
};

// ── Helper ───────────────────────────────────────────────────────────────────

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ── Lead CRUD ────────────────────────────────────────────────────────────────

/** GET /leads — paginated list with optional filters. */
export function listLeads(
  token: string,
  params: {
    skip?: number;
    limit?: number;
    status?: LeadStatus;
    source_id?: number;
    assigned_to?: number;
    search?: string;
    created_from?: string;
    created_to?: string;
  } = {},
): Promise<LeadListResponse> {
  const q = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 20) });
  if (params.status) q.set("status", params.status);
  if (params.source_id != null) q.set("source_id", String(params.source_id));
  if (params.assigned_to != null) q.set("assigned_to", String(params.assigned_to));
  if (params.search) q.set("search", params.search);
  if (params.created_from) q.set("created_from", params.created_from);
  if (params.created_to) q.set("created_to", params.created_to);
  return request<LeadListResponse>(`/leads?${q}`, { headers: authHeaders(token) });
}

/** GET /leads/stats — counts by status and source. */
export function getLeadStats(token: string): Promise<LeadStatsResponse> {
  return request<LeadStatsResponse>("/leads/stats", { headers: authHeaders(token) });
}

/** GET /leads/{id} — single lead detail. */
export function getLead(token: string, leadId: number): Promise<Lead> {
  return request<Lead>(`/leads/${leadId}`, { headers: authHeaders(token) });
}

/** POST /leads — create a lead manually. */
export function createLead(
  token: string,
  body: LeadCreate,
  allowDuplicate = false,
): Promise<Lead> {
  const q = allowDuplicate ? "?allow_duplicate=true" : "";
  return request<Lead>(`/leads${q}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

/** PUT /leads/{id} — partial update. */
export function updateLead(token: string, leadId: number, body: LeadUpdate): Promise<Lead> {
  return request<Lead>(`/leads/${leadId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

/** DELETE /leads/{id} — soft-delete. Returns nothing (204). */
export function deleteLead(token: string, leadId: number): Promise<void> {
  return request<void>(`/leads/${leadId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

/** POST /leads/{id}/convert — convert lead to a Contact. */
export function convertLead(token: string, leadId: number): Promise<ConvertLeadResponse> {
  return request<ConvertLeadResponse>(`/leads/${leadId}/convert`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

/** POST /leads/{id}/send-whatsapp — manually trigger the WhatsApp welcome template. */
export function sendLeadWhatsApp(token: string, leadId: number): Promise<{ queued: boolean }> {
  return request<{ queued: boolean }>(`/leads/${leadId}/send-whatsapp`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

// ── Tenant API key management ─────────────────────────────────────────────────

/** GET /api-keys — list all inbound API keys for the current tenant. */
export function listApiKeys(token: string): Promise<TenantApiKey[]> {
  return request<TenantApiKey[]>("/api-keys", { headers: authHeaders(token) });
}

/** POST /api-keys — generate a new key. Raw key is shown ONCE in the response. */
export function createApiKey(token: string, label: string): Promise<TenantApiKeyCreated> {
  return request<TenantApiKeyCreated>("/api-keys", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ label }),
  });
}

/** DELETE /api-keys/{id} — revoke (deactivate) a key. */
export function revokeApiKey(token: string, keyId: number): Promise<void> {
  return request<void>(`/api-keys/${keyId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// ── Bulk assign ───────────────────────────────────────────────────────────────

/** POST /leads/bulk-assign — assign batches of unassigned leads by source to employees. */
export function bulkAssignLeads(
  token: string,
  assignments: BulkAssignRule[],
): Promise<BulkAssignResponse> {
  return request<BulkAssignResponse>("/leads/bulk-assign", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ assignments }),
  });
}
