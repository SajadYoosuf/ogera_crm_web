// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompleteTaskDialog, NextFollowupDialog, RescheduleTaskDialog } from "@/components/tasks/TaskDialogs";
import { isoDate } from "@/components/followups/activities";
import type { TaskItem } from "@/lib/api/tasks";

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 5, title: "Confirm quote", type: "phone_call", notes: null, status: "pending", scheduled_date: isoDate(), scheduled_time: "10:30:00",
  assigned_to: 7, assigned_to_name: "Rajan", completed_at: null, completed_by: null, completed_by_name: null, coordinates: null, task_id: null,
  created_by: 7, created_by_name: "Rajan", created_at: "2026-10-01T09:00:00", task_state: "due_today", overdue_days: 0,
  contact_id: 12, contact_name: "Anil Kumar", contact_phone: "9111111111", contact_type: "consumer", ...overrides,
});

afterEach(() => cleanup());

describe("CompleteTaskDialog", () => {
  it("refuses blank notes, and never saves them", async () => {
    const onSave = vi.fn(async () => {});
    render(<CompleteTaskDialog task={task()} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    expect(await screen.findByText("Write what happened before marking this done.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves the notes trimmed", async () => {
    const onSave = vi.fn(async () => {});
    render(<CompleteTaskDialog task={task()} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "  Will confirm Friday  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Will confirm Friday"));
  });

  it("shows the server's message when saving fails, and stays open", async () => {
    const onSave = vi.fn(async () => { throw new Error("Follow-up is already completed"); });
    render(<CompleteTaskDialog task={task()} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "Done" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & mark done" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Follow-up is already completed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save & mark done" })).toBeTruthy();
  });

  it("shows the task's own values", () => {
    render(<CompleteTaskDialog task={task({ assigned_to_name: "Rajan" })} onSave={async () => {}} onCancel={() => {}} />);
    expect(screen.getByText("Confirm quote")).toBeTruthy();
    expect(screen.getByText("Anil Kumar")).toBeTruthy();
    expect(screen.getByText("Rajan")).toBeTruthy();
  });
});

describe("RescheduleTaskDialog", () => {
  it("asks for a date first", async () => {
    const onSave = vi.fn(async () => {});
    render(<RescheduleTaskDialog task={task()} onSave={onSave} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Save new date" }));
    expect(await screen.findByText("Pick the new due date.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("refuses a date in the past", async () => {
    const onSave = vi.fn(async () => {});
    render(<RescheduleTaskDialog task={task()} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: isoDate(-1) } });
    fireEvent.click(screen.getByRole("button", { name: "Save new date" }));
    expect(await screen.findByText("The due date cannot be in the past.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("refuses a time that has already passed today", async () => {
    const onSave = vi.fn(async () => {});
    render(<RescheduleTaskDialog task={task()} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: isoDate() } });
    fireEvent.change(screen.getByLabelText("New time (optional)"), { target: { value: "00:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new date" }));
    expect(await screen.findByText("That time has already passed today. Pick a later time.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a future date with no time as a whole-day move", async () => {
    const onSave = vi.fn(async () => {});
    render(<RescheduleTaskDialog task={task()} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: isoDate(3) } });
    fireEvent.click(screen.getByRole("button", { name: "Save new date" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(isoDate(3), ""));
  });

  it("clears the time error once the time changes", async () => {
    render(<RescheduleTaskDialog task={task()} onSave={async () => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("New due date"), { target: { value: isoDate() } });
    fireEvent.change(screen.getByLabelText("New time (optional)"), { target: { value: "00:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new date" }));
    await screen.findByText("That time has already passed today. Pick a later time.");
    fireEvent.change(screen.getByLabelText("New time (optional)"), { target: { value: "23:59" } });
    expect(screen.queryByText("That time has already passed today. Pick a later time.")).toBeNull();
  });
});

describe("NextFollowupDialog", () => {
  it("offers to schedule or to stop", () => {
    const onSchedule = vi.fn();
    const onDone = vi.fn();
    render(<NextFollowupDialog task={task()} onSchedule={onSchedule} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Yes, schedule" }));
    expect(onSchedule).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "No, that's all" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
