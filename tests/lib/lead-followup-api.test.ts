import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/auth";
import { isPastTimeToday } from "@/components/followups/activities";
import { markFollowupDone, rescheduleFollowup, scheduleFollowup } from "@/lib/api/activities";
import { isoDate } from "@/components/followups/activities";

const fetchMock = vi.fn();
const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => data, text: async () => JSON.stringify(data) });
const fail = (status: number, detail: unknown) => ({ ok: false, status, json: async () => ({ detail }), text: async () => JSON.stringify({ detail }) });

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(ok({ id: 5 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("follow-up API calls", () => {
  it("marks a follow-up done on its own route, with the notes and the done outcome", async () => {
    await markFollowupDone("tok", 12, 5, "Customer will confirm Friday");
    const call = lastCall();
    expect(call.url).toBe(`${API_BASE_URL}/contacts/12/followups/5`);
    expect(call.method).toBe("PATCH");
    expect(call.body).toEqual({ status: "completed", outcome: "done", notes: "Customer will confirm Friday" });
  });

  it("reschedules a follow-up by sending due_at, the whole day when no time is given", async () => {
    await rescheduleFollowup("tok", 12, 5, "2026-12-01");
    expect(lastCall().body).toEqual({ due_at: "2026-12-01T23:59:00" });
  });

  it("reschedules to the chosen time", async () => {
    await rescheduleFollowup("tok", 12, 5, "2026-12-01", "09:15");
    expect(lastCall().body).toEqual({ due_at: "2026-12-01T09:15:00" });
  });

  it("schedules a follow-up with the same whole-day default", async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: 9, title: "Quote", assigned_to: 3, due_at: "2026-12-01T23:59:00", status: "todo", channel: "call", created_at: "2026-10-01T09:00:00", task_state: "pending", overdue_days: 0 }, 201));
    await scheduleFollowup("tok", 12, { type: "call", scheduled_date: "2026-12-01", assigned_to: 3, title: "Quote" });
    expect(lastCall().body).toMatchObject({ channel: "call", due_at: "2026-12-01T23:59:00", assigned_to: 3, title: "Quote" });
  });

  it("passes the server's refusal through, so the dialog can show it", async () => {
    fetchMock.mockResolvedValueOnce(fail(409, "Follow-up is already completed"));
    await expect(markFollowupDone("tok", 12, 5, "again")).rejects.toThrow("Follow-up is already completed");
  });
});

describe("isPastTimeToday", () => {
  it("is never past for another day", () => {
    expect(isPastTimeToday(isoDate(1), "00:00")).toBe(false);
  });

  it("is never past without a time", () => {
    expect(isPastTimeToday(isoDate(), undefined)).toBe(false);
    expect(isPastTimeToday(isoDate(), "")).toBe(false);
  });

  it("is past for today when the time is earlier than now", () => {
    expect(isPastTimeToday(isoDate(), "00:00")).toBe(true);
  });

  it("is not past for today when the time is later than now", () => {
    expect(isPastTimeToday(isoDate(), "23:59")).toBe(false);
  });
});
