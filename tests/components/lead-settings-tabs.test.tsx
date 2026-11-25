// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeadStatusesTab from "@/components/settings/LeadStatusesTab";
import IntegrationsTab, { appsScriptSnippet, tenantSlugFromToken, websiteSnippet } from "@/components/settings/IntegrationsTab";
import { visibleSettingsTabs } from "@/components/settings/SettingsView";
import { createLeadStatus, deleteLeadStatus, listLeadStatusRows, updateLeadStatus, type LeadStatusRow } from "@/features/leads/api/leadSettings";
import { createApiKey, listApiKeys, revealApiKey, revokeApiKey } from "@/features/leads/api/leads";
import { ApiError } from "@/lib/api/auth";

// JWT with payload {"sub":"1","tenant":"ventino"}
const TOKEN = `x.${btoa(JSON.stringify({ sub: "1", tenant: "ventino" }))}.y`;

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: TOKEN, user: { id: 1, name: "Ada", role: "admin" } }) }));
vi.mock("@/features/leads/api/leadSettings", async (orig) => ({
  ...(await orig<typeof import("@/features/leads/api/leadSettings")>()),
  listLeadStatusRows: vi.fn(), createLeadStatus: vi.fn(), updateLeadStatus: vi.fn(), deleteLeadStatus: vi.fn(),
}));
vi.mock("@/features/leads/api/leads", async (orig) => ({
  ...(await orig<typeof import("@/features/leads/api/leads")>()),
  listApiKeys: vi.fn(), createApiKey: vi.fn(), revokeApiKey: vi.fn(), revealApiKey: vi.fn(),
}));

const row = (id: number, slug: string, name: string, extra: Partial<LeadStatusRow> = {}): LeadStatusRow =>
  ({ id, slug, name, sort_order: id, is_active: true, locked: slug === "new" || slug === "converted", created_at: "", ...extra });

beforeEach(() => {
  vi.mocked(listLeadStatusRows).mockResolvedValue([row(1, "new", "New"), row(2, "contacted", "Contacted"), row(3, "lost", "Lost")]);
  vi.mocked(createLeadStatus).mockResolvedValue(row(4, "hot", "Hot"));
  vi.mocked(updateLeadStatus).mockResolvedValue(row(2, "contacted", "Contacted"));
  vi.mocked(deleteLeadStatus).mockResolvedValue(undefined);
  vi.mocked(listApiKeys).mockResolvedValue([{ id: 9, label: "Website", is_active: true, created_at: "2026-11-01T00:00:00Z", can_reveal: true }]);
  vi.mocked(createApiKey).mockResolvedValue({ id: 10, label: "Sheet", is_active: true, created_at: "2026-11-24T00:00:00Z", can_reveal: true, raw_key: "a".repeat(64) });
  vi.mocked(revealApiKey).mockResolvedValue({ id: 9, raw_key: "b".repeat(64) });
  vi.mocked(revokeApiKey).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Settings tab visibility", () => {
  it("staff see Account only; managers add Integrations, WhatsApp and Follow-ups; admins see all eight", () => {
    const staff = { role: "sales_executive", permissions: { leads: "cru", company: "", team: "", integrations: "", lead_statuses: "" } };
    const manager = { role: "manager", permissions: { leads: "crud", company: "", team: "", integrations: "ru", lead_statuses: "" } };
    const admin = { role: "admin", permissions: { leads: "crud", company: "crud", team: "crud", integrations: "crud", lead_statuses: "crud" } };
    expect(visibleSettingsTabs(staff).map((t) => t.key)).toEqual(["account"]);
    expect(visibleSettingsTabs(manager).map((t) => t.key)).toEqual(["account", "integrations", "whatsapp", "templates", "followups"]);
    expect(visibleSettingsTabs(admin).map((t) => t.key)).toEqual(["general", "account", "team", "integrations", "whatsapp", "templates", "lead_statuses", "followups"]);
  });
});

