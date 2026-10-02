// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, type Employee } from "@/lib/api/auth";
import {
  assignableRoles, canModifyEmployee, createEmployee, deleteEmployee, listAllEmployees, updateEmployee,
} from "@/lib/api/employees";

const employee = (id: number, role = "sales_executive"): Employee => ({
  id, name: `Emp ${id}`, email: `e${id}@ogera.com`, role, is_field_staff: false, phone: null, is_active: true,
  created_at: "2026-10-01T09:00:00", updated_at: "2026-10-01T09:00:00", deleted_at: null,
});

function mockFetch(responses: Array<{ status: number; body?: unknown }>) {
  const queue = [...responses];
  const fn = vi.fn(async (url: string, ...rest: [RequestInit?]) => {
    void rest;
    // The dev-only log relay must not consume the queued API responses.
    const next = String(url).includes("/api/dev-log") ? { status: 204 } : queue.shift() ?? { status: 500 };
    return { ok: next.status < 400, status: next.status, json: async () => { if (!("body" in next) || next.body === undefined) throw new Error("no body"); return next.body; } };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const apiCalls = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.filter(([url]) => !String(url).includes("/api/dev-log"));

afterEach(() => vi.unstubAllGlobals());

describe("employees client", () => {
  it("sends the bearer token and pages through GET /employees until total is reached", async () => {
    const first = Array.from({ length: 100 }, (_, i) => employee(i + 1));
    const fn = mockFetch([
      { status: 200, body: { items: first, total: 101, skip: 0, limit: 100 } },
      { status: 200, body: { items: [employee(101)], total: 101, skip: 100, limit: 100 } },
    ]);

    const result = await listAllEmployees("tok");

    expect(result.employees).toHaveLength(101);
    const calls = apiCalls(fn);
    expect(calls).toHaveLength(2);
    expect(String(calls[0][0])).toContain("/employees?skip=0&limit=100");
    expect(String(calls[1][0])).toContain("skip=100");
    expect((calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("POSTs the create payload as JSON", async () => {
    const fn = mockFetch([{ status: 201, body: employee(7, "tele_caller") }]);
    await createEmployee("tok", { name: "Anu", email: "anu@ogera.com", role: "tele_caller", password: "Welcome123" });
    const [url, init] = apiCalls(fn)[0];
    expect(String(url)).toMatch(/\/employees$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({ email: "anu@ogera.com", role: "tele_caller" });
  });

  it("treats a 204 delete as success", async () => {
    mockFetch([{ status: 204 }]);
    await expect(deleteEmployee("tok", 7)).resolves.toBeUndefined();
  });

  it.each([
    [401, "invalid_credentials"],
    [403, "forbidden"],
  ])("maps %i to %s", async (status, kind) => {
    mockFetch([{ status, body: { detail: "x" } }]);
    const error = await updateEmployee("tok", 1, { name: "A" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe(kind);
  });

  it("surfaces the server's detail on 409 (email taken)", async () => {
    mockFetch([{ status: 409, body: { detail: "Email already in use" } }]);
    const error = await createEmployee("tok", { name: "A", email: "a@b.com", password: "Welcome123" }).catch((e) => e);
    expect(error.message).toBe("Email already in use");
  });
});

describe("employee permissions", () => {
  it("only admins may assign admin/manager", () => {
    expect(assignableRoles("admin")).toContain("manager");
    expect(assignableRoles("manager")).not.toContain("admin");
    expect(assignableRoles("manager")).not.toContain("manager");
  });

  it("managers can edit staff and themselves, but not other managers or admins", () => {
    const viewer = { id: 2, role: "manager" };
    expect(canModifyEmployee(viewer, employee(5))).toBe(true);
    expect(canModifyEmployee(viewer, employee(2, "manager"))).toBe(true);
    expect(canModifyEmployee(viewer, employee(3, "manager"))).toBe(false);
    expect(canModifyEmployee(viewer, employee(1, "admin"))).toBe(false);
    expect(canModifyEmployee({ id: 1, role: "admin" }, employee(3, "manager"))).toBe(true);
  });
});
