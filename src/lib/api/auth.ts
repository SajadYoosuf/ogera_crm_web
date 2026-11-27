export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://ogera-crm-backend.vercel.app").replace(/\/+$/, "");

// Shown once in the browser console so a deployment can be checked: which backend is this build calling,
// and was NEXT_PUBLIC_API_BASE_URL set when it was built (otherwise it falls back to the production API).
if (typeof window !== "undefined") {
  console.info(`[Ogera CRM] API base URL: ${API_BASE_URL}${process.env.NEXT_PUBLIC_API_BASE_URL ? "" : " (NEXT_PUBLIC_API_BASE_URL was not set at build time)"}`);
}

// Drop any stored value that still points at the local dev backend (port 8000), so an old
// session or cached address cannot keep sending requests there. Runs once per page load.
const LOCAL_BACKEND_PATTERN = /(localhost|127\.0\.0\.1):8000/;

function clearLocalBackendStorage(storageType: "localStorage" | "sessionStorage") {
  try {
    // Accessing browser storage itself can throw in Chrome when the page is
    // running in a restricted or opaque document (for example, a restored
    // mobile tab or an embedded browser context). Keep that access inside the
    // guard; passing `localStorage` as an argument would evaluate it first.
    const store = window[storageType];
    for (let i = store.length - 1; i >= 0; i -= 1) {
      const key = store.key(i);
      if (key && LOCAL_BACKEND_PATTERN.test(store.getItem(key) ?? "")) store.removeItem(key);
    }
  } catch {
    // Storage disabled (private window, blocked site data): nothing to clear.
  }
}

if (typeof window !== "undefined") {
  clearLocalBackendStorage("localStorage");
  clearLocalBackendStorage("sessionStorage");
}

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The company (tenant) the signed-in employee belongs to.
 * Returned by POST /auth/login.
 */
export type Company = {
  id: number;
  /** Display name shown in the app header — this is the "tenant name". */
  name: string;
  logo_url: string | null;
  status: string;
};

/**
 * Employee profile as returned by the employees list / detail endpoints.
 * Uses `role` (a string slug), `branch`, and `is_field_staff`.
 */
export type Employee = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_field_staff: boolean;
  phone: string | null;
  branch: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/**
 * Employee profile as returned specifically by POST /auth/login.
 * The login response uses `role_slug` / `role_id` instead of `role`,
 * and does not include `branch` or `is_field_staff`.
 */
export type LoginEmployee = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role_id: number;
  role_slug: string;
  permissions?: Record<string, string> | null;
  branch_id?: number | null;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  company: Company;
  employee: LoginEmployee;
};

export type ApiErrorKind =
  | "offline" // browser reports no connection
  | "network" // request never reached the server (down, CORS, DNS)
  | "timeout"
  | "cancelled" // the user cancelled an upload
  | "invalid_credentials" // 401
  | "inactive_account" // 403 on login — account deactivated
  | "web_not_allowed" // 403 on login — role may only use the mobile app
  | "forbidden" // 403 on a protected route (role not allowed)
  | "validation" // 422
  | "server" // 5xx
  | "unknown";

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public status?: number,
    public missingFields?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Worth offering a "try again" for the same input. */
  get retryable() {
    return this.kind === "offline" || this.kind === "network" || this.kind === "timeout" || this.kind === "server";
  }
}

/** FastAPI errors are `{ detail: string }` or, for 422, `{ detail: [{ msg, loc }] }`. */
function extractDetail(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("detail" in body)) return null;
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg) : null))
      .filter(Boolean);
    return msgs.length ? msgs.join(". ") : null;
  }
  if (detail && typeof detail === "object" && typeof (detail as { message?: unknown }).message === "string") {
    return (detail as { message: string }).message;
  }
  return null;
}

/** A 409 can carry `detail: { message, missing_fields }` (a lead moved on before its details were complete). */
function extractMissing(body: unknown): { message: string; missing: string[] } | null {
  const detail = body && typeof body === "object" && "detail" in body ? (body as { detail: unknown }).detail : null;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const { message, missing_fields: missing } = detail as { message?: unknown; missing_fields?: unknown };
  return typeof message === "string" && Array.isArray(missing) ? { message, missing: missing.map(String) } : null;
}

export function errorFromResponse(status: number, body: unknown): ApiError {
  const incomplete = status === 409 ? extractMissing(body) : null;
  if (incomplete) return new ApiError("unknown", incomplete.message, status, incomplete.missing);
  const detail = extractDetail(body);
  if (status === 401) return new ApiError("invalid_credentials", detail ?? "Your session has expired. Please sign in again.", status);
  // 403 on login: the account is inactive, or a non-admin/manager tried the website (the server says which).
  if (status === 403) {
    if (detail && detail.toLowerCase().includes("mobile app")) {
      return new ApiError("web_not_allowed", detail, status);
    }
    return new ApiError("inactive_account", detail ?? "This account is inactive. Contact your administrator.", status);
  }
  if (status === 422) return new ApiError("validation", detail ?? "Please check the email and password you entered.", status);
  // 503 is used for "the server cannot do this right now" (for example, email is not configured), so its message is shown.
  if (status === 503 && detail) return new ApiError("server", detail, status);
  if (status >= 500) return new ApiError("server", "The server ran into a problem. Please try again in a moment.", status);
  return new ApiError("unknown", detail ?? "Something went wrong. Please try again.", status);
}

export async function request<T>(path: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError("offline", "You're offline. Check your internet connection and try again.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("timeout", "The server took too long to respond. Please try again.");
    }
    throw new ApiError("network", "Can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON or empty body; handled below by status.
  }

  if (!response.ok) console.warn(`[Ogera CRM] ${init.method ?? "GET"} ${API_BASE_URL}${path} -> ${response.status}`);
  if (!response.ok) throw errorFromResponse(response.status, body);
  if (response.status === 204) return undefined as T;
  if (body === null) throw new ApiError("unknown", "Received an unexpected response from the server.", response.status);
  return body as T;
}

/**
 * Fired on window when an authenticated call gets a 401 (token expired or revoked).
 * AuthProvider clears the session on it; DashboardAuthGate sends the user to sign-in
 * with an `?expired=1` hint so the login page can explain why.
 *
 * The name is intentionally generic — no brand name — so it works across any tenant.
 */
export const SESSION_EXPIRED_EVENT = "crm:session-expired";

/**
 * Authenticated API call with standard 401/403 remapping.
 * Use this in every API module instead of duplicating the auth-header boilerplate.
 */
export async function apiCall<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  timeoutMs?: number,
): Promise<T> {
  try {
    return await request<T>(
      path,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        // Dispatch the expiry event so AuthProvider clears the session once, centrally.
        // DashboardAuthGate then navigates to the sign-in page — no need for pages to do it.
        if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
        // Re-throw so the page's loading/error state reflects the failure (shows nothing while redirecting).
        throw new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
      }
      if (error.status === 403) throw new ApiError("forbidden", "You don't have permission to do that.", 403);
    }
    throw error;
  }
}

/** POST /auth/login */
export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    return await request<LoginResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.kind === "invalid_credentials") {
      throw new ApiError("invalid_credentials", "Incorrect email or password.", 401);
    }
    throw error;
  }
}

/** GET /auth/me — 401 here means the token is missing, invalid, or expired. */
export async function getMe(accessToken: string): Promise<Employee> {
  try {
    return await request<Employee>("/auth/me", { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (error) {
    if (error instanceof ApiError && error.kind === "invalid_credentials") {
      throw new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
    }
    throw error;
  }
}
