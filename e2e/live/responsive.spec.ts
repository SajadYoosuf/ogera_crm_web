import { expect, request as playwrightRequest, test, type Locator, type Page } from "@playwright/test";
import { API, apiSession, authed, createLead, email, isoDate, PASSWORD } from "./helpers";

/** Runs on the desktop (1366), tablet (768) and phone (Pixel 7) projects from playwright.live.config.ts. */

async function signIn(page: Page, key: string) {
  await page.goto("/");
  await page.locator("#email").fill(email(key));
  await page.locator("#password").fill(PASSWORD);
  await page.locator("button.login-submit").click();
  await page.waitForURL(/\/dashboard/);
}

/** The page never scrolls sideways: the content is no wider than the screen. */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page is wider than the screen").toBeLessThanOrEqual(1);
}

/** The whole element is on screen horizontally (it may need a vertical scroll). */
async function expectInsideScreen(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const width = page.viewportSize()!.width;
  expect(box, "no box for element").not.toBeNull();
  expect(box!.x, "cut off on the left").toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width, "cut off on the right").toBeLessThanOrEqual(width + 1);
}

async function seedTask(name: string, taskTitle: string, offsetDays: number) {
  const anu = await apiSession("anu");
  const api = await playwrightRequest.newContext({ baseURL: API });
  const contactId = await createLead(api, anu, name);
  const response = await api.post(`/contacts/${contactId}/followups`, {
    headers: authed(anu.token),
    data: { title: taskTitle, channel: "call", due_at: `${isoDate(offsetDays)}T${offsetDays === 0 ? "23:30" : "10:30"}:00`, assigned_to: anu.id },
  });
  expect(response.status()).toBe(201);
  await api.dispose();
}

test("the Tasks screen fits the screen and its rows stay readable", async ({ page }) => {
  const name = `Fit ${Date.now()}`;
  await seedTask(name, `Quote follow-up ${Date.now()}`, 1);
  await signIn(page, "anu");
  await page.goto("/dashboard/tasks");
  await expect(page.getByText(name).first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectInsideScreen(page, page.getByRole("tablist", { name: "Task status filter" }));
});

test("the Lead Pipeline and an open lead fit the screen", async ({ page }) => {
  const name = `Board ${Date.now()}`;
  const anu = await apiSession("anu");
  const api = await playwrightRequest.newContext({ baseURL: API });
  await createLead(api, anu, name);
  await api.dispose();
  await signIn(page, "anu");
  await page.goto("/dashboard/followups");
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByText(name, { exact: true }).first().click();
  const tabs = page.getByRole("tablist", { name: "Lead detail tabs" });
  await expectInsideScreen(page, tabs);
  await expectNoSidewaysScroll(page);
});

test("the reschedule dialog and the mark-done dialog fit the screen", async ({ page }, testInfo) => {
  const name = `Dialog ${Date.now()}`;
  await seedTask(name, `Visit ${Date.now()}`, 0);
  await signIn(page, "anu");
  await page.goto("/dashboard/tasks");
  const item = page.locator("tbody tr, article").filter({ hasText: name }).first();
  await expect(item).toBeVisible();

  const openFrom = async (action: "Reschedule" | "Mark done") => {
    if (testInfo.project.name === "phone") {
      await item.getByRole("button", { name: action }).click();
    } else {
      await item.getByRole("button", { name: /^Actions for/ }).click();
      await expectInsideScreen(page, page.getByRole("menu"));
      await page.getByRole("menuitem", { name: action }).click();
    }
  };

  await openFrom("Reschedule");
  const reschedule = page.locator("form", { has: page.getByLabel("New due date") });
  await expectInsideScreen(page, reschedule.getByRole("button", { name: "Save new date" }));
  await expectNoSidewaysScroll(page);
  await reschedule.getByRole("button", { name: "Cancel" }).click();

  await openFrom("Mark done");
  const log = page.locator("form", { has: page.getByLabel("What happened?") });
  await expectInsideScreen(page, log.getByRole("button", { name: "Save & mark done" }));
  await expectNoSidewaysScroll(page);
});

test("the schedule form fits the screen on a phone and a tablet", async ({ page }) => {
  const name = `Form ${Date.now()}`;
  const anu = await apiSession("anu");
  const api = await playwrightRequest.newContext({ baseURL: API });
  await createLead(api, anu, name);
  await api.dispose();
  await signIn(page, "anu");
  await page.goto("/dashboard/followups");
  await page.getByText(name, { exact: true }).first().click();
  await page.getByRole("tablist", { name: "Lead detail tabs" }).getByRole("tab", { name: /^Follow-ups/ }).click();
  await page.getByRole("button", { name: "Schedule Followup" }).first().click();
  const form = page.locator("form", { has: page.getByLabel("Due Date") });
  await expectInsideScreen(page, form.getByLabel("Due Date"));
  await expectInsideScreen(page, form.getByRole("button", { name: "Schedule Followup" }));
  await expectNoSidewaysScroll(page);
});
