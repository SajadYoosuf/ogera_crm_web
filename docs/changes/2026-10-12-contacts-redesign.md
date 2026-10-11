# Contacts page and sidebar redesign

## Why
The Contacts page and sidebar must follow the Contacts design, and the status shown must be only Verified or Unverified.

## What changes
- Contacts page: sticky header, type tabs with counts, search, Sort by and Filter, the table (with Assigned to for admins and managers), numbered pagination, mobile cards.
- Sidebar: account block at the top, Workspace and Admin sections, Settings and Log out at the bottom, design icons.
- Contacts route uses DM Sans (`src/app/contacts/layout.tsx`).
- Sort by calls `GET /contacts?sort=` (backend change in the same commit).
- Assignee picker excludes admins and managers (rule.md, rule 1).

## Out of scope
- Dashboard and other pages keep the system font and the previous sidebar styling until they are redesigned.
- Bulk actions for row checkboxes (selection only for now).
- Modals (Add / Edit / Delete contact) keep their existing styling.

## Verification
- `tsc --noEmit` and `eslint` on the changed files: clean.
- Not yet checked in a browser against the design; that is the next step.
