# Lead Followup board (consumer stages)

## Why
"Sales Followup" called a legacy `/api/followups` API that does not exist. It is replaced by a Lead Followup board over consumer contacts, using the agreed stages and the Contacts page look.

## What changes
- Sidebar and page title: "Sales Followup" becomes "Lead Followup".
- New `lib/api/leads.ts`: load all consumer leads, change stage (`POST /contacts/{id}/stages`), read stage history.
- `components/followups/`: new stage config (`stages.ts`), board, lead panel with stage change and history. Legacy AddLeadDialog, LeadDetailsPanel, ManageStagesDialog and shared.ts are removed; leads are added from Contacts.
- Stage clocks shown on cards: New Lead 24h, Quoted 3 days, Lost re-engage after 60 days.
- Lost requires a reason; Aware accepts an optional note.

## Out of scope
Order creation on Won, payment tracking, editable stages, mobile app (follows separately).

## Verification
`npx eslint` and `npx tsc --noEmit` on changed files; manual drag/move on desktop and phone widths.
