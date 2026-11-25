// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamTab from "@/components/settings/TeamTab";
import { listRoles } from "@/lib/api/settings";

let currentUser: { role?: string; permissions?: Record<string, string> | null } | null = null;

vi.mock("@/lib/api/settings", () => ({ listRoles: vi.fn(), updateRole: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ token: sessionStorage.getItem("ogera_access_token"), user: currentUser, setSession: vi.fn(), clearSession: vi.fn() }),
}));

beforeEach(() => {
  sessionStorage.setItem("ogera_access_token", "token-123");
  vi.mocked(listRoles).mockResolvedValue({
    items: [
      { id: 1, slug: "manager", name: "Manager", description: null, is_system: true, is_active: true, see_all_records: true, permissions: { leads: "crud" }, employee_count: 1 },
      { id: 2, slug: "sales_executive", name: "Sales Executive", description: null, is_system: true, is_active: true, see_all_records: false, permissions: { leads: "crud" }, employee_count: 3 },
    ],
    total: 2,
  } as never);
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  currentUser = null;
  vi.clearAllMocks();
});

describe("TeamTab", () => {
  it("lists roles only, with no team member list", async () => {
    render(<TeamTab />);
    expect(await screen.findByText("Sales Executive")).toBeTruthy();
    expect(screen.getByText("Roles & Permissions")).toBeTruthy();
    expect(screen.queryByText("Team Members")).toBeNull();
    expect(screen.queryByLabelText(/Role for/)).toBeNull();
  });

  it("hides Edit unless the user can update the team module", async () => {
    currentUser = { role: "manager", permissions: { team: "" } };
    render(<TeamTab />);
    await screen.findByText("Sales Executive");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("shows Edit when the user can update the team module", async () => {
    currentUser = { role: "admin", permissions: { team: "crud" } };
    render(<TeamTab />);
    await screen.findByText("Sales Executive");
    expect(screen.getAllByRole("button", { name: "Edit" }).length).toBe(2);
  });
});
