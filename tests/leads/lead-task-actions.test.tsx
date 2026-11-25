// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeadTaskActions from "@/features/leads/components/LeadTaskActions";
import { deleteLeadInteraction, reassignLeadTask, rescheduleLeadTask, updateInteraction, type Interaction } from "@/lib/api/interactions";

const auth = vi.hoisted(() => ({ user: { id: 3, name: "Anu", role: "sales_executive" } as { id: number; name: string; role: string; permissions?: Record<string, string> } }));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "tok", user: auth.user }) }));
const followup = vi.hoisted(() => ({ settings: {} as Record<string, unknown> }));
vi.mock("@/features/settings/hooks/useFollowupSettings", async () => {
  const { DEFAULT_FOLLOWUP_SETTINGS } = await import("@/features/settings/api/followupSettings");
  return { useFollowupSettings: () => ({ settings: { ...DEFAULT_FOLLOWUP_SETTINGS, ...followup.settings }, isLoaded: true }) };
});
vi.mock("@/lib/api/interactions", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/interactions")>()),
  updateInteraction: vi.fn(),
  rescheduleLeadTask: vi.fn(),
  reassignLeadTask: vi.fn(),
  deleteLeadInteraction: vi.fn(),
}));

function task(overrides: Partial<Interaction> = {}): Interaction {
  return {
    id: 11, entity_type: "lead", entity_id: 5, kind: "task", activity_type: "phone_call", custom_label: null,
    title: "Call back", notes: null, done_by: null, done_by_name: null, assigned_to: 3, assigned_to_name: "Anu",
    created_by: 3, created_by_name: "Anu", due_at: "2026-12-01T03:30:00Z", priority: "medium", status: "todo",
    outcome: null, parent_task_id: null, logged_at: "2026-11-24T00:00:00Z", created_at: "2026-11-24T00:00:00Z", overdue_days: 0,
    ...overrides,
  };
}

const employees = [{ id: 3, name: "Anu" }, { id: 4, name: "Raj" }];

