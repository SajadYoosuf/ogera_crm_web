# 2026-11-25 — Import / Export menu is admin/manager only (web)

Backend note: `ogera_crm_backend-leads/docs/changes/2026-11-25-staff-lead-ownership.md`.

## What changed
- `src/features/leads/LeadsView.tsx` — the Import / Export menu renders only for admin and manager. Staff no
  longer see it. The menu was already hidden for staff's Export; now Import is hidden too.

## Access / data impact
- Staff cannot import. The backend returns 403 for staff on the import endpoints, so this matches it.

## Verification
- `tsc --noEmit`: no errors in `LeadsView.tsx`. Not checked in a browser.
- `docs/leads-mvp-testing.md` row A3 updated to match: no Import / Export menu for staff.

## Known issues or not done yet
- The e2e suite has no test for this menu yet.
