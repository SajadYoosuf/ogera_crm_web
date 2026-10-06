import { describe, expect, it } from "vitest";
import { SCHEDULABLE_TYPES, formatClock, formatDay, formatWhen, isoDate, typeLabel } from "@/components/followups/activities";

describe("isoDate", () => {
  it("returns today as YYYY-MM-DD and moves by whole days", () => {
    const today = isoDate();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isoDate(1) > today).toBe(true);
    expect(isoDate(-1) < today).toBe(true);
  });
});

describe("formatters", () => {
  it("formats a clock time in 12-hour style", () => {
    expect(formatClock("10:30:00")).toBe("10:30am");
    expect(formatClock("00:05")).toBe("12:05am");
    expect(formatClock("15:00")).toBe("3:00pm");
  });

  it("formats a due day with the weekday", () => {
    expect(formatDay("2026-09-29")).toBe("Tue 29 Sept");
  });

  it("says Today and Yesterday for recent timestamps", () => {
    const now = new Date(2026, 9, 6, 12, 0);
    expect(formatWhen("2026-10-06T10:22:00", now)).toBe("Today 10:22am");
    expect(formatWhen("2026-10-05T16:05:00", now)).toBe("Yesterday 4:05pm");
    expect(formatWhen("2026-09-29T09:00:00", now)).toBe("29 Sept 9:00am");
  });
});

describe("activity types", () => {
  it("does not let an internal note be scheduled", () => {
    expect(SCHEDULABLE_TYPES.map((type) => type.value)).not.toContain("internal_note");
    expect(SCHEDULABLE_TYPES).toHaveLength(5);
  });

  it("labels known types and passes unknown ones through", () => {
    expect(typeLabel("whatsapp")).toBe("WhatsApp message");
    expect(typeLabel("other")).toBe("other");
  });
});
