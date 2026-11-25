# Tasks page — status dropdown and action menu

**Date:** 2026-11-25
**Files:** `src/features/tasks/components/TasksView.tsx`, `src/features/leads/components/LeadTaskActions.tsx`, `tests/tasks/tasks-view.test.tsx`

## What changed

- **Status column** is a dropdown instead of a badge. Only the assignee can change it; heads and other staff see it disabled. To do and In progress save straight away. Completed opens the completion form (done via, outcome, note) rather than saving directly.
- **Action column** is a three-dot menu. Items: View Lead (everyone), Reschedule (heads, and the assignee when Settings allow staff reschedule), Reassign and Delete (heads only). Reassign and Reschedule are hidden on completed tasks. Start and Complete are no longer shown in the row.
- **Row click** opens the task card with no action buttons.
- **LeadTaskActions** takes two optional props: `initialMode` opens straight into one action, and `onCancel` lets the caller close instead of returning to the button row. The lead detail page keeps its existing behaviour.
- **Toolbar** uses plain native selects: Group (with counts) and Employee (heads only).

## Access / data impact

No API or role changes. Status updates use the existing `updateInteraction` call. The assignee-only status rule and the head-only Reassign and Delete are UI gating; the backend enforces its own rules.

## Verification

- Full suite: `23 files, 185 tests passed` (`npx vitest run`).
- `npx tsc --noEmit`: no output, exit 0.
- ESLint on the changed files: no reports.
- `npm run build`: compiled, all 13 routes including `/dashboard/tasks`.
- Conflict markers: none in `src/`, `tests/`, `docs/`.
- Not run: a browser check of the status dropdown, the action menu and the toolbar layout.

## Known issues or not done yet

- Layout and interaction not yet checked in a real browser.
- `next-env.d.ts` was modified by the build and is not part of this change; it is left unstaged.
