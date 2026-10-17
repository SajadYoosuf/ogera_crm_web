# Frontend: Lead pipeline

The `/dashboard/followups` screen. A board of leads by stage, a lead panel for one lead, and the forms that schedule follow-ups, log activities and show the lead's history. The backend contract is in `API.md` (Contacts and Follow-ups) and `ogera_crm_backend/docs/modules/lead-pipeline.md`.

Status: in the working tree, not committed yet.

## File map

| File | Responsibility |
| --- | --- |
| `src/components/followups/FollowupBoard.tsx` | The pipeline board: leads by stage, filters (search, source, owner, period), opens the lead panel |
| `src/components/followups/LeadPanel.tsx` | One lead: details, tabs (Activity log, Follow-ups, History), add button, prompts |
| `src/components/followups/ActivityList.tsx` | Logged activities and open follow-ups in the panel; Mark done and reschedule inline |
| `src/components/followups/ActivityLogForm.tsx` | "Log New Activity" dialog: type, title, details, date and time, logged by |
| `src/components/followups/FollowupScheduleForm.tsx` | "Schedule Followup" dialog: task name, activity type, due date and time, assignee, notes |
| `src/components/followups/OutcomeForm.tsx` | The inline "what happened" form used by the lead panel's Mark done |
| `src/components/followups/HistoryList.tsx` | Renders the timeline, including `followup_rescheduled` ("Follow-up rescheduled: X — Was …, now …") |
| `src/components/followups/ModalShell.tsx` | The dialog frame used by the forms above |
| `src/components/followups/FollowupPrompt.tsx`, `UnverifiedDialog.tsx` | Prompts after an action and for contacts that are not verified |
| `src/components/followups/activities.ts` | Date helpers: `isoDate`, `formatDay`, `formatClock`, `formatWhen`, `isPastTimeToday`, `typeLabel` |
| `src/components/followups/stages.ts` | Stage colours, date formatting for cards, WhatsApp links |
| `src/components/followups/useActivityTypes.ts`, `useStages.ts` | Activity types and pipeline stages from Settings |
| `src/lib/api/activities.ts` | API calls: lists, `logActivity`, `scheduleFollowup`, `markFollowupDone`, `rescheduleFollowup`. Also the mapping of follow-ups into the activity shape |
| `src/lib/api/leads.ts` | `HistoryEvent` type and `getLeadHistory` |

## Behaviour

**Scheduling a follow-up** (`FollowupScheduleForm`)
- Needs a due date and an assignee. The date cannot be in the past.
- A time earlier today is refused in the form ("That time has already passed today. Pick a later time."), so the server never sees it.
- With no time, the follow-up is due for the whole day (`23:59`).
- Shows the server's message when the save fails.

**Logging an activity** (`ActivityLogForm`)
- Needs details (what happened). Blank details are refused in the form and by the server.
- Field visits ask for GPS once; a refusal does not block the save.

**Completing a follow-up** (lead panel, Mark done)
- `markFollowupDone` calls `PATCH /contacts/{id}/followups/{fid}` with `status: "completed"`, `outcome: "done"` and the typed notes. The server writes the activity log row.
- The panel shows "Follow-up marked done" and reloads.

**Rescheduling a follow-up** (lead panel)
- `rescheduleFollowup` sends `due_at` (`date` plus `time`, or `23:59`).
- The panel reloads; the History tab shows the move with the old and new date.

**History** (`HistoryList`)
- Shows stage moves, follow-ups, logged activities, reschedules and owner changes, newest first.
- A reschedule shows as "Follow-up rescheduled: <task>", with "Was <old>, now <new>" and "Rescheduled".

## Known gaps

- The API does not check that the note is non-empty on completion; the lead panel's form does.
- The Tasks screen uses the same calls; see [TASKS.md](TASKS.md).

## Tests

- `tests/components/lead-activity.test.tsx` (15): scheduling, time list, logging, Mark done, reschedule, history rows.
- `tests/components/followup-board.test.tsx`: the board. Four tests are out of date with the redesigned board (see [TESTING.md](TESTING.md)).
- `tests/lib/lead-followup-api.test.ts`: request shapes for complete, reschedule and schedule; `isPastTimeToday`.
- Live end-to-end: `e2e/live/lead-pipeline.spec.ts` (schedule, log, history) on desktop, tablet and phone.
