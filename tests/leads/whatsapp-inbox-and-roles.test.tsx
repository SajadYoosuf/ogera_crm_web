// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessageThread from "@/features/whatsapp-inbox/MessageThread";
import { markConversationRead } from "@/features/whatsapp-inbox/api";
import LeadsMoreMenu from "@/features/leads/components/LeadsMoreMenu";
import LeadActionMenu from "@/features/leads/components/LeadActionMenu";
import { listWhatsAppMessages, sendWhatsAppReply, type WhatsAppMessage } from "@/features/leads/api/leadSettings";
import { localDateTimeToIso } from "@/lib/api/interactions";
import { isAdminRole, isHeadRole } from "@/lib/shared/roles";
import { ApiError } from "@/lib/api/auth";

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "tok", user: { id: 3, name: "Anu", role: "sales_executive" } }) }));
vi.mock("@/features/leads/api/leadSettings", async (orig) => ({
  ...(await orig<typeof import("@/features/leads/api/leadSettings")>()),
  listWhatsAppMessages: vi.fn(),
  sendWhatsAppReply: vi.fn(),
}));

vi.mock("@/features/whatsapp-inbox/api", async (orig) => ({
  ...(await orig<typeof import("@/features/whatsapp-inbox/api")>()),
  markConversationRead: vi.fn().mockResolvedValue({ ok: true }),
}));

const msg = (id: number, direction: "in" | "out", body: string, isRead = true): WhatsAppMessage => ({
  id, lead_id: 5, direction, wamid: null, content_type: "text", body, template_name: null, sent_by: null, status: "sent", is_read: isRead, created_at: "2026-11-24T05:00:00Z",
});

const renderThread = (props: Partial<{ hasPhone: boolean; onRead: () => void; onSent: () => void }> = {}) =>
  render(<MessageThread leadId={5} hasPhone onRead={vi.fn()} onSent={vi.fn()} {...props} />);

beforeEach(() => {
  vi.mocked(listWhatsAppMessages).mockResolvedValue([msg(1, "in", "Hi, price?"), msg(2, "out", "Sending details")]);
  vi.mocked(sendWhatsAppReply).mockResolvedValue(msg(3, "out", "Thanks!"));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("MessageThread", () => {
  it("shows the conversation", async () => {
    renderThread();
    expect(await screen.findByText("Hi, price?")).toBeTruthy();
    expect(screen.getByText("Sending details")).toBeTruthy();
  });

  it("marks unread inbound messages as read and tells the parent", async () => {
    vi.mocked(listWhatsAppMessages).mockResolvedValue([msg(1, "in", "Hi, price?", false)]);
    const onRead = vi.fn();
    renderThread({ onRead });
    await screen.findByText("Hi, price?");
    await waitFor(() => expect(markConversationRead).toHaveBeenCalledWith("tok", 5));
    await waitFor(() => expect(onRead).toHaveBeenCalled());
  });

  it("does not call mark-read when everything is already read", async () => {
    renderThread();
    await screen.findByText("Hi, price?");
    expect(markConversationRead).not.toHaveBeenCalled();
  });

  it("shows the 24-hour hint when the customer wrote more than a day ago", async () => {
    const old = { ...msg(1, "in", "Hi, price?"), created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() };
    vi.mocked(listWhatsAppMessages).mockResolvedValue([old]);
    renderThread();
    await screen.findByText("Hi, price?");
    expect(await screen.findByText(/More than 24 hours/)).toBeTruthy();
  });

  it("hides the 24-hour hint when the customer wrote recently", async () => {
    const recent = { ...msg(1, "in", "Hi, price?"), created_at: new Date(Date.now() - 3_600_000).toISOString() };
    vi.mocked(listWhatsAppMessages).mockResolvedValue([recent]);
    renderThread();
    await screen.findByText("Hi, price?");
    expect(screen.queryByText(/More than 24 hours/)).toBeNull();
  });

  it("sends a text reply and appends it", async () => {
    const onSent = vi.fn();
    renderThread({ onSent });
    await screen.findByText("Hi, price?");
    fireEvent.change(screen.getByLabelText("WhatsApp message"), { target: { value: " Thanks! " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(sendWhatsAppReply).toHaveBeenCalledWith("tok", 5, { message: "Thanks!" }));
    expect(await screen.findByText("Thanks!")).toBeTruthy();
    expect(onSent).toHaveBeenCalled();
  });

  it("sends a template with comma-separated values", async () => {
    renderThread();
    await screen.findByText("Hi, price?");
    fireEvent.click(screen.getByRole("tab", { name: "Template" }));
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "welcome" } });
    fireEvent.change(screen.getByLabelText("Template values"), { target: { value: "Asha, 500L" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(sendWhatsAppReply).toHaveBeenCalledWith("tok", 5, { template_name: "welcome", template_params: ["Asha", "500L"] }));
  });

  it("shows the server's error when sending fails", async () => {
    vi.mocked(sendWhatsAppReply).mockRejectedValueOnce(new ApiError("server", "WhatsApp is not configured on this server", 503));
    renderThread();
    await screen.findByText("Hi, price?");
    fireEvent.change(screen.getByLabelText("WhatsApp message"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect((await screen.findByRole("alert")).textContent).toContain("not configured");
  });

  it("cannot send without a phone number", async () => {
    vi.mocked(listWhatsAppMessages).mockResolvedValue([]);
    renderThread({ hasPhone: false });
    expect(await screen.findByText(/No WhatsApp messages/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("WhatsApp message"), { target: { value: "x" } });
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("role helpers and hidden controls", () => {
  it("heads are admin and manager", () => {
    expect(isHeadRole("admin")).toBe(true);
    expect(isHeadRole("manager")).toBe(true);
    expect(isHeadRole("sales_executive")).toBe(false);
    expect(isHeadRole(undefined)).toBe(false);
    expect(isAdminRole("manager")).toBe(false);
  });

  it("the import/export menu has no Export item without onExport", () => {
    render(<LeadsMoreMenu onImport={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Import or export leads" }));
    expect(screen.getByRole("menuitem", { name: "Import leads" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Export leads" })).toBeNull();
  });

  it("the row action menu has no Delete without onDelete", () => {
    const lead = { id: 1, first_name: "A", last_name: null, phone: null, email: null, source_id: null, source_name: null, status: "new", score: 0, tags: null, whatsapp_sent: false, assigned_to: 3, assigned_name: null, created_by: null, created_by_name: null, branch_id: null, branch_name: null, created_at: "", updated_at: "" };
    render(<LeadActionMenu lead={lead} onEdit={vi.fn()} onActivityLog={vi.fn()} onFollowup={vi.fn()} onConvert={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Lead actions" }));
    expect(screen.getByText("Follow-up")).toBeTruthy();
    expect(screen.queryByText("Delete")).toBeNull();
  });
});

describe("localDateTimeToIso", () => {
  it("applies the browser timezone and defaults to 09:00", () => {
    expect(localDateTimeToIso("2026-12-05", "14:30")).toBe(new Date("2026-12-05T14:30:00").toISOString());
    expect(localDateTimeToIso("2026-12-05")).toBe(new Date("2026-12-05T09:00:00").toISOString());
    expect(localDateTimeToIso("2026-12-05").endsWith("Z")).toBe(true);
  });
});
