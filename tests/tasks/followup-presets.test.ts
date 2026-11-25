import { describe, expect, it } from "vitest";
import { duePresets, isPast, retryChoice } from "@/features/leads/followupPresets";
import { overdueText } from "@/features/leads/components/FollowupCard";

const settings = { morning_time: "10:00", evening_time: "17:00", default_due_time: "09:00" };

describe("duePresets", () => {
  it("builds the six presets from the Settings times (Wednesday 08:20)", () => {
    const now = new Date(2026, 10, 25, 8, 20); // Wed 25 Nov 2026
    const byKey = Object.fromEntries(duePresets(settings, now).map((p) => [p.key, p]));
    expect(byKey.hour).toMatchObject({ date: "2026-11-25", time: "09:20" });
    expect(byKey.evening).toMatchObject({ date: "2026-11-25", time: "17:00" });
    expect(byKey.tomorrow).toMatchObject({ date: "2026-11-26", time: "10:00" });
    expect(byKey.monday).toMatchObject({ date: "2026-11-30", time: "10:00" });
    expect(byKey["3days"]).toMatchObject({ date: "2026-11-28", time: "09:00" });
    expect(byKey.week).toMatchObject({ date: "2026-12-02", time: "09:00" });
  });

  it("drops Today evening once it has passed, and Next Monday is never today", () => {
    const mondayNight = new Date(2026, 10, 30, 20, 0); // Mon 30 Nov 2026, 20:00
    const presets = duePresets(settings, mondayNight);
    expect(presets.find((p) => p.key === "evening")).toBeUndefined();
    expect(presets.find((p) => p.key === "monday")?.date).toBe("2026-12-07");
  });

  it("rounds In 1 hour up to five minutes, across midnight", () => {
    const late = new Date(2026, 10, 25, 23, 31);
    expect(duePresets(settings, late).find((p) => p.key === "hour")).toMatchObject({ date: "2026-11-26", time: "00:35" });
  });
});

describe("isPast and retryChoice", () => {
  it("compares local date and time, using the default time when none is given", () => {
    const now = new Date(2026, 10, 25, 10, 0);
    expect(isPast({ date: "2026-11-25", time: "09:00" }, now)).toBe(true);
    expect(isPast({ date: "2026-11-25", time: "" }, now, "11:00")).toBe(false);
    expect(isPast({ date: "2026-11-26", time: "08:00" }, now)).toBe(false);
  });

  it("retry is N days out at the default time", () => {
    expect(retryChoice(3, "09:30", new Date(2026, 10, 30, 12))).toEqual({ date: "2026-12-03", time: "09:30" });
  });
});

describe("overdueText", () => {
  it("uses minutes, hours or days", () => {
    expect(overdueText(0)).toBe("1m overdue");
    expect(overdueText(45)).toBe("45m overdue");
    expect(overdueText(60)).toBe("1h overdue");
    expect(overdueText(60 * 23 + 59)).toBe("23h overdue");
    expect(overdueText(60 * 24 * 2 + 5)).toBe("2d overdue");
  });
});
