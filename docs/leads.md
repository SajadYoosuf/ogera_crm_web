# Leads Module — Frontend Documentation

Route: `/leads`  
Layout file: `src/app/leads/layout.tsx`  
Page file: `src/app/leads/page.tsx`  
Main component: `src/features/leads/LeadsView.tsx`

---

## Overview

The Leads page is the primary workspace for managing inbound leads — walk-ins, Meta Ads, website form submissions, and WhatsApp enquiries. It is a **fully client-side feature** (all components are `"use client"`).

The page does **not** load data on the server. Everything is fetched in the browser after the JWT is confirmed from `sessionStorage`.

---

## File Structure

```
src/
├── app/leads/
│   ├── layout.tsx              — page shell (sidebar + scrollable main)
│   └── page.tsx                — thin route wrapper, renders <LeadsView />
│
├── features/leads/
│   ├── LeadsView.tsx           — main orchestrator component
│   ├── hooks/
│   │   ├── useLeadsList.ts     — paginated list + filters + search state
│   │   ├── useLeadEditor.ts    — create / edit form state
│   │   └── useLeadConvert.ts   — lead → Contact conversion flow
│   └── components/
│       ├── LeadForm.tsx        — shared create/edit form fields
│       ├── LeadDrawer.tsx      — slide-over detail + edit panel
│       ├── ConvertLeadModal.tsx — confirm lead → Contact conversion
│       ├── BulkAssignModal.tsx — bulk-assign unassigned leads by source
│       ├── LeadStatusPill.tsx  — colour-coded status badge
│       ├── LeadSourceBadge.tsx — source icon + label
│       ├── LeadScoreBar.tsx    — 0–100 score bar
│       ├── LeadAgeIndicator.tsx — age-based urgency ring
│       └── WhatsAppButton.tsx  — trigger WhatsApp template from a lead
│
└── lib/api/
    └── leads-module.ts         — TypeScript types + all fetch functions
```

---

## State Management

There is **no global store** (no Redux, no Zustand). State is entirely local to `LeadsView` via three custom hooks and a few `useState` calls. All state resets when the user navigates away.

```
LeadsView
  ├── useLeadsList()     → list data, filters, pagination, loading/error
  ├── useLeadEditor()    → create/edit modal form state
  ├── useLeadConvert()   → conversion confirmation state
  ├── useState(employees)→ employee list for assignee dropdowns
  ├── useState(isBulkAssignOpen) → bulk assign modal open/close
  └── useState(updateError)      → toast message for inline update failures
```

---

## Hook Reference

### `useLeadsList`
**File:** `hooks/useLeadsList.ts`

Manages the paginated leads table. Fetches from `GET /leads` whenever page, filters, or search changes.

**What it owns**

| State | Type | Purpose |
|---|---|---|
| `leads` | `LeadListItem[]` | Current page of lead rows |
| `total` | `number` | Total matching leads (for pagination) |
| `page` | `number` | Current page (1-based) |
| `totalPages` | `number` | Computed: `ceil(total / PAGE_SIZE)` |
| `search` | `string` | The live text in the search input |
| `filters` | `LeadFilters` | `{ status, source_id, assigned_to }` |
| `hasFilters` | `boolean` | True if any filter is active |
| `isLoading` | `boolean` | Shows skeleton rows while fetching |
| `error` | `string` | Shows `ErrorState` when non-empty |

**How search works:** A separate `submittedSearch` state is debounced 300ms behind the visible `search` input. The API is called with `submittedSearch`, not the raw `search`. This prevents one API call per keystroke.

**How pagination works:** `PAGE_SIZE = 20`. `skip = (page - 1) * 20`. Setting any filter or typing in search resets `page` to 1 automatically.

**Key functions**

| Function | What it does |
|---|---|
| `loadLeads()` | Refetches the current page. Called by the Try Again button in `ErrorState`. |
| `changeFilter(key, value)` | Updates one filter and resets to page 1. |
| `clearFilters()` | Resets all filters and search. |
| `setPage(n)` | Jumps to page n. Called by Previous/Next buttons. |
| `setSearch(term)` | Updates the search input (debounce fires automatically). |

---

### `useLeadEditor`
**File:** `hooks/useLeadEditor.ts`

Manages the form state for creating a new lead or editing an existing one. The same hook handles both modes — the difference is whether `editingId` is set.

**What it owns**

| State | Purpose |
|---|---|
| `isOpen` | Whether the editor drawer is open (edit mode) |
| `editingId` | `null` for create, lead ID for edit |
| `form` | `LeadFormState` — all form field values |
| `isSaving` | Shows spinner and disables submit button |
| `saveError` | Shown as an inline error inside the form |

**Key functions**

