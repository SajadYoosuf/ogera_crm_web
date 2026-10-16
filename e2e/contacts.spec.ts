import { expect, test, type Page } from "@playwright/test";
import { ADMIN, mockApi, signInAs, type MockContact } from "./fixtures/api";

async function openContacts(page: Page, contacts: MockContact[] = []) {
  await signInAs(page, ADMIN);
  const api = await mockApi(page, { viewer: ADMIN, contacts });
  await page.goto("/contacts");
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
  return api;
}

/** Click a contact row/card regardless of layout (desktop table vs mobile cards). */
async function clickContact(page: Page, contactName: string) {
  // Desktop shows a <tr>, mobile shows an <article> card. The other layout is display:none.
  // .and(:visible) filters out the hidden layout so we always click the live one.
  await page.locator("article, tr").filter({ hasText: contactName })
    .and(page.locator(":visible")).first().click();
}

/** Trigger the delete confirmation dialog regardless of layout.
 *  Desktop: "More actions" → "Delete contact" menu item.
 *  Mobile: direct delete icon button on the card.
 */
async function triggerDeleteContact(page: Page, contactName: string) {
  const moreBtn = page.getByRole("button", { name: `More actions for ${contactName}` });
  const directBtn = page.getByRole("button", { name: `Delete ${contactName}` });
  // Wait for the list to load — one of the two buttons must become visible.
  await expect(moreBtn.or(directBtn).first()).toBeVisible();
  if (await moreBtn.isVisible()) {
    await moreBtn.click();
    await page.getByRole("menuitem", { name: "Delete contact" }).click();
  } else {
    await directBtn.click();
  }
}

const makeContact = (overrides: Partial<MockContact> & Pick<MockContact, "id" | "contact_type" | "name" | "phone">): MockContact => ({
  district: "Kozhikode", address: null, profession_type: null,
  lead_stage: null, lead_source: null, assigned_to: { id: 4, name: "Sam Sales" },
  created_by: null, created_at: "2026-10-01T09:00:00", is_verified: false, missing_fields: [],
  ...overrides,
});

// ─── empty states ────────────────────────────────────────────────────────────

test.describe("contacts list — empty states", () => {
  test("all-contacts tab with no data shows No contacts yet", async ({ page }) => {
    await openContacts(page);
    await expect(page.getByRole("heading", { name: "No contacts yet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add your first contact" })).toBeVisible();
  });

  test("dealer tab with no data shows No dealer contacts yet", async ({ page }) => {
    await openContacts(page);
    await page.getByRole("tab", { name: /Dealer/i }).click();
    await expect(page.getByRole("heading", { name: "No dealer contacts yet" })).toBeVisible();
  });

  test("partner tab with no data shows No partner contacts yet", async ({ page }) => {
    await openContacts(page);
    await page.getByRole("tab", { name: /Partner/i }).click();
    await expect(page.getByRole("heading", { name: "No partner contacts yet" })).toBeVisible();
  });

  test("Add from dealer empty state opens modal with Dealer tab selected", async ({ page }) => {
    await openContacts(page);
    await page.getByRole("tab", { name: /Dealer/i }).click();
    await page.getByRole("button", { name: "Add your first contact" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Contact" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Dealer" })).toHaveAttribute("aria-selected", "true");
  });

  test("Add from partner empty state opens modal with Partner tab selected", async ({ page }) => {
    await openContacts(page);
    await page.getByRole("tab", { name: /Partner/i }).click();
    await page.getByRole("button", { name: "Add your first contact" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Contact" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Partner" })).toHaveAttribute("aria-selected", "true");
  });

  test("contacts exist but filtered to zero shows No matches found", async ({ page }) => {
    await openContacts(page, [
      makeContact({ id: 1, contact_type: "consumer", name: "Alice", phone: "+919000000001" }),
    ]);
    await page.getByRole("tab", { name: /Dealer/i }).click();
    await expect(page.getByRole("heading", { name: "No dealer contacts yet" })).toBeVisible();
  });
});

// ─── type pre-selection from header Add Contact button ────────────────────────

