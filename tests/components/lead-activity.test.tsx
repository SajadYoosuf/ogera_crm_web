// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeadPanel from "@/components/followups/LeadPanel";
import { isoDate } from "@/components/followups/activities";
import type { ActivityItem } from "@/lib/api/activities";
import type { ApiContact } from "@/features/contacts/api/contacts";

const fetchMock = vi.fn();
const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => data });
const fail = (status: number, detail: unknown) => ({ ok: false, status, json: async () => ({ detail }) });

const lead = {
  id: 1, contact_type: "consumer", name: "Asha", phone: "9800000001", address: "Street", district: "Malappuram", profession_type: null,
  lead_stage: { stage: "new_lead", changed_at: "2026-10-05T10:00:00" }, lead_source: { id: 1, name: "Meta" },
  assigned_to: { id: 7, name: "Sajad" }, created_by: null, created_at: "2026-10-01T09:00:00", is_verified: true, missing_fields: [],
} as ApiContact;

const longDay = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const OWNERS = [{ id: 7, name: "Sajad" }, { id: 8, name: "Rajan" }];

const item = (overrides: Partial<ActivityItem>): ActivityItem => ({
  id: 1, type: "phone_call", notes: null, status: "done", scheduled_date: null, scheduled_time: null, assigned_to: null, assigned_to_name: null,
  completed_at: "2026-10-06T10:22:00", completed_by: 1, completed_by_name: "Ada", coordinates: null, task_id: null, created_by: 1, created_by_name: "Ada",
  created_at: "2026-10-06T10:22:00", task_state: "done", overdue_days: 0, ...overrides,
});

let activities: ActivityItem[];
const calls = (method: string) => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);
const bodyOf = (method: string) => JSON.parse(String(fetchMock.mock.calls.filter(([url, init]) => String(url).includes("/activities") && init?.method === method).at(-1)?.[1].body));

function serve() {
  fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.pathname === "/contacts/1/stages") return ok([]);
    if (url.pathname === "/contacts/1/activities" && !init?.method) return ok(activities);
    if (url.pathname === "/contacts/1/activities" && init?.method === "POST") return ok(item({ id: 99 }), 201);
    if (url.pathname.startsWith("/contacts/1/activities/") && init?.method === "PATCH") return ok(item({ id: 5 }));
    return fail(404, `Unmocked ${url.pathname}`);
  });
}

function renderPanel() {
  render(<LeadPanel lead={lead} userId={1} owners={OWNERS} onUnverified={vi.fn()} onClose={vi.fn()} onChanged={async () => {}} />);
}

beforeEach(() => {
  activities = [];
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.setItem("ogera_access_token", "test-token");
  serve();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); sessionStorage.clear(); });

