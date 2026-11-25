import { expect, test } from "@playwright/test";
import { ADMIN, mockApi, signInAs } from "./fixtures/api";

const API = "http://localhost:8000";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};
const now = new Date().toISOString();

const lead = (id: number, firstName: string) => ({
  id, first_name: firstName, last_name: "Test", phone: "9800000000", email: null,
  source_id: 2, source_name: "Website", status: "new", score: 40, notes: null, address: "Calicut",
  tags: null, raw_payload: null, whatsapp_sent: false, whatsapp_sent_at: null,
  assigned_to: 1, assigned_name: "Ada Admin", created_by: null, created_by_name: null,
  branch_id: null, branch_name: null, converted_at: null, contact_id: null,
  created_at: now, updated_at: now,
});

const leads: Record<number, ReturnType<typeof lead>> = { 42: lead(42, "Unread"), 43: lead(43, "Read") };

const notifications = [
  { id: 1, type: "lead_assigned", title: "Lead assigned to you", message: "Unread was assigned to you.", entity_type: "lead", entity_id: 42, is_read: false, created_at: now },
  { id: 2, type: "lead_assigned", title: "Lead assigned to you", message: "Read was assigned to you.", entity_type: "lead", entity_id: 43, is_read: true, created_at: now },
];

test.describe("notification opens lead detail", () => {
  // The bell lives in the desktop sidebar; the mobile header layout is covered by responsive.spec.ts.
  test.skip(({ isMobile }) => isMobile, "desktop sidebar flow");

  test("clicking notifications opens the lead, and going back does not reopen it", async ({ page }) => {
    await signInAs(page, ADMIN);
    await mockApi(page);

    // Registered after mockApi, so these handlers run first; anything else falls through to mockApi.
    await page.route(`${API}/**`, async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      const json = (body: unknown) => route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });

      if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      if (path === "/notifications" && method === "GET") return json({ items: notifications, unread_count: 1 });
      if (path === "/notifications/purge" && method === "POST") return json({ deleted: 0 });
      if (/^\/notifications\/\d+\/read$/.test(path) && method === "POST") return json({ ok: true });
      if (path === "/leads" && method === "GET") return json({ items: [leads[42], leads[43]], total: 2, skip: 0, limit: 50 });
      const leadMatch = path.match(/^\/leads\/(\d+)$/);
      if (leadMatch && method === "GET" && leads[Number(leadMatch[1])]) return json(leads[Number(leadMatch[1])]);
      if (/^\/leads\/\d+\/(timeline|interactions)$/.test(path) && method === "GET") return json([]);
      return route.fallback();
    });

    const detailClose = page.getByRole("button", { name: "Close" }).first();

    await page.goto("/dashboard/leads");
    await page.getByRole("button", { name: /^Notifications/ }).click();

    // 1. Unread notification opens the lead, and the link is consumed from the URL.
    await page.getByText("Unread was assigned to you.").click();
    await expect(detailClose).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/leads$/);

    // 2. Close, leave the page, then come back with the browser's back button.
    await detailClose.click();
    await expect(detailClose).toHaveCount(0);
    await page.goto("/dashboard/contacts");
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\/leads/);
    await expect(detailClose).toHaveCount(0);

    // 3. A read notification still opens its lead.
    await page.getByRole("button", { name: /^Notifications/ }).click();
    await page.getByText("Read was assigned to you.", { exact: true }).click();
    await expect(detailClose).toBeVisible();
  });
});
