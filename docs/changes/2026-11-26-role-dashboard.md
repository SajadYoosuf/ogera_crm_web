# Role-based dashboard (web)

Backend side: `ogera_crm_backend-leads/docs/changes/2026-11-26-dashboard-summary.md`. The backend must be
deployed first (or at the same time): without `GET /dashboard/summary` the page shows an error.

## What changed
- `/dashboard` now shows a dashboard instead of redirecting to Leads.
- `src/features/dashboard/` (new): API client, loading hook, one layout per role and the cards.
  - Admin and manager: key numbers, follow-ups and unassigned leads, "qualified, still with a telecaller",
    trend, status, sources, WhatsApp, team tables, contact pipelines, loss reasons, recent activity; admin also
    sees WhatsApp setup.
  - Telecaller: call queue and not-contacted leads first, then calls, connect rate, outcomes and own leads.
  - Sales executive: today's agenda and newly assigned leads first, then own pipeline, contacts needing action
    and charts.
  - Other roles: follow-ups, lead status and recent updates.
- Filters: today, 7 days, 30 days or custom dates; admin and manager can also pick one employee.
- Row actions: Call, WhatsApp, Log, and Complete for lead follow-ups (the same form the Tasks page uses).
- Charts are plain CSS; no new dependency.
- Phone layout: one column, 44px action buttons, team cards instead of a table, completion form as a bottom sheet.

## Access / data impact
- The server decides the view and the data. The page only hides controls (employee filter, complete button).
- Logging an activity and completing a follow-up use the existing endpoints and rules.

## States
- Handled: first load, empty lists, server error with retry, offline notice with refresh on reconnect, failed
  refresh keeping the old numbers, expired session (signs out), access refused (no retry).
- Not added: a success message after logging or completing; the list reloading is the confirmation.

## Verification
- `npx vitest run tests/dashboard`: 14 passed. `npm test`: 202 passed, 1 failed
  (`tests/components/lead-settings-tabs.test.tsx`, which does not use these files).
- `npx tsc --noEmit`, ESLint on the new files and `npm run build`: clean.
- `npx playwright test e2e/dashboard.spec.ts`: 20 passed, desktop and mobile, widths 320, 390, 820 and 1280.
- Screenshots of the admin, sales and telecaller views with sample data produced by the real backend code
  (API answered inside the test browser; no live backend contacted).
- `e2e/login.spec.ts`: 4 failures. The tests stop at the sign-in step, before the dashboard.
- Not checked: a real phone, the deployed backend, real data.

## Known issues or not done yet
- Already failing before this change: the settings tab visibility test (it also fails on a copy of the previous
  commit), and `npm run lint` reports 11 errors and 9 warnings, none in the files added or changed here.
- The phone pages are long, especially for admin.
- Contact rows have no Complete button and open the contacts list, which has no link to a single contact.
- "Open tasks" lists lead follow-ups only; the dashboard counts lead and contact follow-ups.
- Activity outcome is still optional, so the connect rate counts only calls that have one.
- Staff are signed out when the browser tab closes (existing `sessionStorage` sessions).
- `docs/leads.md` and the sidebar are unchanged; the sidebar already linked to `/dashboard`.
