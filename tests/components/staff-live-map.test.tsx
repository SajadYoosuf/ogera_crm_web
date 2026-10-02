// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StaffLiveMap from "@/components/StaffLiveMap";

type Json = Record<string, unknown>;

function ok(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}

function staffRow(overrides: Json = {}) {
  return {
    userId: 7,
    name: "Nila Staff",
    phone: "9800000000",
    latitude: 11.2588,
    longitude: 75.7804,
    address: "West Hill, Kozhikode, Kerala",
    recordedAt: new Date().toISOString(),
    state: "moving",
    colorIndex: 7,
    ...overrides,
  };
}

const fetchMock = vi.fn();
const urlOf = (call: number) => new URL(String(fetchMock.mock.calls[call][0]), "http://localhost");

function serve(live: () => unknown, history: (url: URL) => unknown = () => ok({ points: [], distanceMeters: 0 })) {
  fetchMock.mockImplementation(async (input: string) => {
    const url = new URL(input, "http://localhost");
    return url.pathname === "/api/staff/locations/live" ? live() : history(url);
  });
}

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("ogera_access_token", "test-token");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StaffLiveMap - empty and error states", () => {
  it("shows the empty state when no staff have reported a location", async () => {
    serve(() => ok({ staff: [], total: 0 }));

    render(<StaffLiveMap />);

    expect(await screen.findByText("No staff location has been reported yet.")).toBeTruthy();
  });

  it("shows the server's error message when the live endpoint fails", async () => {
    serve(() => ({ ok: false, json: async () => ({ success: false, error: { message: "Unable to load staff locations." } }) }));

    render(<StaffLiveMap />);

    expect(await screen.findByText("Unable to load staff locations.")).toBeTruthy();
  });
});

describe("StaffLiveMap - staff states", () => {
  it.each([
    ["moving", "Moving"],
    ["stuck", "Stuck"],
    ["location_disabled", "Location disabled"],
    ["connection_lost", "Connection lost"],
    ["signed_out", "Signed out"],
  ])("shows the %s state as %s", async (state, label) => {
    serve(() => ok({ staff: [staffRow({ state })], total: 1 }));

    render(<StaffLiveMap />);

    expect(await screen.findByText(label)).toBeTruthy();
  });

  it("falls back to a resolving-address message when address is null", async () => {
    serve(() => ok({ staff: [staffRow({ address: null, state: "moving" })], total: 1 }));

    render(<StaffLiveMap />);
    await screen.findByText("Nila Staff");

    expect(screen.getByText("Address is being resolved.")).toBeTruthy();
  });

  it("shows a location-disabled-specific fallback when that state has no address", async () => {
    serve(() => ok({ staff: [staffRow({ address: null, state: "location_disabled" })], total: 1 }));

    render(<StaffLiveMap />);
    await screen.findByText("Nila Staff");

    expect(screen.getByText("Location was disabled before an address was saved.")).toBeTruthy();
  });

  it("shows initials for a staff member with no coordinates without crashing", async () => {
    serve(() => ok({ staff: [staffRow({ latitude: null, longitude: null })], total: 1 }));

    render(<StaffLiveMap />);

    expect(await screen.findByText("Nila Staff")).toBeTruthy();
  });
});

describe("StaffLiveMap - relative time (formatAgo)", () => {
  it("shows 'No update yet' when recordedAt is null", async () => {
    serve(() => ok({ staff: [staffRow({ recordedAt: null })], total: 1 }));

    render(<StaffLiveMap />);

    expect(await screen.findByText("No update yet")).toBeTruthy();
  });

  it("shows 'just now' under 45 seconds old", async () => {
    serve(() => ok({ staff: [staffRow({ recordedAt: new Date(Date.now() - 10_000).toISOString() })], total: 1 }));

    render(<StaffLiveMap />);

    expect(await screen.findByText("just now")).toBeTruthy();
  });

  it("shows minutes between 45 seconds and an hour", async () => {
    serve(() => ok({ staff: [staffRow({ recordedAt: new Date(Date.now() - 15 * 60_000).toISOString() })], total: 1 }));

    render(<StaffLiveMap />);

    expect(await screen.findByText("15 min ago")).toBeTruthy();
  });

  it("shows hours at 60 minutes and beyond", async () => {
    serve(() => ok({ staff: [staffRow({ recordedAt: new Date(Date.now() - 125 * 60_000).toISOString() })], total: 1 }));

    render(<StaffLiveMap />);

    expect(await screen.findByText("2 hr ago")).toBeTruthy();
  });
});

describe("StaffLiveMap - route history dialog", () => {
  it("selecting a staff row opens the route dialog and fetches their history for today", async () => {
    serve(() => ok({ staff: [staffRow()], total: 1 }));

    render(<StaffLiveMap />);
    fireEvent.click(await screen.findByText("Nila Staff"));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    const historyCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/history"));
    expect(historyCall).toBeDefined();
    expect(urlOf(fetchMock.mock.calls.indexOf(historyCall!)).searchParams.get("userId")).toBe("7");
  });

  it("shows the empty-route message when no points were recorded that day", async () => {
    serve(() => ok({ staff: [staffRow()], total: 1 }), () => ok({ points: [], distanceMeters: 0 }));

    render(<StaffLiveMap />);
    fireEvent.click(await screen.findByText("Nila Staff"));

    expect(await screen.findByText("No route recorded")).toBeTruthy();
    expect(screen.getByText("There are no location updates for this date.")).toBeTruthy();
  });

  it("shows route distance and update count once loaded", async () => {
    serve(
      () => ok({ staff: [staffRow()], total: 1 }),
      () =>
        ok({
          points: [
            { latitude: 11.2588, longitude: 75.7804, address: "West Hill", recordedAt: "2026-09-10T09:00:00Z", state: "moving" },
          ],
          distanceMeters: 1500,
        }),
    );

    render(<StaffLiveMap />);
    fireEvent.click(await screen.findByText("Nila Staff"));
    await screen.findByText("West Hill");

    expect(screen.getByText("1.5 km")).toBeTruthy(); // Distance tile
    expect(screen.getByText("Distance").nextElementSibling?.textContent).toBe("1.5 km");
    expect(screen.getByText("Updates").nextElementSibling?.textContent).toBe("1");
  });

  it("the date picker's Next day control is disabled once the route is showing today", async () => {
    serve(() => ok({ staff: [staffRow()], total: 1 }));

    render(<StaffLiveMap />);
    fireEvent.click(await screen.findByText("Nila Staff"));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Nila Staff route history" })).toBeTruthy());

    expect((screen.getByRole("button", { name: "Next day" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("closing the dialog clears the selection", async () => {
    serve(() => ok({ staff: [staffRow()], total: 1 }));

    render(<StaffLiveMap />);
    fireEvent.click(await screen.findByText("Nila Staff"));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Nila Staff route history" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Close route history" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nila Staff route history" })).toBeNull());
  });
});
