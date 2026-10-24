// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeadPanel from "@/components/followups/LeadPanel";
import { isoDate } from "@/components/followups/activities";
import type { ActivityItem } from "@/lib/api/activities";
import type { HistoryEvent } from "@/lib/api/leads";
import type { ApiContact } from "@/features/contacts/api/contacts";

const fetchMock = vi.fn();
const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => data });
const fail = (status: number, detail: unknown) => ({ ok: false, status, json: async () => ({ detail }) });

const lead = {
  id: 1, contact_type: "consumer", name: "Asha", phone: "9800000001", address: "Street", district: "Malappuram", profession_type: null,
  lead_stage: { stage_id: 1, stage_slug: "new_lead", stage_name: "New Lead", changed_at: "2026-10-05T10:00:00" }, lead_source: { id: 1, name: "Meta" },
  assigned_to: { id: 7, name: "Sajad" }, created_by: null, created_by_branch: null, created_at: "2026-10-01T09:00:00", is_verified: true, missing_fields: [],
} as ApiContact;

const longDay = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const OWNERS = [{ id: 7, name: "Sajad" }, { id: 8, name: "Rajan" }];

const item = (overrides: Partial<ActivityItem>): ActivityItem => ({
  id: 1, title: null, type: "phone_call", notes: null, status: "done", scheduled_date: null, scheduled_time: null, assigned_to: null, assigned_to_name: null,
  completed_at: "2026-10-06T10:22:00", completed_by: 1, completed_by_name: "Ada", coordinates: null, task_id: null, created_by: 1, created_by_name: "Ada",
  created_at: "2026-10-06T10:22:00", task_state: "done", overdue_days: 0, ...overrides,
});

let activities: ActivityItem[];
let historyEvents: HistoryEvent[] = [];
const historyRow = (overrides: Partial<HistoryEvent>): HistoryEvent => ({
  event_type: "stage", timestamp: "2026-10-05T10:00:00", actor_id: null, actor_name: null, stage_slug: null, stage_name: null, previous_stage_name: null,
  stage_note: null, activity_type: null, title: null, outcome: null, notes: null, followup_id: null, channel: null, due_at: null,
  followup_status: null, assigned_to_name: null, assigned_from_name: null, ...overrides,
});
const ACTIVITY_OR_FOLLOWUP = /\/contacts\/1\/(activities|followups)/;
const calls = (method: string) => fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? "GET") === method && ACTIVITY_OR_FOLLOWUP.test(String(url)));
const bodyOf = (method: string) => JSON.parse(String(fetchMock.mock.calls.filter(([url, init]) => ACTIVITY_OR_FOLLOWUP.test(String(url)) && init?.method === method).at(-1)?.[1].body));

const ACTIVITY_TYPE_OPTIONS = [
  { id: 1, value: "phone_call", label: "Phone call", sort_order: 0, is_active: true, locked: true, usage_count: null },
  { id: 2, value: "demo", label: "Demo / sample", sort_order: 1, is_active: true, locked: false, usage_count: null },
  { id: 3, value: "internal_note", label: "Internal note", sort_order: 2, is_active: true, locked: true, usage_count: null },
];

function serve() {
  fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.pathname === "/settings/enums/activity_type") return ok(ACTIVITY_TYPE_OPTIONS);
    if (url.pathname === "/employees") return ok({ employees: OWNERS.map((o) => ({ ...o, is_active: true, role: "sales_executive" })), total: OWNERS.length });
    if (url.pathname === "/contacts/1/stages") return ok([]);
    if (url.pathname === "/contacts/1/history") return ok(historyEvents);
    if (url.pathname === "/contacts/1/activities" && !init?.method) {
      // The backend keeps logged activities and scheduled follow-ups on separate endpoints.
      return ok(activities.filter((a) => a.scheduled_date === null).map((a) => ({
        id: a.id, done_by: a.completed_by ?? 1, done_by_name: a.completed_by_name, activity_type: a.type, notes: a.notes,
        followup_id: a.task_id, logged_at: a.created_at,
      })));
    }
    if (url.pathname === "/contacts/1/followups" && !init?.method) {
      return ok(activities.filter((a) => a.scheduled_date !== null).map((a) => ({
        id: a.id, title: a.title, assigned_to: a.assigned_to ?? 7, assigned_to_name: a.assigned_to_name,
        due_at: `${a.scheduled_date}T${a.scheduled_time ?? "00:00:00"}`, status: a.status === "done" ? "completed" : "todo",
        channel: a.type === "field_visit" ? "visit" : a.type === "whatsapp" ? "whatsapp" : "call", notes: a.notes,
        created_at: a.created_at, task_state: a.task_state, overdue_days: a.overdue_days,
      })));
    }
    if (url.pathname === "/contacts/1/activities" && init?.method === "POST") return ok(item({ id: 99 }), 201);
    if (url.pathname === "/contacts/1/followups" && init?.method === "POST") {
      return ok({ id: 99, title: null, assigned_to: 7, assigned_to_name: "Sajad", due_at: "2026-12-01T23:59:00", status: "todo", channel: "call", notes: null, created_at: "2026-10-17T10:00:00", task_state: "pending", overdue_days: 0 }, 201);
    }
    if (url.pathname.startsWith("/contacts/1/followups/") && init?.method === "PATCH") return ok({ id: 5 });
    return fail(404, `Unmocked ${url.pathname}`);
  });
}

