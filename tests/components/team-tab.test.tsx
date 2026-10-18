// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamTab from "@/components/settings/TeamTab";
import { listAllEmployees, updateEmployee, type Employee } from "@/lib/api/employees";
import { listRoles } from "@/lib/api/settings";

vi.mock("@/lib/api/employees", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/employees")>();
  return { ...actual, listAllEmployees: vi.fn(), updateEmployee: vi.fn() };
});
vi.mock("@/lib/api/settings", () => ({ listRoles: vi.fn() }));

const person = (overrides: Partial<Employee>): Employee => ({
  id: 1, name: "Asha", email: "asha@example.com", role: "sales_executive", is_active: true,
  team_lead_id: null, deleted_at: null, phone: null,
  ...overrides,
} as Employee);

const staff: Employee[] = [
  person({ id: 2, name: "Lead Ravi", role: "team_lead" }),
  person({ id: 3, name: "Asha", team_lead_id: 2 }),
  person({ id: 4, name: "Bilal", is_active: false }),
];

beforeEach(() => {
  sessionStorage.setItem("ogera_access_token", "token-123");
  vi.mocked(listAllEmployees).mockResolvedValue({ employees: staff, total: staff.length } as never);
  vi.mocked(listRoles).mockResolvedValue({
    items: [
      { slug: "team_lead", name: "Team Lead", is_active: true },
      { slug: "sales_executive", name: "Sales Executive", is_active: true },
    ],
  } as never);
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("TeamTab", () => {
  it("shows the count, the manager note and an Active or Inactive status", async () => {
    render(<TeamTab canEdit viewerId={99} isManager />);
    expect(await screen.findByText("3 people in your workspace")).toBeTruthy();
    expect(screen.getByText("Manager view — admin accounts aren't shown here")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.getAllByText("Active").length).toBe(2);
  });

  it("filters the table to team leads and has no separate no-team-lead tab", async () => {
    render(<TeamTab canEdit viewerId={99} />);
    await screen.findByText("3 people in your workspace");

    fireEvent.click(screen.getByRole("button", { name: "Team leads" }));
    expect(screen.queryByText("Bilal")).toBeNull();
    expect(screen.getByText("Lead Ravi")).toBeTruthy();

    expect(screen.queryByRole("button", { name: "No team lead" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Invite" })).toBeNull();
  });

  it("offers team leads only in the team lead dropdown and saves a change", async () => {
    vi.mocked(updateEmployee).mockResolvedValue(person({ id: 4, name: "Bilal", team_lead_id: 2 }));
    render(<TeamTab canEdit viewerId={99} />);
    const select = await screen.findByLabelText("Team lead for Bilal") as HTMLSelectElement;
    const options = within(select).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["No team lead", "Lead Ravi"]);

    fireEvent.change(select, { target: { value: "2" } });
    await waitFor(() => expect(updateEmployee).toHaveBeenCalledWith("token-123", 4, { team_lead_id: 2 }));
  });

  it("shows roles as text, not dropdowns, when the viewer cannot edit", async () => {
    render(<TeamTab canEdit={false} viewerId={99} />);
    await screen.findByText("3 people in your workspace");
    expect(screen.queryByLabelText("Role for Asha")).toBeNull();
    expect(screen.getAllByText("Sales Executive").length).toBe(2);
  });
});
