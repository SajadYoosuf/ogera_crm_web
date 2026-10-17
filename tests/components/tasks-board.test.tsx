// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TasksBoard from "@/components/tasks/TasksBoard";
import { isoDate } from "@/components/followups/activities";
import type { TaskItem, TaskList } from "@/lib/api/tasks";

const fetchMock = vi.fn();
const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => data });
const fail = (status: number, detail: unknown) => ({ ok: false, status, json: async () => ({ detail }) });

const task = (overrides: Partial<TaskItem>): TaskItem => ({
  id: 5, title: null, type: "phone_call", notes: "Confirm quote decision", status: "pending", scheduled_date: isoDate(), scheduled_time: "10:30:00",
  assigned_to: 7, assigned_to_name: "Rajan", completed_at: null, completed_by: null, completed_by_name: null, coordinates: null, task_id: null,
  created_by: 1, created_by_name: "Ada", created_at: "2026-10-01T09:00:00", task_state: "due_today", overdue_days: 0,
  contact_id: 12, contact_name: "Anil Kumar", contact_phone: "9111111111", contact_type: "consumer", ...overrides,
});

const list = (items: TaskItem[]): TaskList => ({ items, total: items.length, summary: { overdue: 1, today: 2, upcoming: 3, done: 0 } });

let tasks: TaskItem[];
const urlsFor = (path: string) => fetchMock.mock.calls.map(([input]) => String(input)).filter((input) => input.startsWith("http")).map((input) => new URL(input)).filter((url) => url.pathname === path); // skips the relative dev-log beacon
const patchBody = () => JSON.parse(String(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH").at(-1)?.[1].body));

function signIn(role: string) {
  sessionStorage.setItem("ogera_access_token", "test-token");
  sessionStorage.setItem("ogera_user", JSON.stringify({ id: 1, name: "Ada", role }));
}

beforeEach(() => {
  tasks = [task({})];
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.pathname === "/tasks") return ok(list(tasks));
    if (url.pathname === "/employees") return ok({ items: [{ id: 7, name: "Rajan", role: "sales_executive", is_active: true }], total: 1, skip: 0, limit: 100 });
    if (url.pathname === "/contacts/12/followups/5" && init?.method === "PATCH") { tasks = []; return ok({ id: 5 }); }
    return fail(404, `Unmocked ${url.pathname}`);
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); sessionStorage.clear(); });

