import { ApiError, request, type Employee } from "./auth";

export type { Employee };

/** Mirrors the Employees section of the parent API.md. */
export const EMPLOYEE_ROLES = ["admin", "manager", "sales_executive"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export type EmployeeList = { items: Employee[]; total: number; skip: number; limit: number };

export const EMPLOYEE_BRANCHES = ["malappuram", "perinthalmanna", "kottakkal"] as const;
export type EmployeeBranch = (typeof EMPLOYEE_BRANCHES)[number];

export type EmployeeCreate = {
  name: string;
  email: string;
  phone?: string;
  role?: EmployeeRole;
  branch?: EmployeeBranch | null;
  is_field_staff?: boolean;
  password: string;
};

/** Partial update. `phone: null` clears it; the other fields cannot be null. */
export type EmployeeUpdate = Partial<Omit<EmployeeCreate, "phone">> & {
  phone?: string | null;
  branch?: EmployeeBranch | null;
  is_active?: boolean;
};

const PAGE_SIZE = 100; // API maximum
const MAX_PAGES = 10; // safety cap: 1,000 employees

const LOG_ENABLED = process.env.NODE_ENV !== "production";

/** Prints to the browser console and, via /api/dev-log, to the `next dev` terminal. */
function trace(level: "log" | "error", label: string, data?: unknown) {
  console[level](label, data);
  const payload = data instanceof Error ? { ...data, name: data.name, message: data.message } : data;
  void fetch("/api/dev-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, data: payload }),
    keepalive: true,
  }).catch(() => {});
}

/** Dev-only note about what the UI is doing (e.g. why a load started). */
export function logEvent(label: string, data?: unknown) {
  if (LOG_ENABLED) trace("log", `[employees page] ${label}`, data);
}

/** Dev-only request/response trace. Bearer token and passwords are never logged. */
async function logged<T>(method: string, path: string, body: unknown, call: () => Promise<T>): Promise<T> {
  if (!LOG_ENABLED) return call();
  const label = `[employees api] ${method} ${path}`;
  const started = performance.now();
  const safeBody = body && typeof body === "object" && "password" in body ? { ...body, password: "***" } : body;
  trace("log", `${label} → request`, { headers: { Authorization: "Bearer ***" }, ...(safeBody ? { body: safeBody } : {}) });
  try {
    const response = await call();
    trace("log", `${label} ← response (${Math.round(performance.now() - started)}ms)`, response ?? "(no content)");
    return response;
  } catch (error) {
    trace("error", `${label} ← error (${Math.round(performance.now() - started)}ms)`, error);
    throw error;
  }
}

/** auth.ts maps statuses for the login form; on protected routes 403/404 mean something else. */
function mapError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  if (error.status === 401) return new ApiError("invalid_credentials", "Your session has expired. Please sign in again.", 401);
  if (error.status === 403) return new ApiError("forbidden", "You don't have permission to do that.", 403);
  if (error.status === 404) return new ApiError("unknown", "That employee no longer exists.", 404);
  return error;
}

function call<T>(accessToken: string, method: string, path: string, body?: unknown, timeoutMs?: number): Promise<T> {
  return logged(method, path, body, async () => {
    try {
      return await request<T>(path, {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }, timeoutMs);
    } catch (error) {
      throw mapError(error);
    }
  });
}

/** GET /employees — one page. */
export function listEmployees(accessToken: string, params: { skip?: number; limit?: number; role?: string; is_active?: boolean; search?: string } = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ skip: 0, limit: PAGE_SIZE, ...params })) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return call<EmployeeList>(accessToken, "GET", `/employees?${query}`);
}

/** Walks every page of GET /employees. The team is small, so filtering is done client-side. */
export async function listAllEmployees(accessToken: string): Promise<{ employees: Employee[]; total: number }> {
  const employees: Employee[] = [];
  let total = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await listEmployees(accessToken, { skip: page * PAGE_SIZE });
    employees.push(...result.items);
    total = result.total;
    if (employees.length >= total || result.items.length < PAGE_SIZE) break;
  }
  return { employees, total };
}

/** GET /employees/{id} */
export const getEmployee = (accessToken: string, id: number) => call<Employee>(accessToken, "GET", `/employees/${id}`);

/** POST /employees */
export const createEmployee = (accessToken: string, input: EmployeeCreate) => call<Employee>(accessToken, "POST", "/employees", input);

/** PUT /employees/{id} — longer timeout because the backend sends a notification email synchronously. */
export const updateEmployee = (accessToken: string, id: number, input: EmployeeUpdate) => call<Employee>(accessToken, "PUT", `/employees/${id}`, input, 25_000);

/** DELETE /employees/{id} — soft delete, 204. */
export const deleteEmployee = (accessToken: string, id: number) => call<void>(accessToken, "DELETE", `/employees/${id}`);
