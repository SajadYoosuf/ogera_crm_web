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
  address: string | null;
  district: string;
  profession_type: string | null;
  lead_stage: { stage_id: number; stage_slug: string; stage_name: string; changed_at: string } | null;
  lead_source: NameRef | null;
  assigned_to: NameRef;
  created_by: NameRef | null;
  created_at: string;
  /** Computed by the backend: false while any required detail is pending. */
  is_verified: boolean;
  missing_fields: string[];
};

export type ContactList = { items: ApiContact[]; total: number; skip: number; limit: number };

/** GET /contacts — one page. */
export type ContactSort = "newest" | "oldest" | "name_asc" | "name_desc";

export async function listContacts(accessToken: string, params: { skip?: number; limit?: number; sort?: ContactSort; contact_type?: ApiContactType; profession_type?: string; search?: string; lead_source_id?: number; district?: string; assigned_to?: number; created_by?: number; verified?: boolean; created_from?: string; created_to?: string } = {}) {
  const query = new URLSearchParams({ skip: String(params.skip ?? 0), limit: String(params.limit ?? 10) });
  if (params.sort) query.set("sort", params.sort);
  if (params.contact_type) query.set("contact_type", params.contact_type);
  if (params.profession_type) query.set("profession_type", params.profession_type);
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

export type ProfessionOption = { value: string; label: string };

/** GET /contacts/partner-types — the partner types the backend accepts. */
export async function listProfessionTypes(accessToken: string): Promise<ProfessionOption[]> {
  const label = "[contacts api] GET /contacts/partner-types";
  trace("log", `${label} → request`, { url: `${API_BASE_URL}/contacts/partner-types`, headers: { Authorization: "Bearer ***" } });
  try {
    const options = await request<ProfessionOption[]>("/contacts/partner-types", { headers: { Authorization: `Bearer ${accessToken}` } });
    trace("log", `${label} ← response`, options);
    return options;
  } catch (error) {
    trace("error", `${label} ← error`, error);
    throw error;
  }
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

export type ApiContactDetail = {
  id: number;
  contact_type: ApiContactType;
  name: string;
  phone: string;
  district: string;
  address: string | null;
  referred_by_id: number | null;
  referred_by?: { id: number; name: string; phone?: string | null } | null;
  lead_source_id: number | null;
  consumer_profile?: { house_stage: string | null } | null;
  partner_profile?: { profession_type: string } | null;
  dealer_profile?: { owner_name: string; email?: string | null } | null;
};

export type ContactInput = {
  contact_type?: ApiContactType;
  name?: string;
  phone?: string;
  district?: string;
  address?: string;
  referred_by_id?: number | null;
  lead_source_id?: number | null;
  assigned_to?: number;
  latitude?: number;
  longitude?: number;
  consumer_profile?: { house_stage: string | null };
  partner_profile?: { profession_type: string };
  dealer_profile?: { owner_name: string; email?: string | null };
};

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
