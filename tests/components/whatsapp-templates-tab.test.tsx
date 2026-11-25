// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TemplatesTab from "@/components/settings/TemplatesTab";
import {
  createTemplate,
  deleteTemplate,
  fillSamples,
  listTemplates,
  submitTemplate,
  syncTemplates,
  updateTemplate,
  variableIndices,
  type WhatsAppTemplate,
} from "@/features/whatsapp/api/templates";
import { ApiError } from "@/lib/api/auth";

const TOKEN = "jwt";
let permissions: Record<string, string> = { integrations: "crud" };

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ token: TOKEN, user: { id: 1, name: "Ada", role: "admin", permissions } }),
}));
vi.mock("@/features/whatsapp/api/templates", async (orig) => ({
  ...(await orig<typeof import("@/features/whatsapp/api/templates")>()),
  listTemplates: vi.fn(), createTemplate: vi.fn(), updateTemplate: vi.fn(),
  submitTemplate: vi.fn(), syncTemplates: vi.fn(), deleteTemplate: vi.fn(),
}));

const tpl = (id: number, name: string, extra: Partial<WhatsAppTemplate> = {}): WhatsAppTemplate => ({
  id, name, language: "en_US", category: "UTILITY", body_text: "Hi {{1}}", status: "DRAFT",
  meta_template_id: null, rejection_reason: null, quality_score: null, submission_error: null,
  last_submitted_at: null, created_at: "2026-11-25T00:00:00Z", updated_at: null,
  body_variable_count: 1, header_variable_count: 0, can_edit: true, can_submit: true,
  sample_values: { body: ["Anu"], header: [] }, ...extra,
});

const draft = tpl(1, "welcome_draft");
const approved = tpl(2, "order_update", { status: "APPROVED", meta_template_id: "555", can_submit: false, quality_score: "GREEN" });
const rejected = tpl(3, "promo", { status: "REJECTED", meta_template_id: "556", can_submit: false, rejection_reason: "INVALID_FORMAT", submission_error: "Bad example" });
const pending = tpl(4, "in_review", { status: "PENDING", meta_template_id: "557", can_submit: false, can_edit: false });

