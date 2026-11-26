# Leads bulk delete (filter panel)

Change note for the backend side: [../../../ogera_crm_backend-leads/docs/changes/2026-11-26-leads-bulk-delete.md](../../../ogera_crm_backend-leads/docs/changes/2026-11-26-leads-bulk-delete.md)

## What changed

- Leads → Filter panel (`LeadsFilterMenu`) has a **Delete matching leads** button. Shown to admin/manager only. Disabled until a filter or search is set.
- Clicking it opens a confirmation dialog in `LeadsView` that shows the live count (`list.total`) of leads the current filters match, and asks before deleting.
- On confirm, `bulkDeleteLeads()` (`features/leads/api/leads.ts`) posts the same filters the list uses to `POST /leads/bulk-delete`. A toast reports how many were deleted, and the list reloads.
- `useLeadsList` now also returns `submittedSearch`, so the delete uses the search that is actually applied, not the text still being typed.
- Files: `features/leads/LeadsView.tsx`, `features/leads/components/LeadsFilterMenu.tsx`, `features/leads/api/leads.ts`, `features/leads/hooks/useLeadsList.ts`.

## Access / data impact

- Admin and manager only. The button is not rendered for staff.
- Soft delete. Matched leads are hidden from lists; no rows are removed.
- Acts on live data when used.

## Verification

- `tsc --noEmit`: no errors. `eslint` on the four changed files: clean.
- `vitest run tests`: 185 passed, 1 failed. The failure is `tests/components/lead-settings-tabs.test.tsx` (settings tab list, which includes `contact_fields` and `pipeline_stages`). It is not related to this change.
- Not checked in a browser; not run against the live database.

## Known issues or not done yet

- Contacts page bulk delete not done. `routes/contacts.py` is deleted in the uncommitted working tree.
- No component test yet for the new button and dialog.
