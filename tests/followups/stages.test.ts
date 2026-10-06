import { describe, expect, it } from "vitest";
import { NEXT_STAGE, STAGES, columnFor, stageClock } from "@/components/followups/stages";

const at = (iso: string) => new Date(iso).getTime();

describe("stageClock", () => {
  const changedAt = "2026-10-05T10:00:00";

  it("is not overdue before 24h on a new lead", () => {
    expect(stageClock("new_lead", changedAt, at("2026-10-06T09:00:00"))?.overdue).toBe(false);
  });

  it("is overdue after 24h on a new lead", () => {
    expect(stageClock("new_lead", changedAt, at("2026-10-06T11:00:00"))?.overdue).toBe(true);
  });

  it("starts a 3-day follow-up clock on a quoted lead", () => {
    expect(stageClock("quoted", changedAt, at("2026-10-07T10:00:00"))?.overdue).toBe(false);
    expect(stageClock("quoted", changedAt, at("2026-10-08T11:00:00"))?.overdue).toBe(true);
  });

  it("asks to re-engage a lost lead after 60 days", () => {
    expect(stageClock("lost", changedAt, at("2026-12-05T10:00:00"))?.label).toBe("Re-engage now");
  });

  it("has no clock for stages without one", () => {
    expect(stageClock("won", changedAt, at("2027-01-01T00:00:00"))).toBeNull();
  });
});

describe("columnFor", () => {
  it("keeps a known stage in its own column", () => {
    expect(columnFor("connected")).toBe("connected");
  });

  it("puts a lead with no stage in New Lead", () => {
    expect(columnFor(null)).toBe("new_lead");
    expect(columnFor(undefined)).toBe("new_lead");
  });

  it("maps the legacy referral stage to Repeat Customer", () => {
    expect(columnFor("referral")).toBe("repeat_customer");
  });
});

describe("pipeline", () => {
  it("lists the stages in the agreed order", () => {
    expect(STAGES.map((stage) => stage.slug)).toEqual([
      "new_lead", "first_call", "connected", "aware", "interested", "quoted", "negotiating", "won", "lost", "repeat_customer",
    ]);
  });

  it("only ever offers a later stage as the quick next step", () => {
    const order = STAGES.map((stage) => stage.slug);
    for (const [from, to] of Object.entries(NEXT_STAGE)) {
      expect(order.indexOf(to!)).toBeGreaterThan(order.indexOf(from as (typeof order)[number]));
    }
  });
});
