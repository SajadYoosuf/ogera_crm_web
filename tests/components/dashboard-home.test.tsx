// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardHome from "@/components/dashboard/DashboardHome";
import type { DashboardSummary } from "@/lib/api/dashboard";

const fetchMock = vi.fn();
const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data, headers: new Headers() });

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    range: "month",
    range_label: "This month",
    today: "2026-10-17",
    start: "2026-10-01",
    end: "2026-10-17",
    previous_start: "2026-09-01",
    previous_end: "2026-09-17",
    kpis: {
      total_contacts: 42,
      new_leads: { value: 7, previous: 5, change: 2 },
      open_followups: { value: 3, overdue: 1 },
      won: { value: 2, previous: 2, change: 0 },
    },
    stages: [
      { slug: "new_lead", name: "New Lead", count: 4 },
      { slug: "won", name: "Won", count: 2 },
    ],
    followups: [
      { id: 1, title: "Call back", due_at: "2026-10-14T10:00:00", overdue_days: 3, contact_id: 9, contact_name: "Asha", contact_phone: "9811111111", contact_type: "consumer", assigned_to_name: "Anu" },
      { id: 2, title: "Visit", due_at: "2026-10-17T18:05:00", overdue_days: 0, contact_id: null, contact_name: null, contact_phone: null, contact_type: null, assigned_to_name: null },
    ],
    followups_total: 2,
    recent_leads: [
      { id: 9, name: "Asha", phone: "9811111111", contact_type: "consumer", stage_slug: "new_lead", stage_name: "New Lead", owner_name: "Anu", created_at: "2026-10-16T09:00:00" },
      { id: 10, name: null, phone: "9822222222", contact_type: "partner", stage_slug: null, stage_name: null, owner_name: null, created_at: "2026-10-15T09:00:00" },
    ],
    ...overrides,
  };
}

const requestedRanges = () =>
  fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("range"));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.setItem("ogera_access_token", "test-token");
  sessionStorage.setItem("ogera_user", JSON.stringify({ id: 1, name: "Ada Admin", role: "admin" }));
  fetchMock.mockResolvedValue(json(summary()));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  sessionStorage.clear();
});

describe("DashboardHome", () => {
  it("loads the month by default and shows the KPIs, stages, follow-ups and recent leads", async () => {
    render(<DashboardHome />);

    expect(await screen.findByText("Welcome back, Ada")).toBeTruthy();
    expect(requestedRanges()).toEqual(["month"]);

    const kpis = screen.getByRole("region", { name: "Key numbers" });
    expect(within(kpis).getByText("42")).toBeTruthy();
    expect(within(kpis).getByText("+2 vs previous period")).toBeTruthy();
    expect(within(kpis).getByText("1 overdue")).toBeTruthy();
    expect(within(kpis).getByText("No change vs previous period")).toBeTruthy();

    const stages = screen.getByRole("region", { name: "Leads by status" });
    expect(within(stages).getByRole("img", { name: "New Lead: 4" })).toBeTruthy();

    const followups = screen.getByRole("region", { name: "Today's followups" });
    expect(within(followups).getByText("Asha")).toBeTruthy();
    expect(within(followups).getByText("3 days overdue")).toBeTruthy();
    expect(within(followups).getByText("18:05")).toBeTruthy();

    const recent = screen.getByRole("region", { name: "Recent leads" });
    expect(within(recent).getByText("9822222222")).toBeTruthy(); // a lead with no name shows its phone
    expect(within(recent).getByText("No stage")).toBeTruthy();
    expect(within(recent).getByText("—")).toBeTruthy(); // no owner
  });

  it("asks the server for the new range and drops the old numbers while it loads", async () => {
    let resolveWeek: (value: unknown) => void = () => {};
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(json(summary()))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveWeek = resolve; }));
    render(<DashboardHome />);
    await screen.findByText("Welcome back, Ada");

    fireEvent.click(screen.getByRole("button", { name: /This month/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Last 7 days" }));

    expect(screen.queryByText("42")).toBeNull(); // no stale month numbers while the week loads
    expect(requestedRanges()).toEqual(["month", "7d"]);

    resolveWeek(json(summary({ range: "7d", range_label: "Last 7 days", kpis: { ...summary().kpis, total_contacts: 40 } })));
    expect(await screen.findByText("40")).toBeTruthy();
  });

  it("ignores a slow response for a range the user has already left", async () => {
    let resolveSlow: (value: unknown) => void = () => {};
    fetchMock.mockReset();
    fetchMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve; })) // month, slow
      .mockResolvedValueOnce(json(summary({ range: "today", range_label: "Today", kpis: { ...summary().kpis, total_contacts: 5 } }))); // today, fast
    render(<DashboardHome />);

    fireEvent.click(screen.getByRole("button", { name: /This month/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Today" }));
    expect(await screen.findByText("5")).toBeTruthy();

    resolveSlow(json(summary({ kpis: { ...summary().kpis, total_contacts: 999 } })));
    await waitFor(() => expect(screen.queryByText("999")).toBeNull());
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("shows the error and retries when the load fails", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(json({ detail: "Server down" }, 500))
      .mockResolvedValueOnce(json(summary()));
    render(<DashboardHome />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The server ran into a problem");
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("42")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("asks the user to sign in when there is no session, and does not call the server", async () => {
    sessionStorage.clear();
    render(<DashboardHome />);
    expect((await screen.findByRole("alert")).textContent).toContain("Sign in");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows empty states when there are no leads or follow-ups", async () => {
    fetchMock.mockResolvedValue(json(summary({ stages: [], followups: [], followups_total: 0, recent_leads: [] })));
    render(<DashboardHome />);
    expect(await screen.findByText("No leads were added in this period.")).toBeTruthy();
    expect(screen.getByText("No follow-ups due today. You're clear.")).toBeTruthy();
    expect(screen.getByText("No leads yet. New leads appear here as soon as they are added.")).toBeTruthy();
  });

  it("points to Tasks for follow-ups beyond the first six", async () => {
    fetchMock.mockResolvedValue(json(summary({ followups_total: 9 })));
    render(<DashboardHome />);
    expect(await screen.findByText("+7 more on Tasks")).toBeTruthy();
  });
});
