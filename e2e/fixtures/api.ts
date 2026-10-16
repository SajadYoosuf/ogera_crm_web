import type { Page, Route } from "@playwright/test";

/** In-browser stand-in for the FastAPI backend (see the parent API.md). */

export type MockEmployee = {
  id: number; name: string; email: string; role: string; is_field_staff: boolean; phone: string | null;
  is_active: boolean; created_at: string; updated_at: string; deleted_at: string | null;
};

export type MockContact = {
  id: number; contact_type: string; name: string; phone: string; district: string; address: string | null;
  profession_type: string | null; lead_stage: null;
  lead_source: { id: number; name: string } | null; assigned_to: { id: number; name: string };
  created_by: { id: number; name: string } | null; created_at: string; is_verified: boolean; missing_fields: string[];
};

export const LEAD_SOURCES = [
  { id: 1, name: "Meta", slug: "meta" },
  { id: 2, name: "Website", slug: "website" },
  { id: 3, name: "Showroom", slug: "showroom" },
  { id: 4, name: "WhatsApp", slug: "whatsapp" },
];

export const PROFESSION_TYPES = [
  { value: "plumber", label: "Plumber" },
  { value: "engineer", label: "Engineer" },
  { value: "contractor", label: "Contractor" },
  { value: "interior_designer", label: "Interior Designer" },
  { value: "architect", label: "Architect" },
  { value: "electrician", label: "Electrician" },
];

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
  contacts: MockContact[];
  calls: RecordedCall[];
  /** Make the next N employee-list requests fail with this status. */
  failList: (status: number, times?: number) => void;
  /** Make the next N requests whose method matches and whose path starts with `pathPrefix` fail with this status. */
  failRequest: (method: string, pathPrefix: string, status: number, times?: number) => void;
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

/**
 * Mirrors routes/employees.py: admin accounts are never listed or returned by id; a manager also
 * doesn't see other managers (or their own record). Hidden accounts answer 404 by id.
 */
const isHiddenFrom = (viewer: Viewer, employee: MockEmployee) => {
  const hidden = viewer.role === "manager" ? ["admin", "manager"] : ["admin"];
  return hidden.includes(employee.role);
};

export async function mockApi(page: Page, options: { employees?: MockEmployee[]; contacts?: MockContact[]; viewer?: Viewer } = {}): Promise<MockApi> {
  const viewer = options.viewer ?? ADMIN;
  const state: MockApi = {
    employees: options.employees ?? seedEmployees(),
    contacts: options.contacts ?? [],
    calls: [],
    failList: () => {},
    failRequest: () => {},
    callsTo: (method, prefix) => state.calls.filter((call) => call.method === method && call.path.startsWith(prefix)),
  };
  let failures = { status: 0, remaining: 0 };
  state.failList = (status, times = 1) => { failures = { status, remaining: times }; };
  const forced: { method: string; prefix: string; status: number; remaining: number }[] = [];
  state.failRequest = (method, prefix, status, times = 1) => { forced.push({ method, prefix, status, remaining: times }); };
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

    const failing = forced.find((rule) => rule.remaining > 0 && rule.method === method && url.pathname.startsWith(rule.prefix));
    if (failing) {
      failing.remaining -= 1;
      return json(route, failing.status, { detail: "boom" });
    }

    if (url.pathname === "/auth/login" && method === "POST") {
      if (body?.password !== "correct-password") return json(route, 401, { detail: "Incorrect email or password" });
      return json(route, 200, { access_token: "test-token", token_type: "bearer", employee: ADMIN });
    }

    const idMatch = url.pathname.match(/^\/employees\/(\d+)$/);
    if (url.pathname === "/employees" && method === "GET") {
      if (failures.remaining > 0) { failures.remaining -= 1; return json(route, failures.status, { detail: "boom" }); }
      const skip = Number(url.searchParams.get("skip") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const live = state.employees.filter((employee) => !employee.deleted_at && !isHiddenFrom(viewer, employee));
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
      const target = state.employees.find((employee) => employee.id === Number(idMatch[1]) && !employee.deleted_at && !isHiddenFrom(viewer, employee));
      if (!target) return json(route, 404, { detail: "Employee not found" });
      if (method === "GET") return json(route, 200, target);
      if (method === "PUT") { Object.assign(target, body); return json(route, 200, target); }
      if (method === "DELETE") { target.deleted_at = "2026-10-01T10:00:00"; target.is_active = false; return route.fulfill({ status: 204, headers: CORS }); }
    }

    // Contacts routes
    if (url.pathname === "/lead-sources" && method === "GET") return json(route, 200, LEAD_SOURCES);
    if (url.pathname === "/contacts/profession-types" && method === "GET") return json(route, 200, PROFESSION_TYPES);
    if (url.pathname === "/contacts/type-counts" && method === "GET") {
      return json(route, 200, {
        all: state.contacts.length,
        consumer: state.contacts.filter((c) => c.contact_type === "consumer").length,
        partner: state.contacts.filter((c) => c.contact_type === "partner").length,
        dealer: state.contacts.filter((c) => c.contact_type === "dealer").length,
      });
    }
    const contactIdMatch = url.pathname.match(/^\/contacts\/(\d+)$/);
    if (url.pathname === "/contacts" && method === "GET") {
      const skip = Number(url.searchParams.get("skip") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const contactType = url.searchParams.get("contact_type");
      let results = state.contacts;
      if (contactType) results = results.filter((c) => c.contact_type === contactType);
      return json(route, 200, { items: results.slice(skip, skip + limit), total: results.length, skip, limit });
    }
    if (url.pathname === "/contacts" && method === "POST") {
      const profType = (body as Record<string, Record<string, string> | null> | null)?.partner_profile?.profession_type ?? null;
      const created: MockContact = {
        id: nextId++, contact_type: String(body?.contact_type ?? "consumer"),
        name: String(body?.name ?? ""), phone: String(body?.phone ?? ""),
        district: String(body?.district ?? ""), address: (body?.address as string | null) ?? null,
        profession_type: profType, lead_stage: null, lead_source: null,
        assigned_to: { id: viewer.id, name: viewer.name },
        created_by: { id: viewer.id, name: viewer.name },
        created_at: new Date().toISOString(), is_verified: false, missing_fields: [],
      };
      state.contacts.push(created);
      return json(route, 201, created);
    }
    if (contactIdMatch) {
      const target = state.contacts.find((c) => c.id === Number(contactIdMatch[1]));
      if (!target) return json(route, 404, { detail: "Contact not found" });
      if (method === "GET") return json(route, 200, { ...target, referred_by_id: null, lead_source_id: null, referred_by: null });
      if (method === "PUT") { Object.assign(target, body); return json(route, 200, target); }
      if (method === "DELETE") return route.fulfill({ status: 204, headers: CORS });
    }

    return json(route, 404, { detail: `Unmocked ${method} ${url.pathname}` });
  });

  return state;
}
