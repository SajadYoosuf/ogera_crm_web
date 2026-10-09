# Sale form: link to the products catalogue

## Why
Sales should use the product data structure instead of free text. Backend part: see the backend notes of the same name.

## What changes
- `lib/api/sales.ts`: `product_id` on `Sale` and `SaleInput`.
- `SaleFormModal.tsx`: the product box suggests catalogue products (with capacity). An exact catalogue name links the sale (`product_id`), anything else is saved as typed with no link. A small hint says which.
- Sales page loads the active catalogue (`listProducts`, up to 100) next to the existing product suggestions; if that call fails the form still works as plain text.

## Out of scope
Price, quantity, filtering the sales list by catalogue product in the UI.

## Verification
`tests/components/sale-form-modal.test.tsx` (new, 2 tests), `sales-page.test.tsx` still passes, eslint and `tsc --noEmit` clean.
