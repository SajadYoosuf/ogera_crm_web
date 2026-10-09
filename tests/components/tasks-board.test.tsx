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
  id: 5, type: "phone_call", notes: "Confirm quote decision", status: "pending", scheduled_date: isoDate(), scheduled_time: "10:30:00",
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
    if (url.pathname === "/contacts/12/activities/5" && init?.method === "PATCH") { tasks = []; return ok(task({ status: "done", task_state: "done" })); }
    return fail(404, `Unmocked ${url.pathname}`);
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); sessionStorage.clear(); });

describe("tasks screen", () => {
  it("opens on today and asks the server for that day, including what was missed", async () => {
    signIn("sales_executive");
    render(<TasksBoard />);
    expect(await screen.findByText("Anil Kumar")).toBeTruthy();
    const [first] = urlsFor("/tasks");
    expect(first.searchParams.get("date_from")).toBe(isoDate());
    expect(first.searchParams.get("date_to")).toBe(isoDate());
    expect(first.searchParams.get("include_overdue")).toBe("true");
    expect(screen.getByText("10:30am")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Employee/ })).toBeNull(); // staff only see their own tasks
  });

  it("asks for the whole week and the whole month grid when the view changes", async () => {
    signIn("sales_executive");
    render(<TasksBoard />);
    await screen.findByText("Anil Kumar");
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    await waitFor(() => expect(urlsFor("/tasks").some((url) => url.searchParams.get("date_from") !== url.searchParams.get("date_to"))).toBe(true));
    const week = urlsFor("/tasks").at(-1)!;
    expect(week.searchParams.get("include_overdue")).toBeNull();
    expect((new Date(week.searchParams.get("date_to")!).getTime() - new Date(week.searchParams.get("date_from")!).getTime()) / 86400000).toBe(6);

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    await waitFor(() => {
      const last = urlsFor("/tasks").at(-1)!;
      expect((new Date(last.searchParams.get("date_to")!).getTime() - new Date(last.searchParams.get("date_from")!).getTime()) / 86400000).toBeGreaterThanOrEqual(27);
    });
  });

  it("lets a manager filter by employee", async () => {
    signIn("manager");
    render(<TasksBoard />);
    await screen.findByText("Anil Kumar");
    fireEvent.click(screen.getByRole("button", { name: /Employee/ }));
    fireEvent.click(within(await screen.findByRole("option", { name: "Rajan" })).getByRole("button"));
    await waitFor(() => expect(urlsFor("/tasks").at(-1)!.searchParams.get("assigned_to")).toBe("7"));
  });

  it("needs an outcome before a task can be marked done, then logs it with the completion", async () => {
    signIn("sales_executive");
    render(<TasksBoard />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark done" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    expect(await screen.findByText("Write what happened before marking this done.")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);

    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Spoke to Anil, quote on Friday" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    expect(await screen.findByText(/The outcome was logged for Anil Kumar/)).toBeTruthy();
    expect(patchBody()).toEqual({ status: "done", outcome: "Spoke to Anil, quote on Friday" });
    await waitFor(() => expect(screen.queryByText("Anil Kumar")).toBeNull()); // the list reloads without the finished task
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
});
