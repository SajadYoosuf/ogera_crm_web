import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Forgot password against a stubbed backend. Each test scripts the replies it needs.
 * The routes sit on the API origin used by the app (localhost:8000 unless NEXT_PUBLIC_API_BASE_URL is set).
 */

const API = "http://localhost:8000";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

type Reply = { status: number; body: unknown };
type Script = {
  request?: Reply[];
  verify?: Reply[];
  reset?: Reply[];
  calls: { path: string; body: Record<string, unknown> }[];
};

const ok = (body: unknown): Reply => ({ status: 200, body });
const fail = (status: number, detail: string): Reply => ({ status, body: { detail } });
const SENT = { email_masked: "o***t@gmail.com", expires_in_seconds: 600, resend_in_seconds: 60 };
const TEST_EMAIL = "ogera@test.com";

async function scriptApi(page: Page, script: Partial<Script> = {}): Promise<Script> {
  const state: Script = { calls: [], ...script };
  await page.route(`${API}/auth/password-reset/**`, async (route: Route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });

    const path = new URL(request.url()).pathname.replace("/auth/password-reset/", "");
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    state.calls.push({ path, body });

    const queue = state[path as "request" | "verify" | "reset"] ?? [];
    const reply = queue.length > 1 ? queue.shift()! : (queue[0] ?? ok({ message: "Password updated." }));
    return route.fulfill({ status: reply.status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(reply.body) });
  });
  return state;
}

/** Fills the email field and submits to move from the email step to OTP. */
async function submitEmail(page: Page, email = TEST_EMAIL) {
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
}

/** Types a code into the six boxes, one digit per box. */
async function typeCode(page: Page, code: string) {
  const boxes = page.getByRole("textbox", { name: /^Digit \d$/ });
  for (let i = 0; i < code.length; i++) {
    await boxes.nth(i).fill(code[i]);
  }
}

