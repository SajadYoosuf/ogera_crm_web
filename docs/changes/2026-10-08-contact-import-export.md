# Contact import and export (web)

## Why
Staff need to bring in contact sheets without cleaning them first, and to download filtered contact lists. The backend part is in `ogera_crm_backend/docs/changes/2026-10-08-contact-import-export.md`.

## What changes
- `src/lib/api/contactsIo.ts` (new): analyze / commit import, export download, template download, "rows not imported" CSV.
- `src/components/ContactExportModal.tsx` (new): date range, type, lead source and CSV / Excel / PDF picker, pre-filled from the page's filters; shows "N contacts will be exported" and blocks formats over their row limit.
- `src/components/ContactImportModal.tsx` (new): choose file, review detected columns (changeable) and counts, see problem rows, pick rules (default type and source, duplicates, owner), import.
- `src/app/contacts/page.tsx`: Import (admin/manager only) and Export buttons in the header, and the two modals.
- `src/lib/api/contacts.ts`: `created_from` / `created_to` on `listContacts`.
- `tests/components/contact-import-export.test.tsx` (new).

## Out of scope
Mobile, and any redesign of the contacts page.

## Verification
`tsc` and `eslint` clean on the changed files; 7 new Vitest tests pass. The full suite has 17 failures, all in `staff-live-map.test.tsx`, which this change does not touch.

## Deviations / notes
- `DateRangePicker` gained a `bare` prop (form-field look) used by the export modal.
- `contacts/page.tsx` also carries small responsive tweaks made alongside: the table shows from `xl` (cards below, two columns from `sm`), and Source / Added columns hide below `2xl`.
