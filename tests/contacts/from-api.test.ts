import { describe, expect, it } from "vitest";
import { fromApi } from "@/features/contacts/utils";
import type { ApiContact } from "@/features/contacts/api/contacts";

// fromApi turns one GET /contacts row into the Contact shape the table uses.
const apiRow = (overrides: Partial<ApiContact> = {}): ApiContact => ({
  id: 7, contact_type: "consumer", name: "Asha", phone: "+919000000007", address: null, district: "Malappuram",
  profession_type: null, lead_stage: null, lead_source: null, assigned_to: null,
  created_by: { id: 3, name: "Anu Sales" }, created_by_branch: "kottakkal",
  created_at: "2026-10-01T09:00:00", is_verified: true, missing_fields: [], ...overrides,
});

describe("fromApi creator fields", () => {
  it("maps created_by name and branch", () => {
    const contact = fromApi(apiRow());
    expect(contact.createdBy).toBe("Anu Sales");
    expect(contact.createdByBranch).toBe("kottakkal");
  });

  it("leaves creator fields undefined when the contact has no creator", () => {
    const contact = fromApi(apiRow({ created_by: null, created_by_branch: null }));
    expect(contact.createdBy).toBeUndefined();
    expect(contact.createdByBranch).toBeUndefined();
  });

  it("keeps the creator name when the creator has no branch", () => {
    const contact = fromApi(apiRow({ created_by_branch: null }));
    expect(contact.createdBy).toBe("Anu Sales");
    expect(contact.createdByBranch).toBeUndefined();
  });
});
