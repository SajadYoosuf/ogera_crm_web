# Performance dashboard

## Why
Managers had one table of "who added how many contacts". They need to see who is falling behind (overdue follow-ups), where the pipeline stands and which lead sources convert; salespeople want their own numbers.

## What changes
- `lib/api/performance.ts` (new): typed client for the four endpoints.
- `app/dashboard/performance/page.tsx`: rewritten. Sticky This Week / This Month / Last Month / Custom picker; four stat cards; team scorecard (admin, manager) or "My stats"; pipeline bars; lead-source bars. Each section loads on its own with a skeleton, an error with Retry, and an empty state.
- `components/DashboardSidebar.tsx`: Performance is shown to every role (it used the stale `sales_head` role).

## Out of scope
Mobile screen, per-person drill-down from the scorecard, CSV export, comparison with the previous period.

## Assumptions (differs from the original spec)
- The spec's `activity_log` and `follow_up_schedule` tables do not exist; both are `lead_activities` (`status` done / pending).
- The spec's roles `salesperson` / `manager` / `admin` map to: admin and manager see the team, every other role sees only their own.
- The pipeline shows the 10 real stages (incl. Aware, Interested, Repeat Customer), not the spec's Site Visit / On Hold.
- Route stays `/dashboard/performance`. The old `GET /performance` (leads vs awareness) is untouched.

## Verification
`tsc` (src) and eslint clean. Not exercised in a browser.
