// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SaleFormModal from "@/components/SaleFormModal";

const fetchMock = vi.fn();
const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data, headers: new Headers() });
const CATALOGUE = [{ id: 3, name: "200 LTR Vertical Tank", capacity_display: "200 Ltr" }];

const lastBody = () => JSON.parse(String(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST").at(-1)?.[1].body));

function fill(product: string) {
  fireEvent.change(screen.getByLabelText("Buyer name"), { target: { value: "Anil" } });
  fireEvent.change(screen.getByLabelText("Purchased product"), { target: { value: product } });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.setItem("ogera_access_token", "test-token");
  fetchMock.mockImplementation(async () => json({ id: 1 }, 201));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); sessionStorage.clear(); });

describe("sale form product link", () => {
  it("links the sale to a catalogue product when its exact name is picked", async () => {
    render(<SaleFormModal sale={null} products={["SS Tank 500L"]} catalogue={CATALOGUE} onClose={vi.fn()} onSaved={vi.fn()} />);
    fill("200 ltr vertical tank");
    expect(screen.getByText("From the products catalogue")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add sale" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastBody().product_id).toBe(3);
  });

  it("keeps other text as typed, without a link", async () => {
    render(<SaleFormModal sale={null} products={["SS Tank 500L"]} catalogue={CATALOGUE} onClose={vi.fn()} onSaved={vi.fn()} />);
    fill("SS Tank 500L");
    expect(screen.getByText("Not in the catalogue; saved as typed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add sale" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({ purchased_product: "SS Tank 500L", product_id: null });
  });
});
