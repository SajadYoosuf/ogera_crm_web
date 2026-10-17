# Frontend: Tasks

The `/dashboard/tasks` screen: every follow-up across leads in one list, with status tabs, search, a Filter menu, and the actions Mark done and Reschedule. The backend contract is in `ogera_crm_backend/docs/modules/tasks.md`.

Status: in the working tree, not committed yet.

## File map

| File | Responsibility |
| --- | --- |
| `src/app/dashboard/tasks/page.tsx` | Route. Renders `TasksBoard` |
| `src/components/tasks/TasksBoard.tsx` | The screen: header, toolbar (tabs, search, Filter menu), list states, the action dialogs, all data loading |
| `src/components/tasks/TaskTable.tsx` | Desktop and tablet table (from 768px): Task Title, Assigned, Task Type, Status, Due Date, Priority, Actions. The three-dot menu |
| `src/components/tasks/TaskCard.tsx` | Phone cards: task name, lead, phone, notes, Mark done, Reschedule, call and WhatsApp |
| `src/components/tasks/TaskDialogs.tsx` | `CompleteTaskDialog` (log what happened), `NextFollowupDialog` (schedule another?), `RescheduleTaskDialog` (task values and a new date) |
| `src/components/tasks/calendar.ts` | Date ranges for the Due date filter: `rangeFor`, `startOfWeek`, `addDays`, `toISO` |
| `src/lib/api/tasks.ts` | `listTasks`, `TaskItem`, `TaskSummary`, `TaskQuery` |
| `src/lib/api/activities.ts` | `markFollowupDone`, `rescheduleFollowup`, `scheduleFollowup` (shared with the lead pipeline) |

## Screen

- **Header:** title and an Add New button (not wired yet).
- **Toolbar:** status tabs (All, To do, In Progress, Completed; opens on **All**), search (350 ms debounce), Filter menu (Due date, Lead type, Activity type, Employee for managers), Export (disabled).
- **Due date:** All dates (default), Today, This week, This month, or a custom range of up to 62 days. Today also includes overdue tasks.
- **Count:** "Showing N tasks" sits at the bottom edge of the card, whatever the count.

## Layout by width

| Width | Layout |
| --- | --- |
| 768px and up | Table with the Actions column (three-dot menu). The table scrolls inside its box; the page never scrolls sideways |
| Below 768px | One card per task, with the actions as buttons |

The menu is drawn in a portal at screen coordinates, so the table cannot clip it. It follows its button when the page scrolls, and closes when the button leaves the screen, on Escape, or on an outside click.

## States

| State | What the person sees |
| --- | --- |
| Loading | Three grey skeleton rows (first load only; later reloads fade the list) |
| Empty | "No follow-ups here", or "No tasks match" with the active filters and a Clear filters button |
| Error | "Something went wrong" with the server's message and Try again. Offline and timeout messages come from the request helper |
| Not signed in | "Sign in to see your tasks." |
| Custom range not picked | "Pick a date range" |
| Success | The list; a green notice for a few seconds after an action |

## Actions and dialogs

Mark done (menu or card button):
1. **Log Activity** (`CompleteTaskDialog`): the task's values are shown; "What happened?" is required. Blank text is refused in the dialog.
2. The task is completed with that text as the activity note.
3. **Schedule a follow-up?** (`NextFollowupDialog`): "Yes, schedule" opens the schedule form for the same lead; "No, that's all" closes it.

Reschedule (menu or card button):
- **Reschedule Follow-up** (`RescheduleTaskDialog`): shows the task's values; "New due date" (not in the past) and optional "New time". A time earlier today is refused ("That time has already passed today…"). Saves with `due_at`.

Both dialogs show the server's message if the save fails and stay open.

## Known gaps

- A standalone task (no lead) cannot be completed or moved from this screen; the dialog says so.
- The Add New button does nothing yet.
- In Progress tasks are not part of the To do tab.

## Tests

- `tests/components/tasks-board.test.tsx` (10): default All and the status tabs, Today and week/month ranges, manager employee filter, the table actions, the Mark done flow to the next step, the reschedule.
- `tests/components/task-dialogs.test.tsx` (10): blank note refused and trimmed; past date and past time refused; no-time means the whole day; next-step buttons.
- Live end-to-end: `e2e/live/tasks-flow.spec.ts` (mark done, reschedule and the history) and `e2e/live/responsive.spec.ts` (fit on desktop, tablet and phone).
