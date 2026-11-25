# 2026-11-25 — Lead table dropdowns open upward; timeline shows the assignee (web)

Two fixes on the Leads page and its detail modal.

## Dropdowns clipped at the bottom of the table
The Assign dropdown and the status pill menu were absolutely positioned inside the table's scroll wrapper, so rows
near the bottom showed a cut-off or empty menu.

- `src/hooks/useFloatingPopover.ts` (new) — fixed-position placement for a list rendered through a portal. It opens
  below its trigger, or above it when there is not enough room below. It stays inside the screen horizontally and
  recalculates on scroll and resize while open.
- `src/components/FilterSelect.tsx` — the list renders into `document.body` through `createPortal`. Outside-click
  handling also ignores clicks inside the list. This component is shared, so every use gets the new placement.
- `src/features/leads/components/LeadStatusSelect.tsx` — same change for the status pill.
- `src/hooks/usePopoverFit.ts` is unchanged; other menus still use it.

## Timeline shows who an assignment went to
- `src/features/leads/api/leads.ts` — `LeadTimelineItem` gets `detail: string | null` (backend: `routes/lead_interactions.py`).
- `src/features/leads/components/LeadDetailModal.tsx` — the timeline draws `detail` under the event label, e.g.
  "Lead assigned" then "Assigned to Raj Sales".

## Verification
- `tsc --noEmit` passes.
- ESLint on the changed files: `FilterSelect.tsx`, `LeadStatusSelect.tsx` and `useFloatingPopover.ts` are clean.
  `LeadDetailModal.tsx` has three existing errors (`react-hooks/set-state-in-effect`, `preserve-manual-memoization`)
  in code this change does not touch.
- Not yet checked in a browser: the upward flip near the bottom of the table, and the timeline text on a real lead.
