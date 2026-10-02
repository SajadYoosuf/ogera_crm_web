# Changelog

## 2026-10-02 — `da568aa` (branch `phase1`)

**Redesign contacts page and wire it to the FastAPI backend**

Author: sajad yoosuf

### Summary

The contacts page now matches the employees page and uses the FastAPI contacts API for list, create, edit and delete, with a redesigned add/edit modal. Notes: [docs/changes/2026-10-02-contacts-redesign-api.md](docs/changes/2026-10-02-contacts-redesign-api.md).

### Files

| Status | File | Change |
| --- | --- | --- |
| Modified | `src/app/dashboard/page.tsx` | Header, live search, horizontal filters, table/cards, new modal, API-backed save/delete. |
| Added | `src/lib/api/contacts.ts` | Contacts and lead-sources API client with console logging. |
| Added | `src/lib/api/devlog.ts` | Shared dev-only request/response logger. |
| Added | `src/components/PhoneField.tsx` | Country picker with per-country phone length validation. |
| Added | `src/components/SelectField.tsx` | Themed form dropdown. |
| Added | `src/components/FilterSelect.tsx` | Filter dropdown extracted from the employees page. |
| Added | `src/components/FilterPanel.tsx` | Horizontal filter row. |
| Added | `src/app/dashboard/employees/page.tsx`, `src/lib/api/employees.ts`, `src/app/api/dev-log/route.ts` | Existing local work the contacts code depends on. |
| Modified | `src/lib/api/auth.ts` | Exports `request`, adds `forbidden` error kind, handles 204. |
| Modified | `src/app/globals.css` | Removed old `react-phone-number-input` styles. |
| Modified | `package.json`, `package-lock.json` | Added `libphonenumber-js` (also carries earlier Playwright entries). |

### Notes

- The backend (`ogera_crm_backend`) changes are not in this commit: `GET /lead-sources`, a `created_by` list filter, Offline replacing Field Visit in the seed, and `scripts/merge_field_visit_into_offline.sql`.
- Not tested against a running backend or in a browser.

## 2026-09-30 — `f393cff` (branch `phase1`)

**Integrate FastAPI login with loading, network and error states**

Author: sajad yoosuf

### Summary

The login screen now authenticates against the FastAPI backend (`POST /auth/login`, documented in `API.md`) instead of the removed Next.js `/api/auth/login` route. It handles loading, offline/network and error states.

### Files

| Status | File | Change |
| --- | --- | --- |
| Added | `API.md` | Backend API reference (auth and contacts endpoints). |
| Added | `src/lib/api/auth.ts` | `login()` and `getMe()` client, `ApiError` kinds, 15 s timeout. |
| Added | `src/hooks/useLogin.ts` | Idle / loading / success / error state and session storage. |
| Added | `src/hooks/useOnlineStatus.ts` | Reactive browser online/offline state. |
| Added | `tests/api/auth-client.test.ts` | Unit tests for status-to-error mapping. |
| Modified | `src/app/page.tsx` | Login form uses the hooks; offline banner, retry button. |
| Modified | `src/app/globals.css` | Offline banner style (also includes earlier uncommitted style edits). |
| Modified | `docs/FRONTEND_AUTHENTICATION.md` | Rewritten for the new flow. |

### Notes

- Set `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`). The backend must allow the web origin via CORS.
- Session keys `ogera_access_token` and `ogera_user` are unchanged, so existing dashboard code keeps reading them.
- Not included in this commit: the `.env*` files and unrelated working-tree changes.