const STAGES = [
  { id: 1, slug: "new_lead", label: "New Lead", order_index: 0, contact_type: "consumer" },
  { id: 2, slug: "first_call", label: "First Call", order_index: 1, contact_type: "consumer" },
];

function renderPanel() {
  render(<LeadPanel lead={lead} stages={STAGES} userId={1} owners={OWNERS} onUnverified={vi.fn()} onClose={vi.fn()} onChanged={async () => {}} />);
}

beforeEach(() => {
  activities = [];
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.setItem("ogera_access_token", "test-token");
  serve();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); sessionStorage.clear(); });

describe("lead panel activity section", () => {
  it("shows the empty state with a log button when nothing is logged", async () => {
    renderPanel();
    expect(await screen.findByText(/No activity logged yet/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log New Activity" })).toBeTruthy();
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
    expect(screen.getByRole("button", { name: "Schedule Followup" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(await screen.findByText("No history recorded yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Log New Activity" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Schedule Followup" })).toBeNull();
  });

  it("shows an error with a retry when the list cannot load", async () => {
    fetchMock.mockImplementation(async (input: string) => (new URL(input).pathname.endsWith("/activities") ? fail(500, "boom") : ok([])));
    renderPanel();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("logs an activity with notes only, then offers to schedule the next follow-up", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Log New Activity" }));
    const dialog = screen.getByRole("dialog", { name: "Log New Activity" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Activity" }));
    expect(await screen.findByText("Write what happened.")).toBeTruthy(); // notes are required
    expect(calls("POST")).toHaveLength(0);

    fireEvent.change(screen.getByPlaceholderText(/What happened/), { target: { value: "Called, asked about 500L" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Activity" }));

    expect(await screen.findByText("Activity saved")).toBeTruthy();
    expect(screen.getByText("Schedule the next follow-up?")).toBeTruthy();
    expect(bodyOf("POST")).toEqual({ activity_type: "phone_call", notes: "Called, asked about 500L" }); // no timestamp from the browser

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.queryByText("Activity saved")).toBeNull());
  });

  it("opens the schedule form from the prompt", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Log New Activity" }));
    fireEvent.change(screen.getByPlaceholderText(/What happened/), { target: { value: "Visited" } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Log New Activity" })).getByRole("button", { name: "Save Activity" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, schedule" }));
    expect(await screen.findByRole("dialog", { name: "Schedule Followup" })).toBeTruthy();
    expect(screen.queryByText("Activity saved")).toBeNull();
  });

  it("schedules a follow-up for the lead's assignee on a picked due date", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^Follow-ups/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Schedule Followup" }));
    const dialog = screen.getByRole("dialog", { name: "Schedule Followup" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule Followup" }));
    expect(await screen.findByText("Pick a due date.")).toBeTruthy();
    expect(calls("POST")).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText("Due Date"), { target: { value: isoDate() } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule Followup" }));
    await waitFor(() => expect(calls("POST")).toHaveLength(1));
    expect(bodyOf("POST")).toEqual({ channel: "phone_call", due_at: `${isoDate()}T23:59:00`, assigned_to: 7 });
  });

  it("sends the task name with the scheduled follow-up", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^Follow-ups/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Schedule Followup" }));
    const dialog = screen.getByRole("dialog", { name: "Schedule Followup" });
    fireEvent.change(within(dialog).getByLabelText("Task name (optional)"), { target: { value: "  Send quotation  " } });
    fireEvent.change(within(dialog).getByLabelText("Due Date"), { target: { value: isoDate() } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule Followup" }));
    await waitFor(() => expect(calls("POST")).toHaveLength(1));
    expect(bodyOf("POST")).toMatchObject({ title: "Send quotation", channel: "phone_call" });
  });

  it("schedules a follow-up with a time chosen from the time list", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^Follow-ups/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Schedule Followup" }));
    const dialog = screen.getByRole("dialog", { name: "Schedule Followup" });
    // Tomorrow, so the test does not depend on the time of day (a time earlier today is refused).
    fireEvent.change(within(dialog).getByLabelText("Due Date"), { target: { value: isoDate(1) } });
    fireEvent.change(within(dialog).getByLabelText("Due Time"), { target: { value: "10:30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule Followup" }));
    await waitFor(() => expect(calls("POST")).toHaveLength(1));
    expect(bodyOf("POST")).toMatchObject({ due_at: `${isoDate(1)}T10:30:00` });
  });

  it("does not let a past day be picked in the calendar", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^Follow-ups/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Schedule Followup" }));
    expect((screen.getByLabelText("Due Date") as HTMLInputElement).min).toBe(isoDate());
  });

  it("shows stage moves, follow-ups and owner changes in the history tab", async () => {
    historyEvents = [
      historyRow({ event_type: "assignment", timestamp: "2026-10-07T09:00:00", actor_name: "Ada", assigned_to_name: "Rajan", assigned_from_name: "Sajad" }),
      historyRow({ event_type: "followup", timestamp: "2026-10-06T09:00:00", title: "Send quote", channel: "call", due_at: "2026-10-08T10:00:00", followup_status: "todo", assigned_to_name: "Rajan" }),
      historyRow({ event_type: "stage", timestamp: "2026-10-05T10:00:00", actor_name: "Ada", stage_slug: "first_call", stage_name: "First Call", previous_stage_name: "New Lead" }),
    ];
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^History/ }));
    expect(await screen.findByText("Assigned to Rajan")).toBeTruthy();
    expect(screen.getByText("Moved from Sajad")).toBeTruthy();
    expect(screen.getByText("Follow-up: Send quote")).toBeTruthy();
    expect(screen.getByText("New Lead → First Call")).toBeTruthy();
    historyEvents = [];
  });

  it("shows a reschedule in the history with the old and new date and a Rescheduled status", async () => {
    historyEvents = [
      historyRow({ event_type: "followup_rescheduled", timestamp: "2026-10-09T09:00:00", actor_name: "Rajan", title: "Send quote", channel: "call",
        previous_due_at: "2026-10-08T10:00:00", due_at: "2026-10-12T16:00:00", followup_status: "rescheduled" }),
    ];
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^History/ }));
    expect(await screen.findByText("Follow-up rescheduled: Send quote")).toBeTruthy();
    expect(screen.getByText(/Rescheduled$/)).toBeTruthy();
    historyEvents = [];
  });

  it("never offers an internal note when scheduling", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^Follow-ups/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Schedule Followup" }));
    await screen.findByRole("radio", { name: "Demo / sample" });
    const radios = within(screen.getByRole("radiogroup", { name: "Activity type" })).getAllByRole("radio").map((radio) => radio.textContent);
    expect(radios).toContain("Demo / sample");
    expect(radios).not.toContain("Internal note");
  });

  it("marks an overdue task done and prompts for the next follow-up", async () => {
    activities = [item({ id: 5, notes: "Confirm quote decision", status: "pending", scheduled_date: "2026-09-29", assigned_to: 8, assigned_to_name: "Rajan", task_state: "overdue", overdue_days: 2 })];
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: /^Follow-ups/ }));
    expect(await screen.findByText("Overdue 2d")).toBeTruthy();
    expect(screen.getByText("Rajan", { selector: "span" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mark Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    expect(await screen.findByText("Write what happened before marking this done.")).toBeTruthy(); // the outcome is required
    expect(calls("PATCH")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Will order on Friday" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    expect(await screen.findByText("Follow-up marked done")).toBeTruthy();
    expect(bodyOf("PATCH")).toEqual({ status: "completed", outcome: "done", notes: "Will order on Friday" }); // the server records who and when and logs the notes as the activity
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
    await waitFor(() => expect(bodyOf("PATCH")).toEqual({ due_at: `${isoDate()}T23:59:00` }));
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
