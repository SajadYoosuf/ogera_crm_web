import { describe, expect, it } from "vitest";
import { addDays, monthWeeks, rangeFor, shift, startOfWeek, titleFor } from "@/components/tasks/calendar";

describe("task calendar maths", () => {
  it("starts the week on Monday", () => {
    expect(startOfWeek("2026-10-09")).toBe("2026-10-05"); // a Friday
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05"); // a Sunday belongs to the week before
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("asks the server for exactly the days a view shows", () => {
    expect(rangeFor("day", "2026-10-09")).toEqual({ from: "2026-10-09", to: "2026-10-09" });
    expect(rangeFor("week", "2026-10-09")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
    // October 2026 starts on a Thursday and ends on a Saturday, so the grid runs Monday 28 Sep to Sunday 1 Nov
    expect(rangeFor("month", "2026-10-09")).toEqual({ from: "2026-09-28", to: "2026-11-01" });
  });

  it("builds whole Monday-first weeks for the month grid and stays within the server's 62-day limit", () => {
    const weeks = monthWeeks("2026-10-09");
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    const longest = monthWeeks("2026-08-15"); // August 2026 spans six weeks
    expect(longest).toHaveLength(6);
    expect(longest.length * 7).toBeLessThanOrEqual(62);
  });

  it("moves by a day, a week or a month and clamps the day of month", () => {
    expect(shift("day", "2026-10-09", 1)).toBe("2026-10-10");
    expect(shift("week", "2026-10-09", -1)).toBe("2026-10-02");
    expect(shift("month", "2026-10-31", 1)).toBe("2026-11-30");
    expect(shift("month", "2026-01-31", 1)).toBe("2026-02-28");
    expect(shift("month", "2026-01-15", -1)).toBe("2025-12-15");
  });

  it("titles each view", () => {
    expect(titleFor("month", "2026-10-09")).toBe("October 2026");
    expect(titleFor("week", "2026-10-09")).toBe("5 Oct – 11 Oct 2026");
    expect(titleFor("day", "2026-10-09")).toContain("9 Oct 2026");
  });
});
