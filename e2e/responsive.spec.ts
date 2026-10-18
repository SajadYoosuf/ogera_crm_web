import { expect, test, type Page } from "@playwright/test";
import { ADMIN, mockApi, signInAs } from "./fixtures/api";

/**
 * Responsive audit: every screen must render without horizontal overflow, clipped content or an
 * empty right-hand gutter on phones, foldables (folded + unfolded, both orientations) and tablets.
 * Uses its own viewports, so it only runs in the "desktop" project (the device emulation is irrelevant).
 */

const VIEWPORTS = [
  { name: "Galaxy Fold folded", width: 280, height: 653 },
  { name: "Small phone", width: 320, height: 568 },
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "Pixel 7", width: 412, height: 915 },
  { name: "Large phone landscape", width: 915, height: 412 },
  { name: "Surface Duo single", width: 540, height: 720 },
  { name: "Galaxy Z Flip unfolded", width: 412, height: 915 },
  { name: "Galaxy Z Fold unfolded", width: 673, height: 841 },
  { name: "Foldable landscape", width: 841, height: 673 },
  { name: "Surface Duo spanned", width: 1114, height: 720 },
  { name: "iPad mini portrait", width: 744, height: 1133 },
  { name: "iPad portrait", width: 768, height: 1024 },
  { name: "iPad Air portrait", width: 820, height: 1180 },
  { name: "iPad landscape", width: 1024, height: 768 },
  { name: "iPad Pro 11 landscape", width: 1194, height: 834 },
  { name: "iPad Pro 12.9 portrait", width: 1024, height: 1366 },
  { name: "Laptop", width: 1366, height: 768 },
];

const PAGES = [
  { path: "/", signedIn: false },
  { path: "/dashboard", signedIn: true },
  { path: "/dashboard/employees", signedIn: true },
  { path: "/dashboard/followups", signedIn: true },
  { path: "/dashboard/professionals", signedIn: true },
  { path: "/dashboard/tasks", signedIn: true },
  { path: "/dashboard/settings", signedIn: true },
  { path: "/contacts", signedIn: true },
];

/** Long names/places on purpose: layouts usually break on real data, not on empty states. */
const seedContacts = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  contact_type: (["consumer", "partner"] as const)[i % 2],
  name: i % 2 ? "Muhammad Abdul Rahman Kunhimohammed" : "Sam Sales",
  phone: "+919876543210",
  address: "Kizhakkethil House, Near Juma Masjid Road, Kozhikode Beach",
  district: "Kozhikode",
  profession_type: i % 3 === 1 ? "interior_designer" : null,
  lead_stage: { stage: "site_visit_scheduled", changed_at: "2026-09-30T08:40:00" },
  lead_source: { id: 1, name: "Facebook Campaign" },
  assigned_to: { id: 4, name: "Sam Sales" },
  created_by: { id: 1, name: "Ada Admin" },
  created_at: "2026-09-30T08:40:00",
  is_verified: i % 2 === 0,
  missing_fields: i % 2 === 0 ? [] : ["address", "location", "house_stage"],
}));

async function stubBackends(page: Page) {
  await mockApi(page);
  await page.route("http://localhost:8000/contacts**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const cors = { "access-control-allow-origin": "*" };
    if (path === "/contacts") return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ items: seedContacts, total: 40, skip: 0, limit: 12 }) });
    if (path === "/contacts/profession-types") return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify([{ value: "plumber", label: "Plumber" }]) });
    return route.fallback();
  });
  await page.route("http://localhost:8000/lead-sources", (route) =>
    route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: JSON.stringify([{ id: 1, name: "Facebook Campaign", slug: "facebook" }]) }),
  );
  // Next route handlers under /api talk to MySQL, which isn't available in e2e: answer with empty data.
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/dev-log") return route.fulfill({ status: 204 });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], data: [], contacts: [], sales: [], total: 0, page: 1, pageSize: 10 }),
    });
  });
}

