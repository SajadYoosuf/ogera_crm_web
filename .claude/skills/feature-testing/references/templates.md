# Test templates

Copy one, rename, and replace the specifics. All three follow the style of the tests already in the repo (`tests/api/auth-client.test.ts`, `tests/components/performance-page.test.tsx`, `e2e/employees.spec.ts`).

## Unit: a pure function

```ts
// tests/followups/stages.test.ts
import { describe, expect, it } from "vitest";
import { columnFor, stageClock } from "@/components/followups/stages";

describe("stageClock", () => {
  const changedAt = "2026-10-05T10:00:00";
  const at = (iso: string) => new Date(iso).getTime();

  it("is not overdue before 24h on a new lead", () => {
    expect(stageClock("new_lead", changedAt, at("2026-10-06T09:00:00"))?.overdue).toBe(false);
  });

  it("is overdue after 24h on a new lead", () => {
    expect(stageClock("new_lead", changedAt, at("2026-10-06T11:00:00"))?.overdue).toBe(true);
  });

  it("has no clock for stages without one", () => {
    expect(stageClock("won", changedAt, Date.now())).toBeNull();
  });
});
```

A function that calls the network: stub `fetch` and check both the result and the request.

```ts
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { changeStage } from "@/lib/api/leads";

afterEach(() => vi.unstubAllGlobals());

it("posts the stage with the editor id", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1 }) });
  vi.stubGlobal("fetch", fetchMock);
  await changeStage("token", 5, 7, { stage: "quoted" });
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toContain("/contacts/5/stages");
  expect(JSON.parse(init.body)).toEqual({ stage: "quoted", changed_by: 7 });
});
```

## Integration: a component with a fake API

```tsx
// tests/components/followup-board.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowupBoard from "@/components/followups/FollowupBoard";

const fetchMock = vi.fn();
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
const fail = (status: number, detail: unknown) => ({ ok: false, status, json: async () => ({ detail }) });

/** Route by path so each test only describes the responses it cares about. */
function serve(routes: Record<string, (url: URL, init?: RequestInit) => unknown>) {
  fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const handler = routes[url.pathname];
    return handler ? handler(url, init) : fail(404, `Unmocked ${url.pathname}`);
  });
}

function signIn(role = "admin") {
  sessionStorage.setItem("ogera_access_token", "test-token");
  sessionStorage.setItem("ogera_user", JSON.stringify({ id: 1, name: "Head", email: "h@o.com", role }));
}

beforeEach(() => { vi.stubGlobal("fetch", fetchMock); signIn(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); sessionStorage.clear(); });

describe("FollowupBoard", () => {
  it("shows an empty state when there are no leads", async () => {
    serve({ "/contacts": () => ok({ items: [], total: 0, skip: 0, limit: 100 }), "/employees": () => ok({ items: [], total: 0 }), "/lead-sources": () => ok([]) });
    render(<FollowupBoard />);
    expect(await screen.findByText("No consumer leads yet")).toBeTruthy();
  });

  it("shows an error with a retry when the server fails", async () => {
    serve({ "/contacts": () => fail(500, "boom") });
    render(<FollowupBoard />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("sends the right body when a lead is moved", async () => {
    // ...serve a lead, click its next-stage button, then:
    // await waitFor(() => expect(JSON.parse(lastPost().body)).toMatchObject({ stage: "first_call" }));
  });
});
```

Tips: `findBy*` waits, `getBy*` does not. Wrap clicks with `fireEvent.click` or `userEvent`. Mock `next/navigation` with `vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))` when a component routes.

## End-to-end: the main journey in a real browser

First make sure the routes the feature calls exist in `e2e/fixtures/api.ts` (add them to `mockApi`, keeping its recording of `state.calls`).

```ts
// e2e/lead-followup.spec.ts
import { expect, test } from "@playwright/test";
import { ADMIN, mockApi, signInAs } from "./fixtures/api";

test.describe("lead followup", () => {
  test("moves a verified lead to the next stage", async ({ page }) => {
    await signInAs(page, ADMIN);
    const api = await mockApi(page);
    await page.goto("/dashboard/followups");

    await expect(page.getByRole("heading", { level: 1, name: "Lead Followup" })).toBeVisible();
    await page.getByRole("button", { name: /First Call/ }).first().click();

    await expect.poll(() => api.callsTo("POST", "/contacts/").length).toBeGreaterThan(0);
  });

  test("shows the missing-details popup when the server refuses the move", async ({ page }) => {
    await signInAs(page, ADMIN);
    await mockApi(page);   // configure the fixture to answer 409 { detail: { message, missing_fields } }
    await page.goto("/dashboard/followups");
    // click the move button, then:
    await expect(page.getByRole("alertdialog", { name: "Complete the details first" })).toBeVisible();
  });
});
```

Run both projects when layout matters: `npx playwright test e2e/lead-followup.spec.ts` (desktop and mobile). On failure, open the report with `npm run test:e2e:report`; screenshots and traces are kept for failures.
