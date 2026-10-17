import { describe, expect, it } from "vitest";
import { AVATAR_COLORS, LOSS_REASONS, formatCardDate, initials, stageColors, whatsappLink } from "@/components/followups/stages";

describe("stageColors", () => {
  it("returns known colors for a recognised slug", () => {
    const { bar, badgeBg, badgeFg } = stageColors("won");
    expect(bar).toBe("#0E7A4F");
    expect(badgeBg).toBe("#EAF8EF");
    expect(badgeFg).toBe("#0E7A4F");
  });

  it("falls back to default colors for an unknown slug", () => {
    const { bar } = stageColors("unknown_stage");
    expect(bar).toBe("#64748B");
  });
});

describe("initials", () => {
  it("takes first letter of first two words", () => {
    expect(initials("Asha Rajan")).toBe("AR");
  });

  it("single word gives one letter", () => {
    expect(initials("Priya")).toBe("P");
  });

  it("falls back to ? for empty string", () => {
    expect(initials("")).toBe("?");
  });
});

describe("whatsappLink", () => {
  it("prepends +91 to a bare 10-digit number", () => {
    expect(whatsappLink("9800000001")).toBe("https://wa.me/919800000001");
  });

  it("uses the number as-is when it already has a country code", () => {
    expect(whatsappLink("+919800000001")).toBe("https://wa.me/919800000001");
  });
});

describe("formatCardDate", () => {
  it("returns a short weekday + date string", () => {
    expect(formatCardDate("2026-10-16T09:00:00")).toMatch(/\w{3},? \d+ \w{3}/) // the comma depends on the Node locale data;
  });

  it("returns empty string for an invalid date", () => {
    expect(formatCardDate("not-a-date")).toBe("");
  });
});

describe("AVATAR_COLORS", () => {
  it("has exactly 5 entries", () => {
    expect(AVATAR_COLORS).toHaveLength(5);
  });
});

describe("LOSS_REASONS", () => {
  it("includes price and competitor", () => {
    const values = LOSS_REASONS.map((r) => r.value);
    expect(values).toContain("price");
    expect(values).toContain("competitor");
  });
});
