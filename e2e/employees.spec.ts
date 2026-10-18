import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { ADMIN, MANAGER, mockApi, seedEmployees, signInAs, type MockEmployee, type Viewer } from "./fixtures/api";

/** Extra employees so the list runs over several pages. */
const manyEmployees = (count: number): MockEmployee[] => Array.from({ length: count }, (_, index) => {
  const number = index + 1;
  const stamp = "2026-09-30T08:40:00";
  return {
    id: 100 + index, name: `Staff ${String(number).padStart(2, "0")}`, email: `staff${number}@ogera.com`, role: "sales_executive",
    is_field_staff: false, phone: null, is_active: true, created_at: stamp, updated_at: stamp, deleted_at: null,
  };
});

async function openEmployees(page: Page, viewer: Viewer = ADMIN, options: Parameters<typeof mockApi>[1] = {}) {
  await signInAs(page, viewer);
  // The mock applies the backend's visibility rule for whoever is signed in.
  const api = await mockApi(page, { ...options, viewer });
  await page.goto("/dashboard/employees");
  return api;
}

/** One visible row per employee: the table on wide screens, the cards on smaller ones. */
const people = (page: Page): Locator => page.locator("tbody tr:visible, article:visible");
// The button reads just the label until a value is chosen, then "Label: value".
const openDropdown = (page: Page, label: "Role") => page.getByRole("button", { name: new RegExp(`^${label}(:|$)`) }).click();
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });

