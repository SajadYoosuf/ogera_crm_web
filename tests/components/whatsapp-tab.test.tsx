// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WhatsAppTab from "@/components/settings/WhatsAppTab";
import {
  disconnectWhatsApp,
  getWhatsAppConfig,
  rotateWhatsAppVerifyToken,
  saveWhatsAppConfig,
  subscribeWhatsApp,
  testWhatsAppConnection,
  type WhatsAppConfig,
} from "@/features/whatsapp/api/config";
import { ApiError } from "@/lib/api/auth";

const TOKEN = "jwt";
let permissions: Record<string, string> = { integrations: "crud" };

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ token: TOKEN, user: { id: 1, name: "Ada", role: "admin", permissions } }),
}));
vi.mock("@/features/whatsapp/api/config", () => ({
  getWhatsAppConfig: vi.fn(), saveWhatsAppConfig: vi.fn(), testWhatsAppConnection: vi.fn(),
  subscribeWhatsApp: vi.fn(), rotateWhatsAppVerifyToken: vi.fn(), disconnectWhatsApp: vi.fn(),
}));

const empty: WhatsAppConfig = {
  configured: false, phone_number_id: null, waba_id: null, app_id: null, business_id: null, api_version: "v21.0",
  has_access_token: false, access_token_hint: null, has_app_secret: false, verify_token: null,
  webhook_url: "https://api.example.com/webhooks/whatsapp", display_phone_number: null, verified_name: null,
  quality_rating: null, status: "disconnected", connected_at: null, last_checked_at: null, last_error: null,
};
const saved: WhatsAppConfig = {
  ...empty, configured: true, phone_number_id: "1234567890123", waba_id: "9876543210987", app_id: "1112223334445",
  has_access_token: true, access_token_hint: "EAAG…x7Qz", has_app_secret: true, verify_token: "verify-abc",
};

