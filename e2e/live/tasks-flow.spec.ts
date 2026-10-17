import { expect, request as playwrightRequest, test, type Locator, type Page } from "@playwright/test";
import { API, apiSession, authed, createLead, email, isoDate, PASSWORD, type Session } from "./helpers";

async function signIn(page: Page, key: string) {
  await page.goto("/");
  await page.locator("#email").fill(email(key));
  await page.locator("#password").fill(PASSWORD);
  await page.locator("button.login-submit").click();
  await page.waitForURL(/\/dashboard/);
}

/** A lead for `session` with one open follow-up due in `offsetDays`, created through the API. */
async function leadWithTask(session: Session, name: string, taskTitle: string, offsetDays: number) {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const contactId = await createLead(api, session, name);
  const response = await api.post(`/contacts/${contactId}/followups`, {
    headers: authed(session.token),
    data: { title: taskTitle, channel: "call", due_at: `${isoDate(offsetDays)}T${offsetDays === 0 ? "23:30" : "10:30"}:00`, assigned_to: session.id },
  });
  expect(response.status(), await response.text()).toBe(201);
  await api.dispose();
  return contactId;
}

/** The task's row (table, tablet and desktop) or card (phone) on the Tasks screen. */
function taskItem(page: Page, leadName: string): Locator {
  return page.locator("tbody tr, article").filter({ hasText: leadName }).first();
}

test("mark a task done: log the activity, then decide on the next follow-up", async ({ page }, testInfo) => {
  const session = await apiSession("anu");
  const name = `Done ${Date.now()}`;
  await leadWithTask(session, name, "Confirm quote", 0);
  await signIn(page, "anu");
  await page.goto("/dashboard/tasks");

  const item = taskItem(page, name);
  await expect(item).toBeVisible();
  if (testInfo.project.name === "phone") {
    await item.getByRole("button", { name: "Mark done" }).click();
  } else {
    await item.getByRole("button", { name: /^Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Mark done" }).click();
  }

  const logForm = page.locator("form", { has: page.getByLabel("What happened?") });
  await logForm.getByRole("button", { name: "Save & mark done" }).click();
  await expect(page.getByText("Write what happened before marking this done.")).toBeVisible();
  await logForm.getByLabel("What happened?").fill("Customer will confirm on Friday");
  await logForm.getByRole("button", { name: "Save & mark done" }).click();

  await expect(page.getByRole("heading", { name: "Schedule a follow-up?" })).toBeVisible();
  await page.getByRole("button", { name: "No, that's all" }).click();
  await expect(page.getByText(`Done. The activity was logged for ${name}.`)).toBeVisible();
  // The list keeps finished tasks (default filter is All): the row now reads Done and offers no actions.
  await expect(taskItem(page, name).getByText("Done", { exact: true })).toBeVisible();
  await expect(taskItem(page, name).getByRole("button", { name: /^Actions for|^Mark done$/ })).toHaveCount(0);
});

test("reschedule a task and see the move in the lead's history", async ({ page }, testInfo) => {
  const session = await apiSession("anu");
  const name = `Move ${Date.now()}`;
  const taskTitle = `Demo visit ${Date.now()}`;
  await leadWithTask(session, name, taskTitle, 1);
  await signIn(page, "anu");
  await page.goto("/dashboard/tasks");

  const item = taskItem(page, name);
  await expect(item).toBeVisible();
  await expect(item.getByText(taskTitle, { exact: true })).toBeVisible(); // the task's name is shown on its row
  if (testInfo.project.name === "phone") {
    await item.getByRole("button", { name: "Reschedule" }).click();
  } else {
    await item.getByRole("button", { name: /^Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Reschedule" }).click();
  }

  const form = page.locator("form", { has: page.getByLabel("New due date") });
  await expect(form.getByText(name, { exact: true })).toBeVisible(); // the dialog shows the task's own values
  const next = isoDate(4);
  await form.getByLabel("New due date").fill(next);
  await form.getByRole("button", { name: "Save new date" }).click();
  await expect(page.getByText(`Moved to ${next}.`)).toBeVisible();

  await page.goto("/dashboard/followups");
  await page.getByText(name, { exact: true }).first().click();
  await page.getByRole("tablist", { name: "Lead detail tabs" }).getByRole("tab", { name: /^History/ }).click();
  await expect(page.getByText(`Follow-up rescheduled: ${taskTitle}`)).toBeVisible();
  await expect(page.getByText("Rescheduled", { exact: false }).first()).toBeVisible();
});
