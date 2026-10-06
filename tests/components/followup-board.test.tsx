// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowupBoard from "@/components/followups/FollowupBoard";

const fetchMock = vi.fn();
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
const fail = (status: number, detail: unknown) => ({ ok: false, status, json: async () => ({ detail }) });

/** Routes by path so each test only describes the responses it cares about. */
function serve(routes: Record<string, (url: URL) => unknown>) {
  fetchMock.mockImplementation(async (input: string) => {
    const url = new URL(input);
    const handler = routes[url.pathname];
    return handler ? handler(url) : fail(404, `Unmocked ${url.pathname}`);
  });
}

const lead = (id: number, name: string, source: string | null, stage = "new_lead") => ({
  id, contact_type: "consumer", name, phone: `98000000${id}`, address: "Street", district: "Malappuram", profession_type: null,
  lead_stage: { stage, changed_at: new Date().toISOString() }, lead_source: source ? { id: id * 10, name: source } : null,
  assigned_to: { id: 7, name: "Sajad" }, created_by: null, created_at: "2026-10-01T09:00:00", is_verified: true, missing_fields: [],
});

const SOURCES = ["Meta", "Website", "Showroom", "Google My Business", "WhatsApp", "Field Visit", "Offline", "Justdial"].map((name, index) => ({ id: index + 1, name, slug: name.toLowerCase() }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.setItem("ogera_access_token", "test-token");
  sessionStorage.setItem("ogera_user", JSON.stringify({ id: 1, name: "Head", email: "h@o.com", role: "admin" }));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); sessionStorage.clear(); });

describe("FollowupBoard", () => {
  it("shows an empty state when there are no consumer leads", async () => {
    serve({ "/contacts": () => ok({ items: [], total: 0, skip: 0, limit: 100 }), "/employees": () => ok({ items: [], total: 0 }), "/lead-sources": () => ok(SOURCES) });
    render(<FollowupBoard />);
    expect(await screen.findByText("No consumer leads yet")).toBeTruthy();
  });

  it("shows an error with a retry when the server fails", async () => {
    serve({ "/contacts": () => fail(500, "boom"), "/employees": () => ok({ items: [], total: 0 }), "/lead-sources": () => ok(SOURCES) });
    render(<FollowupBoard />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("lists every active lead source in the Source filter, not only the ones leads use", async () => {
    serve({
      "/contacts": () => ok({ items: [lead(1, "Asha", "Meta"), lead(2, "Binu", "Offline")], total: 2, skip: 0, limit: 100 }),
      "/employees": () => ok({ items: [], total: 0 }),
      "/lead-sources": () => ok(SOURCES),
    });
    render(<FollowupBoard />);
    fireEvent.click(await screen.findByRole("button", { name: /^Source:/ }));
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    for (const source of SOURCES) expect(options).toContain(source.name);
    expect(options).toContain("All");
  });
});