| Function | What it does |
|---|---|
| `open()` | Opens the create form with blank fields |
| `open(lead)` | Opens the edit form pre-filled with lead data |
| `close()` | Closes and clears the form |
| `setField(key, value)` | Updates one form field |
| `submit()` | Calls `createLead()` or `updateLead()` based on `editingId` |

**Form fields (`LeadFormState`)**

| Field | Maps to API field | Notes |
|---|---|---|
| `first_name` | `first_name` | Required |
| `last_name` | `last_name` | Optional |
| `phone` | `phone` | Optional |
| `email` | `email` | Optional |
| `address` | `address` | Optional |
| `source_id` | `source_id` | Defaults to 1 (Walk-in) |
| `status` | `status` | Edit mode only |
| `notes` | `notes` | Optional |
| `tags` | `tags` | Comma-separated string; split to array on submit |

**Tags:** The form stores tags as a plain comma-separated string (`"hot, plumber, calicut"`). On submit, it is split by comma, trimmed, and sent as `string[]`.

**Lead date:** Removed from the web create form (it used to let admin/manager backdate `created_at`). The web no longer sends `created_at`.

---

### `useLeadConvert`
**File:** `hooks/useLeadConvert.ts`

Controls the lead → Contact conversion confirmation flow.

**Flow:**
1. User clicks the convert button in `LeadDrawer` → `openModal(leadId)` is called.
2. `ConvertLeadModal` opens and shows the lead ID.
3. User clicks Confirm → `confirm()` calls `POST /leads/{id}/convert`.
4. On success, `result` is set with `{ lead_id, contact_id, created }`.
5. The modal shows "Open contact" button pointing to `/contacts/{contact_id}`.

**What it owns**

| State | Purpose |
|---|---|
| `isOpen` | Whether the confirmation modal is visible |
| `pendingId` | The lead ID being converted |
| `isConverting` | Disables the Confirm button during the API call |
| `convertError` | Shown if the API call fails |
| `result` | `ConvertLeadResponse` after success |

---

## Component Reference

### `LeadsView`
**File:** `LeadsView.tsx`

The page orchestrator. It owns no business logic — it passes state down to child components and responds to their callbacks.

**Key responsibilities:**
- Renders the filter bar (search, source, status, assigned-to selects + Bulk Assign button)
- Renders the data table (skeleton → rows → empty state → error state)
- Opens the create modal (`isCreateOpen` state) and edit drawer (`editor.isOpen`)
- Handles inline status and assignee changes from table rows
- Shows a toast notification when an inline update fails

**Loading state:** 8 `SkeletonRows` with animated pulse — one per approximate column.  
**Error state:** `ErrorState` component with a "Try Again" button that calls `list.loadLeads()`.  
**Empty state (no data):** "No leads yet" with an "Add First Lead" button.  
**Empty state (filtered):** "No results found" with a "Clear Filters" button.

**Toast system:**  
Inline status/assignee changes are fire-and-forget (no reload). If the API call fails, a toast is shown at `fixed bottom-6 left-1/2` for 4 seconds. Uses `useRef<ReturnType<typeof setTimeout>>` to clear any pending timer before showing a new toast.

**Accessibility:**
- `role="status" aria-live="polite"` region announces toast content to screen readers
- `scope="col"` on all `<th>` elements
- `focus-visible:ring` (not `focus:ring`) on all interactive elements
- `touch-manipulation` on table rows for fast mobile taps

---

### `LeadForm`
**File:** `components/LeadForm.tsx`

A pure UI component — it has no state of its own. The parent (`LeadsView` for create, `LeadDrawer` for edit) owns all state and passes `form` + `setField` down.

**Layout (create mode, `sm:` breakpoint and above):**
- Row 1: First name | Last name (always 2-col)
- Row 2: Phone | Email (2-col on sm+)
- Row 3: Address / Location | Source (2-col on sm+)
- Row 4: Notes (full width, 3-row textarea)
- Row 5: Tags | Lead date (2-col on sm+, create mode only)

On mobile (< 640px), all rows stack to single column. This keeps the form usable on small screens without horizontal scroll.

---

### `LeadDrawer`
**File:** `components/LeadDrawer.tsx`

A slide-over panel that shows full lead details and an edit form. Opens when the user clicks a row in the table.

**What it shows:**
- Lead name, source badge, status pill, score bar
- Contact details: phone, email, address
- WhatsApp status and "Send WhatsApp" button (`WhatsAppButton`)
- Notes and tags
- Activity timeline (from lead activities API)
- Edit form (`LeadForm` with `isEdit=true`)
- "Convert to Contact" button (opens `ConvertLeadModal`)

---

### `BulkAssignModal`
**File:** `components/BulkAssignModal.tsx`

Modal for distributing unassigned leads to staff in bulk.

**Opening trigger:** "Bulk Assign" button in the filter bar (top-right, teal).

**On open:** Fetches `GET /leads/stats` to get `unassigned_by_source` counts.

