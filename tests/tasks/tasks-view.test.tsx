// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TasksView from "@/features/tasks/components/TasksView";
import { listLeadTasks, reassignLeadTask, updateInteraction, type LeadTask, type LeadTaskList } from "@/lib/api/interactions";
import { listAllEmployees } from "@/lib/api/employees";
import { ApiError } from "@/lib/api/auth";

const auth = vi.hoisted(() => ({ user: { id: 3, name: "Anu", role: "sales_executive" } as Record<string, unknown> }));
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), replace: vi.fn() }));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "tok", user: auth.user }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => "/dashboard/tasks",
  useSearchParams: () => nav.params,
}));
vi.mock("@/lib/api/interactions", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/interactions")>()),
  listLeadTasks: vi.fn(),
  updateInteraction: vi.fn(),
  reassignLeadTask: vi.fn(),
}));
vi.mock("@/lib/api/employees", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/employees")>()),
  listAllEmployees: vi.fn(),
}));
vi.mock("@/features/settings/hooks/useFollowupSettings", async () => {
  const { DEFAULT_FOLLOWUP_SETTINGS } = await import("@/features/settings/api/followupSettings");
  return { useFollowupSettings: () => ({ settings: DEFAULT_FOLLOWUP_SETTINGS, isLoaded: true }) };
});

function task(overrides: Partial<LeadTask> = {}): LeadTask {
  return {
    id: 11, entity_type: "lead", entity_id: 5, kind: "task", activity_type: "phone_call", custom_label: null,
    title: "Call back", notes: null, done_by: null, done_by_name: null, assigned_to: 3, assigned_to_name: "Anu",
    created_by: 3, created_by_name: "Anu", due_at: "2026-12-01T03:30:00Z", priority: "medium", status: "todo",
    outcome: null, parent_task_id: null, logged_at: "2026-11-24T00:00:00Z", created_at: "2026-11-24T00:00:00Z",
    overdue_days: 0, overdue_minutes: 0, is_overdue: false, lead_name: "Ravi Kumar", lead_phone: "+919800000001", lead_status: "new",
    ...overrides,
  };
}

function page(items: LeadTask[], summary = { today: 1, overdue: 3, upcoming: 2, completed: 0 }): LeadTaskList {
  return { items, total: items.length, skip: 0, limit: 30, bucket: "today", summary };
}

async function openRowMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Task actions" }));
  return screen.getByRole("menu");
}

