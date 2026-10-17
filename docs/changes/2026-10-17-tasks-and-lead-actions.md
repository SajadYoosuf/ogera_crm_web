# Tasks and lead actions: notes, dialogs, layout, and live tests

## Why
Mark done and Reschedule on the Tasks screen did not work against the real API. Task names were not shown. Phones and tablets had layout faults. The team needs the full flow tested end to end before it ships.

## What changes
- **Actions:** Mark done opens a Log Activity dialog first, then asks "Schedule a follow-up?". Reschedule opens a dialog that shows the task's values and changes the date and time. Both replace the old inline forms (Tasks screen).
- **API calls:** `markFollowupDone` and `rescheduleFollowup` call `PATCH /contacts/{id}/followups/{fid}` (they used `/activities/{id}`, which does not exist). The lead panel uses the same functions.
- **Names:** the task's name is shown first in table rows and phone cards.
- **Time check:** a time earlier today is refused in the schedule form and the reschedule dialog, with a message, before the request is sent.
- **Forms:** the modal frame turns off the browser's own date check, so our messages show.
- **Layout:** the Priority column and the three-dot menu on desktop and tablet; the menu is drawn above the page and follows its button. The table scrolls inside its box, so the page does not scroll sideways on tablet.
- **History:** reschedules show as "Follow-up rescheduled" with the old and new date.
- **Tests:** new unit tests (`task-dialogs`, `lead-followup-api`), a reschedule history test, updated tasks-board and lead-activity tests, a locale-proof date test, and the live end-to-end suite (`e2e/live/`, 21 tests, three screen sizes).

## Out of scope
- The followup-board tests (four) still expect the old board copy. Left for a decision on the wording.
- The timezone display test. Left for a decision on how times are stored.
- The Add New button on the Tasks screen. Not built yet.

## Verification
- Web unit suite: 117 of 123 passing; the six failures are the known ones above (four followup-board, one timezone, one password-rules).
- Live end-to-end: 21 of 21 passing on desktop, tablet and phone.
- Lint on changed files: clean. Type-check: clean.
- Backend (same change): see `ogera_crm_backend/docs/changes/2026-10-17-lead-pipeline-and-task-actions.md`.
