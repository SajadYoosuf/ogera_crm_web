import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test.describe("login", () => {
  test("rejects wrong credentials with an inline message", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    await page.getByLabel("Email address").fill("ada.admin@ogera.com");
    await page.getByLabel("Password", { exact: true }).fill("wrong");
    await page.getByRole("button", { name: /login/i }).click();

    await expect(page.locator("#login-message")).toContainText("Incorrect email or password");
    await expect(page).toHaveURL("/");
  });

  test("stores the session and lands on the dashboard", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    await page.getByLabel("Email address").fill("ada.admin@ogera.com");
    await page.getByLabel("Password", { exact: true }).fill("correct-password");
    await page.getByRole("button", { name: /login/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    expect(await page.evaluate(() => sessionStorage.getItem("ogera_access_token"))).toBe("test-token");
  });

  test("the sidebar links to Employees for admins", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("ogera_access_token", "test-token");
      sessionStorage.setItem("ogera_user", JSON.stringify({ id: 1, name: "Ada Admin", email: "a@ogera.com", role: "admin", phone: null }));
    });
    await mockApi(page);
    await page.goto("/dashboard/employees");
    await expect(page.getByRole("link", { name: "Employees" })).toHaveAttribute("aria-current", "page");
  });
});