describe("LeadStatusesTab", () => {
  it("locked statuses have no delete or hide", async () => {
    render(<LeadStatusesTab />);
    await screen.findByText("Contacted");
    expect(screen.queryByRole("button", { name: "Delete New" })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete Contacted" })).toBeTruthy();
  });

  it("blocks a duplicate name, ignoring case", async () => {
    render(<LeadStatusesTab />);
    await screen.findByText("Contacted");
    fireEvent.change(screen.getByLabelText("New status name"), { target: { value: "contacted" } });
    expect(screen.getByText("A status with this name already exists.")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Add status/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("adds a status at the end of the list", async () => {
    render(<LeadStatusesTab />);
    await screen.findByText("Contacted");
    fireEvent.change(screen.getByLabelText("New status name"), { target: { value: "  Hot  " } });
    fireEvent.click(screen.getByRole("button", { name: /Add status/ }));
    await waitFor(() => expect(createLeadStatus).toHaveBeenCalledWith(TOKEN, "Hot", 4));
  });

  it("shows the 409 message when deleting a status in use", async () => {
    vi.mocked(deleteLeadStatus).mockRejectedValueOnce(new ApiError("unknown","3 lead(s) are using this status. Reassign them first.", 409));
    render(<LeadStatusesTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Contacted" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect((await screen.findByRole("alert")).textContent).toContain("3 lead(s) are using this status");
  });

  it("disables adding at 20 active statuses", async () => {
    vi.mocked(listLeadStatusRows).mockResolvedValue(Array.from({ length: 20 }, (_, i) => row(i + 1, `s${i}`, `Stage ${i}`)));
    render(<LeadStatusesTab />);
    await screen.findByText("Stage 0");
    fireEvent.change(screen.getByLabelText("New status name"), { target: { value: "One more" } });
    expect((screen.getByRole("button", { name: /Add status/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/20 active statuses/)).toBeTruthy();
  });
});

describe("IntegrationsTab", () => {
  it("reads the tenant slug from the token", () => {
    expect(tenantSlugFromToken(TOKEN)).toBe("ventino");
    expect(tenantSlugFromToken("garbage")).toBe("");
    expect(tenantSlugFromToken(null)).toBe("");
  });

  it("snippets point at the right inbound URL with the key header", () => {
    expect(websiteSnippet("https://api.x", "ventino", "K")).toContain("https://api.x/leads/inbound/website/ventino");
    expect(websiteSnippet("https://api.x", "ventino", "K")).toContain('"X-Api-Key": "K"');
    expect(appsScriptSnippet("https://api.x", "ventino", "K")).toContain("https://api.x/leads/inbound/sheet/ventino");
  });

  it("shows a newly created key once, then hides it", async () => {
    render(<IntegrationsTab />);
    await screen.findByText("Website");
    fireEvent.change(screen.getByLabelText("Key label"), { target: { value: "Sheet" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate key" }));
    expect((await screen.findByTestId("new-api-key")).textContent).toBe("a".repeat(64));
    expect(createApiKey).toHaveBeenCalledWith(TOKEN, "Sheet");
    fireEvent.click(screen.getByRole("button", { name: /saved it/ }));
    expect(screen.queryByTestId("new-api-key")).toBeNull();
  });

  it("copies a stored key from its row", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<IntegrationsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy key" }));
    await waitFor(() => expect(revealApiKey).toHaveBeenCalledWith(TOKEN, 9));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("b".repeat(64)));
  });

  it("shows no copy button for a key created before copying existed", async () => {
    vi.mocked(listApiKeys).mockResolvedValueOnce([{ id: 9, label: "Old", is_active: true, created_at: "2026-01-01T00:00:00Z", can_reveal: false }]);
    render(<IntegrationsTab />);
    await screen.findByText("Old");
    expect(screen.queryByRole("button", { name: "Copy key" })).toBeNull();
  });

  it("revokes after confirmation", async () => {
    render(<IntegrationsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Revoke" })[0]);
    await waitFor(() => expect(revokeApiKey).toHaveBeenCalledWith(TOKEN, 9));
  });
});
