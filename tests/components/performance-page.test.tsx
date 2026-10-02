// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PerformancePage from "@/app/dashboard/performance/page";

type Json = Record<string, unknown>;

const teamReport = {
  range: { startDate: "2000-01-01", endDate: "2026-09-19" },
  scope: "team",
  totals: { leads: 149, awareness: 7 },
  unattributed: { leads: 42, awareness: 127 },
  staff: [
    { id: 7, name: "Shiju", leads: 91, awareness: 4, total: 95 },
    { id: 1, name: "Admin", leads: 58, awareness: 3, total: 61 },
  ],
};

const contactsPage = (names: string[], extra: Json = {}) => ({
  contacts: names.map((name, index) => ({
    id: index + 1,
    name,
    phone: `98000000${index}`,
    contactType: "lead",
    district: "Malappuram",
    createdAt: "2026-08-10T00:00:00.000Z",
  })),
  total: names.length,
  page: 1,
  totalPages: 1,
  ...extra,
});

function ok(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}
function fail(message: string, status = 500) {
  return { ok: false, status, json: async () => ({ success: false, error: { code: "SERVER_ERROR", message } }) };
}

const fetchMock = vi.fn();
const urlOf = (call: number) => new URL(String(fetchMock.mock.calls[call][0]), "http://localhost");
const lastUrl = () => urlOf(fetchMock.mock.calls.length - 1);

/** Routes `/api/performance` and `/api/contacts` to the given responders. */
function serve(performance: () => unknown, contacts: (url: URL) => unknown = () => ok(contactsPage([]))) {
  fetchMock.mockImplementation(async (input: string) => {
    const url = new URL(input, "http://localhost");
    return url.pathname === "/api/performance" ? performance() : contacts(url);
  });
}

function signIn(role: string) {
  sessionStorage.setItem("ogera_user", JSON.stringify({ id: 1, name: "Head", email: "h@o.com", role }));
  sessionStorage.setItem("ogera_access_token", "test-token");
}

const localYmd = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Performance page - access", () => {
  it("shows a restricted message to sales staff and never calls the API", async () => {
    signIn("sales_staff");

    render(<PerformancePage />);

    expect(await screen.findByText("Restricted area")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a restricted message when nobody is signed in", async () => {
    render(<PerformancePage />);

    expect(await screen.findByText("Restricted area")).toBeTruthy();
  });

  it.each(["admin", "sales_head"])("lets %s in", async (role) => {
    signIn(role);
    serve(() => ok(teamReport));

    render(<PerformancePage />);

    expect(await screen.findByText("Shiju")).toBeTruthy();
    expect(screen.queryByText("Restricted area")).toBeNull();
  });
});

describe("Performance page - loading", () => {
  it("shows a centred spinner with text until the report arrives", async () => {
    signIn("admin");
    let release!: (value: unknown) => void;
    serve(() => new Promise((resolve) => (release = resolve)));

    render(<PerformancePage />);

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Loading performance…");
    expect(screen.queryByText("Shiju")).toBeNull();

    release(ok(teamReport));

    expect(await screen.findByText("Shiju")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sends the bearer token and starts from All time", async () => {
    signIn("admin");
    serve(() => ok(teamReport));

    render(<PerformancePage />);
    await screen.findByText("Shiju");

    expect(urlOf(0).pathname).toBe("/api/performance");
    expect(urlOf(0).searchParams.get("startDate")).toBe("2000-01-01");
    expect(urlOf(0).searchParams.get("endDate")).toBe(localYmd());
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-token");
  });
});

describe("Performance page - report", () => {
  beforeEach(() => {
    signIn("admin");
    serve(() => ok(teamReport));
  });

  it("shows the totals and one row per staff member in server order", async () => {
    render(<PerformancePage />);
    await screen.findByText("Shiju");

    expect(screen.getByText("Leads added").nextElementSibling?.textContent).toBe("149");
    expect(screen.getByText("Awareness added").nextElementSibling?.textContent).toBe("7");
    // "Staff" is also a column header, so pick the summary card label.
    const staffLabel = screen.getAllByText("Staff").find((element) => element.tagName === "P")!;
    expect(staffLabel.nextElementSibling?.textContent).toBe("2");

    const rows = screen.getAllByRole("row").slice(1); // drop the header row
    expect(within(rows[0]).getByText("Shiju")).toBeTruthy();
    expect(within(rows[0]).getByText("95")).toBeTruthy();
    expect(within(rows[1]).getByText("Admin")).toBeTruthy();
  });

  it("shows the unattributed row when older records have no creator", async () => {
    render(<PerformancePage />);
    await screen.findByText("Shiju");

    const row = screen.getByText(/Unattributed/).closest("tr")!;
    expect(within(row).getByText("42")).toBeTruthy();
    expect(within(row).getByText("127")).toBeTruthy();
    expect(within(row).getByText("169")).toBeTruthy();
  });

  it("hides the unattributed row when there are none", async () => {
    serve(() => ok({ ...teamReport, unattributed: { leads: 0, awareness: 0 } }));

    render(<PerformancePage />);
    await screen.findByText("Shiju");

    expect(screen.queryByText(/Unattributed/)).toBeNull();
  });

  it("shows an empty message when nobody has activity", async () => {
    serve(() => ok({ ...teamReport, staff: [], totals: { leads: 0, awareness: 0 }, unattributed: { leads: 0, awareness: 0 } }));

    render(<PerformancePage />);

    expect(await screen.findByText("No staff activity in this range.")).toBeTruthy();
  });

  it("shows the server's message when the report fails", async () => {
    serve(() => fail("Unable to load performance"));

    render(<PerformancePage />);

    expect(await screen.findByText("Unable to load performance")).toBeTruthy();
  });

  it("shows an error when the network is down", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<PerformancePage />);

    expect(await screen.findByText("Failed to fetch")).toBeTruthy();
  });
});