/** Everything that could stick out past the viewport, measured in the browser. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const doc = document.documentElement;
    const scroller = document.querySelector("main");
    const offenders: string[] = [];
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && style.position !== "fixed";
    };
    const insideFixedOrScroll = (el: Element) => {
      for (let p: Element | null = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.position === "fixed" || /(auto|scroll|hidden|clip)/.test(s.overflowX)) return true;
      }
      return false;
    };
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (!visible(el) || insideFixedOrScroll(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        const cls = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 4).join(".");
        offenders.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} [${Math.round(r.left)}→${Math.round(r.right)}]`);
      }
    }
    const main = scroller?.getBoundingClientRect();
    const clippedBy: string[] = [];
    if (scroller && main) {
      for (const el of Array.from(scroller.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > main.right + 1 && getComputedStyle(el).position !== "fixed" && !insideFixedOrScroll(el)) {
          const cls = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 5).join(".");
          clippedBy.push(`${el.tagName.toLowerCase()}.${cls} right=${Math.round(r.right)} (main ${Math.round(main.right)})`);
        }
      }
    }
    return {
      vw,
      docOverflow: doc.scrollWidth - vw,
      // main uses overflow-x-hidden, so a wide child is silently clipped rather than scrolling the page.
      mainClipped: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
      // The content column must reach the right edge: a gap here is the "empty right side" bug.
      rightGap: main ? Math.round(vw - main.right) : 0,
      mainWidth: main ? Math.round(main.width) : null,
      offenders: offenders.slice(0, 6),
      clippedBy: clippedBy.slice(0, 4),
    };
  });
}

test.describe("responsive layout", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "viewport matrix runs once");
  });

  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} ${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const target of PAGES) {
        test(`${target.path} fits the screen`, async ({ page }) => {
          if (target.signedIn) await signInAs(page, ADMIN);
          await stubBackends(page);
          await page.goto(target.path);
          await page.waitForLoadState("networkidle").catch(() => {});

          const result = await measure(page);
          const detail = JSON.stringify(result);
          expect(result.docOverflow, `page scrolls sideways: ${detail}`).toBeLessThanOrEqual(1);
          expect(result.mainClipped, `content clipped by <main>: ${detail}`).toBeLessThanOrEqual(1);
          expect(result.rightGap, `empty right gutter: ${detail}`).toBeLessThanOrEqual(1);
          expect(result.offenders, `elements outside the viewport: ${detail}`).toEqual([]);
        });
      }

      // Overlays are position:fixed, which the page audit above deliberately skips.
      test("navigation drawer opens and stays on screen", async ({ page }) => {
        test.skip(viewport.width >= 1024, "sidebar is permanently docked at lg and up");
        await signInAs(page, ADMIN);
        await stubBackends(page);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle").catch(() => {}); // let React hydrate before clicking
        await page.getByRole("button", { name: "Toggle menu" }).click();
        // The drawer slides in over 300ms; wait for it to land before measuring.
        await expect.poll(async () => (await page.locator("aside").boundingBox())?.x ?? -9999, { message: "drawer starts at the left edge" }).toBeGreaterThanOrEqual(-1);
        const box = await page.locator("aside").boundingBox();
        expect((box?.x ?? 0) + (box?.width ?? 0), "drawer fits the viewport").toBeLessThanOrEqual(viewport.width + 1);
        await expect(page.getByRole("link", { name: "Contacts" })).toBeInViewport();
        await expect(page.getByRole("button", { name: "Log out" })).toBeInViewport();
      });

      for (const overlay of [
        { path: "/contacts", open: "Add contact", dialog: /contact/i },
        { path: "/dashboard/employees", open: "Add employee", dialog: "Add employee" },
      ]) {
        test(`${overlay.path} "${overlay.open}" dialog fits the screen`, async ({ page }) => {
          await signInAs(page, ADMIN);
          await stubBackends(page);
          await page.goto(overlay.path);
          await page.waitForLoadState("networkidle").catch(() => {}); // let React hydrate before clicking
          await page.getByRole("button", { name: overlay.open }).first().click();
          const dialog = page.getByRole("dialog", { name: overlay.dialog });
          await expect(dialog).toBeVisible();
          const box = await dialog.boundingBox();
          expect(box?.x, "dialog not cut off on the left").toBeGreaterThanOrEqual(-1);
          expect((box?.x ?? 0) + (box?.width ?? 0), "dialog not cut off on the right").toBeLessThanOrEqual(viewport.width + 1);
          expect(box?.y, "dialog not cut off at the top").toBeGreaterThanOrEqual(-1);
          // Full-screen phone dialogs may be taller than a short screen and scroll, so the real test is
          // that the primary action stays reachable without scrolling.
          await expect(dialog.getByRole("button", { name: /^(Add|Save|Create)/ }).last()).toBeInViewport();
        });
      }
    });
  }
});
