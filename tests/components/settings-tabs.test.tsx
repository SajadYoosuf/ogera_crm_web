// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountTab from "@/components/settings/AccountTab";
import RolesTab from "@/components/settings/RolesTab";
import { changePassword, getPermissionMatrix, listRoles, setRolePermission, type PermissionMatrix } from "@/lib/api/settings";

vi.mock("@/lib/api/settings", () => ({
  changePassword: vi.fn(),
  updateMe: vi.fn(),
  getPermissionMatrix: vi.fn(),
  listRoles: vi.fn(),
  setRolePermission: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
}));

const profile = { id: 7, name: "Sam Support", email: "sam@example.com", role: "support" };

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

describe("RolesTab editable cells", () => {
  const matrix: PermissionMatrix = {
    roles: [
      { slug: "admin", name: "Admin", is_system: true, is_active: true },
      { slug: "team_lead", name: "Team Lead", is_system: true, is_active: true },
    ],
    features: [
      {
        key: "export",
        label: "Export contacts",
        description: "Download contacts",
        action: "export",
        levels: {
          admin: { level: "full", note: null, editable: false },
          team_lead: { level: "team", note: "Their team's contacts", editable: true },
        },
      },
      {
        key: "employees",
        label: "Employees",
        description: "Add staff",
        action: null,
        levels: {
          admin: { level: "full", note: null, editable: false },
          team_lead: { level: "none", note: null, editable: false },
        },
      },
    ],
  };

  it("opens the level menu, lets only Full or No access be picked, and redraws from the returned matrix", async () => {
    vi.mocked(getPermissionMatrix).mockResolvedValue(matrix);
    vi.mocked(listRoles).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(setRolePermission).mockResolvedValue({
      ...matrix,
      features: [
        { ...matrix.features[0], levels: { ...matrix.features[0].levels, team_lead: { level: "none", note: "Turned off in Settings", editable: true } } },
        matrix.features[1],
      ],
    });

    render(<RolesTab canEdit={true} />);
    const trigger = await screen.findByRole("button", { name: "Export contacts for Team Lead" });
    expect(trigger.textContent).toContain("Team");

    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Export contacts for Team Lead" });
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Full", "View only", "Team", "Own only", "Own + customers", "No access"]);
    expect((items[1] as HTMLButtonElement).disabled).toBe(true);
    expect((items[2] as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(within(menu).getByRole("menuitem", { name: "No access" }));

    await waitFor(() => expect(setRolePermission).toHaveBeenCalledWith("token-123", "team_lead", "export", false));
    await waitFor(() => expect(screen.getByRole("button", { name: "Export contacts for Team Lead" }).textContent).toContain("No access"));
  });

  it("shows fixed rows and admin cells as labels, not switches", async () => {
    vi.mocked(getPermissionMatrix).mockResolvedValue(matrix);
    vi.mocked(listRoles).mockResolvedValue({ items: [], total: 0 });

    render(<RolesTab canEdit={true} />);
    await screen.findByText("Export contacts");

    expect(screen.queryByRole("switch", { name: "Employees for Team Lead" })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Export contacts for Admin" })).toBeNull();
  });
});