describe("tasks screen", () => {
  it("opens on all dates, so a task due on another day shows without picking a range", async () => {
    signIn("sales_executive");
    tasks = [task({ id: 9, notes: "Send brochure", scheduled_date: isoDate(1), task_state: "pending", contact_name: "Future Lead" })];
    render(<TasksBoard />);
    expect(await screen.findByText("Future Lead")).toBeTruthy();
    const [first] = urlsFor("/tasks");
    expect(first.searchParams.get("date_from")).toBeNull();
    expect(first.searchParams.get("date_to")).toBeNull();
  });

  it("can switch to today, which also includes what was missed", async () => {
    signIn("sales_executive");
    render(<TasksBoard />);
    await screen.findByText("Anil Kumar");
    fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => expect(urlsFor("/tasks").at(-1)!.searchParams.get("date_from")).toBe(isoDate()));
    const today = urlsFor("/tasks").at(-1)!;
    expect(today.searchParams.get("date_to")).toBe(isoDate());
    expect(today.searchParams.get("include_overdue")).toBe("true");
    expect(screen.getByText("10:30am")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));
    expect(screen.queryByRole("button", { name: "Rajan" })).toBeNull(); // staff only see their own tasks
  });

  it("asks for the whole week and the whole month when the due date changes", async () => {
    signIn("sales_executive");
    render(<TasksBoard />);
    await screen.findByText("Anil Kumar");
    fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));
    fireEvent.click(screen.getByRole("button", { name: "This week" }));
    await waitFor(() => expect(urlsFor("/tasks").some((url) => url.searchParams.get("date_from") !== url.searchParams.get("date_to"))).toBe(true));
    const week = urlsFor("/tasks").at(-1)!;
    expect(week.searchParams.get("include_overdue")).toBeNull();
    expect((new Date(week.searchParams.get("date_to")!).getTime() - new Date(week.searchParams.get("date_from")!).getTime()) / 86400000).toBe(6);

    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    await waitFor(() => {
      const last = urlsFor("/tasks").at(-1)!;
      expect((new Date(last.searchParams.get("date_to")!).getTime() - new Date(last.searchParams.get("date_from")!).getTime()) / 86400000).toBeGreaterThanOrEqual(27);
    });
  });

  it("lets a manager filter by employee", async () => {
    signIn("manager");
    render(<TasksBoard />);
    await screen.findByText("Anil Kumar");
    fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Rajan" }));
    await waitFor(() => expect(urlsFor("/tasks").at(-1)!.searchParams.get("assigned_to")).toBe("7"));
  });

  it("shows Mark done and Reschedule in the table on desktop", async () => {
    signIn("sales_executive");
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<TasksBoard />);
    expect(await screen.findByRole("columnheader", { name: "Priority" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Actions for/ }));
    expect(screen.getByRole("menu").parentElement).toBe(document.body); // drawn outside the table so nothing clips it
    fireEvent.click(screen.getByRole("menuitem", { name: "Reschedule" }));
    expect(screen.getByRole("button", { name: "Save new date" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: /^Actions for/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark done" }));
    expect(screen.getByRole("button", { name: "Save & mark done" })).toBeTruthy();
  });

  it("logs what happened before a task is marked done, then asks about the next follow-up", async () => {
    signIn("sales_executive");
    render(<TasksBoard />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark done" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    expect(await screen.findByText("Write what happened before marking this done.")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);

    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Spoke to Anil, quote on Friday" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    expect(await screen.findByRole("heading", { name: "Schedule a follow-up?" })).toBeTruthy();
    expect(patchBody()).toEqual({ status: "completed", outcome: "done", notes: "Spoke to Anil, quote on Friday" });

    fireEvent.click(screen.getByRole("button", { name: "No, that's all" }));
    expect(await screen.findByText(/The activity was logged for Anil Kumar/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Anil Kumar")).toBeNull()); // the list reloads without the finished task
  });

  it("opens the schedule form when the next follow-up is wanted after marking done", async () => {
    signIn("sales_executive");
    render(<TasksBoard />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark done" }));
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Called, will confirm" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, schedule" }));
    expect(await screen.findByRole("button", { name: "Schedule Followup" })).toBeTruthy();
  });

  it("reschedules from a dialog that shows the task, and saves the new date", async () => {
    signIn("sales_executive");
    render(<TasksBoard />);
    fireEvent.click(await screen.findByRole("button", { name: "Reschedule" }));
    expect(screen.getByText("Confirm quote decision")).toBeTruthy(); // the task's own values are shown
    const next = isoDate(2);
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: next } });
    fireEvent.click(screen.getByRole("button", { name: "Save new date" }));
    await waitFor(() => expect(patchBody()).toEqual({ due_at: `${next}T23:59:00` }));
  });

  it("shows the empty state, and an error with a retry", async () => {
    signIn("sales_executive");
    tasks = [];
    render(<TasksBoard />);
    expect(await screen.findByText("No follow-ups here")).toBeTruthy();

    cleanup();
    fetchMock.mockImplementation(async () => fail(500, "Boom"));
    render(<TasksBoard />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("starts on All, offers the status tabs, and filters consumer or partner from the Filter menu", async () => {
    signIn("sales_executive");
    render(<TasksBoard />);
    await screen.findByText("Anil Kumar");
    const statusTabs = within(screen.getByRole("tablist", { name: "Task status filter" })).getAllByRole("tab").map((tab) => tab.textContent);
    expect(statusTabs).toEqual(["All", "To do", "In Progress", "Completed"]);
    expect(urlsFor("/tasks").at(-1)!.searchParams.get("status")).toBe("all");

    fireEvent.click(screen.getByRole("tab", { name: "In Progress" }));
    await waitFor(() => expect(urlsFor("/tasks").at(-1)!.searchParams.get("status")).toBe("inprogress"));
    fireEvent.click(screen.getByRole("tab", { name: "To do" }));

    // Due date "All dates" asks for every date
    fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));
    fireEvent.click(screen.getByRole("button", { name: "All dates" }));
    await waitFor(() => {
      const last = urlsFor("/tasks").at(-1)!;
      expect(last.searchParams.get("date_from")).toBeNull();
      expect(last.searchParams.get("date_to")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Partner" }));
    await waitFor(() => expect(urlsFor("/tasks").at(-1)!.searchParams.get("contact_type")).toBe("partner"));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(urlsFor("/tasks").at(-1)!.searchParams.get("contact_type")).toBeNull());
  });
});
