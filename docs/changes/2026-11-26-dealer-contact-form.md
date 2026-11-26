# Dealer contacts: Dealer tab and fields in the add/edit form (web)

Cross-app note. Backend side: [ogera_crm_backend-leads/docs/changes/2026-11-26-dealer-contact-form.md](../../../ogera_crm_backend-leads/docs/changes/2026-11-26-dealer-contact-form.md)

## What changed

- `src/features/contacts/ContactsView.tsx`:
  - The type tabs in the add form now show Consumer, Partner and Dealer. Previously only Consumer and Partner.
  - A new dealer section renders the `dealer` field definitions from Settings. Dropdowns use `SelectField`, other types use text or number inputs.
- `src/features/contacts/hooks/useContactLookups.ts`: loads `dealerFields` from `GET /contact-field-definitions/dealer`.
- `src/features/contacts/hooks/useContactEditor.ts`:
  - Edit loads `dealer_profile.data` into the form.
  - Save sends `dealer_profile: { data }` for dealer contacts. Blank answers are dropped, number fields are sent as numbers, and a non-numeric value is shown as a form error before the request.
- `src/features/contacts/utils.ts`: `ContactForm.dealerData` (answers keyed by backend `field_name`).
- `src/features/contacts/api/contacts.ts`: `dealer` added to the field-definition entity types; `dealer_profile` added to the contact types.

## Access / data impact

- No change to who can add contacts or see the form. Dealer answers are written through the same create and update endpoints.
- Dealer answers are stored in `dealer_profiles.data` (see backend note).

## Verification

- `npx tsc --noEmit`: passes.
- `npx eslint src/features/contacts`: no new warnings or errors from these changes. Remaining errors and warnings are in files not touched here (e.g. `BulkAssignModal.tsx`) or existed before.
- `npx vitest run` on the contacts tests: 39 of 40 pass. The one failure is in a settings-tabs test (`visibleSettingsTabs`) and this change does not touch that code. Not checked against a clean baseline.
- Backend API behaviour checked with a temporary smoke test (see backend note).
- Not checked in the browser. The modal needs a signed-in session against a running backend, which was not set up for this change. The dealer tab and fields are unverified on screen.

## Known issues or not done yet

- Dealer fields only appear if the admin defines `dealer` field definitions in Settings > Contact fields. With none defined, the Dealer tab opens with no extra fields.
- The Dealer tab does not show dealer pipeline stages, and the pipeline board is not changed here.
