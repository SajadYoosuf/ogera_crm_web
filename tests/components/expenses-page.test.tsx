// @vitest-environment jsdom
/**
 * Expense claims review page.
 *
 * WHAT IS CHECKED:
 *   - Rows show the employee, category and price.
 *   - Status tabs, the employee dropdown and the date range are sent to the API.
 *   - Approve saves the claim and refreshes the list. No confirmation step.
 *   - Reject needs a note. A blank note is refused before any request is sent.
 *   - An empty list shows a clear message.
 *
 * The API modules are mocked, so no network call is made.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExpensesPage from "@/app/dashboard/expenses/page";
import { listAllEmployees } from "@/lib/api/employees";
import { approveExpense, listExpenses, rejectExpense, type Expense, type ExpenseListResponse } from "@/lib/api/expenses";

vi.mock("@/lib/api/expenses", () => ({
  listExpenses: vi.fn(),
  approveExpense: vi.fn(),
  rejectExpense: vi.fn(),
}));
vi.mock("@/lib/api/employees", () => ({
  listAllEmployees: vi.fn(),
}));

const EXPENSE: Expense = {
  id: 7,
  employee_id: 3,
  employee_name: "Anu Sales",
  title: "Fuel to Kottakkal site",
  category: "petrol",
  amount: "850.00",
  bill_photo_url: null,
  status: "pending",
  rejection_reason: null,
  reviewed_by: null,
  reviewed_by_name: null,
  reviewed_at: null,
  created_at: "2026-10-24T10:00:00",
};

const page = (items: Expense[]): ExpenseListResponse => ({ items, total: items.length, pending_count: items.length });

// Plain object backing for sessionStorage, same approach as the other component tests.
const store: Record<string, string> = {};

beforeEach(() => {
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    length: 0,
    key: () => null,
  });
  sessionStorage.setItem("ogera_access_token", "test-token");
  vi.mocked(listAllEmployees).mockResolvedValue({ employees: [], total: 0 } as never);
});

afterEach(() => {
  cleanup();
  Object.keys(store).forEach((k) => delete store[k]);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ExpensesPage", () => {
  it("shows the employee, category and price for each claim", async () => {
    vi.mocked(listExpenses).mockResolvedValue(page([EXPENSE]));

    render(<ExpensesPage />);

    expect(await screen.findByText("Anu Sales")).toBeTruthy();
    expect(screen.getByText("Petrol / Fuel")).toBeTruthy();
    expect(screen.getByText(/850/)).toBeTruthy();
  });

  it("sends the status tab to the API", async () => {
    vi.mocked(listExpenses).mockResolvedValue(page([EXPENSE]));
    render(<ExpensesPage />);
    await screen.findByText("Anu Sales");

    fireEvent.click(screen.getByRole("button", { name: "Rejected" }));

    await waitFor(() => {
      expect(vi.mocked(listExpenses).mock.lastCall?.[1]).toMatchObject({ status: "rejected", skip: 0 });
    });
  });

  it("sends the employee and date range to the API", async () => {
    vi.mocked(listExpenses).mockResolvedValue(page([EXPENSE]));
    vi.mocked(listAllEmployees).mockResolvedValue({
      employees: [{ id: 3, name: "Anu Sales" }] as never,
      total: 1,
    });
    render(<ExpensesPage />);
    await screen.findByText("Anu Sales");

    fireEvent.change(await screen.findByRole("combobox"), { target: { value: "3" } });
    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2026-10-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-10-24" } });

    await waitFor(() => {
      expect(vi.mocked(listExpenses).mock.lastCall?.[1]).toMatchObject({
        employee_id: 3,
        date_from: "2026-10-01",
        date_to: "2026-10-24",
      });
    });
  });

  it("approves a claim and reloads the list, without asking for confirmation", async () => {
    vi.mocked(listExpenses).mockResolvedValue(page([EXPENSE]));
    vi.mocked(approveExpense).mockResolvedValue({ ...EXPENSE, status: "approved" });
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<ExpensesPage />);
    await screen.findByText("Anu Sales");
    const callsBefore = vi.mocked(listExpenses).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(approveExpense).toHaveBeenCalledWith("test-token", 7));
    await waitFor(() => expect(vi.mocked(listExpenses).mock.calls.length).toBeGreaterThan(callsBefore));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("refuses a blank rejection note and sends nothing", async () => {
    vi.mocked(listExpenses).mockResolvedValue(page([EXPENSE]));
    render(<ExpensesPage />);
    await screen.findByText("Anu Sales");

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject claim" }));

    expect(await within(dialog).findByRole("alert")).toBeTruthy();
    expect(rejectExpense).not.toHaveBeenCalled();
  });

  it("rejects with the note the manager wrote", async () => {
    vi.mocked(listExpenses).mockResolvedValue(page([EXPENSE]));
    vi.mocked(rejectExpense).mockResolvedValue({ ...EXPENSE, status: "rejected", rejection_reason: "Bill unreadable" });
    render(<ExpensesPage />);
    await screen.findByText("Anu Sales");

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Rejection note/), { target: { value: "  Bill unreadable  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject claim" }));

    await waitFor(() => expect(rejectExpense).toHaveBeenCalledWith("test-token", 7, "Bill unreadable"));
  });

  it("shows an empty message when no claim matches", async () => {
    vi.mocked(listExpenses).mockResolvedValue(page([]));
    render(<ExpensesPage />);

    expect(await screen.findByText("No expense claims yet.")).toBeTruthy();
  });
});
