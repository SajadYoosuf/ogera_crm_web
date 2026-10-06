---
name: feature-testing
description: Test every finished frontend feature in ogera_crm_web with three simple layers - unit, integration (component with a mocked API) and end-to-end (Playwright) - before calling it done. Use this whenever a feature, fix or UI change in the web app is complete or nearly complete, and whenever the user says test, write tests, add tests, verify, "is it working", "feature done", "ready to commit", "before we push", Vitest, Playwright, e2e, unit test or integration test, even if they do not name a test type. Run it at the end of every feature, not only when asked.
---

# Feature testing (unit, integration, end-to-end)

A feature is not finished when it looks right in the browser; it is finished when a test proves it keeps working. The project already has the tools installed (Vitest, React Testing Library, Playwright), so the job is small: after the feature works, add a few focused tests, run them, and report. Keep it lean. A handful of tests that cover what users do beats a pile that breaks on every restyle.

## 1. Pick the layers for this feature

Ask what the feature contains, then write only the tests that match.

| Layer | What it checks | Use it when the feature has | Lives in | Run with |
| --- | --- | --- | --- | --- |
| **Unit** | One function, no screen | Rules, calculations, formatting, an API client function | `tests/<area>/*.test.ts` | `npx vitest run tests/<area>` |
| **Integration** | One page or component rendered with a fake API | A screen that loads data, filters, submits or shows states | `tests/components/*.test.tsx` | `npx vitest run tests/components/<file>` |
| **End-to-end** | A real browser clicking through the running app (API faked at the network edge) | The main user journey and anything layout-dependent | `e2e/*.spec.ts` | `npx playwright test e2e/<file> --project=desktop` |

Sizing guide, so nobody over-tests:
- **Unit:** one test per rule or edge case in the logic (a rule with a boundary gets a test on each side of it).
- **Integration:** one test each for loaded, empty, error, and the feature's main action. Add the permission case if roles matter.
- **End-to-end:** one happy path through the main journey, plus one critical failure (for example the server refusing an action). Run it on both the `desktop` and `mobile` projects when the layout changed.

Skip a layer when it has nothing to say (no logic means no unit test), and say so in the report.

## 2. Write the tests

Copy the matching template from `references/templates.md` and adapt it. The conventions that matter:

- **Test what a user sees or what a function returns**, not internals. Find elements by role, label or visible text (`getByRole`, `getByLabelText`), never by CSS class. Styling changes should not break tests.
- **Fake the network, never the real backend or database.** Integration tests stub `fetch`; end-to-end tests extend the `mockApi` fixture in `e2e/fixtures/api.ts` (unmocked routes return 404 `Unmocked ...`, which is the signal to add a route). The FastAPI base URL is `http://localhost:8000`.
- **Sign in the way the app does:** `sessionStorage` keys `ogera_access_token` and `ogera_user` (`signIn` helper in the component tests, `signInAs` in e2e).
- **Assert the request too**, not only the screen: check the method, path and body the feature sent (`fetchMock.mock.calls`, `api.callsTo(...)`). Many real bugs are a wrong payload that the screen hides.
- **No fixed waits.** Use `await screen.findBy...`, `waitFor`, or Playwright's auto-waiting `expect(...)`.
- **No snapshots.** They fail on harmless changes and teach people to ignore failures.
- Name tests as sentences about behaviour: `"blocks moving an unverified lead and lists the missing details"`.
- New Next.js specifics (routing, `next/navigation`): this repo's Next.js version differs from older docs; read the relevant page in `node_modules/next/dist/docs/` before mocking router hooks.

## 3. Run, in this order

1. The new tests alone (fast loop) until they pass.
2. `npm test` for the whole unit and component suite, then `npx tsc --noEmit` and `npx eslint <changed files>`.
3. The end-to-end spec for the feature (`npx playwright test e2e/<file>`; it starts the dev server by itself or reuses one on port 3000).

If a test fails, decide honestly whether the feature or the test is wrong. Fix the feature when it is a real bug. Never weaken or delete an assertion just to get green. Failures that were already there before your change (check with `git stash` or by looking at files you did not touch) are not yours to fix here; list them in the report by name.

## 4. Report

Finish with a short summary the user can read in ten seconds:
- Tests added, per layer, with file paths.
- The command results (passed / failed counts; name any failure).
- What was deliberately not tested and why.
- Pre-existing failures noticed but left alone.

Also put the commands in the feature's change notes under `## Verification` (the `feature-workflow` skill asks for that file), so the next person knows how to re-run them. Commit the tests together with the feature, not afterwards.
