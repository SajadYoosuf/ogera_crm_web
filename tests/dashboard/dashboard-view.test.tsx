// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardView from "@/features/dashboard/DashboardView";
import { getDashboardSummary, type DashboardSummary, type QueueItem } from "@/features/dashboard/api/dashboard";
import { niceMax } from "@/features/dashboard/components/Charts";
import { agoText, dueText, whatsAppUrl } from "@/features/dashboard/format";
import { ApiError } from "@/lib/api/auth";

const auth = vi.hoisted(() => ({ user: { id: 3, name: "Anu", role: "sales_executive" } as Record<string, unknown>, clearSession: vi.fn() }));
const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "tok", user: auth.user, clearSession: auth.clearSession }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push }) }));
vi.mock("@/components/NavbarUserSection", () => ({ default: () => null }));
vi.mock("@/features/dashboard/api/dashboard", async (orig) => ({
  ...(await orig<typeof import("@/features/dashboard/api/dashboard")>()),
  getDashboardSummary: vi.fn(),
}));
vi.mock("@/features/leads/components/LeadActivityLogModal", () => ({
  default: ({ leadName, onSaved }: { leadName: string; onSaved: () => void }) => <button onClick={onSaved}>save log for {leadName}</button>,
}));
vi.mock("@/features/contacts/components/ContactActivityLogModal", () => ({
  default: ({ contactName }: { contactName: string }) => <p>contact log for {contactName}</p>,
}));
vi.mock("@/features/leads/components/LeadTaskActions", () => ({
  default: ({ task }: { task: { id: number } }) => <p>complete form {task.id}</p>,
}));

function queueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 11, entity_type: "lead", entity_id: 5, kind: "task", activity_type: "phone_call", custom_label: null,
    title: "Call back", notes: null, done_by: null, done_by_name: null, assigned_to: 3, assigned_to_name: "Anu",
    created_by: 3, created_by_name: "Anu", due_at: "2020-01-01T00:00:00+00:00", priority: "medium", status: "todo",
    outcome: null, parent_task_id: null, logged_at: "2020-01-01T00:00:00+00:00", created_at: "2020-01-01T00:00:00+00:00",
    overdue_days: 3, name: "Ravi Kumar", phone: "+919800000001", overdue: true, ...overrides,
  };
}

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  const pipeline = (type: "consumer" | "partner" | "dealer") => ({ type, total: 0, unassigned: null, no_stage: 0, stages: [] });
  return {
    view: "sales",
    period: { key: "30d", date_from: "2026-10-28", date_to: "2026-11-26" },
    employee_id: 3,
    followups: { overdue: 1, today: 0, upcoming: 0, completed_in_period: 0, due_total: 1, queue: [queueItem()] },
    leads: {
      open: 4, new_in_period: 4, converted_in_period: 1, cohort_converted: 1, conversion_rate: 25,
      by_status: [{ slug: "pre_qualified", name: "Pre-Qualified", count: 2 }],
      by_source: [{ source_id: 1, name: "Website", count: 4, converted: 1 }],
      trend: [{ date: "2026-11-26", created: 4, converted: 1 }], trend_days_per_point: 1,
      uncontacted: 0, uncontacted_items: [],
    },
    activity: {
      total: 3, calls: 3, calls_with_outcome: 2, calls_answered: 1, connect_rate: 50,
      by_type: [{ type: "phone_call", label: "Phone call", count: 3 }],
      by_outcome: { done: 1, not_now: 0, no_answer: 1, none: 1 },
      by_day: [{ date: "2026-11-26", total: 3, calls: 3 }],
    },
    contacts: { total: 0, pipelines: [pipeline("consumer"), pipeline("partner"), pipeline("dealer")], needs_action: 0, needs_action_items: [], loss_reasons: [] },
    recent: [], unassigned_leads: null, qualified_with_telecaller: null, newly_assigned: [], team: null, employees: null,
    whatsapp: { unread_conversations: 0, unread_items: [], sent_in_period: 0 }, whatsapp_setup: null,
    ...overrides,
  };
}

const headSummary = () => summary({
  view: "head", employee_id: null, newly_assigned: null,
  unassigned_leads: { count: 2, items: [] }, qualified_with_telecaller: { count: 0, items: [] },
  team: [{ employee_id: 4, name: "Cara", role: "tele_caller", role_name: "Tele Caller", open_leads: 5, activities: 9, calls: 7, followups_completed: 2, overdue: 3, converted: 0 }],
  employees: [{ id: 4, name: "Cara", role: "tele_caller" }],
});

