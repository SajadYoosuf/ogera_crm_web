import { describe, expect, it } from "vitest";
import { isLeadConverted } from "@/features/leads/api/leads";

// isLeadConverted decides whether the UI locks a lead's status and hides "Convert".
// A lead counts as converted if its status says so OR it has a contact link.
describe("isLeadConverted", () => {
  it("is false for an open lead with no contact", () => {
    expect(isLeadConverted({ status: "new", contact_id: null })).toBe(false);
  });

  it("is true when the status is converted", () => {
    expect(isLeadConverted({ status: "converted", contact_id: 12 })).toBe(true);
    expect(isLeadConverted({ status: "converted" })).toBe(true);
  });

  it("is true when a contact is linked, even if the status drifted", () => {
    expect(isLeadConverted({ status: "contacted", contact_id: 7 })).toBe(true);
  });
});
