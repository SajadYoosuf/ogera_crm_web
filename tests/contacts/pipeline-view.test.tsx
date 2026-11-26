// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PipelineView from "@/features/contacts/PipelineView";
import { listPipelineContacts, listPipelineStages } from "@/features/contacts/api/contacts";

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "test-token" }) }));
vi.mock("@/features/contacts/hooks/useContactLookups", () => ({
  useContactLookups: () => ({ leadSources: [], branches: [], employees: [], canAssign: false }),
}));
vi.mock("@/features/contacts/api/contacts", () => ({
  listPipelineStages: vi.fn(),
  listPipelineContacts: vi.fn(),
}));

const stagesFor = (type: string) => [
  { id: 1, slug: "first", label: `${type} first stage`, order_index: 1, contact_type: type },
  { id: 2, slug: "second", label: `${type} second stage`, order_index: 2, contact_type: type },
];

describe("PipelineView", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(listPipelineStages).mockImplementation(async (_token, type) => stagesFor(type));
    vi.mocked(listPipelineContacts).mockResolvedValue([]);
  });

  it("shows the stage columns on every tab when there are no contacts", async () => {
    const user = userEvent.setup();
    render(<PipelineView />);

    expect(await screen.findByText("consumer first stage")).toBeTruthy();
    expect(screen.getAllByText("No contacts")).toHaveLength(2);

    for (const [tab, type] of [["Partner", "partner"], ["Dealer", "dealer"]]) {
      await user.click(screen.getByRole("button", { name: tab }));
      expect(await screen.findByText(`${type} first stage`)).toBeTruthy();
      expect(screen.getByText(`${type} second stage`)).toBeTruthy();
    }
  });

  it("keeps the columns visible when the contacts request fails", async () => {
    vi.mocked(listPipelineContacts).mockRejectedValue(new Error("down"));
    render(<PipelineView />);

    expect((await screen.findByRole("alert")).textContent).toContain("Failed to load contacts");
    expect(screen.getByText("consumer first stage")).toBeTruthy();
  });

  it("shows an error and no columns when the stages request fails", async () => {
    vi.mocked(listPipelineStages).mockRejectedValue(new Error("down"));
    render(<PipelineView />);

    expect((await screen.findByRole("alert")).textContent).toContain("Failed to load pipeline");
    expect(screen.queryByText("consumer first stage")).toBeNull();
  });
});
