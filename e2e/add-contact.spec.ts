import { expect, test, type Page } from "@playwright/test";
import { ADMIN, mockApi, signInAs, type MockApi } from "./fixtures/api";

async function openContacts(page: Page): Promise<MockApi> {
  await signInAs(page, ADMIN);
  const api = await mockApi(page, { viewer: ADMIN });
  await page.goto("/contacts");
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
  return api;
}

/** Opens the Add Contact modal and returns a locator scoped to it. */
async function openAddModal(page: Page) {
  await page.getByRole("button", { name: /Add Contact/i }).click();
  const dialog = page.getByRole("dialog", { name: "Add Contact" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("add contact modal — type tabs", () => {
  test("opens with Consumer tab selected by default", async ({ page }) => {
    await openContacts(page);
    const dialog = await openAddModal(page);
    await expect(dialog.getByRole("tab", { name: "Consumer" })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("tab", { name: "Partner" })).toHaveAttribute("aria-selected", "false");
    await expect(dialog.getByRole("tab", { name: "Dealer" })).toHaveAttribute("aria-selected", "false");
  });

  test("switching to Partner shows the profession field", async ({ page }) => {
    await openContacts(page);
    const dialog = await openAddModal(page);
    await dialog.getByRole("tab", { name: "Partner" }).click();
    await expect(dialog.getByRole("button", { name: "Partner type" })).toBeVisible();
  });

  test("switching to Dealer shows owner-name field and hides profession", async ({ page }) => {
    await openContacts(page);
    const dialog = await openAddModal(page);
    await dialog.getByRole("tab", { name: "Dealer" }).click();
    await expect(dialog.getByLabel("Owner name")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Partner type" })).not.toBeVisible();
  });

  test("edit mode shows a type badge instead of tabs", async ({ page }) => {
    await signInAs(page, ADMIN);
    await mockApi(page, {
      viewer: ADMIN,
      contacts: [{
        id: 50, contact_type: "partner", name: "Rajan Engineer", phone: "+919100000001",
        district: "Kozhikode", address: null, profession_type: "engineer",
        lead_stage: null, lead_source: null, assigned_to: { id: 4, name: "Sam Sales" },
        created_by: null, created_at: "2026-10-01T09:00:00", is_verified: true, missing_fields: [],
      }],
    });
    await page.goto("/contacts");
    await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
    await page.getByText("Rajan Engineer").filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Edit contact" });
    await expect(dialog).toBeVisible();
    // Edit mode must not show the type tab switcher.
    await expect(dialog.getByRole("tablist", { name: "Contact type" })).not.toBeVisible();
    // A read-only "Partner" badge is shown instead.
    await expect(dialog.getByText("Partner", { exact: true })).toBeVisible();
  });
});

test.describe("add contact modal — validation", () => {
  test("saving a partner without a profession type shows an error", async ({ page }) => {
    await openContacts(page);
    const dialog = await openAddModal(page);
    await dialog.getByRole("tab", { name: "Partner" }).click();
    await page.getByLabel("Phone number").fill("9876543210");
    await dialog.getByRole("button", { name: "Add Contact" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Select the partner type");
  });

  test("saving a dealer without an owner name shows an error", async ({ page }) => {
    await openContacts(page);
    const dialog = await openAddModal(page);
    await dialog.getByRole("tab", { name: "Dealer" }).click();
    await page.getByLabel("Phone number").fill("9876543210");
    await dialog.getByRole("button", { name: "Add Contact" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Owner name is required");
  });

  test("saving without a phone number shows an error", async ({ page }) => {
    await openContacts(page);
    const dialog = await openAddModal(page);
    await dialog.getByRole("button", { name: "Add Contact" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
  });
});

test.describe("add contact modal — happy paths", () => {
  test("adds a consumer contact with blank name — phone becomes the display name", async ({ page }) => {
    const api = await openContacts(page);
    const dialog = await openAddModal(page);
    // Name left blank on purpose (it is optional per rule.md)
    await page.getByLabel("Phone number").fill("9876543210");
    await dialog.getByRole("button", { name: "Add Contact" }).click();
    await expect.poll(() => api.callsTo("POST", "/contacts").length).toBeGreaterThan(0);
    const posted = api.callsTo("POST", "/contacts")[0];
    expect(posted.body?.contact_type).toBe("consumer");
    expect(posted.body?.name).toBe("");
  });

  test("adds a partner contact with a profession type", async ({ page }) => {
    const api = await openContacts(page);
    const dialog = await openAddModal(page);
    await dialog.getByRole("tab", { name: "Partner" }).click();
    await page.getByLabel("Phone number").fill("9876543210");
    await dialog.getByRole("button", { name: "Partner type" }).click();
    await page.getByRole("option", { name: "Plumber" }).click();
    await dialog.getByRole("button", { name: "Add Contact" }).click();
    await expect.poll(() => api.callsTo("POST", "/contacts").length).toBeGreaterThan(0);
    const posted = api.callsTo("POST", "/contacts")[0];
    expect(posted.body?.contact_type).toBe("partner");
    expect((posted.body?.partner_profile as { profession_type: string })?.profession_type).toBe("plumber");
  });

  test("adds a dealer contact with an owner name", async ({ page }) => {
    const api = await openContacts(page);
    const dialog = await openAddModal(page);
    await dialog.getByRole("tab", { name: "Dealer" }).click();
    await page.getByLabel("Shop / dealer name").fill("Kerala Pipes Ltd");
    await page.getByLabel("Phone number").fill("9876543210");
    await page.getByLabel("Owner name").fill("Suresh Kumar");
    await dialog.getByRole("button", { name: "Add Contact" }).click();
    await expect.poll(() => api.callsTo("POST", "/contacts").length).toBeGreaterThan(0);
    const posted = api.callsTo("POST", "/contacts")[0];
    expect(posted.body?.contact_type).toBe("dealer");
    expect((posted.body?.dealer_profile as { owner_name: string })?.owner_name).toBe("Suresh Kumar");
    expect(posted.body?.name).toBe("Kerala Pipes Ltd");
  });
});

test.describe("add contact modal — UX", () => {
  test("backdrop click closes the modal", async ({ page }) => {
    await openContacts(page);
    const dialog = await openAddModal(page);
    // Click the backdrop (top-left corner, well outside the centered dialog)
    await page.mouse.click(10, 10);
    await expect(dialog).not.toBeVisible();
  });

  test("Cancel button closes the modal", async ({ page }) => {
    await openContacts(page);
    const dialog = await openAddModal(page);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Close (×) button closes the modal", async ({ page }) => {
    await openContacts(page);
    const dialog = await openAddModal(page);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).not.toBeVisible();
  });
});
