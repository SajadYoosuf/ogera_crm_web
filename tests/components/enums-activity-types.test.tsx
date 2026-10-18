// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EnumsTab from "@/components/settings/EnumsTab";
import { listAllEnums, reorderEnum, updateEnum, type EnumValue } from "@/lib/api/settings";

vi.mock("@/lib/api/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/settings")>()),
  listAllEnums: vi.fn(),
  reorderEnum: vi.fn(),
  updateEnum: vi.fn(),
  createEnum: vi.fn(),
  deleteEnum: vi.fn(),
}));

const option = (id: number, label: string, extra: Partial<EnumValue> = {}): EnumValue => ({
  id, value: label.toLowerCase().replace(/\s+/g, "_"), label, sort_order: id, is_active: true, locked: false, usage_count: 0, ...extra,
});

const activityTypes = [
  option(1, "Phone call", { locked: true, usage_count: 4 }),
  option(2, "Site visit", { usage_count: 0 }),
  option(3, "Quote sent", { usage_count: 2 }),
];

beforeEach(() => {
  sessionStorage.setItem("ogera_access_token", "token-123");
  vi.mocked(listAllEnums).mockResolvedValue({
    lead_source: [], lead_stage: [], activity_type: activityTypes, loss_reason: [], professional_type: [], district: [],
  } as unknown as Awaited<ReturnType<typeof listAllEnums>>);
  vi.mocked(reorderEnum).mockResolvedValue(undefined as never);
  vi.mocked(updateEnum).mockImplementation(async (_token, _category, id, body) => ({ ...activityTypes.find((row) => row.id === id)!, ...body }) as EnumValue);
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

async function openActivityTypes() {
  render(<EnumsTab />);
  fireEvent.click(await screen.findByRole("tab", { name: "Activity types" }));
  return screen.findByRole("list");
}

describe("Activity types list", () => {
  it("shows each type as an editable name with its usage and a lock on built-in types", async () => {
    const list = await openActivityTypes();
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect((within(rows[0]).getByLabelText("Rename Phone call") as HTMLInputElement).value).toBe("Phone call");
    expect(within(rows[0]).getByText("4 in use")).toBeTruthy();
    expect(within(rows[1]).getByText("Unused")).toBeTruthy();
  });

  it("saves a renamed type when the field loses focus", async () => {
    const list = await openActivityTypes();
    const input = within(list).getByLabelText("Rename Site visit") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Site inspection" } });
    fireEvent.blur(input);
    await waitFor(() => expect(updateEnum).toHaveBeenCalledWith("token-123", "activity_type", 2, { label: "Site inspection" }));
  });

  it("cancels a rename on Escape without saving", async () => {
    const list = await openActivityTypes();
    const input = within(list).getByLabelText("Rename Site visit") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Oops" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(updateEnum).not.toHaveBeenCalled();
    expect(input.value).toBe("Site visit");
  });

  it("moves a type with the arrow keys on its handle and saves the new order", async () => {
    const list = await openActivityTypes();
    fireEvent.keyDown(within(list).getByRole("button", { name: /Reorder Site visit/ }), { key: "ArrowDown" });
    await waitFor(() => expect(reorderEnum).toHaveBeenCalledWith("token-123", "activity_type", [1, 3, 2]));
  });

  it("does not move the first type up or the last type down", async () => {
    const list = await openActivityTypes();
    fireEvent.keyDown(within(list).getByRole("button", { name: /Reorder Phone call/ }), { key: "ArrowUp" });
    fireEvent.keyDown(within(list).getByRole("button", { name: /Reorder Quote sent/ }), { key: "ArrowDown" });
    expect(reorderEnum).not.toHaveBeenCalled();
  });
});
