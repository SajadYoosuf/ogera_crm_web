# Contact fields: dynamic save and load for consumer and partner profiles

## What changed

**`src/features/contacts/utils.ts`** — exported `toCamel` helper (snake_case → camelCase) so it can be shared across hooks and the view.

**`src/features/contacts/hooks/useContactEditor.ts`** — reworked consumer and partner profile serialization to be driven by `ContactFieldDefinition` rows instead of hardcoded field names:
- Now accepts `consumerFields` and `partnerFields` params (default to `[]`).
- **Detail load** (`openEditor` → `getContact`): iterates the field definition arrays to populate form state from `consumer_profile.data` / `partner_profile.data`, falling back to the legacy hardcoded names when definitions are not yet loaded.
- **Save path** (`saveContact`): builds `consumer_profile.data` and `partner_profile.data` by iterating the field definitions, so any dropdown, text or number field created in Settings is serialized automatically. Falls back to legacy hardcoded fields when definitions are empty.
- Partner-type required validation updated to read from the dynamic form key rather than the fixed `values.partnerType` when definitions are present.

**`src/features/contacts/ContactsView.tsx`** — passes `consumerFields` and `partnerFields` (already loaded by `useContactLookups`) to `useContactEditor`; removed the now-redundant inline `toCamel` definition.

## Access / data impact

No schema migration. Contact data already in `consumer_profile.data` / `partner_profile.data` continues to round-trip correctly. New fields added via Settings will now be saved and loaded correctly.

## Verification

- `npx tsc --noEmit` — clean, no type errors.
- End-to-end: add a dropdown field via Settings → Contact Field Definitions, then create a consumer contact and select an option; save and re-open — the value is preserved.

## Known issues or not done yet

- Dealer `data` JSONB bag not yet wired dynamically (dealer fixed columns still hardcoded; dealer_type options already read from `dealerFields` for the dropdown).
- No Vitest tests for the reworked save/load logic.
