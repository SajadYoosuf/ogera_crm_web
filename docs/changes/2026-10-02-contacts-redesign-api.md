# Contacts page redesign wired to the FastAPI backend

## Why
The contacts page still used the removed Next.js `/api/contacts` routes, so loading, saving and deleting failed.
It also looked different from the employees page.

## What changes
- `src/app/dashboard/page.tsx`: employees-style header, live search, horizontal filter row (type, lead source, district, assigned to, created by), table on desktop and cards on phones, redesigned single-section add/edit modal (close button fixed), assigned-employee display and reassignment (admin/manager), save/delete through the API.
- `src/lib/api/contacts.ts` (new): `GET/POST/PUT/DELETE /contacts`, `GET /lead-sources`, with request/response console logging via `src/lib/api/devlog.ts`.
- `src/components/`: `PhoneField` (country picker + per-country length validation via `libphonenumber-js`), `SelectField` (themed form dropdown), `FilterSelect` (extracted from the employees page), `FilterPanel` (horizontal filter row).
- `src/app/dashboard/employees/page.tsx`: imports the shared `FilterSelect`; `src/lib/api/employees.ts`, `src/lib/api/auth.ts` (exports `request`, adds `forbidden` kind, handles 204) and `src/app/api/dev-log/route.ts` are included because the contacts code depends on them.
- `src/app/globals.css`: removed the old `react-phone-number-input` styles.
- New dependency: `libphonenumber-js`.
- Backend (separate folder `ogera_crm_backend`, not part of this commit): `GET /lead-sources`, `created_by` list filter, Offline replaces Field Visit in the seed, `scripts/merge_field_visit_into_offline.sql`.

## Out of scope
- GPS accuracy check for Offline contacts, notes/professional/campaign/awareness/water-tank fields (removed because the API has no place for them), backend deployment and the SQL merge run.

## Verification
- `npx tsc --noEmit` and eslint on the changed files pass.
- Not yet tested against a running backend or in a browser.