test.describe("forgot password", () => {
  test("sends a code, verifies it and sets a new password", async ({ page }) => {
    const api = await scriptApi(page, {
      request: [ok(SENT)],
      verify: [fail(400, "Incorrect code. 4 attempts left."), ok({ reset_token: "token-123", expires_in_seconds: 600 })],
      reset: [ok({ message: "Password updated." })],
    });

    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();

    await submitEmail(page);
    await expect(page.getByText("o***t@gmail.com")).toBeVisible();
    expect(api.calls.map((c) => c.path)).toEqual(["request"]);
    expect(api.calls[0].body).toEqual({ email: TEST_EMAIL });

    // Wrong code: message shown and the boxes clear for a retype.
    await typeCode(page, "000000");
    await page.getByRole("button", { name: "Verify Code" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("Incorrect code. 4 attempts left.");
    await expect(page.getByRole("textbox", { name: "Digit 1" })).toHaveValue("");

    // Right code: moves to the new password step.
    await typeCode(page, "123456");
    await page.getByRole("button", { name: "Verify Code" }).click();
    await expect(page.getByRole("heading", { name: "Create a new password" })).toBeVisible();
    expect(api.calls.filter((c) => c.path === "verify").at(-1)?.body).toEqual({ email: TEST_EMAIL, code: "123456" });

    // Validation: too short, then mismatch, then fixed.
    await page.getByLabel("New password", { exact: true }).fill("abcde");
    await expect(page.getByText("Use at least 6 characters.", { exact: true })).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill("NewPass123");
    await page.getByLabel("Confirm new password").fill("NewPass12");
    await expect(page.getByText("Passwords don't match.")).toBeVisible();

    await page.getByLabel("Confirm new password").fill("NewPass123");
    await page.getByRole("button", { name: "Reset Password" }).click();

    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
    expect(api.calls.find((c) => c.path === "reset")?.body).toEqual({ reset_token: "token-123", new_password: "NewPass123" });
    await expect(page.getByRole("link", { name: "Back to Login" })).toHaveAttribute("href", "/");
  });

  test("an expired code asks for a new one", async ({ page }) => {
    await scriptApi(page, {
      request: [ok({ ...SENT, resend_in_seconds: 0 })],
      verify: [fail(400, "This code has expired. Request a new code.")],
    });

    await page.goto("/forgot-password");
    await submitEmail(page);
    await typeCode(page, "123456");
    await page.getByRole("button", { name: "Verify Code" }).click();

    await expect(page.locator('p[role="alert"]')).toHaveText("This code has expired. Request a new code.");
    await page.getByRole("button", { name: "Resend code" }).click();
    await expect(page.getByRole("textbox", { name: "Digit 1" })).toHaveValue("");
  });

  test("a locked code can be replaced with a fresh one", async ({ page }) => {
    await scriptApi(page, {
      request: [ok({ ...SENT, resend_in_seconds: 0 })],
      verify: [fail(400, "Too many wrong attempts. Request a new code.")],
    });

    await page.goto("/forgot-password");
    await submitEmail(page);
    await typeCode(page, "999999");
    await page.getByRole("button", { name: "Verify Code" }).click();

    await expect(page.locator('p[role="alert"]')).toHaveText("Too many wrong attempts. Request a new code.");
    await expect(page.getByText("(request a new code)")).toBeVisible();
  });

  test("the same password as the current one is refused by the server", async ({ page }) => {
    await scriptApi(page, {
      request: [ok(SENT)],
      verify: [ok({ reset_token: "token-123", expires_in_seconds: 600 })],
      reset: [fail(400, "Your new password must be different from your current password.")],
    });

    await page.goto("/forgot-password");
    await submitEmail(page);
    await typeCode(page, "123456");
    await page.getByRole("button", { name: "Verify Code" }).click();
    await page.getByLabel("New password", { exact: true }).fill("Passw0rd!");
    await page.getByLabel("Confirm new password").fill("Passw0rd!");
    await page.getByRole("button", { name: "Reset Password" }).click();

    await expect(page.locator('p[role="alert"]')).toHaveText("Your new password must be different from your current password.");
    await expect(page.getByRole("heading", { name: "Create a new password" })).toBeVisible();
  });

  test("a used or expired reset link has to start again", async ({ page }) => {
    await scriptApi(page, {
      request: [ok(SENT), ok(SENT)],
      verify: [ok({ reset_token: "token-old", expires_in_seconds: 600 })],
      reset: [fail(400, "This reset link has expired or was already used. Start again.")],
    });

    await page.goto("/forgot-password");
    await submitEmail(page);
    await typeCode(page, "123456");
    await page.getByRole("button", { name: "Verify Code" }).click();
    await page.getByLabel("New password", { exact: true }).fill("NewPass123");
    await page.getByLabel("Confirm new password").fill("NewPass123");
    await page.getByRole("button", { name: "Reset Password" }).click();

    await expect(page.locator('p[role="alert"]')).toHaveText("This reset link has expired or was already used. Start again.");
    await page.getByRole("button", { name: "Start again" }).click();
    await expect(page.getByText("o***t@gmail.com")).toBeVisible();
  });

  test("when the email cannot be sent, the page says so and can retry", async ({ page }) => {
    const api = await scriptApi(page, {
      request: [fail(503, "Reset code not sent: could not reach the mail server"), ok(SENT)],
    });

    await page.goto("/forgot-password");
    await submitEmail(page);
    await expect(page.locator('p[role="alert"]')).toHaveText("Reset code not sent: could not reach the mail server");

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("o***t@gmail.com")).toBeVisible();
    expect(api.calls.filter((c) => c.path === "request")).toHaveLength(2);
  });

  test("the page opens on the email step and no request fires until the form is submitted", async ({ page }) => {
    const api = await scriptApi(page, { request: [ok(SENT)] });

    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await page.waitForTimeout(300);
    expect(api.calls).toHaveLength(0);

    await submitEmail(page);
    await expect(page.getByText("o***t@gmail.com")).toBeVisible();
    expect(api.calls.filter((c) => c.path === "request")).toHaveLength(1);
  });

  test("the login page links to forgot password", async ({ page }) => {
    await page.route(`${API}/**`, (route) => route.fulfill({ status: 204, headers: CORS }));

    await page.goto("/");
    await page.getByRole("link", { name: "Reset here" }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
  });
});
