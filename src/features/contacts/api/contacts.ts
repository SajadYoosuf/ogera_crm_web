import { API_BASE_URL, ApiError, request } from "@/lib/api/auth";
import { trace } from "@/lib/api/devlog";

/** Mirrors the Contacts section of the parent API.md. */
export type ApiContactType = "consumer" | "partner" | "dealer";

type NameRef = { id: number; name: string };

/** Row shape of GET /contacts (ContactListItem in the backend). */
export type ApiContact = {
  id: number;
  contact_type: ApiContactType;
  name: string;
  phone: string;
  /** Branch object assigned to the contact; null when no branch is set. */
  branch: BranchOption | null;
  address: string | null;
  district: string;
  partner_type: string | null;
  /** Not yet returned by the backend — reserved for a future pipeline stage feature. */
  lead_stage?: { stage_id: number; stage_slug: string; stage_name: string; changed_at: string } | null;
  lead_source: NameRef | null;
  assigned_to: NameRef | null;
  created_by: NameRef | null;
  /** Creator's employee branch, e.g. "malappuram"; null when unknown. */
  created_by_branch: string | null;
  created_at: string;
  /** Computed by the backend: false while any required detail is pending. */
  is_verified: boolean;
  missing_fields: string[];
};

export type ContactList = { items: ApiContact[]; total: number; skip: number; limit: number };

/** GET /contacts — one page. */
export type ContactSort = "newest" | "oldest" | "name_asc" | "name_desc";

