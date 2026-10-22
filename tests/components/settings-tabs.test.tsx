// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountTab from "@/components/settings/AccountTab";
import { changePassword } from "@/lib/api/settings";

vi.mock("@/lib/api/settings", () => ({
  changePassword: vi.fn(),
  updateMe: vi.fn(),
}));

const profile = { id: 7, name: "Sam Sales", email: "sam@example.com", role: "sales_executive" };

beforeEach(() => {
  sessionStorage.setItem("ogera_access_token", "token-123");
  vi.mocked(changePassword).mockResolvedValue({ message: "Password changed" });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("AccountTab password form", () => {
  it("keeps Update disabled until the current password is typed and the new one is valid and matches", () => {
    render(<AccountTab profile={profile} />);
    const update = screen.getByRole("button", { name: "Update Password" }) as HTMLButtonElement;
    expect(update.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "Sam2026" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "abcdefgh" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "abcdefgh" } });
    expect(screen.getByText("Needs a letter and a number")).toBeTruthy();
    expect(update.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "Kerala2026" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "Kerala2026" } });
    expect(update.disabled).toBe(false);
  });

  it("sends the change and reports the emailed confirmation", async () => {
    render(<AccountTab profile={profile} />);
    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "Sam2026" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "Kerala2026" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "Kerala2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith("token-123", { current_password: "Sam2026", new_password: "Kerala2026" }));
    expect(await screen.findByText(/We emailed you a confirmation/)).toBeTruthy();
  });
});