beforeEach(() => {
  permissions = { integrations: "crud" };
  vi.mocked(listTemplates).mockResolvedValue({ items: [draft, approved, rejected, pending], total: 4 });
  vi.mocked(createTemplate).mockResolvedValue(draft);
  vi.mocked(updateTemplate).mockResolvedValue(approved);
  vi.mocked(submitTemplate).mockResolvedValue({ ...draft, status: "PENDING", meta_template_id: "900" });
  vi.mocked(syncTemplates).mockResolvedValue({ fetched: 5, created: 2, updated: 3 });
  vi.mocked(deleteTemplate).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("template helpers", () => {
  it("finds variables and fills samples", () => {
    expect(variableIndices("Hi {{2}} and {{1}} and {{2}}")).toEqual([1, 2]);
    expect(fillSamples("Hi {{1}}, order {{2}}", ["Anu"])).toBe("Hi Anu, order {{2}}");
  });
});

describe("TemplatesTab list", () => {
  it("shows each template with its Meta status, the quality dot and Meta's reasons", async () => {
    render(<TemplatesTab />);
    await screen.findByText("welcome_draft");
    expect(screen.getByTestId("tpl-status-1").textContent).toBe("Draft");
    expect(screen.getByTestId("tpl-status-2").textContent).toBe("Approved");
    expect(screen.getByTestId("tpl-status-3").textContent).toBe("Rejected");
    expect(screen.getByTestId("tpl-status-4").textContent).toBe("In review");
    expect(screen.getByTitle("Quality: GREEN")).toBeTruthy();
    expect(screen.getByText(/Meta.s reason: INVALID_FORMAT/)).toBeTruthy();
    expect(screen.getByText(/Last error from Meta: Bad example/)).toBeTruthy();
  });

  it("only drafts can be sent, and templates under review cannot be edited", async () => {
    render(<TemplatesTab />);
    await screen.findByText("welcome_draft");
    expect(screen.getAllByRole("button", { name: "Send to Meta" }).length).toBe(1);
    expect(screen.getByRole("button", { name: "Edit order_update" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit in_review" })).toBeNull();
  });

  it("filters by status and by name", async () => {
    render(<TemplatesTab />);
    await screen.findByText("welcome_draft");
    fireEvent.click(screen.getByRole("button", { name: "Approved" }));
    expect(screen.queryByText("welcome_draft")).toBeNull();
    expect(screen.getByText("order_update")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByLabelText("Search templates"), { target: { value: "PROMO" } });
    expect(screen.getByText("promo")).toBeTruthy();
    expect(screen.queryByText("order_update")).toBeNull();
  });

  it("sends a draft to Meta from the list", async () => {
    render(<TemplatesTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Send to Meta" }));
    await waitFor(() => expect(submitTemplate).toHaveBeenCalledWith(TOKEN, 1));
    await screen.findByText("Sent to Meta for review.");
  });

  it("asks before deleting and says when it also deletes on Meta", async () => {
    render(<TemplatesTab />);
    await screen.findByText("welcome_draft");
    fireEvent.click(screen.getByRole("button", { name: "Delete order_update" }));
    expect(deleteTemplate).not.toHaveBeenCalled();
    expect(screen.getByText("Delete here and on Meta?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteTemplate).toHaveBeenCalledWith(TOKEN, 2));
    await screen.findByText("Template deleted.");
  });

  it("syncs from Meta and reports the counts", async () => {
    render(<TemplatesTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Sync from Meta" }));
    await screen.findByText("Synced 5 templates from Meta (2 new, 3 updated).");
    expect(listTemplates).toHaveBeenCalledTimes(2);
  });

  it("is read-only without update permission", async () => {
    permissions = { integrations: "r" };
    render(<TemplatesTab />);
    await screen.findByText(/view templates but not change them/);
    expect(screen.queryByRole("button", { name: "New template" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sync from Meta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send to Meta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete order_update" })).toBeNull();
  });

  it("offers a retry when the list cannot be loaded, and an empty-state message", async () => {
    vi.mocked(listTemplates).mockRejectedValueOnce(new ApiError("network", "Cannot reach the server.", 0));
    render(<TemplatesTab />);
    await screen.findByText("Cannot reach the server.");
    vi.mocked(listTemplates).mockResolvedValue({ items: [], total: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText(/No templates yet/);
  });
});

describe("TemplateEditor", () => {
  async function openNew() {
    render(<TemplatesTab />);
    fireEvent.click(await screen.findByRole("button", { name: "New template" }));
    await screen.findByLabelText("Template name");
  }

  it("cannot be saved until it has a name and a body", async () => {
    await openNew();
    const save = screen.getByRole("button", { name: "Save draft" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "order_update" } });
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Hello" } });
    expect(save.disabled).toBe(false);
  });

  it("turns a typed name into Meta's format", async () => {
    await openNew();
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Order Update-Now" } });
    expect((screen.getByLabelText("Template name") as HTMLInputElement).value).toBe("order_update_now");
  });

  it("adds a sample box per variable and previews the message with the samples", async () => {
    await openNew();
    fireEvent.click(screen.getByRole("button", { name: "Add variable" }));
    fireEvent.click(screen.getByRole("button", { name: "Add variable" }));
    expect((screen.getByLabelText("Body") as HTMLTextAreaElement).value).toBe("{{1}}{{2}}");
    fireEvent.change(screen.getByLabelText("Sample for {{1}}"), { target: { value: "Anu" } });
    expect(screen.getByTestId("tpl-preview-body").textContent).toBe("Anu{{2}}");
    fireEvent.change(screen.getByLabelText("Sample for {{2}}"), { target: { value: "A100" } });
    expect(screen.getByTestId("tpl-preview-body").textContent).toBe("AnuA100");
  });

  it("saves a draft with one sample value per variable, the buttons and the header", async () => {
    await openNew();
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "order_update" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Hi {{1}}, order {{2}} is ready" } });
    fireEvent.change(screen.getByLabelText("Sample for {{1}}"), { target: { value: "Anu" } });
    fireEvent.change(screen.getByLabelText("Sample for {{2}}"), { target: { value: "A100" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "text" } });
    fireEvent.change(screen.getByLabelText("Header text"), { target: { value: "Order {{1}}" } });
    fireEvent.change(screen.getByLabelText("Sample for {{1}} in the header"), { target: { value: "A100" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Quick reply" }));
    fireEvent.change(screen.getByLabelText("Button 1 text"), { target: { value: "Thanks" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(createTemplate).toHaveBeenCalled());
    expect(vi.mocked(createTemplate).mock.calls[0][1]).toMatchObject({
      name: "order_update", language: "en_US", category: "MARKETING", header_type: "text", header_content: "Order {{1}}",
      body_text: "Hi {{1}}, order {{2}} is ready", buttons: [{ type: "QUICK_REPLY", text: "Thanks" }],
      sample_values: { body: ["Anu", "A100"], header: ["A100"] },
    });
    expect(submitTemplate).not.toHaveBeenCalled();
    await screen.findByText("Draft saved.");
  });

  it("saves and sends to Meta in one step", async () => {
    await openNew();
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "hello" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Hello there" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and send to Meta" }));
    await waitFor(() => expect(submitTemplate).toHaveBeenCalledWith(TOKEN, 1));
    await screen.findByText("Sent to Meta for review.");
  });

  it("shows the server's rule sentence and stays on the form", async () => {
    vi.mocked(createTemplate).mockRejectedValue(new ApiError("validation", "The body has 1 variable(s) but 0 sample value(s) were given.", 422));
    await openNew();
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "hello" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Hi {{1}}" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("The body has 1 variable(s) but 0 sample value(s) were given.");
    expect(screen.getByLabelText("Template name")).toBeTruthy();
  });

  it("locks name and language of a submitted template and warns that it is reviewed again", async () => {
    render(<TemplatesTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit order_update" }));
    const name = (await screen.findByLabelText("Template name")) as HTMLInputElement;
    expect(name.disabled).toBe(true);
    expect((screen.getByLabelText("Language") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/already with Meta/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save and send to Meta" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save and resubmit to Meta" }));
    await waitFor(() => expect(updateTemplate).toHaveBeenCalledWith(TOKEN, 2, expect.objectContaining({ name: "order_update" })));
    await screen.findByText("Saved and sent to Meta for a new review.");
  });

  it("limits the buttons the way Meta does and removes one on request", async () => {
    await openNew();
    fireEvent.click(screen.getByRole("button", { name: "+ Call phone number" }));
    expect((screen.getByRole("button", { name: "+ Call phone number" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "+ Visit website" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Visit website" }));
    expect((screen.getByRole("button", { name: "+ Visit website" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove button 1" }));
    expect(screen.queryByLabelText("Button 3 text")).toBeNull();
    expect((screen.getByRole("button", { name: "+ Call phone number" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("goes back to the list on cancel without saving", async () => {
    await openNew();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText("welcome_draft");
    expect(createTemplate).not.toHaveBeenCalled();
  });
});
