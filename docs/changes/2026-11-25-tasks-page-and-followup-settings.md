# Tasks page, "Done via" completion, reschedule presets and Follow-ups settings

Date: 2026-11-25 · PRD: `../docs/followups-tasks-prd.md` (workspace) · Backend note: `ogera_crm_backend-leads/docs/changes/2026-11-25-lead-tasks-page-completion-log.md`

## What changed
- **Tasks page** `/dashboard/tasks` (`src/app/dashboard/tasks/page.tsx`, `src/features/tasks/`): Today / Overdue / Upcoming / Completed tabs with counts, tab kept in `?tab=`, search, assignee filter for admin and manager, load more, loading / empty / error / offline states. Clicking a card opens the lead (`/dashboard/leads?lead=<id>`).
- **Sidebar**: new Tasks item with a red overdue count (polled, and refreshed after every task change).
- **Shared card** `src/features/leads/components/FollowupCard.tsx`, extracted from `LeadDetailModal.tsx`: overdue by the minute ("45m / 2h / 3d overdue"), status label from the `task_status` enum, colour from Settings, "Done via WhatsApp" badge and completion time on completed tasks.
- **LeadTaskActions**: Complete asks "Done via" (pre-selected with the planned type) and requires a note; afterwards "Schedule next follow-up?" opens `LeadFollowupModal` pre-filled (retry date after No answer / Not now). Reschedule has quick picks, a reason and a past-time check; it is hidden from staff when Settings turns it off.
- **LeadFollowupModal**: quick picks (In 1 hour, Today evening, Tomorrow morning, Next Monday, In 3 days, In 1 week) using Settings times; default time from Settings; `initial` pre-fill prop. `src/features/leads/followupPresets.ts` holds the preset maths.
- **Settings → Follow-ups** (`src/features/settings/`): times, reminder mode / hour / max days, due-now and overdue alerts, retry days, staff permissions, task status names and colours, activity types. Save stays disabled until something changes. Admin and manager only.
- `src/lib/api/interactions.ts`: `listLeadTasks`, new `Interaction` fields, `UpdateTaskInput.actual_activity_type`, `rescheduleLeadTask(..., reason)`, `localDateTimeToIso(date, time, defaultTime)`. `src/lib/api/settings.ts`: `task_status`, `task_priority` categories.

## Access / data impact
- New `isLeadHead(user)` in `src/lib/shared/roles.ts` (admin or manager by role slug). Task actions, the Tasks assignee filter, the follow-up assignee picker and the Follow-ups tab now use it instead of `canDo(user, "leads", "u")`. Reason: several staff roles hold `leads: "crud"`, which showed them Reassign / Delete the backend then refused (PRD S8). Custom roles with `see_all_records` but another slug lose those buttons in the web app; the backend still allows them.
- Renaming statuses and editing activity types in the Follow-ups tab needs `lead_statuses` update permission (same as the existing enum API); without it those panels are read-only.

## Verification
- `npx tsc --noEmit`: clean. `npm test`: 23 files, 177 tests pass, including new `tests/tasks/tasks-view.test.tsx`, `tests/tasks/followup-presets.test.ts`, `tests/components/followups-settings-tab.test.tsx` and extended `tests/leads/lead-task-actions.test.tsx`.
- `npm run lint`: 8 errors remain, all in files or lines this change did not write (existing effects in `AuthContext`, both `BulkAssignModal`s, `LeadDetailModal`, `LeadFollowupModal`).
- Browser: walked J1, J2, J3, J4 and T13 at desktop and phone width (no sideways scroll) against the API on a throwaway SQLite database.
- **Not run**: `npm run build` (your dev server was running in this folder), `npm run test:e2e`, `test:integration`. `e2e/responsive.spec.ts` and `e2e/live/responsive.spec.ts` now point at `/dashboard/tasks` / `/dashboard/leads`, and `e2e/fixtures/api.ts` mocks `/lead-tasks` and `/settings/followups`, but other parts of those specs reference screens that no longer exist.

## Known issues or not done yet
- Until the backend migration script runs, Settings shows defaults with a notice and saving returns the server's 503 message.
