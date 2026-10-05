# Changelog

## 2026-10-05 — `48b3df0` (branch `phase1`)

**Add verified / unverified filter to contacts**

Author: sajad yoosuf
Previous commit on this side: `bf76cde` Add hover tooltip listing pending contact details (2026-10-05)

### Summary
The contacts filter bar gets a Status dropdown (Verified / Unverified) that drives the new `verified` API parameter.

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/lib/api/contacts.ts` | `listContacts` accepts `verified` |
| Modified | `src/app/contacts/page.tsx` | Status filter added to the filter bar and the load call |

### Notes
Web part of a commit that also touched the backend. Checked with eslint and tsc, not in a browser.

## 2026-10-05 — `bf76cde` (branch `phase1`)

**Add hover tooltip listing pending contact details**

Author: sajad yoosuf
Previous commit on this side: `f6ca49e` Show a table skeleton while contacts load (2026-10-05)

### Summary
The Verified / Unverified badge shows a tooltip on hover and focus. Unverified lists the details still to fill in; Verified says all are complete.

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/app/contacts/page.tsx` | `VerifiedBadge` gets a fixed-position tooltip (not clipped by the table wrapper), keyboard focus support and an aria-label |

### Notes
Web only. Checked with eslint and tsc, not in a browser.

## 2026-10-05 — `f6ca49e` (branch `phase1`)

**Show a table skeleton while contacts load**

Author: sajad yoosuf
Previous commit on this side: `d39dc1b` Add verified / unverified status to contacts (2026-10-05)

### Summary
Desktop and tablet show one skeleton table with the real headers while contacts load; phones keep the card skeleton.

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/app/contacts/page.tsx` | Loading state renders a header-matched skeleton table (12 rows) at `md` and up |

### Notes
Web only. Checked with eslint and tsc, not in a browser.

## 2026-10-05 — `d39dc1b` (branch `phase1`)

**Add verified / unverified status to contacts**

Author: sajad yoosuf
Previous commit on this side: `c93ee92` docs: update changelog for 2ce70d2 (2026-10-03)

### Summary
The contacts page gets a Status column showing Verified or Unverified. Notes: [docs/changes/2026-10-05-contact-verification.md](docs/changes/2026-10-05-contact-verification.md).

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/lib/api/contacts.ts` | `ApiContact` gains `is_verified` and `missing_fields` |
| Modified | `src/app/contacts/page.tsx` | Status column on the table and a badge on phone cards; Unverified lists the pending fields |
| Added | `docs/changes/2026-10-05-contact-verification.md` | Change notes |

### Notes
The same commit also touched the backend, which supplies the fields. No filter by status yet.

## 2026-10-02 — `2ce70d2` (branch `phase1`)

**Restructure repo into backend / web / mobile folders**

Author: sajad yoosuf
Previous commit on this side: `da568aa` Redesign contacts page and wire it to the FastAPI backend (2026-10-02)

### Summary

The web app moved from the repo root into `ogera_crm_web/`, so one repo now holds the backend, web and mobile folders. No application code changed; git records most of the move as renames, so file history carries over. Notes: [docs/changes/2026-10-02-contacts-redesign-api.md](docs/changes/2026-10-02-contacts-redesign-api.md) (earlier change, moved with the app).

### Files

Git lists these as new paths under `ogera_crm_web/` because the old paths were outside the folder; most are renames of files that lived at the repo root.

| Status | File | Change |
| --- | --- | --- |
| Renamed | `src/`, `public/`, `tests/`, `e2e/`, `scripts/` | Moved under `ogera_crm_web/` unchanged. |
| Renamed | `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.mts`, `playwright.config.ts` | Project config moved with the app. |
| Renamed | `docs/`, `README.md`, `API.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md` | Documentation moved with the app. |
| Added | `.claude/skills/responsive-ui/`, `.claude/skills/ui-states/` | Web UI skills, now tracked. |
| Added | `.gitignore` | Web-specific ignores (`.env*`, Playwright output); the root `.gitignore` now covers `node_modules/` and `.next/`. |
| Deleted | `src/app/api/**`, `src/lib/auth/`, `src/lib/sales.ts`, `migrations/`, `tests/api/*route*` | Old Next.js API routes, SQL migrations and server-side code. Already removed from the working tree when the web app moved to the FastAPI backend; recorded here. |

### Notes

- Run commands (`npm run dev`, `npx eslint`) from `ogera_crm_web/` now.
- The old Professionals page (`src/app/dashboard/professionals/`) still exists and depends on the deleted `/api/professionals` routes.
- The previous commit above lived at the old layout, so a path-scoped history of `ogera_crm_web/` starts at this commit; use `git log --follow` on a file to see its earlier history.
- Pairs with the backend entry for `2ce70d2` and the root `.gitignore` / `.claude/skills/feature-workflow` additions.

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