beforeEach(() => {
  auth.user = { id: 3, name: "Anu", role: "sales_executive" };
  vi.mocked(getDashboardSummary).mockResolvedValue(summary());
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("DashboardView", () => {
  it("shows a sales executive their agenda with call, WhatsApp, log and complete, and no team filter", async () => {
    render(<DashboardView />);

    const queue = await screen.findByRole("list", { name: "Follow-ups to do" });
    expect(screen.getByRole("heading", { name: "Today's agenda" })).toBeTruthy();
    expect(within(queue).getByRole("link", { name: "Call Ravi Kumar" }).getAttribute("href")).toBe("tel:+919800000001");
    expect(within(queue).getByRole("link", { name: "WhatsApp Ravi Kumar" }).getAttribute("href")).toBe("https://wa.me/919800000001");
    expect(within(queue).getByRole("link", { name: "Ravi Kumar" }).getAttribute("href")).toBe("/dashboard/leads?lead=5");
    expect(screen.queryByLabelText("Employee")).toBeNull();
    expect(screen.queryByText("Telecallers")).toBeNull();
    expect(vi.mocked(getDashboardSummary).mock.calls[0][1]).toMatchObject({ period: "30d", assignedTo: null });
  });

  it("opens the complete form and the log form, and reloads after saving", async () => {
    render(<DashboardView />);

    fireEvent.click(await screen.findByRole("button", { name: "Complete follow-up for Ravi Kumar" }));
    expect(screen.getByText("complete form 11")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Log activity for Ravi Kumar" }));
    fireEvent.click(screen.getByRole("button", { name: "save log for Ravi Kumar" }));

    await waitFor(() => expect(getDashboardSummary).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole("button", { name: "save log for Ravi Kumar" })).toBeNull();
  });

  it("does not offer to complete a contact follow-up or someone else's", async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(summary({
      followups: {
        overdue: 2, today: 0, upcoming: 0, completed_in_period: 0, due_total: 2,
        queue: [queueItem({ id: 1, entity_type: "contact", name: "Meera" }), queueItem({ id: 2, assigned_to: 9, name: "Joseph" })],
      },
    }));
    render(<DashboardView />);

    await screen.findByText("Meera");
    expect(screen.queryByRole("button", { name: /Complete follow-up/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Log activity for Meera" }));
    expect(screen.getByText("contact log for Meera")).toBeTruthy();
  });

  it("shows eight follow-ups until asked for the rest", async () => {
    const queue = Array.from({ length: 11 }, (_, i) => queueItem({ id: i + 1, name: `Person ${i + 1}` }));
    vi.mocked(getDashboardSummary).mockResolvedValue(summary({
      followups: { overdue: 11, today: 0, upcoming: 0, completed_in_period: 0, due_total: 25, queue },
    }));
    render(<DashboardView />);

    const list = await screen.findByRole("list", { name: "Follow-ups to do" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByText("The oldest 11 of 25 are listed here.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(11);
  });

  it("shows a telecaller the call queue and connect rate", async () => {
    auth.user = { id: 3, name: "Cara", role: "tele_caller" };
    vi.mocked(getDashboardSummary).mockResolvedValue(summary({ view: "telecaller" }));
    render(<DashboardView />);

    expect(await screen.findByRole("heading", { name: "Call queue" })).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("1 answered of 2 calls with an outcome")).toBeTruthy();
  });

  it("lets admin pick an employee from the filter or the team table", async () => {
    auth.user = { id: 1, name: "Ada", role: "admin" };
    vi.mocked(getDashboardSummary).mockResolvedValue(headSummary());
    render(<DashboardView />);

    expect(await screen.findByRole("heading", { name: "Telecallers" })).toBeTruthy();
    expect(screen.getByText("Unassigned leads", { selector: "span" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Show only Cara" })[0]);

    await waitFor(() => expect(vi.mocked(getDashboardSummary).mock.lastCall?.[1]).toMatchObject({ assignedTo: 4 }));
  });

  it("asks for a custom range only once both dates are chosen", async () => {
    render(<DashboardView />);
    await screen.findByRole("list", { name: "Follow-ups to do" });

    fireEvent.change(screen.getByLabelText("Dates"), { target: { value: "custom" } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getDashboardSummary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Last 90 days" }));

    await waitFor(() => expect(getDashboardSummary).toHaveBeenCalledTimes(2));
    expect(vi.mocked(getDashboardSummary).mock.lastCall?.[1]).toMatchObject({ period: "custom" });
  });

  it("shows the error and loads again on request", async () => {
    vi.mocked(getDashboardSummary).mockRejectedValueOnce(new ApiError("server", "The server ran into a problem.", 500));
    render(<DashboardView />);

    expect((await screen.findByRole("alert")).textContent).toContain("The server ran into a problem.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ravi Kumar")).toBeTruthy();
  });

  it("signs the person out when the session has expired", async () => {
    vi.mocked(getDashboardSummary).mockRejectedValueOnce(new ApiError("invalid_credentials", "Your session has expired.", 401));
    render(<DashboardView />);

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/"));
    expect(auth.clearSession).toHaveBeenCalled();
  });

  it("offers no retry when access is refused", async () => {
    vi.mocked(getDashboardSummary).mockRejectedValueOnce(new ApiError("forbidden", "You don't have permission to do that.", 403));
    render(<DashboardView />);

    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("refreshes when the connection comes back", async () => {
    render(<DashboardView />);
    await screen.findByRole("list", { name: "Follow-ups to do" });

    window.dispatchEvent(new Event("online"));

    await waitFor(() => expect(getDashboardSummary).toHaveBeenCalledTimes(2));
  });

  it("closes the complete form with Escape", async () => {
    render(<DashboardView />);
    fireEvent.click(await screen.findByRole("button", { name: "Complete follow-up for Ravi Kumar" }));

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("dashboard formatting", () => {
  const now = new Date("2026-11-26T10:00:00Z");

  it("says how late a follow-up is or when it is due", () => {
    expect(dueText("2026-11-26T09:30:00Z", now)).toBe("30 min late");
    expect(dueText("2026-11-26T05:00:00+00:00", now)).toBe("5 h late");
    expect(dueText("2026-11-24T10:00:00", now)).toBe("2 days late");
    expect(dueText("2026-11-26T11:00:00Z", now)).toMatch(/^Today, 4:30/);
    expect(agoText("2026-11-26T09:55:00Z", now)).toBe("5 min ago");
  });

  it("builds WhatsApp links and round axis tops", () => {
    expect(whatsAppUrl("98000 00001")).toBe("https://wa.me/919800000001");
    expect(whatsAppUrl("+971501234567")).toBe("https://wa.me/971501234567");
    expect([niceMax(0), niceMax(5), niceMax(7), niceMax(18), niceMax(130)]).toEqual([4, 6, 8, 20, 200]);
  });
});
