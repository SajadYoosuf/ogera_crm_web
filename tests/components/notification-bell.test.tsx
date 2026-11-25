// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell, { timeAgo } from "@/features/notifications/NotificationBell";
import {
  dismissNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  purgeOldNotifications,
  type AppNotification,
} from "@/features/notifications/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "tok", user: { id: 3, name: "Anu", role: "sales_executive" } }) }));
vi.mock("@/features/notifications/api", async (orig) => ({
  ...(await orig<typeof import("@/features/notifications/api")>()),
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  dismissNotification: vi.fn(),
  purgeOldNotifications: vi.fn(),
}));

const now = new Date().toISOString();
const items: AppNotification[] = [
  { id: 1, type: "lead_assigned", title: "Lead assigned to you", message: "Asha was assigned to you.", entity_type: "lead", entity_id: 42, is_read: false, created_at: now },
  { id: 2, type: "followup_assigned", title: "New follow-up assigned", message: "Ada assigned you: Call", entity_type: "lead", entity_id: 7, is_read: false, created_at: now },
  { id: 3, type: "lead_created", title: "New lead received", message: "Ravi was added.", entity_type: "lead", entity_id: 9, is_read: true, created_at: now },
];

beforeEach(() => {
  vi.mocked(listNotifications).mockResolvedValue({ items: items.map((x) => ({ ...x })), unread_count: 2 });
  vi.mocked(markNotificationRead).mockResolvedValue({ ok: true });
  vi.mocked(markAllNotificationsRead).mockResolvedValue({ ok: true });
  vi.mocked(dismissNotification).mockResolvedValue(undefined);
  vi.mocked(purgeOldNotifications).mockResolvedValue({ deleted: 0 });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("NotificationBell", () => {
  it("shows the unread count on the badge", async () => {
    render(<NotificationBell />);
    expect((await screen.findByTestId("unread-badge")).textContent).toBe("2");
  });

  it("opening the panel purges old notifications and lists them", async () => {
    render(<NotificationBell />);
    await screen.findByTestId("unread-badge");
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    await waitFor(() => expect(purgeOldNotifications).toHaveBeenCalledWith("tok"));
    expect(await screen.findByText("Lead assigned to you")).toBeTruthy();
    expect(screen.getByText("New lead received")).toBeTruthy();
  });

  it("clicking a lead notification marks it read and opens the lead", async () => {
    render(<NotificationBell />);
    await screen.findByTestId("unread-badge");
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    fireEvent.click(await screen.findByText("Lead assigned to you"));
    expect(markNotificationRead).toHaveBeenCalledWith("tok", 1);
    expect(push).toHaveBeenCalledWith("/dashboard/leads?lead=42");
    expect(screen.getByTestId("unread-badge").textContent).toBe("1");
  });

  it("mark all read clears the badge", async () => {
    render(<NotificationBell />);
    await screen.findByTestId("unread-badge");
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledWith("tok"));
    expect(screen.queryByTestId("unread-badge")).toBeNull();
  });

  it("dismiss removes one notification", async () => {
    render(<NotificationBell />);
    await screen.findByTestId("unread-badge");
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss New lead received" }));
    await waitFor(() => expect(dismissNotification).toHaveBeenCalledWith("tok", 3));
    expect(screen.queryByText("New lead received")).toBeNull();
  });

  it("shows an empty state", async () => {
    vi.mocked(listNotifications).mockResolvedValue({ items: [], unread_count: 0 });
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText(/all caught up/)).toBeTruthy();
  });
});

describe("timeAgo", () => {
  it("formats relative times", () => {
    const base = Date.parse("2026-11-24T12:00:00Z");
    expect(timeAgo("2026-11-24T11:59:30Z", base)).toBe("just now");
    expect(timeAgo("2026-11-24T11:45:00Z", base)).toBe("15m ago");
    expect(timeAgo("2026-11-24T09:00:00", base)).toBe("3h ago"); // offset-less = UTC
    expect(timeAgo("2026-11-21T12:00:00Z", base)).toBe("3d ago");
  });
});
