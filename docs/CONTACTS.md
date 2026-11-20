# Contacts Module — Frontend

## What this module does

The Contacts page lets staff view, filter, search, and manage every contact in the CRM. It also handles bulk assignment, CSV/Excel import, and export. The module lives at `src/features/contacts/`.

---

## Folder Structure

```
src/features/contacts/
  ContactsView.tsx            ← main page component
  utils.ts                    ← shared helper functions

  api/
    contacts.ts               ← API calls for CRUD + bulk assign + stats
    contactsIo.ts             ← API calls for import and export (file upload/download)

  components/
    AutoFollowupPromptModal   ← prompts user to set a follow-up after assignment
    BulkAssignModal           ← modal to distribute unassigned contacts to employees
    ContactExportModal        ← modal to filter and download an Excel export
    ContactImportModal        ← 3-step modal: file upload → column map → results
    ContactRowMenu            ← per-row action menu (edit, delete, assign)
    ContactsFilterMenu        ← filter panel (by source, type, district, assigned, verified)
    ContactsMoreMenu          ← "More" button menu (import, export, bulk assign)
    ContactsSortMenu          ← sort panel (by name, date, etc.)
    VerifiedBadge             ← small badge shown on verified contacts

  hooks/
    useContactEditor.ts       ← state + logic for create/edit contact form
    useContactLookups.ts      ← fetches lead sources, employees, districts for dropdowns
    useContactsList.ts        ← fetches the contact list; manages page, filters, sort
```

---

## Page Layout — `ContactsView.tsx`

The page has three main areas:

**Header bar**
- Title ("Contacts") and total count
- Search input
- "Bulk Assign" outline button
- "More" dropdown button (Import, Export)
- "Add Contact" primary button

**Filter + sort row**
- Quick filter chips (contact type, verified status)
- Filter icon → opens `ContactsFilterMenu`
- Sort icon → opens `ContactsSortMenu`

**Contacts table**
- Columns: Name, Phone, Type, Source, District, Assigned To, Verified, Actions
- Infinite scroll or pagination via `useContactsList`
- Each row has a `ContactRowMenu` for quick actions

---

## Hooks — What they do

### `useContactsList`

Manages the full state for the contacts table:
- Holds `filters`, `sort`, `page`, `search` in local state
- Calls `GET /contacts` with all active params whenever state changes
- Returns `{ contacts, total, isLoading, error, setFilters, setSort, setPage, setSearch, refetch }`

**Why a hook?** The ContactsView component stays clean — it just renders data, it doesn't know how to fetch it.

### `useContactEditor`

Manages the create/edit contact form:
- Holds form field values in state
- Validates required fields before submit
- Calls `POST /contacts` or `PUT /contacts/{id}`
- On source lookup: matches by name (case-insensitive) or slug, so display labels vs stored slugs both work
- Sends `null` for blank optional fields (name, district, address) instead of empty string

### `useContactLookups`

Fetches reference data needed for dropdowns:
- `GET /lead-sources` → list of lead source options
- `GET /employees` → list of active employees (for "assign to" dropdown)
- Caches results so the same data isn't fetched multiple times per page load

---

## Components — What they do

### `ContactsFilterMenu`

A side panel or dropdown showing filter options:
- Contact type (consumer / partner)
- Lead source (dropdown populated from `useContactLookups`)
- Assigned to (employee dropdown)
- District (text input)
- Verified / Unverified toggle

Applying filters calls `setFilters()` from `useContactsList`, which re-fetches the list.

### `ContactsSortMenu`

Lets users pick a sort column and direction. Calls `setSort()` from `useContactsList`.

### `ContactRowMenu`

The `⋮` action menu on each row. Options:
- Edit — opens the contact editor form
- Assign to — quick reassign
- View profile
- Delete — soft delete with confirmation

### `VerifiedBadge`

Shows a green checkmark badge on verified contacts. No logic — just a display component.

---

## Bulk Assign — `BulkAssignModal`

**Purpose:** Distribute a batch of unassigned contacts across multiple employees in one action.

**How it works:**

1. When opened, it calls `GET /contacts/stats` to find out how many unassigned contacts exist and breaks them down by lead source.
2. The user picks a lead source (or "Any source") and sets how many contacts each employee should receive.
3. An allocation counter shows remaining unassigned contacts as the user fills in numbers.
4. On submit, calls `POST /contacts/bulk-assign` with the assignment rules.
5. On success, closes the modal and refetches the contact list.

**Key design:** Sources are loaded dynamically from the API — there's no hardcoded source list. If a new lead source is added in settings, it appears here automatically.

