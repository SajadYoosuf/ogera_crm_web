# Tasks screen (day / week / month) and outcome on completion

## Why
Scheduled follow-ups were visible only inside one lead's panel. Staff need a daily work list, managers need to see the team's week and month, and finishing a task should always record its outcome as an activity log.

## What changes
- New page `/dashboard/tasks` and a "Tasks" sidebar item for every role.
- `components/tasks/`: `TasksBoard` (toolbar, filters, states), `DayView`, `WeekView`, `MonthView`, `TaskCard`, `calendar.ts` (range maths).
- Filters: Day / Week / Month switch with previous / next / Today, employee (managers and admins only), status (Open / Done / All), activity type, search by contact.
- Mark done opens an outcome form (`OutcomeForm`, text required); saving logs the outcome as an activity. Used on the Tasks screen and in the lead panel's Follow-ups tab.
- `lib/api/tasks.ts` (new); `markFollowupDone` takes the outcome.
- Backend part: see the backend notes of the same name.

## Out of scope
Drag to reschedule, "schedule the next follow-up?" prompt after completing from Tasks, URL-synced filters, mobile app.

## Verification
`npx vitest run`, eslint and `tsc --noEmit` on the touched files.

## As built (deviations)
- Filters live in component state, not the URL.
- Reschedule is available on the Tasks cards too (same date and time pickers as the lead panel); the lead panel keeps Mark Done / Reschedule as before, but Mark Done now asks for the outcome there as well.
- Week view cards are compact (time, contact, employee); tapping one opens that day, where the actions are. Month cells list the first three tasks (a count on phones).
- Verified: new tests `tests/tasks/calendar.test.ts` and `tests/components/tasks-board.test.tsx`, updated `lead-activity.test.tsx`; eslint and `tsc --noEmit` are clean for the touched files. The full suite still has the 17 existing failures in `staff-live-map.test.tsx`. No e2e or browser run.
