# Frontend Contacts

How the web app lists, creates, edits, deletes, exports and imports contacts. The backend contract is in the root `API.md` (`/contacts/*`). Business rules that govern which contacts a role can see are in `rule.md` (rules 1, 2, 6, 7, 8).

## File map

| File | Responsibility |
| --- | --- |
| `src/features/contacts/api/contacts.ts` | API calls: list, get, create, update, delete, lead sources, profession types, type counts. |
| `src/features/contacts/api/contactsIo.ts` | Export (`downloadContactsExport`) and import (`importContacts`, `getImportTemplate`). |
| `src/features/contacts/utils.ts` | `Contact` and `ContactForm` types, `Filters`, `PAGE_SIZE`, label maps, `fromApi`, `toForm`, `blankContact`. |
| `src/features/contacts/hooks/useContactsList.ts` | List state: paging, search (300 ms debounce), filters, sort, type counts. |
| `src/features/contacts/hooks/useContactEditor.ts` | Add / edit / delete state, client-side validation, `?add=1&returnTo=` deep link. |
| `src/features/contacts/hooks/useContactLookups.ts` | Lead sources, partner types, districts, employee list (admin / manager only). |
| `src/features/contacts/ContactsView.tsx` | Full contacts screen: header, tabs, search, filter panel, table (xl+) / cards (below xl), modals. |
| `src/features/contacts/components/VerifiedBadge.tsx` | Green / amber badge; tooltip lists missing fields for unverified contacts. |
| `src/features/contacts/components/ContactExportModal.tsx` | Export dialog: CSV / Excel / PDF, date range, type, source filters, live count. |
| `src/features/contacts/components/ContactImportModal.tsx` | Import dialog: drag-drop or file picker, template download, progress, errors. |
| `src/features/contacts/components/ContactsFilterMenu.tsx` | Side-panel filter sheet: type, lead source, district, assigned-to, created-by, verified. |
| `src/features/contacts/components/ContactsSortMenu.tsx` | Sort dropdown: name, phone, created date, updated date (asc / desc). |
| `src/features/contacts/components/ContactRowMenu.tsx` | Per-row action menu: edit, copy phone, delete. |
| `src/app/contacts/page.tsx` | Next.js page — renders `ContactsView`. |

## Data model

### `Contact` (display, from `utils.ts`)

Built from `ApiContact` via `fromApi()`. The fields the list and cards use.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `number` | |
| `displayName` | `string` | Contact name if set, else the formatted phone number. |
| `phone` | `string` | Normalised (spaces and symbols stripped). |
| `contactType` | `"consumer" \| "partner" \| "dealer"` | |
| `leadSource` | `string \| null` | Source name string, not id. |
| `district` | `string \| null` | |
| `isVerified` | `boolean` | |
| `missingFields` | `string[]` | Field keys still needed; shown in the `VerifiedBadge` tooltip. |
| `assignedTo` | `{ id, name } \| null` | |
| `createdBy` | `{ id, name } \| null` | |
| `createdAt` | `string` | ISO date string. |
| `updatedAt` | `string` | |

### `ContactForm` (editor state, from `utils.ts`)

All string fields — easier for controlled inputs. `blankContact()` produces the default. `toForm(contact)` converts an existing contact for editing.

### `Filters` (from `utils.ts`)

```ts
{
  contactType?: "consumer" | "partner" | "dealer";
  leadSourceId?: number;
  district?: string;
  assignedTo?: number;
  createdBy?: number;
  verified?: boolean;
  search?: string;
}
```

### `ContactSort` (from `api/contacts.ts`)

`"name_asc" | "name_desc" | "created_asc" | "created_desc" | "updated_asc" | "updated_desc"`

## API client (`api/contacts.ts`)

Every function takes an `accessToken` as its first argument.

| Function | Method | Path | Notes |
| --- | --- | --- | --- |
| `listContacts(token, params)` | `GET` | `/contacts` | Accepts `limit`, `offset`, `search`, `contact_type`, `lead_source_id`, `district`, `assigned_to`, `created_by`, `verified`, `sort`, `created_from`, `created_to`. Returns `{ contacts, total }`. |
| `getContact(token, id)` | `GET` | `/contacts/{id}` | Returns `ApiContactDetail` with full nested profiles. |
| `createContact(token, input)` | `POST` | `/contacts` | |
| `updateContact(token, id, input)` | `PUT` | `/contacts/{id}` | |
| `deleteContact(token, id)` | `DELETE` | `/contacts/{id}` | |
| `listLeadSources(token)` | `GET` | `/lead-sources` | Returns `{ id, name }[]`. Used by filters and the editor form. |
| `listProfessionTypes(token)` | `GET` | `/profession-types` | Returns `{ value, label }[]` for partner contacts. |
| `getContactTypeCounts(token)` | `GET` | `/contacts/counts` | Returns `{ all, consumer, partner, dealer }` for the type tabs. |

