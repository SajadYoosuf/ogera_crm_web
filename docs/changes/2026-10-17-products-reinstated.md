# Products page and Product Details modal (web)

## Why
The products catalogue is reinstated (rule 9 in `rule.md`). The team wants a list of tanks and one modal to view, add, edit and archive them.

## What changes
- `src/app/dashboard/products/page.tsx`: list with search, a Filter menu (status, category, brand, material), table, and pagination. Rows open the modal. "Add New Product" opens it empty.
- `src/components/products/ProductModal.tsx` (new): Product Details modal with Basic Info, Pricing, Dimensions and Specs, and Features (free-text chips). Brand, category and material have inline "+ Add new". Archive/Restore is in the footer. Read-only for non-editors. Backdrop matches the other modals (`z-[1100]`, blur).
- `src/lib/api/products.ts`: API client for the products endpoints, with `canEditProducts`.
- `src/components/DashboardSidebar.tsx`: Products menu item.
- Removed the old `products/new`, `products/[id]` pages, `ProductForm` and `PageHeader`. The modal replaces them.

## Out of scope
- Product photos (removed from the modal; the list shows a tank icon).
- Delete button in the UI (archive instead).
- Mobile.

## Verification
- `npx tsc --noEmit`: clean. `npx eslint` on the products files: clean.
- Browser pass against the backend e2e server, before the photo removal: create (with the photo check), inline brand, feature chip, save, edit, archive, restore, search empty state.
