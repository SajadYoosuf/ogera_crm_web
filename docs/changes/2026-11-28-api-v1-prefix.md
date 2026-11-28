# Update API base URL to include /api/v1

**Date:** 2026-11-28

## What changed

- `src/lib/api/auth.ts`: `API_BASE_URL` now appends `/api/v1` to the configured origin, so all `apiCall` and `request` calls automatically target versioned backend endpoints (e.g. `/api/v1/auth/login`).

No path strings in feature modules were changed — the prefix is added once at the base URL level.

**Companion change:** `ogera_crm_backend-leads/docs/changes/2026-11-28-api-v1-prefix.md`

## Access / data impact

None — purely a URL structure change.

## Verification

- Reviewed that `API_BASE_URL` is the single point where the host is built; all callers use it via `request()` or `apiCall()`.
- Dev server not started in this session.

## Known issues / not done yet

- `.env.example` `NEXT_PUBLIC_API_BASE_URL` comment should be updated to remind that the value should be just the origin (e.g. `https://my-backend.com`), not include `/api/v1`.