## List screen

### Type tabs

`TYPE_TABS` in `utils.ts` drives four tabs: All, Consumer, Partner, Dealer. The active tab sets `filters.contactType` and the URL `?type=` param. Tab badges show the counts from `getContactTypeCounts()`, fetched once on mount and refreshed after any create / delete.

### Search

The search box debounces 300 ms before updating `filters.search`. The input is cleared when the type tab changes.

### Sort

`ContactsSortMenu` offers six options. The current sort is tracked in list state and sent as the `sort` query param.

### Filters

`ContactsFilterMenu` opens as a side panel. It filters by: contact type, lead source, district, assigned-to employee, created-by employee, and verified status. Active filters render as removable chips below the search bar. The count of active filters (excluding type, which has its own tab) shows on the "Filters" button.

### Layout

- **≥ xl:** a sortable data table with columns: Name & phone, Type, Lead source, District, Verified, Assigned to, Created.
- **< xl:** a card grid, one card per contact.

Both share the same `useContactsList` state.

### Pagination

`PAGE_SIZE = 10`. Prev / next buttons. The current page resets to 1 when filters or search change.

## Editor

`useContactEditor` manages the add and edit modal.

### Opening the editor

- Clicking a row or card opens the editor in edit mode.
- The "Add contact" button opens it in add mode.
- **Deep link:** `?add=1` in the URL opens the editor in add mode immediately on load. `?add=1&returnTo=/some/path` navigates to that path after a successful save. Used by other screens that want to create a contact and come back.

### Validation

Client-side checks before sending:
- Phone is required and must contain 7–15 digits (after stripping spaces and symbols).
- For partners: profession is required.
- For dealers: owner name is required.

The backend re-validates all fields and returns `422` for anything the client missed.

### Delete

`deleteContact()` is called from the row menu or the editor. A confirmation dialog is shown before the request.

## Lookups (`useContactLookups`)

Fetched once per page open and shared across the filter panel and the editor form.

| Data | Source | Notes |
| --- | --- | --- |
| Lead sources | `GET /lead-sources` | Refreshed on Settings change via the `useEnumOptions` hook. |
| Partner profession types | `GET /profession-types` | Falls back to `DEFAULT_PARTNER_TYPES` if the request fails. |
| Districts | Settings (`useEnumOptions("district", …)`) | Falls back to the built-in `KERALA_DISTRICTS` list if Settings has not overridden them. |
| Employees | `GET /employees` | **Loaded only for admins and managers** (`canManageEmployees`). Used to populate the "Assign to" dropdown. Staff do not see this dropdown (rule.md, rule 1). |

## Verified badge

`VerifiedBadge` renders two states (rule.md, rule 2):

| State | Colour | Tooltip |
| --- | --- | --- |
| Verified | Green (`#2DB565`) | "All details are complete." |
| Unverified | Amber (`#E59A1A`) | "Fill in the remaining details:" followed by each field name from `contact.missingFields`, mapped through `FIELD_LABELS`. "Click the row to edit this contact." |

The tooltip uses a fixed-position portal because the table wrapper clips absolutely-positioned descendants.

## Export

`ContactExportModal` accepts the filter set already active on the contacts page as its `initial` prop. The user can adjust the date range, type and lead source inside the modal.

| Format | Row limit | Notes |
| --- | --- | --- |
| CSV | 20,000 | Plain data |
| Excel (xlsx) | 20,000 | Formatted sheet |
| PDF | 2,000 | Print-ready |

A live count ("N contacts will be exported") is fetched from `GET /contacts?limit=1` whenever the filters change. The download button is disabled if the count exceeds the format's row limit or is zero. `downloadContactsExport()` in `api/contactsIo.ts` triggers the browser save dialog.

## Import

`ContactImportModal` lets the user upload a CSV or Excel file. A template file is available via `getImportTemplate()`. The modal shows row-level errors returned by the backend and a success count.

## Visibility rules

The contacts screen enforces rule.md rule 7 through the API — the backend returns only the contacts the signed-in employee may see. The frontend does not need to filter further, but it also does not show "you can't see this contact" messages; a 404 from the backend is presented the same as any other not-found error.
