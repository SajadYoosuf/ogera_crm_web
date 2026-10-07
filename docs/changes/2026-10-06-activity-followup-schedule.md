# Activity log and follow-up schedule in the lead panel

## Why
Section 4 of the lead panel becomes two independent actions: Log Activity and Schedule Follow-up, with a combined list and a "schedule the next follow-up?" prompt.

## What changes
- `LeadPanel.tsx`: the Activity section is replaced with `ActivityLogForm`, `FollowupScheduleForm`, `ActivityList` and `FollowupPrompt` (new files in `components/followups/`).
- `lib/api/activities.ts` (new): GET, POST, PATCH for activities; the old activity calls leave `lib/api/leads.ts`.
- Removed: `ActivityLog.tsx`; `activities.ts` loses subtypes.
- Assign-to uses the same staff list as "Lead assigned to" (no admins or managers), defaulting to the lead's assignee.
- Backend part: see the backend notes of the same name.

## Out of scope
Employee-only view (assign-to hidden, own tasks only), deleting activities, board changes.

## Verification
`npx vitest run tests/followups tests/components/lead-activity.test.tsx`, `npm test`, eslint, `tsc --noEmit`. End-to-end not added (the e2e fixture has no lead routes yet).

## As built (deviations)
- Dropdowns use the shared styled `FilterSelect` (the panel's existing pattern) instead of a native `crm-select`.
- Icons are inline SVGs (Lucide is not a dependency); WhatsApp reuses the board's green icon.
- Date input is the native date field plus the Today / Tomorrow / In 3 days / Next week chips; "Next week" is +7 days.
- Pending tasks that are not due yet show no action buttons; due-today tasks show Mark Done; overdue tasks show Mark Done and Reschedule (as specified).
- GPS for a field visit is captured silently with a 5 second limit.
- Tests: `tests/followups/activities.test.ts` (helpers), `tests/components/lead-activity.test.tsx` (9 panel flows). The full suite still has 17 failures in `staff-live-map.test.tsx` that predate this change.

## Update 2026-10-07: date and time pickers
The native date and time inputs in the Schedule Follow-up form and the Reschedule mini-form are replaced by `DatePickerField` (one-month calendar, past days disabled) and `TimePickerField` (half-hour slots from 8:00 am to 9:00 pm, plus "No specific time") in `src/components/SchedulePickers.tsx`. Both open as a floating panel on desktop and a bottom sheet on phones; Escape closes only the picker, not the lead panel. The Today / Tomorrow / In 3 days / Next week chips stay.

## Update 2026-10-07: two different interfaces
Log Activity and Schedule Follow-up no longer look alike. Log Activity (blue): "Log what happened" with a tile per activity type (icon and label) and a notes box. Schedule Follow-up (violet): "Plan the next follow-up" in What / When / Who steps (type and note, date chips with date and time pickers, assignee). The two entry buttons have their own icon and colour. Activity icons are shared through `ActivityIcons.tsx`.

## Update 2026-10-07: history in view-only tabs
Applying stays as two buttons (+ Log Activity, + Schedule Follow-up) with their own forms. Viewing is a separate "History" section with three tabs: Activity log (finished entries), Follow-ups (scheduled tasks, with Mark Done and Reschedule) and Stage history. Saving a log opens the Activity log tab; scheduling opens the Follow-ups tab.