beforeEach(() => {
  auth.user = { id: 3, name: "Anu", role: "sales_executive" };
  followup.settings = {};
  vi.mocked(updateInteraction).mockResolvedValue(task({ status: "completed" }));
  vi.mocked(rescheduleLeadTask).mockResolvedValue(task());
  vi.mocked(reassignLeadTask).mockResolvedValue(task({ assigned_to: 4 }));
  vi.mocked(deleteLeadInteraction).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("LeadTaskActions role rules", () => {
  it("assignee (staff) can start, complete and reschedule, but not reassign or delete", () => {
    render(<LeadTaskActions task={task()} leadId={5} employees={employees} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Complete" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reassign" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("staff whose role holds leads 'crud' still get no reassign or delete (S8)", () => {
    auth.user = { id: 3, name: "Anu", role: "sales_executive", permissions: { leads: "crud" } } as typeof auth.user;
    render(<LeadTaskActions task={task()} leadId={5} employees={employees} onChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Reassign" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("staff who is not the assignee sees no actions", () => {
    const { container } = render(<LeadTaskActions task={task({ assigned_to: 4 })} leadId={5} employees={employees} onChanged={vi.fn()} />);
    expect(container.textContent).toBe("");
  });

  it("admin/manager sees reassign and delete on anyone's task", () => {
    auth.user = { id: 1, name: "Ada", role: "manager" };
    render(<LeadTaskActions task={task({ assigned_to: 4 })} leadId={5} employees={employees} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Reassign" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("completed tasks show nothing to staff", () => {
    const { container } = render(<LeadTaskActions task={task({ status: "completed" })} leadId={5} onChanged={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
});

describe("LeadTaskActions calls", () => {
  it("completes with the outcome, note and the planned type as 'done via', then offers the next follow-up", async () => {
    const onChanged = vi.fn();
    render(<LeadTaskActions task={task()} leadId={5} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    expect(screen.getByRole("radio", { name: "Phone Call" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "No answer" }));
    fireEvent.change(screen.getByLabelText("Completion note"), { target: { value: "phone off" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    await waitFor(() => expect(updateInteraction).toHaveBeenCalledWith("tok", 11, {
      status: "completed", outcome: "no_answer", notes: "phone off", actual_activity_type: "phone_call",
    }));
    expect(await screen.findByText(/Schedule next follow-up\?/)).toBeTruthy();
    expect(screen.getByText(/Suggested: in 3 days/)).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onChanged).toHaveBeenCalled();
  });

  it("records a different channel than planned", async () => {
    render(<LeadTaskActions task={task()} leadId={5} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    fireEvent.click(screen.getByRole("radio", { name: "WhatsApp" }));
    fireEvent.change(screen.getByLabelText("Completion note"), { target: { value: "sent brochure" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    await waitFor(() => expect(updateInteraction).toHaveBeenCalledWith("tok", 11, expect.objectContaining({ actual_activity_type: "whatsapp" })));
  });

  it("needs a note and a name for 'Other'", () => {
    render(<LeadTaskActions task={task()} leadId={5} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(screen.getByRole("alert").textContent).toContain("note");
    fireEvent.change(screen.getByLabelText("Completion note"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("radio", { name: "Other" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(screen.getByRole("alert").textContent).toContain("Name how");
    expect(updateInteraction).not.toHaveBeenCalled();
  });

  it("'Schedule' opens the follow-up form pre-filled with the retry date", async () => {
    render(<LeadTaskActions task={task()} leadId={5} leadName="Ravi" onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    fireEvent.click(screen.getByRole("radio", { name: "Not now" }));
    fireEvent.change(screen.getByLabelText("Completion note"), { target: { value: "busy" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Schedule" }));
    expect(screen.getByRole("dialog", { name: "Schedule Follow-up" })).toBeTruthy();
    const expected = new Date();
    expected.setDate(expected.getDate() + 3);
    const iso = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`;
    expect((screen.getByDisplayValue(iso) as HTMLInputElement).type).toBe("date");
  });

  it("hides Reschedule from staff when Settings turns it off", () => {
    followup.settings = { allow_staff_reschedule: false };
    render(<LeadTaskActions task={task()} leadId={5} onChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Reschedule" })).toBeNull();
    expect(screen.getByRole("button", { name: "Complete" })).toBeTruthy();
  });

  it("heads can still reschedule when staff rescheduling is off", () => {
    followup.settings = { allow_staff_reschedule: false };
    auth.user = { id: 1, name: "Ada", role: "manager" };
    render(<LeadTaskActions task={task()} leadId={5} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeTruthy();
  });

  it("start moves the task to in progress", async () => {
    render(<LeadTaskActions task={task()} leadId={5} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(updateInteraction).toHaveBeenCalledWith("tok", 11, { status: "inprogress" }));
  });

  it("reschedule sends a UTC ISO time built from the local date and time", async () => {
    render(<LeadTaskActions task={task()} leadId={5} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: "2026-12-05" } });
    fireEvent.change(screen.getByLabelText("New due time"), { target: { value: "14:30" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "client travelling" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const expected = new Date("2026-12-05T14:30:00").toISOString();
    await waitFor(() => expect(rescheduleLeadTask).toHaveBeenCalledWith("tok", 5, 11, expected, "client travelling"));
  });

  it("reschedule rejects a past time without calling the API", () => {
    render(<LeadTaskActions task={task()} leadId={5} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: "2020-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert").textContent).toContain("past");
    expect(rescheduleLeadTask).not.toHaveBeenCalled();
  });

  it("reschedule quick picks fill the date and time from Settings", async () => {
    followup.settings = { morning_time: "10:30" };
    render(<LeadTaskActions task={task()} leadId={5} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.click(screen.getByRole("button", { name: "Tomorrow morning" }));
    expect((screen.getByLabelText("New due time") as HTMLInputElement).value).toBe("10:30");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(rescheduleLeadTask).toHaveBeenCalled());
  });

  it("shows the API's message when a call is refused", async () => {
    const { ApiError } = await import("@/lib/api/auth");
    vi.mocked(updateInteraction).mockRejectedValueOnce(new ApiError("forbidden", "Only the assignee can change this", 403));
    render(<LeadTaskActions task={task()} leadId={5} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Only the assignee");
  });

  it("head reassigns and deletes", async () => {
    auth.user = { id: 1, name: "Ada", role: "admin" };
    render(<LeadTaskActions task={task()} leadId={5} employees={employees} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reassign" }));
    fireEvent.change(screen.getByLabelText("New assignee"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Reassign" }));
    await waitFor(() => expect(reassignLeadTask).toHaveBeenCalledWith("tok", 5, 11, 4));

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    await waitFor(() => expect(deleteLeadInteraction).toHaveBeenCalledWith("tok", 5, 11));
  });
});
