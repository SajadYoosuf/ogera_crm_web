# House stage and tank type move to Settings (web)

## Why
The backend now keeps house stages and tank types in Settings. The contact form sent labels such as "Ready" or "Under Construction - Structure", which the backend rejected (422), so house stage could not be saved from the web.

## What changed
- `src/lib/api/settings.ts`: `house_stage` and `tank_type` added to `ENUM_CATEGORIES`, so they show in Settings > Lists & Options.
- `src/components/settings/EnumsTab.tsx`: a hint for each new list.
- `src/features/contacts/hooks/useContactLookups.ts`: loads house stages with `useEnumOptions`, falling back to `DEFAULT_HOUSE_STAGES` (`utils.ts`).
- `src/features/contacts/ContactsView.tsx`: the house stage dropdown uses the Settings list and sends the stored value. A hidden value stays selectable on its own record. The "Construction phase" dropdown is removed; the backend never stored it.

## Out of scope
- No tank type field on the web contact form yet.

## Verification
- `npx tsc --noEmit` and `npx eslint` on the changed files: no new errors.

Same commit: backend (`ogera_crm_backend/docs/changes/2026-10-22-house-stage-tank-type-settings.md`) and mobile.
