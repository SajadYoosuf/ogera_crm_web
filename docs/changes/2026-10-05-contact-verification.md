# Contact verified / unverified column

## Why
Show on the contacts page which contacts have all required details and which are still pending.

## What changes
- `src/lib/api/contacts.ts`: `ApiContact` gains `is_verified` and `missing_fields`.
- `src/app/contacts/page.tsx`: new "Status" column on the desktop table and a badge on the phone cards. Unverified shows the pending fields in its tooltip and text.

## Out of scope
Filtering by status, and any change to the contact form.

## Verification
`npx eslint` and `npx tsc --noEmit` on the changed files.
