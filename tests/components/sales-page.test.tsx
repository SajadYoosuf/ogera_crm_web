// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SalesPage from "@/app/dashboard/sales/page";

const fetchMock = vi.fn();
const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data, headers: new Headers() });
const SALE = { id: 7, purchase_date: "2026-09-24", name: "ABDUL MAJEED", phone: "+917403212125", alt_phone: null, address: "Villoor", purchased_product: "SS Tank 500L", created_at: "2026-10-09T04:00:00" };

const signIn = (role: string) => sessionStorage.setItem("ogera_user", JSON.stringify({ id: 1, name: "U", email: "u@o.com", role }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.setItem("ogera_access_token", "test-token");
  fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
    if (input.includes("/sales/products")) return json(["SS Tank 500L"]);
    if (init?.method === "DELETE") return { ok: true, status: 204, json: async () => ({}), headers: new Headers() };
    return json({ items: [SALE], total: 1, skip: 0, limit: 20 });
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); sessionStorage.clear(); });

describe("SalesPage", () => {
  it("lists sales for a manager and deletes one after confirming", async () => {
    signIn("manager");
    render(<SalesPage />);
    expect((await screen.findAllByText("ABDUL MAJEED")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("SS Tank 500L").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByLabelText("Delete sale of ABDUL MAJEED")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/sales/7") && init?.method === "DELETE")).toBe(true));
  });

  it("hides add, edit and delete from a sales executive", async () => {
    signIn("sales_executive");
    render(<SalesPage />);
    expect((await screen.findAllByText("ABDUL MAJEED")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Add sale" })).toBeNull();
    expect(screen.queryAllByLabelText("Delete sale of ABDUL MAJEED")).toHaveLength(0);
  });

  it("shows an empty state with a way to add the first sale", async () => {
    signIn("admin");
    fetchMock.mockImplementation(async (input: string) => input.includes("/sales/products") ? json([]) : json({ items: [], total: 0, skip: 0, limit: 20 }));
    render(<SalesPage />);
    expect(await screen.findByText("No sales yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add the first sale" })).toBeTruthy();
  });
});
