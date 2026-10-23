# Sprint 1 — Lead Pipeline Task System Redesign + Bug Fixes (web)

## Why
The follow-up form lacked a priority field and auto-title from type selection. ActivityLogForm
had date/time/loggedBy fields that were collected but silently dropped on submit. Icons and colour
tiles were missing for the new meeting and email activity types.

## What changes
- `src/components/followups/ActivityLogForm.tsx` — remove date, time, loggedBy state + UI fields
  (Bug 2 fix: values were collected but never sent to the API)
- `src/components/followups/FollowupScheduleForm.tsx` — add priority radio (high/med/low);
  auto-fill title from task type selection (user can override)
- `src/components/followups/ActivityIcons.tsx` — add meeting (calendar) and email (envelope) icons
- `src/components/followups/designTokens.ts` — add ACTIVITY_TILE colour tiles for meeting + email

## Out of scope
- Kanban card overdue badge (Sprint 3)
- Notification bell (Sprint 4)
- Mobile form changes

## Verification
```bash
cd ogera_crm_web
npx eslint src/components/followups/ActivityLogForm.tsx src/components/followups/FollowupScheduleForm.tsx
npx tsc --noEmit
```
Manual: open Schedule Followup → pick WhatsApp → title field auto-fills "WhatsApp"; change to
Meeting → title becomes "Meeting".
Manual: open Log Activity → confirm no Date, Time or Logged By fields.