beforeEach(() => {
  auth.user = { id: 3, name: "Anu", role: "sales_executive" };
  nav.params = new URLSearchParams();
  vi.mocked(listLeadTasks).mockResolvedValue(page([task()]));
  vi.mocked(listAllEmployees).mockResolvedValue({ employees: [{ id: 3, name: "Anu" }, { id: 4, name: "Raj" }] as never, total: 2 });
  vi.mocked(updateInteraction).mockResolvedValue({} as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("TasksView", () => {
  it("shows bucket counts and the Today list by default", async () => {
    render(<TasksView />);
    expect(await screen.findByText("Ravi Kumar")).toBeTruthy();
    expect(vi.mocked(listLeadTasks).mock.calls[0][1]).toMatchObject({ bucket: "today", assignedTo: null });
    expect(screen.getByRole("option", { name: "Overdue (3)" })).toBeTruthy();
    expect((screen.getByLabelText("Task group") as HTMLSelectElement).value).toBe("today");
  });

  it("opens the overdue tab from ?tab= and marks late tasks in red", async () => {
    nav.params = new URLSearchParams("tab=overdue");
    vi.mocked(listLeadTasks).mockResolvedValue(page([task({ is_overdue: true, overdue_minutes: 125, due_at: "2026-11-25T03:30:00Z" })]));
    render(<TasksView />);
    expect(await screen.findByText("2h overdue")).toBeTruthy();
    expect(vi.mocked(listLeadTasks).mock.calls[0][1]).toMatchObject({ bucket: "overdue" });
  });

  it("changing the bucket dropdown updates the URL", async () => {
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    fireEvent.change(screen.getByLabelText("Task group"), { target: { value: "upcoming" } });
    expect(nav.replace).toHaveBeenCalledWith("/dashboard/tasks?tab=upcoming", { scroll: false });
  });

  it("clicking a row opens the task card without action buttons", async () => {
    render(<TasksView />);
    fireEvent.click(await screen.findByText("Ravi Kumar"));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark complete" })).toBeNull();
  });

  it("after an admin reassigns, the table shows the new assignee without a reload", async () => {
    auth.user = { id: 1, name: "Ada", role: "manager" };
    vi.mocked(listLeadTasks)
      .mockResolvedValueOnce(page([task({ assigned_to: 3, assigned_to_name: "Anu" })]))
      .mockResolvedValue(page([task({ assigned_to: 4, assigned_to_name: "Raj" })]));
    vi.mocked(reassignLeadTask).mockResolvedValue({} as never);
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    await waitFor(() => expect(document.querySelector("tbody")?.textContent).toContain("Anu"));
    fireEvent.click(screen.getByRole("button", { name: "Task actions" }));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Reassign" }));
    fireEvent.change(await screen.findByLabelText("New assignee"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Reassign" }));
    await waitFor(() => expect(reassignLeadTask).toHaveBeenCalledWith("tok", 5, 11, 4));
    await waitFor(() => expect(document.querySelector("tbody")?.textContent).toContain("Raj"));
  });

  it("the assignee changes status from the status dropdown", async () => {
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    const status = screen.getByRole("combobox", { name: "Task status" }) as HTMLSelectElement;
    expect(status.disabled).toBe(false);
    fireEvent.change(status, { target: { value: "inprogress" } });
    await waitFor(() => expect(updateInteraction).toHaveBeenCalledWith("tok", 11, { status: "inprogress" }));
  });

  it("choosing Completed in the status dropdown opens the completion form", async () => {
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    fireEvent.change(screen.getByRole("combobox", { name: "Task status" }), { target: { value: "completed" } });
    expect(await screen.findByRole("button", { name: "Mark complete" })).toBeTruthy();
    expect(updateInteraction).not.toHaveBeenCalled();
  });

  it("only the assignee can change status; heads see it disabled", async () => {
    auth.user = { id: 1, name: "Ada", role: "manager" };
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    expect((screen.getByRole("combobox", { name: "Task status" }) as HTMLSelectElement).disabled).toBe(true);
  });

  it("assigned staff menu has View Lead and Reschedule, but no Reassign or Delete", async () => {
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    const menu = await openRowMenu();
    expect(within(menu).getByRole("menuitem", { name: "View Lead" })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Reschedule" })).toBeTruthy();
    expect(within(menu).queryByRole("menuitem", { name: "Reassign" })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });

  it("heads get Reschedule, Reassign and Delete in the menu", async () => {
    auth.user = { id: 1, name: "Ada", role: "manager" };
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    const menu = await openRowMenu();
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: "Reassign" })).toBeTruthy());
    expect(within(menu).getByRole("menuitem", { name: "Reschedule" })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toBeTruthy();
  });

  it("other staff see only View Lead in the menu and no status control", async () => {
    auth.user = { id: 9, name: "Other", role: "sales_executive" };
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    expect((screen.getByRole("combobox", { name: "Task status" }) as HTMLSelectElement).disabled).toBe(true);
    const menu = await openRowMenu();
    expect(within(menu).getByRole("menuitem", { name: "View Lead" })).toBeTruthy();
    expect(within(menu).queryByRole("menuitem", { name: "Reschedule" })).toBeNull();
  });

  it("menu Reschedule opens the reschedule form", async () => {
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    const menu = await openRowMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Reschedule" }));
    expect(await screen.findByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("menu View Lead navigates to the lead", async () => {
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    const menu = await openRowMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "View Lead" }));
    expect(nav.push).toHaveBeenCalledWith("/dashboard/leads?lead=5");
  });

  it("staff get no assignee filter; heads do and it filters the request", async () => {
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    expect(screen.queryByLabelText("Assigned to")).toBeNull();
    cleanup();

    auth.user = { id: 1, name: "Ada", role: "manager" };
    render(<TasksView />);
    await screen.findByText("Ravi Kumar");
    await screen.findByRole("option", { name: "Raj" });
    fireEvent.change(screen.getByLabelText("Assigned to"), { target: { value: "4" } });
    await waitFor(() => expect(vi.mocked(listLeadTasks).mock.calls.at(-1)?.[1]).toMatchObject({ assignedTo: 4 }));
  });

  it("shows the empty state", async () => {
    vi.mocked(listLeadTasks).mockResolvedValue(page([], { today: 0, overdue: 0, upcoming: 0, completed: 0 }));
    render(<TasksView />);
    expect(await screen.findByText("Nothing due today.")).toBeTruthy();
  });

  it("shows an offline message with a retry", async () => {
    vi.mocked(listLeadTasks).mockRejectedValueOnce(new ApiError("offline", "You're offline."));
    render(<TasksView />);
    expect(await screen.findByText(/offline or the server can't be reached/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ravi Kumar")).toBeTruthy();
  });
});
