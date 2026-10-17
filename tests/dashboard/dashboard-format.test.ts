import { describe, expect, it } from "vitest";
import { changeLine, dueTimeLabel, initialOf, leadDisplayName, leadTypeLabel, overdueLabel, shortDate, stageColor } from "@/components/dashboard/dashboard-format";

describe("change line under a KPI", () => {
  it("shows an up change, a down change and no change", () => {
    expect(changeLine({ value: 5, previous: 2, change: 3 })).toEqual({ text: "+3 vs previous period", tone: "up" });
    expect(changeLine({ value: 1, previous: 4, change: -3 })).toEqual({ text: "−3 vs previous period", tone: "down" });
    expect(changeLine({ value: 4, previous: 4, change: 0 })).toEqual({ text: "No change vs previous period", tone: "muted" });
  });

  it("says All time when there is no previous period to compare with", () => {
    expect(changeLine({ value: 9, previous: null, change: null })).toEqual({ text: "All time", tone: "muted" });
  });
});

describe("stage colours", () => {
  it("keeps won and lost fixed and gives no stage a neutral grey", () => {
    expect(stageColor("won")).toBe("#12A56A");
    expect(stageColor("lost")).toBe("#E5484D");
    expect(stageColor(null)).toBe("#9AA0AC");
    expect(stageColor("no_stage")).toBe("#9AA0AC");
  });

  it("gives the same stage the same colour every time", () => {
    expect(stageColor("interested")).toBe(stageColor("interested"));
  });
});

describe("labels", () => {
  it("names the lead type, with a fallback for an unknown type", () => {
    expect(leadTypeLabel("dealer")).toBe("Dealer");
    expect(leadTypeLabel(null)).toBe("Lead");
  });

  it("shows the phone number when a lead has no name, and a placeholder when it has neither", () => {
    expect(leadDisplayName(null, "9811111111")).toBe("9811111111");
    expect(leadDisplayName("   ", "9811111111")).toBe("9811111111");
    expect(leadDisplayName("Asha", "9811111111")).toBe("Asha");
    expect(leadDisplayName(null, null)).toBe("Unnamed lead");
  });

  it("uses an initial that is safe for empty and symbol-led names", () => {
    expect(initialOf("asha")).toBe("A");
    expect(initialOf("  ")).toBe("#");
  });

  it("reads the due time from the stored wall-clock text without a timezone shift", () => {
    expect(dueTimeLabel("2026-10-17T18:05:00")).toBe("18:05");
    expect(dueTimeLabel("")).toBe("");
  });

  it("pluralises the overdue text and hides it when nothing is overdue", () => {
    expect(overdueLabel(0)).toBe("");
    expect(overdueLabel(1)).toBe("1 day overdue");
    expect(overdueLabel(3)).toBe("3 days overdue");
  });

  it("formats a created date from its calendar day", () => {
    expect(shortDate("2026-10-17T23:50:00")).toMatch(/17/);
    expect(shortDate("not a date")).toBe("");
  });
});