**Workflow:**
1. Staff selects a source (e.g. Meta Ads — 30 unassigned).
2. For each team member, enters how many leads to assign.
3. A live "Allocated: X / 30" counter validates the total.
4. On confirm, calls `POST /leads/bulk-assign` with the assignment rules.
5. Modal closes and the leads table reloads.

**Multiple sources:** The user can build up a queue of assignments across sources before confirming. All rules are sent in a single API call.

---

### `ConvertLeadModal`
**File:** `components/ConvertLeadModal.tsx`

Simple two-step confirmation modal for converting a lead to a Contact. Driven entirely by the `converter` object from `useLeadConvert`.

---

### Display-only components

| Component | What it renders |
|---|---|
| `LeadStatusPill` | Coloured pill for `new` / `contacted` / `qualified` / `converted` / `lost` |
| `LeadSourceBadge` | Icon + label for each source (Walk-in, Meta Ads, etc.) |
| `LeadScoreBar` | Thin horizontal bar coloured green→red by score (0–100) |
| `LeadAgeIndicator` | Urgency ring: yellow if lead is > 24h old + still `new`, red if > 48h |
| `WhatsAppButton` | "Send WhatsApp" button; calls `POST /leads/{id}/send-whatsapp` |

---

## Service Layer — `lib/api/leads-module.ts`

All network calls go through this single file. It is the only place that knows the API endpoint URLs for the leads module.

**Why a separate file from `lib/api/leads.ts`?**  
`lib/api/leads.ts` handles the contacts pipeline stage/history API (a different concept). This file is for the Lead entity (pre-contact funnel). They must never be merged.

**All exported functions**

| Function | HTTP | Endpoint |
|---|---|---|
| `listLeads(token, params)` | GET | `/leads` |
| `getLead(token, id)` | GET | `/leads/{id}` |
| `createLead(token, body)` | POST | `/leads` |
| `updateLead(token, id, body)` | PUT | `/leads/{id}` |
| `deleteLead(token, id)` | DELETE | `/leads/{id}` |
| `convertLead(token, id)` | POST | `/leads/{id}/convert` |
| `sendLeadWhatsApp(token, id)` | POST | `/leads/{id}/send-whatsapp` |
| `getLeadStats(token)` | GET | `/leads/stats` |
| `bulkAssignLeads(token, assignments)` | POST | `/leads/bulk-assign` |
| `listApiKeys(token)` | GET | `/api-keys` |
| `createApiKey(token, label)` | POST | `/api-keys` |
| `revokeApiKey(token, keyId)` | DELETE | `/api-keys/{id}` |

**Error handling pattern:**  
Every function throws `ApiError` (from `lib/api/auth`) on a non-2xx response. `ApiError.message` contains the backend's `detail` field. Hooks catch this and store it in their own error state.

**Auth token:**  
All functions take `token` as the first argument. The token comes from `sessionStorage.getItem("ogera_access_token")` — read at the hook level, not inside the service function.

---

## Data Flow — Full Page Load

```
1. Browser navigates to /leads
2. Next.js renders layout.tsx (server) + page.tsx (triggers client hydration)
3. LeadsView mounts → useLeadsList runs
4. sessionStorage.getItem("ogera_access_token") → passes token to listLeads()
5. GET /leads?skip=0&limit=20 → backend authenticates JWT, queries ventino.leads
6. Response: { items: [...], total: 142, skip: 0, limit: 20 }
7. setLeads(items), setTotal(142), setIsLoading(false)
8. SkeletonRows replaced by real table rows
```

---

## Data Flow — Inline Status Change

```
User clicks status <select> in a table row
  → onChange fires → handleStatusChange(lead.id, newStatus)
  → PUT /leads/{id}  { status: "contacted" }
  → On success: list.loadLeads() (refetch the full page)
  → On error: showToast("Could not update status") → auto-dismisses after 4s
```

---

## Data Flow — Create Lead

```
User clicks "+ New Lead"
  → setIsCreateOpen(true) → modal opens
User fills form + clicks "Create Lead"
  → editor.submit()
  → POST /leads { first_name, source_id, ... }
  → On success: editor.close(), list.loadLeads()
  → On error: editor.saveError is shown inside the modal
```

---

## Responsive Behaviour

| Breakpoint | Table columns hidden | Modal width | Form layout |
|---|---|---|---|
| Mobile (< 640px) | Source, WhatsApp, Score, Date | `max-w-md` (full width) | Single column |
| Tablet (≥ 640px) | Score, Date (lg) | `max-w-xl` | 2-column rows |
| Desktop (≥ 1024px) | Nothing | `max-w-xl` | 2-column rows |

The page has a **single vertical scroll** on `<main>`. There is no inner table scroll — the table grows to its natural height and the page scrolls. `overflow-x-auto` is on the table wrapper only, to handle very wide screens with many columns.
