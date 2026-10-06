# Offline location picker on contact creation

## Why
Offline (field visit) contacts needed the browser's GPS to save, and blocked saving when it was denied. The location is now needed only when an offline contact is created, and the user can set it themselves.

## What changes
- `src/app/contacts/page.tsx`: when creating a contact with the Offline source, a Location block appears with "Use my current location" (reads the browser position only, no address lookup) and editable Latitude / Longitude fields. Saving needs valid coordinates. The address stays a typed field. Editing an existing contact shows no location fields.
- The automatic, blocking GPS capture on save is removed.
- Backend part: see the backend notes of the same name.

## Out of scope
A map picker, reverse geocoding the address.

## Verification
eslint, tsc, `npm test`; manual: create an Offline contact with and without coordinates; edit an imported Offline contact without any location.