export async function listContacts(accessToken: string, params: { skip?: number; limit?: number; sort?: ContactSort; contact_type?: ApiContactType; partner_type?: string; search?: string; lead_source_id?: number; district?: string; assigned_to?: number; created_by?: number; verified?: boolean; created_from?: string; created_to?: string } = {}) {
  const query = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 10) });
  if (params.sort) query.set("sort", params.sort);
  if (params.contact_type) query.set("contact_type", params.contact_type);
  if (params.partner_type) query.set("partner_type", params.partner_type);
  if (params.search) query.set("search", params.search);
  if (params.lead_source_id !== undefined) query.set("lead_source_id", String(params.lead_source_id));
  if (params.district) query.set("district", params.district);
  if (params.assigned_to !== undefined) query.set("assigned_to", String(params.assigned_to));
  if (params.created_by !== undefined) query.set("created_by", String(params.created_by));
  if (params.verified !== undefined) query.set("verified", String(params.verified));
  if (params.created_from) query.set("created_from", params.created_from);
  if (params.created_to) query.set("created_to", params.created_to);
  const label = `[contacts api] GET /contacts?${query}`;
  const started = performance.now();
  trace("log", `${label} → request`, { url: `${API_BASE_URL}/contacts?${query}`, headers: { Authorization: "Bearer ***" } });
  try {
    const response = await request<ContactList>(`/contacts?${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    trace("log", `${label} ← response (${Math.round(performance.now() - started)}ms)`, { total: response.total, count: response.items.length, items: response.items });
    return response;
  } catch (error) {
    trace("error", `${label} ← error (${Math.round(performance.now() - started)}ms)`, error);
    if (error instanceof ApiError && error.status === 401) throw new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
    if (error instanceof ApiError && error.status === 403) throw new ApiError("forbidden", "You don't have permission to view contacts.", 403);
    throw error;
  }
}

export type PartnerTypeOption = { value: string; label: string };

/** GET /contacts/partner-types — partner type options from contact_field_definitions. */
export async function listPartnerTypes(accessToken: string): Promise<PartnerTypeOption[]> {
  return request<PartnerTypeOption[]>("/contacts/partner-types", { headers: { Authorization: `Bearer ${accessToken}` } });
}

export type LeadSource = { id: number; name: string; slug: string };

/** GET /contacts/type-counts — live totals per type for the tabs; ignores search and filters. */
export function getContactTypeCounts(accessToken: string) {
  return request<{ all: number; consumer: number; partner: number; dealer?: number }>("/contacts/type-counts", { headers: { Authorization: `Bearer ${accessToken}` } });
}

/** GET /lead-sources — every active source, for the contact form's Source dropdown. */
export async function listLeadSources(accessToken: string): Promise<LeadSource[]> {
  const label = "[contacts api] GET /lead-sources";
  trace("log", `${label} → request`, { url: `${API_BASE_URL}/lead-sources`, headers: { Authorization: "Bearer ***" } });
  try {
    const sources = await request<LeadSource[]>("/lead-sources", { headers: { Authorization: `Bearer ${accessToken}` } });
    trace("log", `${label} ← response`, sources);
    return sources;
  } catch (error) {
    trace("error", `${label} ← error`, error);
    throw error;
  }
}

export type BranchOption = { id: number; name: string; code: string; is_active: boolean };

export type ApiContactDetail = {
  id: number;
  contact_type: ApiContactType;
  /** True when the creator is admin/manager — web should show the "Schedule first follow-up?" prompt. */
  auto_followup_needed?: boolean;
  name: string;
  phone: string;
  district: string;
  address: string | null;
  branch_id?: number | null;
  branch?: BranchOption | null;
  referred_by_id: number | null;
  referred_by?: { id: number; name: string; phone?: string | null } | null;
  lead_source_id: number | null;
  consumer_profile?: { id: number; contact_id: number; data: Record<string, unknown> } | null;
  partner_profile?: { id: number; contact_id: number; data: Record<string, unknown> } | null;
  dealer_profile?: {
    id: number; contact_id: number;
    business_name: string | null; gstin: string | null; dealer_type: string | null; town_city: string | null; pin_code: string | null;
    assigned_rep: number | null; assigned_rep_name: string | null;
    credit_limit: number | null; outstanding_balance: number | null;
    data: Record<string, unknown>;
  } | null;
  /** Free-text note. Null when none has been entered. */
  notes?: string | null;
};

export type ContactInput = {
  contact_type?: ApiContactType;
  branch_id?: number | null;
  name?: string;
  phone?: string;
  district?: string;
  address?: string;
  referred_by_id?: number | null;
  lead_source_id?: number | null;
  assigned_to?: number;
  consumer_profile?: { data: Record<string, unknown> };
  partner_profile?: { data: Record<string, unknown> };
  dealer_profile?: DealerProfileInput;
  /** Free-text note. Omit to keep unchanged, null to clear, string to set. */
  notes?: string | null;
};

/** Dealer profile as sent on create/update. Money fields are sent by admins only; omit them otherwise. */
export type DealerProfileInput = {
  business_name?: string | null;
  gstin?: string | null;
  dealer_type?: string | null;
  town_city?: string | null;
  pin_code?: string | null;
  assigned_rep?: number | null;
  credit_limit?: number;
  outstanding_balance?: number;
};

/** One field definition row from GET /contact-field-definitions. */
export type ContactFieldDefinition = {
  id: number;
  entity_type: "consumer" | "partner" | "dealer";
  field_name: string;       // key stored in profile data (e.g. "tank_type")
  field_label: string | null; // display label (e.g. "Tank Type")
  field_type: "text" | "dropdown" | "number" | "boolean";
  options: string[] | null; // dropdown options; null for other types
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
};

/** GET /contact-field-definitions/{entity_type} — fields to render for a consumer, partner or dealer profile. */
export async function listContactFieldDefinitions(accessToken: string, entityType: "consumer" | "partner" | "dealer"):Promise<ContactFieldDefinition[]> {
  try {
    return await request<ContactFieldDefinition[]>(`/contact-field-definitions/${entityType}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    return [];
  }
}

// ── Bulk-assign ─────────────────────────────────────────────────────────────

export type ContactBulkAssignRule = { source_id: number | null; assigned_to: number; count: number };

export type ContactStatsResponse = {
  total_unassigned: number;
  unassigned_by_source: Record<string, number>;
};

/** GET /contacts/stats — unassigned counts total and by source, for the bulk-assign modal. */
export function getContactStats(accessToken: string): Promise<ContactStatsResponse> {
  return request<ContactStatsResponse>("/contacts/stats", { headers: { Authorization: `Bearer ${accessToken}` } });
}

/** POST /contacts/bulk-assign — assign batches of unassigned contacts by source to employees. */
export function bulkAssignContacts(accessToken: string, assignments: ContactBulkAssignRule[]): Promise<{ assigned: number }> {
  return request<{ assigned: number }>("/contacts/bulk-assign", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ assignments }),
  });
}