**API types used:**
```ts
ContactBulkAssignRule = { source_id: number | null; assigned_to: number; count: number }
ContactBulkAssignRequest = { assignments: ContactBulkAssignRule[] }
ContactStatsResponse = { total_unassigned: number; unassigned_by_source: Record<string, number> }
```

---

## Import — `ContactImportModal`

A 3-step modal for uploading contacts from a CSV or Excel file.

### Step 1 — File upload

- User picks a CSV or Excel file
- Calls `POST /contacts/import/analyze` using XMLHttpRequest (not `fetch`) so upload progress can be tracked
- Shows a progress bar while the file uploads

### Step 2 — Column mapping

- Displays each column found in the file with a dropdown
- Dropdown options come from `report.fields` (returned by the analyze endpoint) — all core + profile fields
- User can map any sheet column to any CRM field, or mark it "Skip"
- A warning banner shows if `report.missing_required` is not empty (required field like phone is not mapped)

### Step 3 — Results preview

- Shows the `report.summary` counts (ready, warning, duplicate, error)
- Lists any rows with warnings or errors with a reason
- "Import" button calls `POST /contacts/import/commit` with the file and optionally a list of `assigned_to` employee IDs
- Shows final success/failure counts

**Contract with the backend:**

The analyze endpoint must return this exact shape (defined in `contactsIo.ts` as `ImportReport`):
```ts
{
  columns: { index: number; header: string; field?: string; sample?: string }[]
  fields: Record<string, string>          // field_name → display label
  missing_required: string[]              // e.g. ["phone"]
  summary: { total: number; ready: number; warning: number; duplicate: number; error: number }
  rows: { row: number; status: string; issues: string[]; name?: string; phone?: string }[]
}
```

---

## Export — `ContactExportModal`

Lets the user apply filters (same options as the main filter menu) and download an Excel file.

Calls `GET /contacts/export` with filter params. The response is a file download (`blob`). Uses the browser's download mechanism to save the file.

Profile field columns in the export match whatever the tenant has in `contact_field_definitions`.

---

## API Layer — `contacts.ts`

All REST API calls for the contact module. Each function:
- Calls the backend via `fetch` with the JWT from the auth context
- Returns typed response objects (defined with TypeScript interfaces)
- Throws an error on non-2xx responses so calling components can handle it

Key functions:
```ts
getContacts(params)        → GET /contacts
getContact(id)             → GET /contacts/{id}
createContact(data)        → POST /contacts
updateContact(id, data)    → PUT /contacts/{id}
deleteContact(id)          → DELETE /contacts/{id}
getContactStats()          → GET /contacts/stats
bulkAssignContacts(data)   → POST /contacts/bulk-assign
```

---

## API Layer — `contactsIo.ts`

Handles file upload and download for import/export.

```ts
analyzeImport(file, onProgress?)  → POST /contacts/import/analyze  (XHR for progress)
commitImport(file, assignedTo?)   → POST /contacts/import/commit   (fetch)
exportContacts(filters)           → GET /contacts/export            (blob download)
downloadTemplate()                → GET /contacts/import/template   (blob download)
```

**Why XHR for analyze?** The browser's `fetch` API doesn't expose upload progress. `XMLHttpRequest` does, via the `upload.onprogress` event. This shows the user a progress bar for large files.

---

## State Flow — How it all connects

```
ContactsView
  ├─ useContactsList()          → fetches + holds the list
  ├─ useContactLookups()        → fetches sources + employees for dropdowns
  │
  ├─ ContactsFilterMenu         → calls setFilters() → list refetches
  ├─ ContactsSortMenu           → calls setSort() → list refetches
  │
  ├─ BulkAssignModal
  │    ├─ getContactStats()     → shows unassigned counts
  │    └─ bulkAssignContacts()  → assigns → refetch list
  │
  ├─ ContactImportModal
  │    ├─ analyzeImport(file)   → shows preview + column map
  │    └─ commitImport(file)    → writes contacts → refetch list
  │
  └─ ContactExportModal
       └─ exportContacts(filters) → downloads Excel file
```

---

## Design Notes

- Follows the same design system as the rest of the app: `#09152b` sidebar, `gray-50` page background, Tailwind utilities.
- Modals use the shared `Modal` base component with standard padding and close-on-backdrop patterns.
- Loading states: spinner or skeleton shown while API calls are in-flight.
- Error states: inline error message shown below the failing action, never a silent failure.
- Empty state: a friendly message when the filtered list returns zero contacts.
