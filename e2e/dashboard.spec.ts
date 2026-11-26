import { expect, test, type Page } from "@playwright/test";
import { ADMIN, mockApi, signInAs } from "./fixtures/api";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,PATCH,OPTIONS" };
const SALES = { id: 4, name: "Sam Sales", email: "sam.sales@ogera.com", role: "sales_executive" };

const lead = (id: number, name: string) => ({
  id, name, phone: "+919876543210", status: "new", source_name: "Facebook Campaign", assigned_to_name: "Sam Sales",
  created_at: "2026-11-20T08:40:00+00:00", assigned_at: "2026-11-21T08:40:00+00:00",
});

/** Long names on purpose: layouts usually break on real data. */
function summary(view: "head" | "sales") {
  const head = view === "head";
  const followUp = {
    id: 11, entity_type: "lead", entity_id: 5, kind: "task", activity_type: "phone_call", custom_label: null,
    title: "Send the revised quotation for the overhead tank", notes: null, done_by: null, done_by_name: null,
    assigned_to: 4, assigned_to_name: "Sam Sales", created_by: 1, created_by_name: "Ada Admin",
    due_at: "2026-01-01T04:00:00+00:00", priority: "medium", status: "todo", outcome: null, parent_task_id: null,
    logged_at: "2026-01-01T00:00:00+00:00", created_at: "2026-01-01T00:00:00+00:00", overdue_days: 3,
    name: "Muhammad Abdul Rahman Kunhimohammed", phone: "+919876543210", overdue: true,
  };
  const days = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
  return {
    view,
    period: { key: "30d", date_from: days[0], date_to: days[29] },
    employee_id: head ? null : 4,
    followups: { overdue: 1, today: 0, upcoming: 2, completed_in_period: 3, due_total: 1, queue: [followUp] },
    leads: {
      open: 1240, new_in_period: 312, converted_in_period: 27, cohort_converted: 27, conversion_rate: 8.7,
      by_status: [{ slug: "attempt_to_contact", name: "Attempt to Contact", count: 640 }, { slug: "new", name: "New", count: 600 }],
      by_source: [{ source_id: 1, name: "Facebook Campaign for Kottakkal Branch", count: 312, converted: 27 }],
      trend: days.map((date, i) => ({ date, created: (i % 9) + 3, converted: i % 3 })),
      trend_days_per_point: 1, uncontacted: 14, uncontacted_items: [lead(7, "Fathima Beevi")],
    },
    activity: {
      total: 90, calls: 70, calls_with_outcome: 50, calls_answered: 30, connect_rate: 60,
      by_type: [{ type: "phone_call", label: "Phone call", count: 70 }],
      by_outcome: { done: 30, not_now: 10, no_answer: 10, none: 40 },
      by_day: days.map((date, i) => ({ date, total: i % 7, calls: i % 5 })),
    },
    contacts: {
      total: 3,
      pipelines: (["consumer", "partner", "dealer"] as const).map((type) => ({
        type, total: 1, unassigned: head ? 1 : null, no_stage: 0, stages: [{ id: 1, name: "After Sales / Referring", count: 1 }],
      })),
      needs_action: 1, needs_action_items: [{ id: 3, name: "Joseph Mathew", phone: null, type: "dealer", stage: null }],
      loss_reasons: [{ reason: "price", label: "Price too high", count: 2 }],
    },
    recent: [{ id: 1, entity_type: "lead", entity_id: 5, name: followUp.name, label: "Status changed", detail: "New → Attempt to Contact", actor_name: "Sam Sales", created_at: "2026-11-20T08:40:00+00:00" }],
    unassigned_leads: head ? { count: 1, items: [lead(8, "Vinod Varma")] } : null,
    qualified_with_telecaller: head ? { count: 1, items: [lead(9, "Meera Nair")] } : null,
    newly_assigned: head ? null : [lead(10, "Biju Thomas")],
    team: head ? [{ employee_id: 5, name: "Tia Caller", role: "tele_caller", role_name: "Tele Caller", open_leads: 120, activities: 300, calls: 280, followups_completed: 40, overdue: 12, converted: 9 }] : null,
    employees: head ? [{ id: 5, name: "Tia Caller", role: "tele_caller" }] : null,
    whatsapp: { unread_conversations: 1, unread_items: [{ lead_id: 5, name: followUp.name, unread: 2, last_at: "2026-11-20T08:40:00+00:00" }], sent_in_period: 4 },
    whatsapp_setup: head ? { status: "connected", templates: { APPROVED: 3, PENDING: 1 } } : null,
  };
}

/** Answers the dashboard (failing the first `failures` requests) and records follow-up completions. */
async function stubDashboard(page: Page, view: "head" | "sales", failures = 0) {
  const completions: unknown[] = [];
  let remaining = failures;
  await page.route("http://localhost:8000/dashboard/summary**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const failing = remaining-- > 0;
    return route.fulfill({ status: failing ? 500 : 200, headers: CORS, contentType: "application/json", body: JSON.stringify(failing ? { detail: "boom" } : summary(view)) });
  });
  await page.route("http://localhost:8000/interactions/11", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    completions.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: "{}" });
  });
  return completions;
}

/** Nothing may scroll sideways, and every call, message, log and open button must be big enough to tap. */
async function checkLayout(page: Page) {
  const result = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    const phone = window.innerWidth < 640;
    const short = Array.from(main.querySelectorAll("a, button"))
      .filter((el) => /^(Complete|Call|WhatsApp|Log|Open)$/.test(el.textContent?.trim() ?? ""))
      .filter((el) => phone && el.getBoundingClientRect().height < 43).length;
    return { sideways: main.scrollWidth - main.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth, short };
  });
  expect(result.sideways, "content wider than the page").toBeLessThanOrEqual(1);
  expect(result.page, "page scrolls sideways").toBeLessThanOrEqual(1);
  expect(result.short, "buttons too short to tap").toBe(0);
}

test.describe("dashboard", () => {
  test("a sales executive completes a follow-up from the agenda", async ({ page }) => {
    await signInAs(page, SALES);
    await mockApi(page, { viewer: SALES });
    const completions = await stubDashboard(page, "sales");
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { level: 2, name: "Today's agenda" })).toBeVisible();
    await page.getByRole("button", { name: /Complete follow-up for/ }).click();
    const dialog = page.getByRole("dialog", { name: /Complete follow-up for/ });
    await dialog.getByRole("textbox").last().fill("Spoke to them, quotation sent");
    await dialog.getByRole("button", { name: /^(Complete|Mark|Save)/ }).last().click();

    await expect.poll(() => completions.length).toBe(1);
    expect(completions[0]).toMatchObject({ status: "completed", outcome: "done" });
  });

  test("shows a server problem and recovers on retry", async ({ page }) => {
    await signInAs(page, SALES);
    await mockApi(page, { viewer: SALES });
    await stubDashboard(page, "sales", 1);
    await page.goto("/dashboard");

    await expect(page.getByRole("alert").filter({ hasText: "server" })).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Today's agenda" })).toBeVisible();
  });

  for (const width of [320, 390, 820, 1280]) {
    for (const view of ["sales", "head"] as const) {
      test(`the ${view} view fits a ${width}px screen`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await signInAs(page, view === "head" ? ADMIN : SALES);
        await mockApi(page);
        await stubDashboard(page, view);
        await page.goto("/dashboard");

        await expect(page.getByRole("heading", { level: 2, name: "Contact pipelines" }).or(page.getByRole("heading", { level: 2, name: "My pipeline" }))).toBeVisible();
        await checkLayout(page);
      });
    }
  }
});
