// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowupsSettingsTab from "@/features/settings/components/FollowupsSettingsTab";
import {
  DEFAULT_FOLLOWUP_SETTINGS,
  getFollowupSettings,
  updateFollowupSettings,
} from "@/features/settings/api/followupSettings";
import { listEnum, updateEnum } from "@/lib/api/settings";
import { ApiError } from "@/lib/api/auth";

const auth = vi.hoisted(() => ({ user: { id: 1, name: "Ada", role: "admin" } as Record<string, unknown> }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "tok", user: auth.user }) }));
vi.mock("@/features/settings/api/followupSettings", async (orig) => ({
  ...(await orig<typeof import("@/features/settings/api/followupSettings")>()),
  getFollowupSettings: vi.fn(),
  updateFollowupSettings: vi.fn(),
}));
vi.mock("@/lib/api/settings", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/settings")>()),
  listEnum: vi.fn(),
  updateEnum: vi.fn(),
  createEnum: vi.fn(),
}));

const stored = { ...DEFAULT_FOLLOWUP_SETTINGS, stored: true };
const statusRows = [
  { id: 1, value: "todo", label: "To do", sort_order: 1, is_active: true, locked: true, usage_count: null },
  { id: 2, value: "inprogress", label: "In progress", sort_order: 2, is_active: true, locked: true, usage_count: null },
  { id: 3, value: "completed", label: "Completed", sort_order: 3, is_active: true, locked: true, usage_count: null },
];

beforeEach(() => {
  auth.user = { id: 1, name: "Ada", role: "admin" };
  vi.mocked(getFollowupSettings).mockResolvedValue(stored);
  vi.mocked(updateFollowupSettings).mockImplementation(async (_t, patch) => ({ ...stored, ...patch }) as typeof stored);
  vi.mocked(listEnum).mockImplementation(async (_t, category) => (category === "task_status" ? statusRows : []));
  vi.mocked(updateEnum).mockResolvedValue({ ...statusRows[1], label: "Working" });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("FollowupsSettingsTab", () => {
  it("keeps Save disabled until something changes, then sends only the changes", async () => {
    render(<FollowupsSettingsTab />);
    const save = await screen.findByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: /Every day until done/ }));
    fireEvent.change(screen.getByLabelText("Maximum reminder days"), { target: { value: "5" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(updateFollowupSettings).toHaveBeenCalledWith("tok", { reminder_mode: "daily_until_done", reminder_max_days: 5 }));
    expect(await screen.findByText("Follow-up settings saved.")).toBeTruthy();
    expect(save.disabled).toBe(true);
  });

  it("toggles a staff permission", async () => {
    render(<FollowupsSettingsTab />);
    fireEvent.click(await screen.findByRole("switch", { name: "Staff can reschedule their follow-ups" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateFollowupSettings).toHaveBeenCalledWith("tok", { allow_staff_reschedule: false }));
  });

  it("renames a task status without changing its value", async () => {
    render(<FollowupsSettingsTab />);
    const input = await screen.findByLabelText("Name for inprogress");
    fireEvent.change(input, { target: { value: "Working" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[1]);
    await waitFor(() => expect(updateEnum).toHaveBeenCalledWith("tok", "task_status", 2, { label: "Working" }));
  });

  it("a manager without lead-status permission sees names read-only but can still recolour", async () => {
    auth.user = { id: 2, name: "Mani", role: "manager", permissions: { leads: "crud", lead_statuses: "" } };
    render(<FollowupsSettingsTab />);
    await screen.findByRole("radiogroup", { name: "Colour for In progress" });
    expect(screen.queryByLabelText("Name for inprogress")).toBeNull();
    expect(screen.queryByLabelText("New activity type")).toBeNull();
  });

  it("recolours a status through Save changes", async () => {
    render(<FollowupsSettingsTab />);
    const group = await screen.findByRole("radiogroup", { name: "Colour for In progress" });
    fireEvent.click(group.querySelector('[aria-label="purple"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateFollowupSettings).toHaveBeenCalledWith("tok", {
      status_colors: { todo: "gray", inprogress: "purple", completed: "teal" },
    }));
  });

  it("shows the server's message when saving fails", async () => {
    vi.mocked(updateFollowupSettings).mockRejectedValueOnce(new ApiError("server", "Follow-up settings are not set up on this database yet.", 503));
    render(<FollowupsSettingsTab />);
    fireEvent.click(await screen.findByRole("switch", { name: "Send follow-up reminders" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/not set up on this database yet/)).toBeTruthy();
  });

  it("says when the values are only defaults", async () => {
    vi.mocked(getFollowupSettings).mockResolvedValue(DEFAULT_FOLLOWUP_SETTINGS);
    render(<FollowupsSettingsTab />);
    expect(await screen.findByText(/These are the built-in defaults/)).toBeTruthy();
  });
});