beforeEach(() => {
  permissions = { integrations: "crud" };
  vi.mocked(getWhatsAppConfig).mockResolvedValue(empty);
  vi.mocked(saveWhatsAppConfig).mockResolvedValue(saved);
  vi.mocked(testWhatsAppConnection).mockResolvedValue({
    ok: true, status: "connected", detail: "Connected",
    config: { ...saved, status: "connected", display_phone_number: "+91 90000 00001", verified_name: "Ventino", quality_rating: "GREEN" },
  });
  vi.mocked(subscribeWhatsApp).mockResolvedValue({ ok: true, detail: "Subscribed" });
  vi.mocked(rotateWhatsAppVerifyToken).mockResolvedValue({ ...saved, verify_token: "verify-new" });
  vi.mocked(disconnectWhatsApp).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const saveButton = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

describe("WhatsAppTab", () => {
  it("shows a not-connected state and no connection actions before anything is saved", async () => {
    render(<WhatsAppTab />);
    expect((await screen.findByTestId("wa-status")).textContent).toBe("Not connected");
    expect(screen.queryByRole("button", { name: "Test connection" })).toBeNull();
    expect(screen.getByText(/Save your credentials to get the callback URL/)).toBeTruthy();
  });

  it("will not save until both IDs are digits and the access token is entered", async () => {
    render(<WhatsAppTab />);
    await screen.findByTestId("wa-status");
    expect(saveButton().disabled).toBe(true);

    fill("Phone number ID", "abc");
    expect(screen.getAllByText("Digits only, at least 5.").length).toBe(1);
    fill("Phone number ID", "1234567890123");
    fill("WhatsApp Business Account ID", "9876543210987");
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("Enter the access token to save.")).toBeTruthy();

    fill("Access token", "EAAGsecret");
    expect(saveButton().disabled).toBe(false);
  });

  it("sends the trimmed values and never keeps the secrets in the form after saving", async () => {
    render(<WhatsAppTab />);
    await screen.findByTestId("wa-status");
    fill("Phone number ID", " 1234567890123 ");
    fill("WhatsApp Business Account ID", "9876543210987");
    fill("Access token", " EAAGsecret ");
    fill("App secret", "appsecret");
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveWhatsAppConfig).toHaveBeenCalledWith(TOKEN, {
      phone_number_id: "1234567890123", waba_id: "9876543210987", app_id: "", business_id: "",
      api_version: "v21.0", access_token: "EAAGsecret", app_secret: "appsecret",
    }));
    await screen.findByText(/Saved\. Use Test connection/);
    expect((screen.getByLabelText("Access token") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("App secret") as HTMLInputElement).value).toBe("");
    expect(screen.getByTestId("wa-verify-token").textContent).toBe("verify-abc");
  });

  it("keeps the saved token when the field is left blank on a later save", async () => {
    vi.mocked(getWhatsAppConfig).mockResolvedValue(saved);
    render(<WhatsAppTab />);
    await screen.findByTestId("wa-status");
    expect((screen.getByLabelText("Access token") as HTMLInputElement).placeholder).toContain("EAAG…x7Qz");
    fill("API version", "v22.0");
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveWhatsAppConfig).toHaveBeenCalled());
    const sent = vi.mocked(saveWhatsAppConfig).mock.calls[0][1];
    expect(sent.api_version).toBe("v22.0");
    expect("access_token" in sent).toBe(false);
    expect("app_secret" in sent).toBe(false);
  });

  it("tests the connection and shows what Meta reported", async () => {
    vi.mocked(getWhatsAppConfig).mockResolvedValue(saved);
    render(<WhatsAppTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
    await screen.findByText("Connected to WhatsApp.");
    expect(screen.getByTestId("wa-status").textContent).toBe("Connected");
    expect(screen.getByText("+91 90000 00001")).toBeTruthy();
    expect(screen.getByText("GREEN")).toBeTruthy();
  });

  it("shows Meta's error when the test fails", async () => {
    vi.mocked(getWhatsAppConfig).mockResolvedValue(saved);
    vi.mocked(testWhatsAppConnection).mockResolvedValue({
      ok: false, status: "error", detail: "Phone number check failed: Invalid OAuth access token",
      config: { ...saved, status: "error", last_error: "Phone number check failed: Invalid OAuth access token" },
    });
    render(<WhatsAppTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(screen.getByTestId("wa-status").textContent).toBe("Connection error"));
    expect(screen.getAllByText(/Invalid OAuth access token/).length).toBeGreaterThan(0);
  });

  it("shows the API's sentence when saving is refused", async () => {
    vi.mocked(saveWhatsAppConfig).mockRejectedValue(new ApiError("unknown", "This WhatsApp Business Account is already connected to another company", 409));
    render(<WhatsAppTab />);
    await screen.findByTestId("wa-status");
    fill("Phone number ID", "1234567890123");
    fill("WhatsApp Business Account ID", "9876543210987");
    fill("Access token", "EAAGsecret");
    fireEvent.click(saveButton());
    await screen.findByText("This WhatsApp Business Account is already connected to another company");
  });

  it("asks before generating a new verify token and before disconnecting", async () => {
    vi.mocked(getWhatsAppConfig).mockResolvedValue(saved);
    render(<WhatsAppTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Generate a new verify token" }));
    expect(rotateWhatsAppVerifyToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(screen.getByTestId("wa-verify-token").textContent).toBe("verify-new"));

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(disconnectWhatsApp).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Disconnect" })[0]);
    await waitFor(() => expect(disconnectWhatsApp).toHaveBeenCalledWith(TOKEN));
    await screen.findByText(/WhatsApp disconnected/);
    expect(screen.getByTestId("wa-status").textContent).toBe("Not connected");
  });

  it("is read-only for someone without update permission", async () => {
    permissions = { integrations: "r" };
    vi.mocked(getWhatsAppConfig).mockResolvedValue(saved);
    render(<WhatsAppTab />);
    await screen.findByText(/view these settings but not change them/);
    expect((screen.getByLabelText("Phone number ID") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Test connection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Generate a new verify token" })).toBeNull();
  });

  it("offers a retry when the settings cannot be loaded", async () => {
    vi.mocked(getWhatsAppConfig).mockRejectedValueOnce(new ApiError("network", "Cannot reach the server.", 0));
    render(<WhatsAppTab />);
    await screen.findByText("Cannot reach the server.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByTestId("wa-status");
  });
});
