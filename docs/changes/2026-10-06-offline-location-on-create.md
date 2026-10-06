# Offline contacts are entered on mobile only

## Why
Offline (field visit) contacts are entered only in the mobile app, which reads the GPS position natively. The web app does not need to read a location or collect latitude and longitude at all.

## What changes
- `src/app/contacts/page.tsx`: the browser GPS capture on save is removed. The Source dropdown no longer offers Offline when adding a new contact, so the web cannot create an Offline contact (which the backend would refuse without coordinates). Editing a contact that already has the Offline source still shows it.
- Backend part: see the backend notes of the same name (location needed only on creation; imported offline contacts without GPS are verified).

## Out of scope
The mobile app's capture of latitude and longitude (unchanged).

## Verification
eslint, tsc, `npm test`; browser check: the new-contact Source list has no Offline; editing an Offline contact keeps it.
