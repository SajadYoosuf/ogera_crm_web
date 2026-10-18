// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EnumsTab from "@/components/settings/EnumsTab";
import type { EnumValue } from "@/lib/api/settings";

const fetchMock = vi.fn();
const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => data });
const fail = (status: number, detail: unknown) => ({ ok: false, status, json: async () => ({ detail }) });

const row = (id: number, value: string, label: string, extra: Partial<EnumValue> = {}): EnumValue => ({
  id, value, label, sort_order: id, is_active: true, locked: false, usage_count: 0, ...extra,
});

let data: Record<string, EnumValue[]>;
const calls = (method: string) => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);

beforeEach(() => {
  data = {
    lead_source: [row(1, "meta", "Meta", { usage_count: 4 }), row(2, "website", "Website"), row(3, "offline", "Offline", { locked: true })],
    lead_stage: [row(10, "new_lead", "New Lead", { locked: true }), row(11, "quoted", "Quoted")],
    activity_type: [], loss_reason: [], professional_type: [], district: [],
  };
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.setItem("ogera_access_token", "test-token");
  fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    if (url.pathname === "/settings/enums" && method === "GET") return ok(data);
    if (url.pathname === "/settings/enums/lead_source" && method === "POST") return ok(row(9, "walk_in", JSON.parse(String(init?.body)).label), 201);
    if (url.pathname === "/settings/enums/lead_source/reorder") return ok([]);
    if (url.pathname === "/settings/enums/lead_source/2" && method === "DELETE") return ok(row(2, "website", "Website", { is_active: false }));
    if (url.pathname === "/settings/enums/lead_source/1" && method === "PATCH") return ok(row(1, "meta", "Meta", { is_active: false, usage_count: 4 }));
    return fail(404, `Unmocked ${method} ${url.pathname}`);
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); sessionStorage.clear(); });

describe("settings: enum values", () => {
  it("lists the options of the first category with usage and a lock on required ones", async () => {
    render(<EnumsTab />);
    expect(await screen.findByText("Meta")).toBeTruthy();
    expect(screen.getByText("4 in use")).toBeTruthy();
    expect(screen.getByLabelText("Offline active")).toHaveProperty("disabled", true); // the app relies on it
  });

  it("adds a value at the end of the list", async () => {
    render(<EnumsTab />);
    await screen.findByText("Meta");
    fireEvent.click(screen.getByRole("button", { name: /Add new/ }));
    fireEvent.change(screen.getByLabelText("New lead source name"), { target: { value: "Walk in" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Walk in")).toBeTruthy();
    expect(JSON.parse(String(calls("POST")[0][1].body))).toEqual({ label: "Walk in" });
  });

  it("removes an unused value after a confirmation", async () => {
    render(<EnumsTab />);
    await screen.findByText("Website");
    fireEvent.click(screen.getByRole("button", { name: "Remove Website" }));
    expect(screen.getByText(/Nothing uses it/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(calls("DELETE")).toHaveLength(1));
    expect(await screen.findByText("Website removed.")).toBeTruthy();
  });

  it("offers to hide a value that records still use instead of deleting it", async () => {
    render(<EnumsTab />);
    await screen.findByText("Meta");
    fireEvent.click(screen.getByRole("button", { name: "Remove Meta" }));
    expect(screen.getByText(/4 records use this value/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide instead" }));
    await waitFor(() => expect(calls("PATCH")).toHaveLength(1));
    expect(JSON.parse(String(calls("PATCH")[0][1].body))).toEqual({ is_active: false });
    expect(calls("DELETE")).toHaveLength(0);
  });

  it("sends the full new order when a row moves down", async () => {
    render(<EnumsTab />);
    await screen.findByText("Meta");
    fireEvent.click(screen.getByRole("button", { name: "Move Meta down" }));
    await waitFor(() => expect(calls("POST")).toHaveLength(1));
    expect(JSON.parse(String(calls("POST")[0][1].body))).toEqual({ ordered_ids: [2, 1, 3] });
  });

  it("does not let stages be added or removed", async () => {
    render(<EnumsTab />);
    await screen.findByText("Meta");
    fireEvent.click(screen.getByRole("tab", { name: "Lead stages" }));
    expect(await screen.findByText("Quoted")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add new/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Quoted" })).toBeNull();
  });

  it("shows the API's reason when saving fails", async () => {
    fetchMock.mockImplementationOnce(async () => ok(data));
    render(<EnumsTab />);
    await screen.findByText("Meta");
    fetchMock.mockImplementation(async () => fail(409, "This option already exists"));
    fireEvent.click(screen.getByRole("button", { name: /Add new/ }));
    fireEvent.change(screen.getByLabelText("New lead source name"), { target: { value: "Meta" } });
    fireEvent.keyDown(screen.getByLabelText("New lead source name"), { key: "Enter" });
    expect(await screen.findByText("This option already exists")).toBeTruthy();
  });
});
