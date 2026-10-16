import { describe, expect, it } from "vitest";
import { blankContact, KIND_LABELS, toForm, TYPE_TABS } from "@/features/contacts/utils";
import type { Contact } from "@/features/contacts/utils";

const baseContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 1, kind: "consumer", name: "Test Contact", phone: "+919000000001",
  source: "Meta", address: undefined, district: "Kozhikode",
  assignedTo: "Sam Sales", assignedToId: 4, createdAt: "2026-10-01T09:00:00",
  isVerified: true, missingFields: [], ...overrides,
});

describe("blankContact", () => {
  it("defaults to consumer type", () => {
    expect(blankContact.contactType).toBe("consumer");
  });

  it("has empty dealer fields", () => {
    expect(blankContact.dealerOwnerName).toBe("");
    expect(blankContact.dealerEmail).toBe("");
  });

  it("has empty partner type and house stage", () => {
    expect(blankContact.partnerType).toBe("");
    expect(blankContact.houseStage).toBe("");
  });

  it("has empty name and phone", () => {
    expect(blankContact.name).toBe("");
    expect(blankContact.phone).toBe("");
  });
});

describe("toForm", () => {
  it("maps a consumer contact's type correctly", () => {
    const form = toForm(baseContact({ kind: "consumer" }));
    expect(form.contactType).toBe("consumer");
  });

  it("always initialises dealer fields to empty strings (dealer detail is loaded async)", () => {
    const form = toForm(baseContact({ kind: "dealer" }));
    expect(form.contactType).toBe("dealer");
    expect(form.dealerOwnerName).toBe("");
    expect(form.dealerEmail).toBe("");
  });

  it("maps a partner contact and preserves partner type from the list row", () => {
    const form = toForm(baseContact({ kind: "partner", profession: "plumber" }));
    expect(form.contactType).toBe("partner");
    expect(form.partnerType).toBe("plumber");
  });

  it("sets assignedTo from assignedToId as a string", () => {
    const form = toForm(baseContact({ assignedToId: 7 }));
    expect(form.assignedTo).toBe("7");
  });

  it("uses empty string when assignedToId is absent", () => {
    const form = toForm(baseContact({ assignedToId: undefined, assignedTo: undefined }));
    expect(form.assignedTo).toBe("");
  });

  it("sets address and district from the contact", () => {
    const form = toForm(baseContact({ address: "MG Road", district: "Ernakulam" }));
    expect(form.address).toBe("MG Road");
    expect(form.district).toBe("Ernakulam");
  });

  it("uses empty string when address is undefined", () => {
    const form = toForm(baseContact({ address: undefined }));
    expect(form.address).toBe("");
  });
});

describe("TYPE_TABS", () => {
  it("has four tabs in order: all, consumer, partner, dealer", () => {
    expect(TYPE_TABS.map((tab) => tab.value)).toEqual(["", "consumer", "partner", "dealer"]);
  });

  it("labels each tab correctly", () => {
    const labels = TYPE_TABS.map((tab) => tab.label);
    expect(labels).toContain("All Contacts");
    expect(labels).toContain("Consumer");
    expect(labels).toContain("Partner");
    expect(labels).toContain("Dealer");
  });
});

describe("KIND_LABELS", () => {
  it("names all three contact types", () => {
    expect(KIND_LABELS.consumer).toBe("Consumer");
    expect(KIND_LABELS.partner).toBe("Partner");
    expect(KIND_LABELS.dealer).toBe("Dealer");
  });
});