describe("lead panel activity section", () => {
  it("shows the empty message when nothing is logged", async () => {
    renderPanel();
    expect(await screen.findByText(/No activity logged yet/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Log Activity" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Schedule Follow-up" })).toBeTruthy();
  });

  it("splits the history into Activity log, Follow-ups and Stage history tabs", async () => {
    activities = [
      item({ id: 1, notes: "Called, asked for price" }),
      item({ id: 2, type: "demo", status: "pending", scheduled_date: isoDate(4), assigned_to_name: "Rajan", task_state: "pending", notes: "Show sample" }),
    ];
    renderPanel();
    expect(await screen.findByText(/Called, asked for price/)).toBeTruthy();
    expect(screen.queryByText(/Show sample/)).toBeNull(); // follow-ups are in their own tab

    fireEvent.click(screen.getByRole("tab", { name: /^Follow-ups/ }));
    expect(await screen.findByText(/Show sample/)).toBeTruthy();
    expect(screen.queryByText(/Called, asked for price/)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Stage history" }));
    expect(await screen.findByText("No stage changes recorded yet.")).toBeTruthy();
    // applying still lives in the two buttons above the history
    expect(screen.getByRole("button", { name: "+ Log Activity" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Schedule Follow-up" })).toBeTruthy();
  });

  it("shows an error with a retry when the list cannot load", async () => {
    fetchMock.mockImplementation(async (input: string) => (new URL(input).pathname.endsWith("/activities") ? fail(500, "boom") : ok([])));
    renderPanel();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("logs an activity with notes only, then offers to schedule the next follow-up", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "+ Log Activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Activity" }));
    expect(await screen.findByText("Write what happened.")).toBeTruthy(); // notes are required
    expect(calls("POST")).toHaveLength(0);

    fireEvent.change(screen.getByPlaceholderText(/What happened/), { target: { value: "Called, asked about 500L" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Activity" }));

    expect(await screen.findByText("Activity saved")).toBeTruthy();
    expect(screen.getByText("Schedule the next follow-up?")).toBeTruthy();
    expect(bodyOf("POST")).toEqual({ type: "phone_call", notes: "Called, asked about 500L" }); // no timestamp from the browser

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.queryByText("Activity saved")).toBeNull());
  });

  it("opens the schedule form from the prompt", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "+ Log Activity" }));
    fireEvent.change(screen.getByPlaceholderText(/What happened/), { target: { value: "Visited" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Activity" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, schedule" }));
    expect(await screen.findByRole("form", { name: "Schedule follow-up" })).toBeTruthy();
    expect(screen.queryByText("Activity saved")).toBeNull();
  });

  it("schedules a follow-up for the lead's assignee using a date chip", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "+ Schedule Follow-up" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(await screen.findByText("Pick a due date.")).toBeTruthy();
    expect(calls("POST")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(calls("POST")).toHaveLength(1));
    expect(bodyOf("POST")).toEqual({ type: "phone_call", scheduled_date: isoDate(1), assigned_to: 7, status: "pending" });
  });

  it("schedules a follow-up with a time chosen from the time list", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "+ Schedule Follow-up" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: /^Due time:/ }));
    fireEvent.click(screen.getByRole("option", { name: "10:30 am" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(calls("POST")).toHaveLength(1));
    expect(bodyOf("POST")).toMatchObject({ scheduled_date: isoDate(), scheduled_time: "10:30" });
  });

  it("does not let a past day be picked in the calendar", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "+ Schedule Follow-up" }));
    fireEvent.click(screen.getByRole("button", { name: /^Due date:/ }));
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const cell = screen.queryByRole("gridcell", { name: longDay(yesterday) });
    // Yesterday is in this month unless today is the 1st; either way it must be disabled or absent.
    if (cell) expect((cell as HTMLButtonElement).disabled).toBe(true);
  });

  it("never offers an internal note when scheduling", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "+ Schedule Follow-up" }));
    fireEvent.click(within(screen.getByRole("form", { name: "Schedule follow-up" })).getByRole("button", { name: /^Type:/ }));
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toContain("Demo / sample");
    expect(options).not.toContain("Internal note");
  });

  it("marks an overdue task done and prompts for the next follow-up", async () => {
    activities = [item({ id: 5, notes: "Confirm quote decision", status: "pending", scheduled_date: "2026-09-29", assigned_to: 8, assigned_to_name: "Rajan", task_state: "overdue", overdue_days: 2 })];
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^Follow-ups/ }));
    expect(await screen.findByText("Overdue 2d")).toBeTruthy();
    expect(screen.getByText(/Assigned: Rajan/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mark Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    expect(await screen.findByText("Write what happened before marking this done.")).toBeTruthy(); // the outcome is required
    expect(calls("PATCH")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Will order on Friday" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    expect(await screen.findByText("Follow-up marked done")).toBeTruthy();
    expect(bodyOf("PATCH")).toEqual({ status: "done", outcome: "Will order on Friday" }); // the server records who and when and logs the outcome
  });

  it("reschedules an overdue task with just a date and an optional time", async () => {
    activities = [item({ id: 5, status: "pending", scheduled_date: "2026-09-29", assigned_to_name: "Rajan", task_state: "overdue", overdue_days: 2 })];
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^Follow-ups/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Reschedule" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Pick the new due date.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Due date:/ }));
    fireEvent.click(screen.getByRole("gridcell", { name: longDay(new Date()) })); // today is the first day that can be picked
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(bodyOf("PATCH")).toEqual({ scheduled_date: isoDate() }));
  });

  it("shows no action buttons on a task that is not due yet", async () => {
    activities = [item({ id: 6, status: "pending", scheduled_date: isoDate(5), assigned_to_name: "Rajan", task_state: "pending" })];
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^Follow-ups/ }));
    expect(await screen.findByText("Pending")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark Done" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reschedule" })).toBeNull();
  });
});