test.describe("employees list", () => {
  test("shows the team in a paginated list and loads only from /employees", async ({ page }) => {
    const api = await openEmployees(page);

    await expect(page.getByRole("heading", { level: 1, name: "Employees" })).toBeVisible();
    await expect(people(page)).toHaveCount(7); // Ada Admin is never listed for an admin
    await expect(page.getByText("Showing 1 to 7 of 7 employees")).toBeVisible();

    expect(api.callsTo("GET", "/employees").length).toBeGreaterThan(0);
    expect(api.calls.filter((call) => call.path.startsWith("/contacts"))).toHaveLength(0);
  });

  test("searches by name and clears filters", async ({ page }) => {
    await openEmployees(page);

    await page.getByLabel("Search employees").fill("tia");
    await expect(people(page)).toHaveCount(1);
    await expect(people(page).filter({ hasText: "Tia Caller" })).toBeVisible();

    await page.getByLabel("Search employees").fill("zzz");
    await expect(page.getByText("No matches found")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(people(page)).toHaveCount(7);
  });

  test("shows the phone number in the details dialog", async ({ page }) => {
    await openEmployees(page);
    await people(page).filter({ hasText: "Maya Manager" }).click();
    await expect(dialog(page, "Maya Manager")).toContainText("+91 98765 43210");
  });

  test("role dropdown lists every role and filters", async ({ page }) => {
    await openEmployees(page);
    await openDropdown(page, "Role");

    const options = page.getByRole("listbox", { name: "Role" }).getByRole("option");
    await expect(options).toHaveCount(7); // the 7 API roles; no "All" entry
    for (const role of ["admin", "manager", "team lead", "sales executive", "tele caller", "field executive", "support"]) {
      await expect(options.filter({ hasText: new RegExp(`^${role}`, "i") })).toHaveCount(1);
    }

    await options.filter({ hasText: /^sales executive/i }).click();
    await expect(people(page)).toHaveCount(2);
    await expect(page.getByRole("listbox")).toBeHidden();
    // (Sam Sales and Ian Inactive are the two sales executives visible to an admin.)
  });

  test("the role dropdown shows only its label until chosen, and re-picking clears the choice", async ({ page }) => {
    await openEmployees(page);
    await expect(page.getByRole("button", { name: /^Role$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Joined date/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Status/ })).toHaveCount(0);
    await expect(page.getByText("All roles")).toHaveCount(0);

    await openDropdown(page, "Role");
    await page.getByRole("option", { name: /^sales executive/i }).click();
    await expect(people(page)).toHaveCount(2);
    await expect(page.getByRole("button", { name: /^Role: sales executive/i })).toBeVisible();

    await openDropdown(page, "Role");
    await page.getByRole("option", { name: /^sales executive/i }).click();
    await expect(people(page)).toHaveCount(7);
    await expect(page.getByRole("button", { name: /^Role$/ })).toBeVisible();
  });

  test("the role dropdown closes on Escape", async ({ page }) => {
    await openEmployees(page);

    await openDropdown(page, "Role");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
  });

  test("exports the filtered employees as a CSV file", async ({ page }) => {
    await openEmployees(page);
    await page.getByLabel("Search employees").fill("sam");

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^employees-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = readFileSync((await download.path()) as string, "utf8");
    expect(text.split("\r\n")[0]).toBe('"Name","Email","Phone","Role","Status","Joined"');
    expect(text).toContain('"Sam Sales"');
    expect(text).not.toContain('"Tia Caller"');
  });

  test("opens the details dialog from GET /employees/{id}", async ({ page }) => {
    const api = await openEmployees(page);
    await people(page).filter({ hasText: "Sam Sales" }).click();

    await expect(dialog(page, "Sam Sales")).toBeVisible();
    await expect(dialog(page, "Sam Sales")).toContainText("sam.sales@ogera.com");
    await expect.poll(() => api.callsTo("GET", "/employees/4").length).toBe(1);
  });

  test("does not overflow horizontally", async ({ page }) => {
    await openEmployees(page);
    await expect(people(page)).toHaveCount(7);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("add employee", () => {
  test("validates an Indian mobile and creates the employee without a field staff option", async ({ page }) => {
    const api = await openEmployees(page);
    await page.getByRole("button", { name: "Add employee" }).first().click();
    const modal = dialog(page, "Add employee");

    await modal.getByLabel("Full name").fill("Nina Newhire");
    await modal.getByLabel("Email", { exact: true }).fill("Nina@Ogera.com");

    // Phone: digits only, capped at 10, must start with 6-9
    const phone = modal.getByLabel("Phone");
    await phone.fill("5123456789");
    await phone.blur();
    await expect(modal.getByText("Enter a valid Indian mobile number")).toBeVisible();
    await phone.fill("+91 98765-43211");
    await expect(phone).toHaveValue("9876543211");
    await expect(modal.getByText("Enter a valid Indian mobile number")).toBeHidden();

    await modal.getByLabel("Role").selectOption("field_executive");
    await expect(modal.getByText("Field staff")).toHaveCount(0);

    // Password: generate, reveal and meet the API's rules
    const password = modal.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await modal.getByRole("button", { name: "Generate a strong password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    const generated = await password.inputValue();
    expect(generated).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/);
    await modal.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");

    await modal.getByRole("button", { name: "Add employee" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Nina Newhire was added to the team." })).toBeVisible();
    await expect(people(page).filter({ hasText: "Nina Newhire" })).toBeVisible();
    const [post] = api.callsTo("POST", "/employees");
    expect(post.body).toMatchObject({ name: "Nina Newhire", email: "Nina@Ogera.com", phone: "+919876543211", role: "field_executive", password: generated });
    expect(post.body).not.toHaveProperty("is_field_staff");
  });

  test("blocks an invalid phone on submit and shows the server's 409 message", async ({ page }) => {
    const api = await openEmployees(page);
    await page.getByRole("button", { name: "Add employee" }).first().click();
    const modal = dialog(page, "Add employee");

    await modal.getByLabel("Full name").fill("Dup Licate");
    await modal.getByLabel("Email", { exact: true }).fill("sam.sales@ogera.com");
    await modal.getByLabel("Password", { exact: true }).fill("Welcome123");
    await modal.getByLabel("Phone").fill("12345");
    await modal.getByRole("button", { name: "Add employee" }).click();
    await expect(modal.getByRole("alert")).toContainText("10-digit Indian mobile");
    expect(api.callsTo("POST", "/employees")).toHaveLength(0);

    await modal.getByLabel("Phone").fill("");
    await modal.getByRole("button", { name: "Add employee" }).click();
    await expect(modal.getByRole("alert")).toHaveText("Email already in use");
  });
});

test.describe("edit and delete", () => {
  test("edit opens the form and sends only the changed fields", async ({ page }) => {
    const api = await openEmployees(page);
    await page.getByRole("button", { name: "Edit Tia Caller" }).click();
    const modal = dialog(page, "Edit employee");
    await expect(modal.getByLabel("Phone")).toHaveValue("9123456780");

    await modal.getByLabel("Role").selectOption("support");
    await modal.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Tia Caller was updated." })).toBeVisible();
    const [put] = api.callsTo("PUT", "/employees/5");
    expect(put.body).toEqual({ role: "support" });
  });

  test("delete asks for confirmation, then removes the row", async ({ page }) => {
    const api = await openEmployees(page);
    await page.getByRole("button", { name: "Delete Sue Support" }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Sue Support");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    expect(api.callsTo("DELETE", "/employees")).toHaveLength(0);

    await page.getByRole("button", { name: "Delete Sue Support" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete employee" }).click();

    await expect(people(page).filter({ hasText: "Sue Support" })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Sue Support was removed." })).toBeVisible();
    expect(api.callsTo("DELETE", "/employees/7")).toHaveLength(1);
  });

  test("an admin's own account is not listed, so it cannot be edited or deleted here", async ({ page }) => {
    await openEmployees(page);
    await expect(people(page).filter({ hasText: "Ada Admin" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit Ada Admin" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete Ada Admin" })).toHaveCount(0);
  });

  test("a manager sees neither admins nor managers, including themselves", async ({ page }) => {
    const employees = [...seedEmployees(), { ...seedEmployees()[1], id: 9, name: "Mo Manager", email: "mo@ogera.com" }];
    await openEmployees(page, MANAGER, { employees });

    // Six visible: Tara Lead, Sam, Tia, Fay, Sue and Ian. Ada, Maya and Mo are hidden.
    await expect(people(page)).toHaveCount(6);
    await expect(page.getByRole("button", { name: "Edit Sam Sales" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete Sam Sales" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Edit|Delete) (Ada Admin|Maya Manager|Mo Manager)$/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Add employee" }).first().click();
    const roleOptions = await dialog(page, "Add employee").getByLabel("Role").locator("option").allTextContents();
    expect(roleOptions).not.toContain("admin");
    expect(roleOptions).not.toContain("manager");
  });
});

test.describe("edge cases", () => {
  test("pages through a long list ten at a time", async ({ page }) => {
    await openEmployees(page, ADMIN, { employees: [...seedEmployees(), ...manyEmployees(17)] });
    const pager = page.getByRole("navigation", { name: "Employees pagination" });

    // 25 accounts, one of them the admin's own (never listed for an admin): 24 are shown.
    await expect(page.getByText("Showing 1 to 10 of 24 employees")).toBeVisible();
    await expect(people(page)).toHaveCount(10);
    await pager.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Showing 11 to 20 of 24 employees")).toBeVisible();
    await pager.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Showing 21 to 24 of 24 employees")).toBeVisible();
    await expect(pager.getByRole("button", { name: "Next" })).toBeDisabled();
    await pager.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByText("Showing 11 to 20 of 24 employees")).toBeVisible();
  });

  test("returns to the first page when a search narrows the list", async ({ page }) => {
    await openEmployees(page, ADMIN, { employees: [...seedEmployees(), ...manyEmployees(17)] });
    const pager = page.getByRole("navigation", { name: "Employees pagination" });
    await pager.getByRole("button", { name: "Next" }).click();
    await pager.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("Search employees").fill("staff 1");
    await expect(page.getByText("Showing 1 to 8 of 8 employees")).toBeVisible();
    await expect(people(page)).toHaveCount(8);
  });

  test("an expired session during save sends the user back to sign in", async ({ page }) => {
    const api = await openEmployees(page);
    api.failRequest("PUT", "/employees/5", 401);
    await page.getByRole("button", { name: "Edit Tia Caller" }).click();
    const modal = dialog(page, "Edit employee");
    await modal.getByLabel("Role").selectOption("support");
    await modal.getByRole("button", { name: "Save changes" }).click();

    await expect(page).toHaveURL(/\/$/);
  });

  test("a server error during save keeps the form open with the message", async ({ page }) => {
    const api = await openEmployees(page);
    api.failRequest("PUT", "/employees/5", 500);
    await page.getByRole("button", { name: "Edit Tia Caller" }).click();
    const modal = dialog(page, "Edit employee");
    await modal.getByLabel("Role").selectOption("support");
    await modal.getByRole("button", { name: "Save changes" }).click();

    await expect(modal.getByRole("alert")).toContainText("The server ran into a problem");
    await expect(modal).toBeVisible();
  });

  test("saving while offline shows the offline message and can be retried", async ({ page, context }) => {
    const api = await openEmployees(page);
    await page.getByRole("button", { name: "Edit Tia Caller" }).click();
    const modal = dialog(page, "Edit employee");
    await modal.getByLabel("Role").selectOption("support");

    await context.setOffline(true);
    await modal.getByRole("button", { name: "Save changes" }).click();
    await expect(modal.getByRole("alert")).toContainText("You're offline");
    expect(api.callsTo("PUT", "/employees/5")).toHaveLength(0);

    await context.setOffline(false);
    await modal.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Tia Caller was updated." })).toBeVisible();
  });

  test("the list reloads by itself when the connection returns after a failed refresh", async ({ page, context }) => {
    await openEmployees(page);
    await expect(people(page)).toHaveCount(7);

    await context.setOffline(true);
    await page.getByRole("button", { name: "Refresh employees" }).click();
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();

    await context.setOffline(false);
    await expect(people(page)).toHaveCount(7);
  });

  test("a server error during delete keeps the employee and shows the message", async ({ page }) => {
    const api = await openEmployees(page);
    api.failRequest("DELETE", "/employees/7", 500);
    await page.getByRole("button", { name: "Delete Sue Support" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete employee" }).click();

    await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText("The server ran into a problem");
    await expect(people(page).filter({ hasText: "Sue Support" })).toBeVisible();
  });

  test("deactivating an employee from the edit form sends only is_active", async ({ page }) => {
    const api = await openEmployees(page);
    await page.getByRole("button", { name: "Edit Tia Caller" }).click();
    const modal = dialog(page, "Edit employee");
    await modal.getByLabel(/^Account active/).uncheck();
    await modal.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Tia Caller was updated." })).toBeVisible();
    expect(api.callsTo("PUT", "/employees/5")[0].body).toEqual({ is_active: false });
  });

  test("a new password that is too short is rejected before any request", async ({ page }) => {
    const api = await openEmployees(page);
    await page.getByRole("button", { name: "Edit Tia Caller" }).click();
    const modal = dialog(page, "Edit employee");
    await modal.getByLabel("New password").fill("short1");
    await modal.getByRole("button", { name: "Save changes" }).click();

    await expect(modal.getByRole("alert")).toContainText("Password must be at least 8 characters");
    expect(api.callsTo("PUT", "/employees/5")).toHaveLength(0);
  });

  test("an employee with a non-Indian phone can be edited without changing that phone", async ({ page }) => {
    const employees = seedEmployees().map((employee) => (employee.id === 4 ? { ...employee, phone: "+14155550123" } : employee));
    const api = await openEmployees(page, ADMIN, { employees });
    await page.getByRole("button", { name: "Edit Sam Sales" }).click();
    const modal = dialog(page, "Edit employee");
    await modal.getByLabel("Role").selectOption("field_executive");
    await modal.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Sam Sales was updated." })).toBeVisible();
    expect(api.callsTo("PUT", "/employees/4")[0].body).toEqual({ role: "field_executive" });
  });

  test("the details dialog still opens from list data when its own request fails", async ({ page }) => {
    const api = await openEmployees(page);
    api.failRequest("GET", "/employees/4", 500);
    await people(page).filter({ hasText: "Sam Sales" }).click();

    await expect(dialog(page, "Sam Sales")).toContainText("sam.sales@ogera.com");
  });

  test("export is disabled when no employee matches", async ({ page }) => {
    await openEmployees(page);
    await page.getByLabel("Search employees").fill("zzz");
    await expect(page.getByRole("button", { name: "Export" })).toBeDisabled();
  });
});

test.describe("states", () => {
  test("shows an error with Try again that recovers", async ({ page }) => {
    await signInAs(page);
    const api = await mockApi(page);
    api.failList(500);
    await page.goto("/dashboard/employees");

    await expect(page.getByText("Couldn't load employees")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(people(page)).toHaveCount(7);
  });

  test("shows the empty state with an add action", async ({ page }) => {
    await openEmployees(page, ADMIN, { employees: [] });
    await expect(page.getByText("No employees yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add employee" }).last()).toBeVisible();
  });

  test("asks for a new sign-in when the session has expired (401)", async ({ page }) => {
    await signInAs(page);
    const api = await mockApi(page);
    api.failList(401);
    await page.goto("/dashboard/employees");
    await expect(page.getByText("Session expired")).toBeVisible();
  });

  test("shows access denied on 403", async ({ page }) => {
    await signInAs(page);
    const api = await mockApi(page);
    api.failList(403);
    await page.goto("/dashboard/employees");
    await expect(page.getByText("Access denied")).toBeVisible();
  });

  test("blocks roles that cannot manage employees without calling the API", async ({ page }) => {
    const api = await openEmployees(page, { id: 4, name: "Sam Sales", email: "sam.sales@ogera.com", role: "sales_executive" });
    await expect(page.getByText("Restricted area")).toBeVisible();
    expect(api.calls).toHaveLength(0);
  });
});
