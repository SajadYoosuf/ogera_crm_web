import type { Page, Route } from "@playwright/test";

/** In-browser stand-in for the FastAPI backend (see the parent API.md). */

export type MockEmployee = {
  id: number; name: string; email: string; role: string; is_field_staff: boolean; phone: string | null;
  is_active: boolean; created_at: string; updated_at: string; deleted_at: string | null;
};

export type RecordedCall = { method: string; path: string; search: string; body: Record<string, unknown> | null };

const API_ORIGIN = "http://localhost:8000";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

const person = (id: number, name: string, role: string, extra: Partial<MockEmployee> = {}): MockEmployee => ({
  id, name, email: `${name.toLowerCase().replace(/\s+/g, ".")}@ogera.com`, role, is_field_staff: false, phone: null,
  is_active: true, created_at: "2026-09-30T08:40:00", updated_at: "2026-09-30T08:40:00", deleted_at: null, ...extra,
});

export const seedEmployees = (): MockEmployee[] => [
  person(1, "Ada Admin", "admin"),
  person(2, "Maya Manager", "manager", { phone: "+919876543210" }),
  person(3, "Tara Lead", "team_lead"),
  person(4, "Sam Sales", "sales_executive", { is_field_staff: true }),
  person(5, "Tia Caller", "tele_caller", { phone: "+919123456780" }),
  person(6, "Fay Field", "field_executive", { is_field_staff: true }),
  person(7, "Sue Support", "support"),
  person(8, "Ian Inactive", "sales_executive", { is_active: false }),
];

export type MockApi = {
  employees: MockEmployee[];
  calls: RecordedCall[];
  /** Make the next N employee-list requests fail with this status. */
  failList: (status: number, times?: number) => void;
  /** Calls made to the API, excluding CORS preflights. */
  callsTo: (method: string, pathPrefix: string) => RecordedCall[];
};

export type Viewer = { id: number; name: string; email: string; role: string };

export const ADMIN: Viewer = { id: 1, name: "Ada Admin", email: "ada.admin@ogera.com", role: "admin" };
export const MANAGER: Viewer = { id: 2, name: "Maya Manager", email: "maya.manager@ogera.com", role: "manager" };

/** Seeds the same sessionStorage keys the real login writes. */
export async function signInAs(page: Page, viewer: Viewer = ADMIN) {
  await page.addInitScript((user) => {
    sessionStorage.setItem("ogera_access_token", "test-token");
    sessionStorage.setItem("ogera_user", JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role, phone: null }));
  }, viewer);
}

export async function mockApi(page: Page, options: { employees?: MockEmployee[] } = {}): Promise<MockApi> {
  const state: MockApi = {
    employees: options.employees ?? seedEmployees(),
    calls: [],
    failList: () => {},
    callsTo: (method, prefix) => state.calls.filter((call) => call.method === method && call.path.startsWith(prefix)),
  };
  let failures = { status: 0, remaining: 0 };
  state.failList = (status, times = 1) => { failures = { status, remaining: times }; };
  let nextId = 100;

  const json = (route: Route, status: number, body?: unknown) =>
    route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  // The dev-only terminal relay would just add noise to the Next dev server output.
  await page.route("**/api/dev-log", (route) => route.fulfill({ status: 204 }));

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });

    const url = new URL(request.url());
    const method = request.method();
    const body = request.postDataJSON() as Record<string, unknown> | null;
    state.calls.push({ method, path: url.pathname, search: url.search, body });

    if (url.pathname === "/auth/login" && method === "POST") {
      if (body?.password !== "correct-password") return json(route, 401, { detail: "Incorrect email or password" });
      return json(route, 200, { access_token: "test-token", token_type: "bearer", employee: ADMIN });
    }

    const idMatch = url.pathname.match(/^\/employees\/(\d+)$/);
    if (url.pathname === "/employees" && method === "GET") {
      if (failures.remaining > 0) { failures.remaining -= 1; return json(route, failures.status, { detail: "boom" }); }
      const skip = Number(url.searchParams.get("skip") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const live = state.employees.filter((employee) => !employee.deleted_at);
      return json(route, 200, { items: live.slice(skip, skip + limit), total: live.length, skip, limit });
    }
    if (url.pathname === "/employees" && method === "POST") {
      if (state.employees.some((employee) => employee.email === String(body?.email).toLowerCase())) return json(route, 409, { detail: "Email already in use" });
      const created = person(nextId++, String(body?.name), String(body?.role ?? "sales_executive"), {
        email: String(body?.email).toLowerCase(), phone: (body?.phone as string) ?? null, is_field_staff: Boolean(body?.is_field_staff),
      });
      state.employees.push(created);
      return json(route, 201, created);
    }
    if (idMatch) {
      const target = state.employees.find((employee) => employee.id === Number(idMatch[1]) && !employee.deleted_at);
      if (!target) return json(route, 404, { detail: "Employee not found" });
      if (method === "GET") return json(route, 200, target);
      if (method === "PUT") { Object.assign(target, body); return json(route, 200, target); }
      if (method === "DELETE") { target.deleted_at = "2026-10-01T10:00:00"; target.is_active = false; return route.fulfill({ status: 204, headers: CORS }); }
    }
    return json(route, 404, { detail: `Unmocked ${method} ${url.pathname}` });
  });

  return state;
}
