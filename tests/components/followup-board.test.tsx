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

const CONSUMER_STAGES = [
  { id: 1, slug: "new_lead", label: "New Lead", order_index: 0, contact_type: "consumer" },
  { id: 2, slug: "aware", label: "Aware", order_index: 1, contact_type: "consumer" },
  { id: 3, slug: "connected", label: "Connected", order_index: 2, contact_type: "consumer" },
  { id: 4, slug: "interested", label: "Interested", order_index: 3, contact_type: "consumer" },
  { id: 5, slug: "negotiating", label: "Negotiating", order_index: 4, contact_type: "consumer" },
  { id: 6, slug: "won", label: "Won", order_index: 5, contact_type: "consumer" },
  { id: 7, slug: "lost", label: "Lost", order_index: 6, contact_type: "consumer" },
];

const PARTNER_STAGES = [
  { id: 11, slug: "new_lead", label: "New Lead", order_index: 0, contact_type: "partner" },
  { id: 12, slug: "aware", label: "Aware", order_index: 1, contact_type: "partner" },
  { id: 13, slug: "connected", label: "Connected", order_index: 2, contact_type: "partner" },
  { id: 14, slug: "demo", label: "Demo / Introduction", order_index: 3, contact_type: "partner" },
  { id: 15, slug: "interested", label: "Interested", order_index: 4, contact_type: "partner" },
  { id: 16, slug: "active_referral", label: "Active Referral", order_index: 5, contact_type: "partner" },
  { id: 17, slug: "inactive", label: "Inactive", order_index: 6, contact_type: "partner" },
];

/** Build a mock API contact. stage_id defaults to 1 (consumer "New Lead"). */
const lead = (id: number, name: string, source: string | null, stageSlug = "new_lead", stageId = 1) => ({
  id, contact_type: "consumer", name, phone: `98000000${id}`, address: "Street", district: "Malappuram", profession_type: null,
  lead_stage: { stage_id: stageId, stage_slug: stageSlug, stage_name: stageSlug.replace(/_/g, " "), changed_at: new Date().toISOString() },
  lead_source: source ? { id: id * 10, name: source } : null,
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
    serve({
      "/contacts": () => ok({ items: [], total: 0, skip: 0, limit: 100 }),
      "/employees": () => ok({ items: [], total: 0 }),
      "/lead-sources": () => ok(SOURCES),
      "/pipeline/stages": () => ok(CONSUMER_STAGES),
    });
    render(<FollowupBoard />);
    expect(await screen.findByText("No consumer leads yet")).toBeTruthy();
  });

  it("shows an error with a retry when the server fails", async () => {
    serve({
      "/contacts": () => fail(500, "boom"),
      "/employees": () => ok({ items: [], total: 0 }),
      "/lead-sources": () => ok(SOURCES),
      "/pipeline/stages": () => ok(CONSUMER_STAGES),
    });
    render(<FollowupBoard />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("lists every active lead source in the Source filter, not only the ones leads use", async () => {
    serve({
      "/contacts": () => ok({ items: [lead(1, "Asha", "Meta"), lead(2, "Binu", "Offline")], total: 2, skip: 0, limit: 100 }),
      "/employees": () => ok({ items: [], total: 0 }),
      "/lead-sources": () => ok(SOURCES),
      "/pipeline/stages": () => ok(CONSUMER_STAGES),
    });
    render(<FollowupBoard />);
    fireEvent.click(await screen.findByRole("button", { name: /^Source/ }));
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    for (const source of SOURCES) expect(options).toContain(source.name);
    expect(options).toContain("All");
  });

  it("switches between the consumer and partner boards, each with its own stages and its own request", async () => {
    serve({
      "/contacts": (url) => ok({
        items: url.searchParams.get("contact_type") === "partner"
          ? [{ ...lead(5, "Raju", "Meta", "active_referral", 16), contact_type: "partner", created_at: new Date().toISOString() }]
          : [],
        total: 1, skip: 0, limit: 100,
      }),
      "/employees": () => ok({ items: [], total: 0 }),
      "/lead-sources": () => ok(SOURCES),
      "/pipeline/stages": (url) => ok(url.searchParams.get("contact_type") === "partner" ? PARTNER_STAGES : CONSUMER_STAGES),
    });
    render(<FollowupBoard />);
    await screen.findByText("No consumer leads yet");
    expect(screen.queryByText("Active Referral")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Partner" }));
    expect(await screen.findByText("Active Referral")).toBeTruthy();
    for (const label of ["New Lead", "Connected", "Demo / Introduction", "Aware", "Interested", "Inactive"]) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText("Negotiating")).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("contact_type=partner"))).toBe(true);
    // A partner in the active_referral stage shows in the Active Referral column
    expect(screen.getByText("Raju")).toBeTruthy();
  });

  it("opens the partner board on Day like consumers, filters partners by their created date, and All brings back older ones", async () => {
    const oldPartner = { ...lead(8, "Old Partner", "Meta", "new_lead", 11), contact_type: "partner", created_at: "2026-07-01T09:00:00" };
    serve({
      // Return Old Partner only when no date filter is applied (i.e. the "All" mode sends no created_from/created_to).
      "/contacts": (url) => {
        const isPartner = url.searchParams.get("contact_type") === "partner";
        const hasDateFilter = url.searchParams.has("created_from") || url.searchParams.has("created_to");
        const items = isPartner && !hasDateFilter ? [oldPartner] : [];
        return ok({ items, total: items.length, skip: 0, limit: 100 });
      },
      "/employees": () => ok({ items: [], total: 0 }),
      "/lead-sources": () => ok(SOURCES),
      "/pipeline/stages": (url) => ok(url.searchParams.get("contact_type") === "partner" ? PARTNER_STAGES : CONSUMER_STAGES),
    });
    render(<FollowupBoard />);
    await screen.findByText("No consumer leads yet");
    expect(screen.getByRole("button", { name: "Day" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Partner" }));
    expect(await screen.findByRole("tab", { name: "Partner" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Day" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Old Partner")).toBeNull(); // created in July, not today

    fireEvent.click(screen.getByRole("button", { name: "Month" })); // this month has no partner created in it
    expect(screen.queryByText("Old Partner")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(await screen.findByText("Old Partner")).toBeTruthy();
  });
});