/** GET /branches — active branches for the current tenant. Used to populate the Branch dropdown on the contact form. */
export async function listBranches(accessToken: string): Promise<BranchOption[]> {
  try {
    return await request<BranchOption[]>("/branches", { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    return [];
  }
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export type PipelineStageItem = {
  id: number;
  slug: string;
  label: string;
  order_index: number;
  contact_type: string;
};

/** GET /pipeline/stages?contact_type=consumer|partner|dealer — ordered board columns. */
export async function listPipelineStages(accessToken: string, contactType: string): Promise<PipelineStageItem[]> {
  return request<PipelineStageItem[]>(`/pipeline/stages?contact_type=${contactType}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** GET /contacts/stage — alias: returns current stage for a contact (from /contacts list lead_stage). */
export type ContactStageInfo = {
  stage_id: number;
  stage_slug: string;
  stage_name: string;
  contact_type: string;
  changed_at: string | null;
};

/** GET /contacts/{id}/stage */
export async function getContactStage(accessToken: string, contactId: number): Promise<ContactStageInfo | null> {
  try {
    return await request<ContactStageInfo>(`/contacts/${contactId}/stage`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** POST /contacts/{id}/stage — move contact to a stage. */
export async function setContactStage(
  accessToken: string,
  contactId: number,
  stageId: number,
  opts?: { loss_reason?: string; loss_notes?: string; awareness_note?: string },
): Promise<void> {
  await request<unknown>(`/contacts/${contactId}/stage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ stage_id: stageId, ...opts }),
  });
}

// ── Contacts for pipeline board ───────────────────────────────────────────────

/** Minimal shape for the pipeline board (all contacts for a type with their current stage). */
export type PipelineContact = {
  id: number;
  name: string;
  phone: string;
  district: string;
  assigned_to: { id: number; name: string } | null;
  lead_stage: { stage_id: number; stage_slug: string; stage_name: string; changed_at: string } | null;
  created_at: string;
};

/** Filters the pipeline board sends to GET /contacts. Empty values are left out of the query. */
export type PipelineFilters = {
  search?: string;
  lead_source_id?: number;
  assigned_to?: number;
  branch_id?: number;
  created_from?: string;
  created_to?: string;
};

/**
 * Fetch all contacts of one type for the pipeline board, after the given filters.
 * The backend caps `limit` at 100 per request, so pages are fetched until every row is loaded.
 */
export async function listPipelineContacts(
  accessToken: string,
  contactType: string,
  filters: PipelineFilters = {},
): Promise<PipelineContact[]> {
  const PAGE_SIZE = 100;
  const all: ApiContact[] = [];
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;
  while (skip < total) {
    const query = new URLSearchParams({ contact_type: contactType, limit: String(PAGE_SIZE), skip: String(skip) });
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    const data = await request<ContactList>(`/contacts?${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    all.push(...data.items);
    total = data.total;
    if (data.items.length === 0) break;
    skip += data.items.length;
  }
  return all as unknown as PipelineContact[];
}

/** Calls a protected /contacts route with request/response logging and session-aware errors. */
async function authed<T>(method: string, path: string, accessToken: string, body?: unknown): Promise<T> {
  const label = `[contacts api] ${method} ${path}`;
  const started = performance.now();
  trace("log", `${label} → request`, { url: `${API_BASE_URL}${path}`, headers: { Authorization: "Bearer ***" }, ...(body ? { body } : {}) });
  try {
    const response = await request<T>(path, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    trace("log", `${label} ← response (${Math.round(performance.now() - started)}ms)`, response ?? "(no content)");
    return response;
  } catch (error) {
    trace("error", `${label} ← error (${Math.round(performance.now() - started)}ms)`, error);
    if (error instanceof ApiError && error.status === 401) throw new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
    if (error instanceof ApiError && error.status === 403) throw new ApiError("forbidden", "You don't have permission to do that.", 403);
    if (error instanceof ApiError && error.status === 404) throw new ApiError("unknown", "That contact no longer exists.", 404);
    throw error;
  }
}

/** GET /contacts/{id} — the full record the edit form needs. */
export const getContact = (accessToken: string, id: number) => authed<ApiContactDetail>("GET", `/contacts/${id}`, accessToken);

/** POST /contacts — the backend assigns an owner when `assigned_to` is omitted. */
export const createContact = (accessToken: string, input: ContactInput & { name: string; phone: string; district: string; address: string }) =>
  authed<ApiContactDetail>("POST", "/contacts", accessToken, input);

/** PUT /contacts/{id} — partial update. */
export const updateContact = (accessToken: string, id: number, input: ContactInput) => authed<ApiContactDetail>("PUT", `/contacts/${id}`, accessToken, input);

/** DELETE /contacts/{id} — soft delete, 204. */
export const deleteContact = (accessToken: string, id: number) => authed<void>("DELETE", `/contacts/${id}`, accessToken);
