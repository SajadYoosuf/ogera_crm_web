# Sales page on the new sales API

## Why
The Sales Ledger page called `/api/sales`, which no longer exists, and used a tank-specific layout. The buyers register now lives in the backend `sales` table (see `ogera_crm_backend/docs/changes/2026-10-09-sales-table.md`).

## What changes
- `src/lib/api/sales.ts` (new): list, products, create, update, delete, and `canEditSales`.
- `src/components/SaleFormModal.tsx` (new): add / edit form (name, phones, purchase date, purchased product with suggestions, address).
- `src/app/dashboard/sales/page.tsx` (rewritten): search, purchase date range, product filter, table on desktop and cards on phones, pagination, delete confirmation, loading / empty / error states. Add, edit and delete show only for admin and manager.
- `tests/components/sales-page.test.tsx` (new): 3 tests.

## Out of scope
Export, import, linking sales to contacts or the products catalogue, mobile. The old `SaleDetailModal`, `SaleEditorDrawer`, `salesExport.ts` and `saleTypes.ts` are no longer used by the page and were left in place.

## Verification
`eslint` and `tsc` clean on the changed files; 3 Vitest tests pass. Not checked in a browser.
