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

## Update: design pass
First version looked like the old generic board. Reworked to follow the Contacts page: gradient header with eyebrow, title and KPI chips (Active / Overdue / Won); toolbar with a `lg:max-w-md` search and the shared `FilterSelect` (no full-width native dropdowns); a pipeline strip of stage tabs with counts; columns with a colour bar; cards with avatar, clock chip, call and WhatsApp buttons and a one-click next-stage button; a "Needs attention" filter. Mobile uses the strip to pick one column. Not yet checked visually in a browser.