describe("Performance page - date range", () => {
  beforeEach(() => {
    signIn("admin");
    serve(() => ok(teamReport));
  });

  it("Today asks for a single day", async () => {
    render(<PerformancePage />);
    await screen.findByText("Shiju");

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(lastUrl().searchParams.get("startDate")).toBe(localYmd());
    expect(lastUrl().searchParams.get("endDate")).toBe(localYmd());
  });

  it("Last 7 days spans seven calendar days", async () => {
    render(<PerformancePage />);
    await screen.findByText("Shiju");

    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const start = new Date(`${lastUrl().searchParams.get("startDate")}T00:00:00`);
    const end = new Date(`${lastUrl().searchParams.get("endDate")}T00:00:00`);
    expect(Math.round((end.getTime() - start.getTime()) / 86_400_000)).toBe(6);
  });

  it("This month starts on the first of the month", async () => {
    render(<PerformancePage />);
    await screen.findByText("Shiju");

    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(lastUrl().searchParams.get("startDate")).toBe(localYmd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  });

  it("Custom reveals two date inputs and fetches the chosen range", async () => {
    render(<PerformancePage />);
    await screen.findByText("Shiju");

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    const [from, to] = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    fireEvent.change(from, { target: { value: "2026-08-01" } });
    fireEvent.change(to, { target: { value: "2026-08-31" } });

    await waitFor(() => expect(lastUrl().searchParams.get("endDate")).toBe("2026-08-31"));
    expect(lastUrl().searchParams.get("startDate")).toBe("2026-08-01");
  });

  it("warns and does not fetch when the start is after the end", async () => {
    render(<PerformancePage />);
    await screen.findByText("Shiju");
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    const [from, to] = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    fireEvent.change(to, { target: { value: "2026-08-01" } });
    await waitFor(() => expect(lastUrl().searchParams.get("endDate")).toBe("2026-08-01"));
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.change(from, { target: { value: "2026-09-01" } });

    expect(await screen.findByText("Start date must not be after end date.")).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});

describe("Performance page - a person's contacts", () => {
  beforeEach(() => {
    signIn("admin");
  });

  const openPanel = async () => {
    render(<PerformancePage />);
    const row = (await screen.findByText("Shiju")).closest("tr")!;
    fireEvent.click(row);
    return document.querySelector("aside") as HTMLElement;
  };

  it("clicking a row opens a panel for that person, with the current range", async () => {
    serve(() => ok(teamReport), () => ok(contactsPage(["Amina", "Bala", "Chitra"])));

    const panel = await openPanel();

    expect(await within(panel).findByText("Amina")).toBeTruthy();
    expect(within(panel).getByText("3 contacts added")).toBeTruthy();
    const url = lastUrl();
    expect(url.pathname).toBe("/api/contacts");
    expect(url.searchParams.get("addedBy")).toBe("7");
    expect(url.searchParams.get("startDate")).toBe("2000-01-01");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.has("type")).toBe(false);
  });

  it("shows a spinner while the first page loads", async () => {
    let release!: (value: unknown) => void;
    serve(() => ok(teamReport), () => new Promise((resolve) => (release = resolve)));

    const panel = await openPanel();

    expect(within(panel).getByRole("status").textContent).toContain("Loading contacts…");

    release(ok(contactsPage(["Amina"])));
    expect(await within(panel).findByText("Amina")).toBeTruthy();
    expect(within(panel).queryByRole("status")).toBeNull();
  });

  it("uses the singular for one contact", async () => {
    serve(() => ok(teamReport), () => ok(contactsPage(["Amina"])));

    const panel = await openPanel();

    expect(await within(panel).findByText("1 contact added")).toBeTruthy();
  });

  it("Leads / Awareness tabs re-fetch with the type from page 1", async () => {
    serve(() => ok(teamReport), (url) =>
      ok(contactsPage(url.searchParams.get("type") === "awareness" ? ["Deepa"] : ["Amina", "Bala"])),
    );

    const panel = await openPanel();
    await within(panel).findByText("Amina");

    fireEvent.click(within(panel).getByRole("button", { name: "Awareness" }));

    expect(await within(panel).findByText("Deepa")).toBeTruthy();
    expect(lastUrl().searchParams.get("type")).toBe("awareness");
    expect(lastUrl().searchParams.get("page")).toBe("1");
    expect(within(panel).queryByText("Amina")).toBeNull();
  });

  it("Load more appends the next page", async () => {
    serve(() => ok(teamReport), (url) =>
      url.searchParams.get("page") === "2"
        ? ok(contactsPage(["Third"], { page: 2, totalPages: 2, total: 3 }))
        : ok(contactsPage(["First", "Second"], { page: 1, totalPages: 2, total: 3 })),
    );

    const panel = await openPanel();
    await within(panel).findByText("First");

    fireEvent.click(within(panel).getByRole("button", { name: "Load more" }));

    expect(await within(panel).findByText("Third")).toBeTruthy();
    expect(within(panel).getByText("First")).toBeTruthy(); // kept
    expect(within(panel).queryByRole("button", { name: "Load more" })).toBeNull(); // last page
  });

  it("says so when there are no contacts in range", async () => {
    serve(() => ok(teamReport), () => ok(contactsPage([])));

    const panel = await openPanel();

    expect(await within(panel).findByText("No contacts in this range.")).toBeTruthy();
  });

  it("shows the error inside the panel when the list fails", async () => {
    serve(() => ok(teamReport), () => fail("Unable to load contacts"));

    const panel = await openPanel();

    expect(await within(panel).findByText("Unable to load contacts")).toBeTruthy();
  });

  it("the Unattributed row opens the bucket for records with no creator", async () => {
    serve(() => ok(teamReport), () => ok(contactsPage(["Old lead"])));
    render(<PerformancePage />);
    fireEvent.click((await screen.findByText(/Unattributed/)).closest("tr")!);

    await waitFor(() => expect(lastUrl().pathname).toBe("/api/contacts"));

    expect(lastUrl().searchParams.get("addedBy")).toBe("unattributed");
  });

  it("closes with Escape, the close button, or a click outside", async () => {
    serve(() => ok(teamReport), () => ok(contactsPage(["Amina"])));
    render(<PerformancePage />);
    const reopen = async () => {
      // Once the panel is closed, the only "Shiju" is the table cell.
      fireEvent.click(screen.getByText("Shiju").closest("tr")!);
      const panel = document.querySelector("aside") as HTMLElement;
      await within(panel).findByText("Amina");
      return panel;
    };
    await screen.findByText("Shiju");

    await reopen();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(document.querySelector("aside")).toBeNull());

    const panel = await reopen();
    fireEvent.click(within(panel).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.querySelector("aside")).toBeNull());

    await reopen();
    fireEvent.click(document.querySelector('[class*="bg-black"]')!);
    await waitFor(() => expect(document.querySelector("aside")).toBeNull());
  });

  it("does not open a panel for the header row", async () => {
    serve(() => ok(teamReport));
    render(<PerformancePage />);
    await screen.findByText("Shiju");

    fireEvent.click(screen.getAllByRole("row")[0]);

    expect(document.querySelector("aside")).toBeNull();
  });
});
