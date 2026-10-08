# Partner type in the contact form

## Why
The contact form had no way to choose a partner's type, and the partner filter used a hardcoded list.

## What changes
- `src/lib/api/contacts.ts`: `listProfessionTypes()`, `partner_profile` on the contact types.
- `src/app/contacts/page.tsx`: "Partner type" select in the add/edit form when Type is Partner (required), sent as `partner_profile.profession_type`; the filter and badges use the backend list and labels.

## Out of scope
Mobile; backend changes (see the backend notes of the same date).

## Verification
Type-check and eslint on the two files.
