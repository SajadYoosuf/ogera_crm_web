# Remove lead date from the lead create modal

## What changed
- `src/features/leads/components/LeadForm.tsx`: removed the "Lead date" input (admin/manager create mode only). Tags is now a single full-width field for every role.
- `src/features/leads/hooks/useLeadEditor.ts`: removed the `lead_date` form field, the `todayDate()` helper, the pre-fill of the date from `created_at` in edit mode, and the backdating logic on submit. Create requests no longer send `created_at`.
- `src/features/leads/api/leads.ts`: removed `created_at` from the `LeadCreate` type.
- `docs/leads.md`: removed the Lead date row and paragraph from the form-field mapping.

## Access / data impact
- Admin/manager can no longer backdate a lead from the web app. Assignee picking on create is unchanged.
- No API change in this repo. The backend still accepts a `created_at` override; it is simply no longer sent by the web app.

## Verification
- `npx tsc --noEmit`: passes.
- `npx eslint` on the three edited files: passes.
- `npx vitest run tests/leads`: 3 files, 25 tests pass.
- Not run: the e2e suite and a manual browser check of the create modal.

## Known issues or not done yet
- The backend `created_at` override in the lead create schema is not removed. Remove it there too if backdating should be blocked at the API level.
- Lint errors remain in `LeadFollowupModal.tsx` and other files; they predate this change and were not touched.
