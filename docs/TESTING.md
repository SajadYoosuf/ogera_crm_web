# Frontend testing

Three layers, from fastest to slowest.

## 1. Unit and component tests (Vitest)

```bash
npx vitest run
```

Files are in `tests/` (`tests/components`, `tests/followups`, `tests/lib`, `tests/api`). The API is stubbed with `fetch` mocks; no backend is needed.

Type-check and lint the changed files too:

```bash
npx tsc --noEmit -p .
npx eslint src tests e2e/live
```

Current state (last run): 117 of 123 passing. The six failing tests are known and listed below.

## 2. Live end-to-end tests (Playwright, real backend)

These run the real API and the real web app together, with no browser stubs. `e2e/live/README.md` has the full steps. In short:

1. Start the seeded backend: `python tests/e2e_server.py --port 8765` (in `ogera_crm_backend`).
2. Start the web app on port 3100, pointed at it: `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8765 npx next dev --port 3100`.
   If a dev server already runs in this folder, run from a copy of the folder (Next locks the folder).
3. `npx playwright test -c playwright.live.config.ts`

Three screen sizes run for every spec: desktop 1366×768, tablet 768×1024 and phone (Pixel 7).

| Spec | What it proves |
| --- | --- |
| `e2e/live/lead-pipeline.spec.ts` | Sign in, schedule a follow-up, log an activity, both appear in History |
| `e2e/live/tasks-flow.spec.ts` | Mark done (log, then next step); reschedule (dialog shows the task, the new date saves, History shows the move) |
| `e2e/live/responsive.spec.ts` | No sideways scrolling on the Tasks screen, the Lead Pipeline and the lead panel; dialogs and the action menu fit the screen; the schedule form fits |

Last run: 21 of 21 passing.

## 3. Responsive checks

The responsive spec measures real screen sizes in the browser. Each check fails if an element is cut off on the left or right, or if the page is wider than the screen. Layouts were checked at 1366, 768 and 412 pixels wide.

## Known failures (not caused by the current change)

| Test | Why it fails | Needs |
| --- | --- | --- |
| `tests/components/followup-board.test.tsx` (4) | Expects copy and a "Source:" control from the old board. The board was redesigned ("Drop leads here", a generic Source control) | The wording and behaviour you want the tests to check |
| `tests/followups/activities.test.ts` (1) | `formatWhen` treats a time without a timezone as UTC; the test assumes local time | Decision on how the server's times are stored |
| `tests/lib/password-rules.test.ts` (1) | Belongs to an untracked file (`src/lib/password-rules.ts`) in progress | Finish or fix that file |

The old mock-based Playwright specs in `e2e/` (not `e2e/live/`) use a browser stub and a port 3000 server. They were not run for this change.
