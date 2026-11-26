# Pipeline filters, pagination fix and filter styling (2026-11-26)

Backend change note: none needed. The backend `GET /contacts` already accepts `search`, `lead_source_id`, `assigned_to`, `branch_id`, `created_from` and `created_to`.

## What changed

- `src/features/contacts/api/contacts.ts`
  - `listPipelineContacts` now takes a `PipelineFilters` object and sends only the filters that are set.
  - It pages through `/contacts` in pages of 100. The old request used `limit=500`, which the backend rejects with a 422, so the board failed to load.
- `src/features/contacts/components/PipelineFilterBar.tsx` (new): a filter header for the pipeline with
  - search by name or phone,
  - a "Created between" date range,
  - Lead source, Branch and Employee pickers (Employee only for admins and managers, as on the contacts list),
  - a "Clear all" action shown while any filter is set.
- `src/features/contacts/PipelineView.tsx`
  - Holds the filter state. Search waits 300 ms after typing before it queries the API.
  - Each load gets a sequence number, so a slow earlier response cannot overwrite newer results.
  - Shows "No contacts match these filters." when filters leave the board empty.
  - Initial load is deferred with a zero-delay timeout, matching the contacts list hook. This also clears a lint error.
- `src/components/FilterSelect.tsx` and `src/components/DateRangePicker.tsx`: new opt-in `plain` look (38px, regular weight, muted label) to match the page tabs and search box. Existing pages do not pass `plain`, so they are unchanged.

## Access / data impact

- No new endpoints and no role changes. The pipeline only reads contacts through `GET /contacts`, which applies the backend's existing role rules.
- The Employee filter is hidden for non-admin, non-manager users, because the employee list is not available to them.

## Verification

- `npm test -- --run`: 185 passed, 1 failed (186 total).
  - Failing test: `tests/components/lead-settings-tabs.test.tsx` > "Settings tab visibility". It expects 8 tabs and gets 9.
  - Cause: `src/components/settings/SettingsView.tsx` has 33 uncommitted lines from separate in-progress work, which add a tab. This commit does not touch that file.
- `npx tsc --noEmit`: no errors.
- `npx eslint` on the changed files: no errors.
- `npm run build`: succeeded, all routes built including `/dashboard/pipeline`.
- Not run: browser check of the new filter bar. The browser pane could not load the page, so the visual result is unverified.

## Known issues or not done yet

- The failing settings-tab test above, until the `SettingsView.tsx` work is finished or the test is updated.
- "Lead number" search matches name or phone only. Searching by contact ID is not supported by the backend.
- The "New contact" form still offers only Consumer and Partner. The export and import dialogs also leave out Dealer.
- Filter styling has not been checked in the browser.
