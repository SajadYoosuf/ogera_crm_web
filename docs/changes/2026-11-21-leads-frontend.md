# 2026-11-21 — Leads page (frontend)

## Summary
Leads page redesigned to match Contacts. Adds lead import and export, a single Filter panel with a created-date range, the lead modal, and fixes found while testing on desktop, tablet and phone.

## Leads page
- Header: title, Import / Export, Bulk Assign, Add Lead.
- Toolbar: search, **All time** date range (outside the panel), **Filter** (Source, Status, Assigned to).
- Table: Name (link-style, opens the modal), Source, Branch, Tags (up to two pills plus `+N`), WhatsApp (number plus sent/not-sent icon), Status, Assigned, Created by, Score, Created, Action. Scrolls sideways inside its card; Action stays pinned.
- Status is one colour-coded control, loaded from `/leads/statuses`. Saving shows a spinner, then "Saved".
- Assigned is a dropdown built from the employee list.
- Source options come from `/lead-sources`, the same endpoint Contacts uses. Nothing is hardcoded.

## Lead modal (`LeadModal.tsx`)
- One centred modal for create and edit. Mounted only while open, so each open starts from a fresh form.
- Saving closes the modal, as in Contacts.
- Default created date is today's India date.

## Import and export
- `LeadImportModal.tsx` — three-step wizard: pick file, match columns, import. Column choices come from the backend. Assignment: leave unassigned, automatic, or one employee for the whole file.
- `LeadExportModal.tsx` — Excel or CSV with the current filters; shows the live count.
- `LeadsMoreMenu.tsx` — the Import / Export button.
- `api/leadsIo.ts` — upload with progress, cancel, template and export downloads.

## Filters and dates
- `LeadsFilterMenu.tsx` — Filter panel. Uses `usePopoverFit` so it stays on screen on tablet and small desktop; full-screen sheet on phones.
- `DateRangePicker` — on phones, opens on the current month when no range is set.
- Date range sends `date_from` / `date_to` (the backend interprets them as IST days).

## Other fixes
- `DashboardSidebar.tsx` — solid white background (was frosted glass). Escape closes the phone drawer.
- `src/app/page.tsx` — login layout: the brand panel's top padding no longer uses the form's offset when the form is wrapped below the panel (was a 2,000 px-tall green panel on narrow windows).
- `LeadStatusPill.tsx` — shared status colour map.
- `leads-module.ts` — `listLeads` sends `date_from` / `date_to` (was `created_from` / `created_to`, which the backend ignored).

## Removed
- `LeadDrawer.tsx` — replaced by `LeadModal`.

## Known gaps
- The WhatsApp button in the lead modal marks a lead "Sent" even when sending is disabled on the backend.
- Leads assigned to admin accounts show a blank Assign value (admins are hidden from the employee list).
- `LeadImportModal.tsx` and `BulkAssignModal.tsx` still have lint warnings or errors carried over from the Contacts pattern.
