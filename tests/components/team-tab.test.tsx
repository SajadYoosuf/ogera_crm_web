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
  deleted_at: null, phone: null,
  ...overrides,
} as Employee);

const staff: Employee[] = [
  person({ id: 2, name: "Mani", role: "manager" }),
  person({ id: 3, name: "Asha" }),
  person({ id: 4, name: "Bilal", is_active: false }),
];

beforeEach(() => {
  sessionStorage.setItem("ogera_access_token", "token-123");
  vi.mocked(listAllEmployees).mockResolvedValue({ employees: staff, total: staff.length } as never);
  vi.mocked(listRoles).mockResolvedValue({
    items: [
      { slug: "manager", name: "Manager", is_active: true },
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
  it("shows everyone with an Active or Inactive status and no team lead column", async () => {
    render(<TeamTab viewerId={99} />);
    expect(await screen.findByText("3 people in your workspace")).toBeTruthy();
    expect(screen.getByText("Mani")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.getAllByText("Active").length).toBe(2);
    expect(screen.queryByText("Team Lead")).toBeNull();
    expect(screen.queryByRole("button", { name: "Team leads" })).toBeNull();
  });

  it("changes a role from the dropdown", async () => {
    vi.mocked(updateEmployee).mockResolvedValue(person({ id: 3, name: "Asha", role: "manager" }));
    render(<TeamTab viewerId={99} />);
    const select = await screen.findByLabelText("Role for Asha") as HTMLSelectElement;
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["Manager", "Sales Executive"]);

    fireEvent.change(select, { target: { value: "manager" } });
    await waitFor(() => expect(updateEmployee).toHaveBeenCalledWith("token-123", 3, { role: "manager" }));
  });

  it("does not let you change your own role", async () => {
    render(<TeamTab viewerId={3} />);
    const select = await screen.findByLabelText("Role for Asha") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});
