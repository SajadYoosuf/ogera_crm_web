# Lead detail: fetch before opening, read-only follow-ups, UI loaders

## What changed

- **Lead detail opens with data already loaded.** Clicking a lead row (or following a `?lead=` notification link) now calls `openLeadDetail` in `src/features/leads/LeadsView.tsx`. It fetches the lead first, showing a full-screen backdrop with a spinner, then mounts `LeadDetailModal` with `initialLead`. The modal skips its own first fetch when given that lead. If the fetch fails, the modal opens without preloaded data and its own fetch path shows the error.
- **Follow-ups in the lead detail are read-only.** `LeadDetailModal` renders `FollowupCard` in its `compact` mode with no action children. The compact card shows type, title, assignee and due date/time only. Start, Complete, Reschedule, Reassign and Delete are no longer shown in this modal. `LeadTaskActions` is no longer imported there; the component itself is unchanged.
- **Shared loaders.** New `src/components/Spinner.tsx` exports `Spinner` (xs/sm/md/lg), `SpinnerRow` (spinner with label) and `SkeletonLines`. Plain "Loading…" text is replaced with these in: LeadDetailModal, LeadModal, LeadActivityLogModal, LeadFollowupModal, leads and contacts BulkAssignModal, NotificationBell, WhatsApp inbox (ConversationList, LeadInfoPanel, MessageThread).
- `FollowupCard.tsx` gains the `compact` prop that the read-only card uses.

## Access / data impact

None. No API, route or permission changes. Staff who could previously act on follow-ups from the lead modal now use the Tasks page for those actions. The backend permission checks are unchanged.

## Verification

- `npm test -- --run`: 22 files, 183 tests passed. One Vitest error was reported: a forks worker failed to spawn (`spawn EPERM`) while starting `tests/leads/convert-lead-modal.test.tsx`. It is an environment issue; the test itself did not report a failure.
- `npx tsc --noEmit`: exit 0.
- `npm run build`: compiled successfully, all 13 routes generated.
- `npm run lint`: 7 errors, all in lines this change did not touch (see Known issues). Changed files were checked with `npx eslint` on the touched paths.
- Manual check on the live app by the user: lead detail opens after the loader, follow-up cards show details only.
- Not run: a browser test in this session, and the Vitest suite was not re-run after the spawn error.

## Known issues or not done yet

- 7 ESLint `react-hooks/set-state-in-effect` and related errors remain in code this change did not touch: `LeadDetailModal.tsx` (refreshLead/useLeadEditor ordering, `loadInteractions` effect), `LeadFollowupModal.tsx` (two effects), and both `BulkAssignModal.tsx` files (effect setState). They predate this change and need a separate refactor.
- `tests/tasks/tasks-view.test.tsx` (reassign test) and `next-env.d.ts` have unrelated uncommitted changes and are not part of this change.
- The lead detail modal still lets the user edit lead details and log activities; only follow-up actions were removed.