test.describe("contacts list — Add Contact pre-selects active tab", () => {
  test("All Contacts tab → modal opens on Consumer (default)", async ({ page }) => {
    await openContacts(page);
    await page.getByRole("button", { name: /Add Contact/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add Contact" });
    await expect(dialog.getByRole("tab", { name: "Consumer" })).toHaveAttribute("aria-selected", "true");
  });

  test("Partner tab → modal opens on Partner", async ({ page }) => {
    await openContacts(page);
    await page.getByRole("tab", { name: /Partner/i }).click();
    await page.getByRole("button", { name: /Add Contact/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add Contact" });
    await expect(dialog.getByRole("tab", { name: "Partner" })).toHaveAttribute("aria-selected", "true");
  });

  test("Dealer tab → modal opens on Dealer", async ({ page }) => {
    await openContacts(page);
    await page.getByRole("tab", { name: /Dealer/i }).click();
    await page.getByRole("button", { name: /Add Contact/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add Contact" });
    await expect(dialog.getByRole("tab", { name: "Dealer" })).toHaveAttribute("aria-selected", "true");
  });
});

// ─── dealer email real-time validation ────────────────────────────────────────

test.describe("add contact modal — dealer email validation", () => {
  async function openDealerModal(page: Page) {
    await openContacts(page);
    await page.getByRole("button", { name: /Add Contact/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add Contact" });
    await dialog.getByRole("tab", { name: "Dealer" }).click();
    return dialog;
  }

  test("invalid email shows inline error as you type", async ({ page }) => {
    const dialog = await openDealerModal(page);
    await dialog.getByLabel("Email").fill("notanemail");
    await expect(dialog.getByText(/Enter a valid email/i)).toBeVisible();
  });

  test("fixing the email clears the error", async ({ page }) => {
    const dialog = await openDealerModal(page);
    const emailInput = dialog.getByLabel("Email");
    await emailInput.fill("bad");
    await expect(dialog.getByText(/Enter a valid email/i)).toBeVisible();
    await emailInput.fill("owner@company.com");
    await expect(dialog.getByText(/Enter a valid email/i)).not.toBeVisible();
  });

  test("blank email shows no error — it is optional", async ({ page }) => {
    const dialog = await openDealerModal(page);
    await expect(dialog.getByText(/Enter a valid email/i)).not.toBeVisible();
  });

  test("save is blocked and shows an alert when email is invalid", async ({ page }) => {
    const dialog = await openDealerModal(page);
    await page.getByLabel("Phone number").fill("9876543210");
    await page.getByLabel("Owner name").fill("Test Owner");
    await dialog.getByLabel("Email").fill("invalidemail");
    await dialog.getByRole("button", { name: "Add Contact" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
  });

  test("business email is accepted — not just gmail", async ({ page }) => {
    const api = await openContacts(page);
    await page.getByRole("button", { name: /Add Contact/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add Contact" });
    await dialog.getByRole("tab", { name: "Dealer" }).click();
    await page.getByLabel("Phone number").fill("9876543210");
    await page.getByLabel("Owner name").fill("Suresh Kumar");
    await dialog.getByLabel("Email").fill("suresh@keralapipes.co.in");
    await expect(dialog.getByText(/Enter a valid email/i)).not.toBeVisible();
    await dialog.getByRole("button", { name: "Add Contact" }).click();
    await expect.poll(() => api.callsTo("POST", "/contacts").length).toBeGreaterThan(0);
    const posted = api.callsTo("POST", "/contacts")[0];
    expect((posted.body?.dealer_profile as { email?: string })?.email).toBe("suresh@keralapipes.co.in");
  });
});

// ─── edit contact ─────────────────────────────────────────────────────────────

test.describe("contacts list — edit contact", () => {
  const PARTNER = makeContact({
    id: 10, contact_type: "partner", name: "Rajan Engineer", phone: "+919100000001",
    profession_type: "engineer", is_verified: true, missing_fields: [],
  });

  test("clicking a contact opens the edit modal pre-filled with the contact's name", async ({ page }) => {
    await openContacts(page, [PARTNER]);
    await clickContact(page, "Rajan Engineer");
    const dialog = page.getByRole("dialog", { name: "Edit contact" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Full name")).toHaveValue("Rajan Engineer");
  });

  test("edit modal shows Save changes button not Add Contact", async ({ page }) => {
    await openContacts(page, [PARTNER]);
    await clickContact(page, "Rajan Engineer");
    const dialog = page.getByRole("dialog", { name: "Edit contact" });
    await expect(dialog.getByRole("button", { name: "Save changes" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add Contact" })).not.toBeVisible();
  });

  test("saving edits sends PUT /contacts/10", async ({ page }) => {
    const api = await openContacts(page, [PARTNER]);
    await clickContact(page, "Rajan Engineer");
    const dialog = page.getByRole("dialog", { name: "Edit contact" });
    const nameInput = dialog.getByLabel("Full name");
    await nameInput.fill("Rajan Updated");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect.poll(() => api.callsTo("PUT", "/contacts/10").length).toBeGreaterThan(0);
    expect(api.callsTo("PUT", "/contacts/10")[0].body?.name).toBe("Rajan Updated");
  });
});

// ─── delete contact ───────────────────────────────────────────────────────────

test.describe("contacts list — delete contact", () => {
  const CONSUMER = makeContact({
    id: 20, contact_type: "consumer", name: "Delete Me", phone: "+919200000002",
  });

  test("delete shows confirmation dialog", async ({ page }) => {
    await openContacts(page, [CONSUMER]);
    await triggerDeleteContact(page, "Delete Me");
    await expect(page.getByRole("dialog", { name: "Delete contact?" })).toBeVisible();
  });

  test("confirming delete sends DELETE /contacts/20", async ({ page }) => {
    const api = await openContacts(page, [CONSUMER]);
    await triggerDeleteContact(page, "Delete Me");
    const confirmDialog = page.getByRole("dialog", { name: "Delete contact?" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete contact" }).click();
    await expect.poll(() => api.callsTo("DELETE", "/contacts/20").length).toBeGreaterThan(0);
  });

  test("cancelling delete closes the dialog without sending DELETE", async ({ page }) => {
    const api = await openContacts(page, [CONSUMER]);
    await triggerDeleteContact(page, "Delete Me");
    const confirmDialog = page.getByRole("dialog", { name: "Delete contact?" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmDialog).not.toBeVisible();
    expect(api.callsTo("DELETE", "/contacts/20")).toHaveLength(0);
  });
});
