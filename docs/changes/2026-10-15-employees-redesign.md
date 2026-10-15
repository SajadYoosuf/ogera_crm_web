# Employees page redesign

## Why
The Employees page did not match the Employees design: it used a hero banner, stat tiles and cards. The design is a toolbar, a table and pagination, and it has a single Role filter.

## What changes
- `src/app/dashboard/employees/page.tsx`: 72px sticky header (title, Export, Add Employee). Toolbar with search, a Role dropdown and a refresh icon. Table from `xl` up, cards below it. Pagination of 10 per page. Export downloads the filtered list as CSV, client side. The Role dropdown lists every role in `EMPLOYEE_ROLES`. Phone number is shown in the table; Field staff is removed from the form, cards and details dialog.
- `src/components/FilterSelect.tsx`: two opt-in props, `clearable` (label only until a value is chosen; re-picking the chosen option clears it) and `fit` (38px, content-width button). Default behaviour is unchanged for other screens. Colour tokens moved from blue to the brand green (`#0E4D3A`).
- `e2e/employees.spec.ts`: rewritten for the table and cards. Adds edge-case tests: paging, save failures (401, 500, offline), delete failure, reconnect reload, self-edit guards, password and legacy-phone rules, detail fallback, export disabled when empty.
- `e2e/fixtures/api.ts`: `failRequest(method, pathPrefix, status, times)` to fail the next matching request.

## Out of scope
- Backend: no changes. The list still comes from `GET /employees`; `is_field_staff` stays in the API and types, only the UI stops showing and sending it.
- Bulk selection checkboxes and a Joined date filter from the design are not built (no bulk actions exist; no date options were specified).
- Mobile app.

## Verification
- `tsc --noEmit` and `eslint` on the changed files: clean.
- `playwright test e2e/employees.spec.ts` (desktop and mobile): 64 of 64 pass (32 tests on each project).
- Desktop screenshot of the toolbar checked against the design's sizes (Role 80px, 38px high).
- Not run: the full Vitest suite has 47 failures in `performance-page.test.tsx` and `staff-live-map.test.tsx`, which this change does not touch.
