# Sprint 2 — Contact Creation Auto Follow-up (web prompt modal)

## Why
Admin/manager create contacts via the web app. When they do, they need a quick way to assign
the first follow-up to a staff member before closing the create form. Without this prompt,
they would have to navigate to the contact, open the panel, and schedule manually.

## What changes

### Web
- New component `src/features/contacts/components/AutoFollowupPromptModal.tsx`:
  Modal shown after a successful contact creation when `auto_followup_needed == true`.
  Fields: Assigned To (staff only, non-monitoring), Due Date (pre-filled today+48h), Channel (phone_call default).
  "Skip" dismisses. "Schedule" calls `POST /contacts/{id}/followups`.
- `src/features/contacts/components/ContactCreateModal.tsx` (or equivalent):
  After a successful create, check `auto_followup_needed` and open the prompt modal.
- `src/lib/api/contacts.ts`: `ContactResponse` type gains `auto_followup_needed: boolean`.

## Out of scope
- No changes to the contact create form itself.
- No mobile changes (staff auto-schedule is backend-only).

## Verification
- Open "Add Contact" as admin/manager, fill and submit.
- Prompt modal appears with 48h pre-filled.
- Skip → no follow-up created.
- Fill and Schedule → follow-up visible in the contact's LeadPanel.
