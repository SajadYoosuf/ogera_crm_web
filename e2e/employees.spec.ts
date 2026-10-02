import { expect, test, type Locator, type Page } from "@playwright/test";
import { ADMIN, MANAGER, mockApi, seedEmployees, signInAs, type Viewer } from "./fixtures/api";

async function openEmployees(page: Page, viewer: Viewer = ADMIN, options: Parameters<typeof mockApi>[1] = {}) {
  await signInAs(page, viewer);
  const api = await mockApi(page, options);
  await page.goto("/dashboard/employees");
  return api;
}

const card = (page: Page, name: string): Locator => page.getByRole("heading", { level: 3, name }).locator("xpath=ancestor::div[contains(@class,'group')][1]");
const openDropdown = (page: Page, label: "Role" | "Status") => page.getByRole("button", { name: new RegExp(`^${label}:`) }).click();
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });

test.describe("employees list", () => {
  test("shows the team with live stats and loads only from /employees", async ({ page }) => {
    const api = await openEmployees(page);

    await expect(page.getByRole("heading", { level: 1, name: "Employees" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(8);
    const stat = (label: string) => page.locator("dl > div", { hasText: label }).locator("dd");
    await expect(stat("Team members")).toHaveText("8");
    await expect(stat("Active accounts")).toHaveText("7");
    await expect(stat("Field staff")).toHaveText("2");
    await expect(stat("Admins & managers")).toHaveText("2");

    expect(api.callsTo("GET", "/employees").length).toBeGreaterThan(0);
    expect(api.calls.filter((call) => call.path.startsWith("/contacts"))).toHaveLength(0);
  });

  test("formats phone numbers and searches by name", async ({ page }) => {
    await openEmployees(page);
    await expect(card(page, "Maya Manager")).toContainText("+91 98765 43210");

    await page.getByLabel("Search employees").fill("tia");
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 3, name: "Tia Caller" })).toBeVisible();

    await page.getByLabel("Search employees").fill("zzz");
    await expect(page.getByText("No matches found")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(8);
  });

  test("role dropdown lists every role with counts and filters", async ({ page }) => {
    await openEmployees(page);
    await openDropdown(page, "Role");

    const options = page.getByRole("listbox", { name: "Role" }).getByRole("option");
    await expect(options).toHaveCount(8); // All roles + the 7 API roles
    for (const role of ["admin", "manager", "team lead", "sales executive", "tele caller", "field executive", "support"]) {
      await expect(options.filter({ hasText: new RegExp(`^${role}`, "i") })).toHaveCount(1);
    }

    await options.filter({ hasText: /^sales executive/i }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(2);
    await expect(page.getByRole("listbox")).toBeHidden();
  });

  test("status dropdown filters active and inactive and closes on Escape", async ({ page }) => {
    await openEmployees(page);

    await openDropdown(page, "Status");
    await page.getByRole("option", { name: /^Inactive/ }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 3, name: "Ian Inactive" })).toBeVisible();

    await openDropdown(page, "Status");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
  });

  test("opens the details dialog from GET /employees/{id}", async ({ page }) => {
    const api = await openEmployees(page);
    await card(page, "Sam Sales").getByRole("button").first().click();

    await expect(dialog(page, "Sam Sales")).toBeVisible();
    await expect(dialog(page, "Sam Sales")).toContainText("sam.sales@ogera.com");
    await expect.poll(() => api.callsTo("GET", "/employees/4").length).toBe(1);
  });

  test("does not overflow horizontally", async ({ page }) => {
    await openEmployees(page);
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(8);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("add employee", () => {
  test("validates an Indian mobile, hides field staff for office roles and creates the employee", async ({ page }) => {
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

    // Field staff: offered for sales roles, hidden for office roles
    await expect(modal.getByText("Field staff")).toBeVisible();
    for (const role of ["admin", "manager", "tele_caller", "support"]) {
      await modal.getByLabel("Role").selectOption(role);
      await expect(modal.getByText("Field staff")).toBeHidden();
    }
    await modal.getByLabel("Role").selectOption("field_executive");
    await expect(modal.getByText("Field staff")).toBeVisible();
    await modal.getByRole("checkbox").first().check();

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
    await expect(page.getByRole("heading", { level: 3, name: "Nina Newhire" })).toBeVisible();
    const [post] = api.callsTo("POST", "/employees");
    expect(post.body).toMatchObject({ name: "Nina Newhire", email: "Nina@Ogera.com", phone: "+919876543211", role: "field_executive", is_field_staff: true, password: generated });
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
  test("edit icon opens the form and sends only the changed fields", async ({ page }) => {
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

  test("delete icon asks for confirmation, then removes the card", async ({ page }) => {
    const api = await openEmployees(page);
    await page.getByRole("button", { name: "Delete Sue Support" }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Sue Support");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    expect(api.callsTo("DELETE", "/employees")).toHaveLength(0);

    await page.getByRole("button", { name: "Delete Sue Support" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete employee" }).click();

    await expect(page.getByRole("heading", { level: 3, name: "Sue Support" })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Sue Support was removed." })).toBeVisible();
    expect(api.callsTo("DELETE", "/employees/7")).toHaveLength(1);
  });

  test("an admin cannot delete their own account from the card", async ({ page }) => {
    await openEmployees(page);
    await expect(page.getByRole("button", { name: "Edit Ada Admin" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete Ada Admin" })).toHaveCount(0);
  });

  test("a manager cannot modify other managers or admins", async ({ page }) => {
    const employees = [...seedEmployees(), { ...seedEmployees()[1], id: 9, name: "Mo Manager", email: "mo@ogera.com" }];
    await openEmployees(page, MANAGER, { employees });

    await expect(page.getByRole("button", { name: "Edit Sam Sales" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete Sam Sales" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Maya Manager" })).toBeVisible(); // themselves
    await expect(page.getByRole("button", { name: "Delete Maya Manager" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Edit|Delete) (Ada Admin|Mo Manager)$/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Add employee" }).first().click();
    const roleOptions = await dialog(page, "Add employee").getByLabel("Role").locator("option").allTextContents();
    expect(roleOptions).not.toContain("admin");
    expect(roleOptions).not.toContain("manager");
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
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(8);
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
