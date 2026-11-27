# 2026-11-27 — Notifications poll every 60 seconds (live stream paused)

Backend side of the same incident:
`ogera_crm_backend-leads/docs/changes/2026-11-27-tenant-session-routes.md`.

## What changed

- `src/features/notifications/NotificationBell.tsx` no longer opens `GET /notifications/stream`. It loads the
  list on mount, every 60 seconds while the tab is visible, and as soon as a hidden tab becomes visible again.
- Why: on Vercel each stream was cut off at 300 s, and every open one kept querying the database.
- `src/features/notifications/stream.ts` is kept, unused, so the stream can be restored later.
- `tests/components/notification-bell.test.tsx` has three new polling tests.

## Access / data impact

None. A new notification can now take up to 60 seconds to appear.

## Verification

- `npm test -- --run`: 205 passed, 1 failed (see below).
- `npx tsc --noEmit`: no errors. ESLint on the changed files: no errors. `npm run build`: passed.
- Browser, production build against a local test API: `/notifications` was requested at 0 s and 60 s, no
  request went to `/notifications/stream`, the employees page loaded, and there were no console errors.
- `npm run lint` on the whole project: 20 problems (11 errors, 9 warnings). ESLint on the changed files passes, so
  they are in files this change does not touch.
- Not run: Playwright e2e, and anything against the deployed app.

## Known issues / not done

- `tests/components/lead-settings-tabs.test.tsx` fails: the admin tab list now includes `contact_fields` and
  `pipeline_stages`, which the test does not expect. This change does not touch those files.
- Tabs opened before the new build is deployed keep using the stream until they are reloaded.
- Restore the stream only after the backend ends it before the platform limit and releases its database session.
