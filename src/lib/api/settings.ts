import { API_BASE_URL, ApiError, request } from "./auth";

/** Mirrors the Settings section of the parent API.md. */
export const ENUM_CATEGORIES = [
  { key: "lead_source", label: "Lead sources", noun: "lead source" },
  { key: "lead_stage", label: "Lead stages", noun: "stage" },
  { key: "activity_type", label: "Activity types", noun: "activity type" },
  { key: "loss_reason", label: "Loss reasons", noun: "loss reason" },
  { key: "professional_type", label: "Partner types", noun: "partner type" },
  { key: "district", label: "Districts", noun: "district" },
] as const;
export type EnumCategory = (typeof ENUM_CATEGORIES)[number]["key"];

export type EnumValue = {
  id: number;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  /** The app relies on this option: it can be renamed but not turned off or removed. */
  locked: boolean;
  /** Records using this option (admin list only). */
  usage_count: number | null;
  /** Lead stages only: the contact type whose pipeline the stage belongs to. */
  group?: string | null;
};

export type Company = { company_name: string; company_logo_url: string | null };

export type PermissionLevel = "full" | "view" | "team" | "own" | "customers" | "none";
export type PermissionCell = { level: PermissionLevel; note: string | null; editable: boolean };
export type PermissionMatrix = {
  roles: { slug: string; name: string; is_system: boolean; is_active: boolean }[];
  features: { key: string; label: string; description: string; action: string | null; levels: Record<string, PermissionCell> }[];
};

export type RoleSummary = { id: number; slug: string; name: string; description: string | null; is_system: boolean; is_active: boolean; employee_count: number };

/** auth.ts maps statuses for the login form; on protected routes 401/403 mean something else. */
function mapError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  if (error.status === 401) return new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
  if (error.status === 403) return new ApiError("forbidden", "You don't have permission to do that.", 403);
  return error;
}

async function call<T>(accessToken: string, method: string, path: string, body?: unknown): Promise<T> {
  try {
    return await request<T>(path, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw mapError(error);
  }
}

// ---- Enum values ----

/** GET /settings/enums/{category} — active options in order, for dropdowns (any signed-in user). */
export const listEnum = (token: string, category: EnumCategory) => call<EnumValue[]>(token, "GET", `/settings/enums/${category}`);
/** GET /settings/enums — every category with inactive values and usage counts (admin). */
export const listAllEnums = (token: string) => call<Record<EnumCategory, EnumValue[]>>(token, "GET", "/settings/enums");
/** Lead stages also take `group`: the pipeline (consumer, partner or dealer) the stage joins. */
export const createEnum = (token: string, category: EnumCategory, label: string, group?: string) =>
  call<EnumValue>(token, "POST", `/settings/enums/${category}`, group ? { label, group } : { label });
export const updateEnum = (token: string, category: EnumCategory, id: number, patch: { label?: string; is_active?: boolean }) =>
  call<EnumValue>(token, "PATCH", `/settings/enums/${category}/${id}`, patch);
export const deleteEnum = (token: string, category: EnumCategory, id: number) => call<EnumValue>(token, "DELETE", `/settings/enums/${category}/${id}`);
export const reorderEnum = (token: string, category: EnumCategory, orderedIds: number[]) =>
  call<EnumValue[]>(token, "POST", `/settings/enums/${category}/reorder`, { ordered_ids: orderedIds });

// ---- Company ----

export const getCompany = (token: string) => call<Company>(token, "GET", "/settings/company");
export const updateCompany = (token: string, patch: { company_name?: string; company_logo_url?: string }) => call<Company>(token, "PATCH", "/settings/company", patch);

/** POST /settings/company/logo — multipart, so it bypasses `call` (the browser sets the boundary). */
export async function uploadLogo(token: string, file: File): Promise<Company> {
  const form = new FormData();
  form.append("file", file);
  try {
    return await request<Company>("/settings/company/logo", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  } catch (error) {
    throw mapError(error);
  }
}

/** Uploaded logos come back as "/uploads/…" on the API server. */
export const logoSrc = (url: string | null) => (!url ? null : url.startsWith("/") ? `${API_BASE_URL}${url}` : url);

// ---- Roles ----

export const getPermissionMatrix = (token: string) => call<PermissionMatrix>(token, "GET", "/settings/roles");
/** Switches one action on or off for a role. Returns the whole matrix so the grid redraws in one step. */
export const setRolePermission = (token: string, slug: string, action: string, allowed: boolean) =>
  call<PermissionMatrix>(token, "PUT", `/settings/roles/${slug}/permissions/${action}`, { allowed });

// ---- My account ----

export type MyProfile = { id: number; name: string; email: string; role: string };

/** PATCH /auth/me — a new email needs `current_password`. */
export const updateMe = (token: string, patch: { name?: string; email?: string; current_password?: string }) =>
  call<MyProfile>(token, "PATCH", "/auth/me", patch);
export const changePassword = (token: string, body: { current_password: string; new_password: string }) =>
  call<{ message: string }>(token, "POST", "/auth/change-password", body);
export const listRoles = (token: string) => call<{ items: RoleSummary[]; total: number }>(token, "GET", "/roles");
export const createRole = (token: string, body: { name: string; description?: string }) => call<RoleSummary>(token, "POST", "/roles", body);
export const updateRole = (token: string, id: number, body: { name?: string; description?: string; is_active?: boolean }) => call<RoleSummary>(token, "PUT", `/roles/${id}`, body);
