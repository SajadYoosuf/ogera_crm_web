# Tasks page — table layout redesign

**Date:** 2026-11-25
**Files:** `src/features/tasks/components/TasksView.tsx`, `tests/tasks/tasks-view.test.tsx`

## What changed

Replaced the card list + 4-tab row on `/dashboard/tasks` with a table layout that matches the Leads page.

- **Header** — same sticky white header structure as `LeadsView` (title + subtitle, no action buttons needed).
- **Toolbar** — single row: search input, bucket `<select>` dropdown (Today/Overdue/Upcoming/Completed with live counts), assignee `<select>` for head/manager, Clear button when filters are active.
- **Table** — white rounded card (`rounded-[14px] border`), columns: Lead (name + phone), Title, Type (teal badge), Priority (coloured badge), Status (settings-driven badge), Due (date + time, red when overdue), Assigned To (head only), sticky Action column with View Lead button.
- **Task detail modal** — clicking any row opens an inline modal with the full `FollowupCard` + `LeadTaskActions` (Start/Complete/Reschedule/Reassign/Delete). Previously the card body navigated directly to the lead.
- **Pagination** — load-more footer matching the leads table style (shows "X of Y tasks" + Load more button).
- **States** — skeleton rows on load, table-cell empty state, error state with retry.

## Access / data impact

No API or role changes. The same `useLeadTasks` hook and `GET /lead-tasks` endpoint are used. Staff still see only their own tasks; head/manager see everyone's and get the assignee filter.

## Verification

- **Tests:** 178 passed (23 test files). Updated 3 tests in `tests/tasks/tasks-view.test.tsx` to match the new design (dropdown instead of tab role, row click opens modal, View Lead button navigates to lead). Added 1 new test (`View Lead button navigates to lead`).
- **TypeScript:** `npx tsc --noEmit` — no errors.
- **ESLint:** 8 pre-existing errors in unrelated files; zero errors in tasks files.
- **Build:** `npm run build` — `✓ Compiled successfully`, all 13 routes including `/dashboard/tasks`.
- **Conflict check:** `grep -rn "<<<<<<" src/features/tasks/` — none found.

## Known issues

- Pre-existing ESLint errors (8 errors in other files, unrelated to this change) are not fixed here.
