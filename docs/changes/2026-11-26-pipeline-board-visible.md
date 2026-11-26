# Pipeline board stays visible without contacts

Backend change note: [../../../ogera_crm_backend-leads/docs/changes/2026-11-26-contact-pipeline-and-import-fixes.md](../../../ogera_crm_backend-leads/docs/changes/2026-11-26-contact-pipeline-and-import-fixes.md)

## What changed

- `src/features/contacts/PipelineView.tsx` loads stages and contacts separately. If only the contacts request
  fails, the stage columns stay on screen under an error with Retry.
- A pipeline with no stages shows a message instead of a blank area.
- The empty board seen before this change came from the backend returning 404 for `/pipeline/stages`; see the
  backend note.

## Access / data impact

None. Display only.

## Verification

- `tests/contacts/pipeline-view.test.tsx` (new): empty board on all three tabs, contacts failure, stages failure.
- `vitest run`: 188 passed, 1 failed (`tests/components/lead-settings-tabs.test.tsx`, in code not touched here).
- `tsc --noEmit`: no errors. `npm run build`: compiled.
- Not checked in a browser; the page needs a signed-in session.

## Known issues or not done yet

- If the stages request fails, no columns can be shown.
- Clicking a card does nothing yet.
