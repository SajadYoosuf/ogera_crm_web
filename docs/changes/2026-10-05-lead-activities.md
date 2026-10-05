# Activity log and owner change in the lead panel

## Why
Salespeople need to log calls, visits, WhatsApp, quotes and demos on a lead, schedule tasks, and hand a lead to another salesperson.

## What changes
- `lib/api/leads.ts`: activity list, create and complete calls.
- `LeadPanel.tsx`: an Activity section (add form with type, subtype and optional due date, task state chips, mark done, next-task prompt) and an Owner dropdown listing active staff except admins and managers (`PUT /contacts/{id}` with `assigned_to`).
- Field visits capture GPS from the browser.
- Backend part: see the backend notes of the same name.

## Out of scope
Task counts on board cards, notifications.

## Verification
eslint, tsc, manual: log a call, schedule a task, mark it done, change owner.
