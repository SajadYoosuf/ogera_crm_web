import { expect, request as playwrightRequest, test, type Page } from "@playwright/test";
import { API, apiSession, createLead, email, isoDate, PASSWORD } from "./helpers";

async function signIn(page: Page, key: string) {
  await page.goto("/");
  await page.locator("#email").fill(email(key));
  await page.locator("#password").fill(PASSWORD);
  await page.locator("button.login-submit").click();
  await page.waitForURL(/\/dashboard/);
}

/** Open a lead from the pipeline board by its name. */
async function openLead(page: Page, name: string) {
  await page.goto("/dashboard/followups");
  await page.getByText(name, { exact: true }).first().click();
  await expect(page.getByRole("tablist", { name: "Lead detail tabs" })).toBeVisible();
}

async function newLeadFor(name: string) {
  const anu = await apiSession("anu");
  const api = await playwrightRequest.newContext({ baseURL: API });
  const id = await createLead(api, anu, name);
  await api.dispose();
  return { id, anu };
}

test("schedule a follow-up and log an activity from the lead, then see both in history", async ({ page }) => {
  const name = `Pipeline ${Date.now()}`;
  await newLeadFor(name);
  await signIn(page, "anu");
  await openLead(page, name);

  const tabs = page.getByRole("tablist", { name: "Lead detail tabs" });
  await tabs.getByRole("tab", { name: /^Follow-ups/ }).click();
  await page.getByRole("button", { name: "Schedule Followup" }).first().click();
  const dialog = page.locator("form", { has: page.getByLabel("Due Date") });
  await dialog.getByLabel("Task name (optional)").fill("Send quote E2E");
  await dialog.getByLabel("Due Date").fill(isoDate(2));
  await dialog.getByRole("button", { name: "Schedule Followup" }).click();
  await expect(page.getByText("Send quote E2E").first()).toBeVisible();

  await tabs.getByRole("tab", { name: /^Activity log/ }).click();
  await page.getByRole("button", { name: "Log New Activity" }).first().click();
  const logForm = page.locator("form", { has: page.getByLabel("Details") });
  await logForm.getByLabel("Details").fill("Called, customer asked for the price");
  await logForm.getByRole("button", { name: "Save Activity" }).click();
  await expect(page.getByText("Called, customer asked for the price").first()).toBeVisible();

  await tabs.getByRole("tab", { name: /^History/ }).click();
  await expect(page.getByText("Follow-up: Send quote E2E")).toBeVisible();
  await expect(page.getByText("Called, customer asked for the price")).toBeVisible();
});
