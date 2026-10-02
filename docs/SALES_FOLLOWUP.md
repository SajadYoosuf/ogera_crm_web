# Sales Followup

Feature name: **Sales Followup**

A kanban board for working leads through configurable pipeline stages, replicated from the venting-next admin pipeline (`/admin/dashboard/pipeline`) and adapted to Ogera CRM's conventions. Access is restricted to the `admin` and `sales_head` roles at both the UI and the API layer.

Status: **backend and frontend complete**, built and smoke-tested. Not yet rendered in a browser.

## Summary

| Area | Detail |
| --- | --- |
| Route | `/dashboard/followups`, sidebar item **Sales Followup** |
| Access | `admin` and `sales_head` only. `sales_staff` receives `403` from every endpoint and a "Restricted area" card on the page |
| Data source | The shared MySQL database, `contacts` rows where `contact_type = 'lead'` and `stage` is set |
| Stages | Fully configurable through `pipeline_stages`. Five stages already exist and are shared live with venting-next |
| History | Every lead carries a `contact_remarks` timeline of manual notes and system entries |
| Migration | None required. All columns and tables already existed, verified against `information_schema` |
| New code | 10 files, 1,522 lines |

Because Ogera CRM and venting-next share one live database, a stage change made here is immediately visible in the venting-next admin pipeline, and the reverse. There is no separate copy of this data.

## Database

No migration was written. The following already existed and were confirmed before any code was written.

| Object | Columns used |
| --- | --- |
| `contacts` | `stage` (varchar 50, default `initial_contact`), `followup_assigned_to` (varchar 100), `followup_due_date` (date), `contact_type`, `added_by` |
| `pipeline_stages` | `id` (varchar 50, PK), `label` (varchar 255), `order_index` (int), `created_at` |
| `contact_remarks` | `id`, `contact_id` (FK to `contacts`, cascade delete), `staff_id`, `staff_name`, `remark`, `is_system`, `created_at` |

`followup_assigned_to` stores the staff **name**, not an ID. This matches how venting-next writes the column, and keeps the two apps interoperable on the same rows.

`followup_due_date` is a MySQL `DATE`. The driver returns it as a local-midnight `Date`, so `toIsoDate()` in the route formats it from the local calendar parts rather than `toISOString()`, which would shift the day backwards in IST.

## Access control

Three independent layers, each of which is sufficient on its own.

| Layer | File | Behaviour |
| --- | --- | --- |
| Navigation | `src/components/DashboardSidebar.tsx` | The menu item carries `roles: ["admin", "sales_head"]` and is filtered out for other roles |
| Page | `src/app/dashboard/followups/page.tsx` | Reads the session user after hydration and renders a "Restricted area" card instead of the board |
| API | `src/lib/auth/guard.ts` | `guardFollowupRequest()` returns `401` without a bearer token and `403` for any role outside the allowlist, before any query runs |

The page guard is cosmetic; the API guard is the real boundary. Editing `sessionStorage` to spoof a role reveals the board shell but every request it makes returns `403`.

`sales_staff` users can still be **assigned** follow-ups from the assignee dropdown, which is populated from all active admin users. They simply cannot open the board to see them. This is a deliberate narrowing of the venting-next behaviour, where an assigned staff member could open the board and move their own leads.

## Backend

### `src/lib/auth/guard.ts` (new)

Shared helpers for the follow-up endpoints.

```ts
apiError(status, code, message)     // the { success:false, error:{ code, message } } envelope
bearerUser(request)                 // AuthUser | null from the Authorization header
guardFollowupRequest(request)       // { user, response:null } | { user:null, response }
```

The allowlist lives here as a single constant, so widening or narrowing access is a one-line change.

### `GET /api/followups`

Returns every lead on the board, newest first. Leads with a null or empty `stage` are excluded, so a plain awareness contact never appears until it is explicitly added.

```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": 41,
        "name": "Anil Kumar",
        "phone": "9876543210",
        "address": "…", "district": "…", "panchayath": "…", "ward": "7",
        "houseStage": "…", "currentTank": "…", "waterSource": "…", "tankSizeInterest": "1000",
        "remarks": "…", "latitude": "…", "longitude": "…",
        "stage": "qualified",
        "followupAssignedTo": "Anil Kumar",
        "followupDueDate": "2026-09-12",
        "createdAt": "2026-08-02T09:14:00.000Z"
      }
    ],
    "total": 282
  }
}
```

### `PUT /api/followups`

Updates the stage, assignee, or due date of one lead. All three optional fields are sparse: only what is sent is written.

```json
{ "id": 41, "stage": "qualified", "followupAssignedTo": "Anil Kumar", "followupDueDate": "2026-09-12" }
```

- `followupAssignedTo` and `followupDueDate` accept `null` or `""` to clear the value.
- `followupDueDate` must be `YYYY-MM-DD`.
- `contact_type` is forced to `lead` on every write, since anything managed from this board is a pipeline lead.
- A stage change or a reassignment writes a system row into `contact_remarks`, giving the timeline an audit trail:
  `Lead moved from 'initial_contact' to 'qualified'`, `Lead reassigned from 'Unassigned' to 'Anil Kumar'`.

### `GET /api/followups/stages`

```json
{ "success": true, "data": [{ "id": "initial_contact", "label": "vilikkanam", "orderIndex": 0 }] }
```

### `POST /api/followups/stages`

Takes `{ "label": "Showroom visit" }` and derives the ID by slugifying the label (`showroom_visit`). Returns `201` with the created stage, or `409 DUPLICATE_STAGE` if that slug is taken. A label with no letters or digits is rejected with `400`.

### `PUT /api/followups/stages`

Takes `{ "id", "label?", "orderIndex?" }`. Reordering is done by the client swapping the `orderIndex` of two neighbouring stages in two calls.

### `DELETE /api/followups/stages?id=<stage>`

Deletes a stage and moves every lead sitting in it to the first remaining stage by `order_index`. If it was the last stage, those leads get `stage = NULL` and drop off the board rather than being deleted.

### `GET /api/followups/:id/remarks`

Returns the full timeline for one lead, newest first.

```json
{
  "success": true,
  "data": {
    "remarks": [
      { "id": 9, "staffId": "3", "staffName": "Sales Head", "remark": "Called, visiting Saturday", "isSystem": false, "createdAt": "2026-09-08T11:02:00.000Z" }
    ],
    "total": 1
  }
}
```

### `POST /api/followups/:id/remarks`

Takes `{ "remark": "…" }`, up to 2000 characters, and returns `201`. The row is stamped with the caller's user ID and name, and `is_system = 0`.

### Reused endpoints

| Endpoint | Use |
| --- | --- |
| `GET /api/staff` | Assignee dropdowns. Open to any authenticated user, not restricted to the follow-up roles |
| `GET /api/contacts?query=` | Searching for an existing contact to promote onto the board |
| `POST /api/contacts` | Creating a brand new lead before it is placed on a stage |
| `PUT /api/contacts/:id` | Editing lead details from the detail panel |
| `DELETE /api/contacts/:id` | Deleting a lead. Its remarks cascade |

### Error codes

| Status | Code | Cause |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Zod rejected the body, or a path or query parameter was malformed |
| 401 | `UNAUTHORIZED` | Missing or invalid bearer token |
| 403 | `FORBIDDEN` | Authenticated, but not `admin` or `sales_head` |
| 404 | `NOT_FOUND` | Lead or stage does not exist |
| 409 | `DUPLICATE_STAGE` | The slugified stage label collides with an existing stage |
| 500 | `SERVER_ERROR` | Query or connection failure |

## Frontend

### `src/components/followups/shared.ts` (new)

Types (`Lead`, `Stage`, `Remark`, `Staff`), the shared Tailwind class strings, and:

- `requestJson<T>(path, init)` reads the bearer token from `sessionStorage`, sets the JSON content type only when there is a body, unwraps the `{ success, data }` envelope, and throws a readable `Error` for both HTTP failures and network failures.
- `toDateInput`, `todayIsoDate`, `formatDueDate`, `formatMoment` handle dates as plain `YYYY-MM-DD` strings so nothing drifts across a timezone.
- `isQualified(lead)` is the gate described under **Qualification** below.

### `src/components/followups/FollowupBoard.tsx` (new)

The board. Loads stages, leads, and staff in one `Promise.all`, then renders:

- A header with **Manage stages** and **Add lead**.
- A search box matching on name, phone, or panchayath, with matches highlighted in the cards.
- An assignee filter, including an explicit **Unassigned** option. Its list is the union of active staff and any name already written on a lead, so a lead assigned to a since-deactivated user stays filterable.
- A banner counting follow-ups due today or overdue.
- One column per stage. Leads with no stage fall into the first column.

Cards are dragged between columns with the HTML5 drag-and-drop API. A drop applies optimistically, then reloads, and rolls back to the previous list with an error message if the request fails.

### Qualification

A lead cannot leave the first stage until `panchayath`, `ward`, `waterSource`, `houseStage`, and `tankSizeInterest` are all filled in. Dropping an unqualified lead on another column does not move it. Instead the detail panel opens in edit mode with an amber prompt naming the missing fields. This mirrors the venting-next rule.

### Mobile

Kanban does not fit a phone, so below the `sm` breakpoint the board shows one column at a time behind a stage picker, and each option carries its own lead count. HTML5 drag-and-drop does not fire for touch, so on a phone a lead is moved by opening it and using the **Stage** select in the detail panel.

### `src/components/followups/LeadDetailsPanel.tsx` (new)

A right-hand panel in three sections.

| Section | Contents |
| --- | --- |
| Basic information | Read view, with an **Edit** toggle covering name, phone, address, district, panchayath, ward, water source, current tank, house stage, and tank interest. Includes **Use current location**, which calls `getGPSLocationAndGeocode()` from `src/lib/location.ts`. Saves through `PUT /api/contacts/:id` |
| Follow-up management | Stage, assignee, and due date, saved together through `PUT /api/followups`. The assignee select keeps the lead's current value as an option even if that person is no longer in the staff list |
| Follow-up history | A note composer and the timeline. System rows are grey, human notes are blue |

Deleting a lead is a two-step confirm and removes the contact along with its remarks.

### `src/components/followups/AddLeadDialog.tsx` (new)

A right-hand drawer that either links an existing contact or creates a new one, then places it on a stage.

The search box queries `/api/contacts` after a 300 ms debounce once two characters are typed. Selecting a result links that contact and locks the identity fields, so an existing contact is promoted onto the board rather than duplicated. With nothing linked, the form creates a contact with `contactType: "lead"` and `source: "offline"` first, then calls `PUT /api/followups` with the stage, assignee, and due date, and finally posts the opening note as the first remark.

### `src/components/followups/ManageStagesDialog.tsx` (new)

Add, rename, reorder, and delete stages. Reordering swaps `orderIndex` with the neighbour, so the sequence stays gap-free. Delete asks for confirmation and states that leads will move to the first remaining stage.

### `src/app/dashboard/followups/page.tsx` (new)

Reads `ogera_user` from `sessionStorage` through `useSyncExternalStore` with a null server snapshot, and renders either the board or the restricted card. It returns `null` before hydration so the wrong branch never flashes.

## Adaptation notes

venting-next depends on several libraries Ogera CRM does not carry. Nothing new was installed.

| venting-next | Ogera CRM |
| --- | --- |
| `lucide-react` icons | Inline `<svg>` elements |
| `cn()` class helper | Template literals |
| `date-fns` | Small local date helpers in `shared.ts` |
| shadcn `Button`, `Input`, `Select` | Native elements with the shared `inputClass` and `labelClass` |
| `sonner` toasts | Inline error state on each panel |
| `withAdminAuth` cookie wrapper | `guardFollowupRequest` with a bearer token |
| `useAdminAuth` context | `sessionStorage` read through `useSyncExternalStore` |

Colours follow the Ogera CRM system rather than venting-next's: `blue-600` accents, `#0a192f` headings, `rounded-xl` white cards on `gray-50`.

## Files

| File | Lines | Status |
| --- | --- | --- |
| `src/lib/auth/guard.ts` | 29 | New |
| `src/app/api/followups/route.ts` | 140 | New |
| `src/app/api/followups/stages/route.ts` | 113 | New |
| `src/app/api/followups/[id]/remarks/route.ts` | 76 | New |
| `src/app/dashboard/followups/page.tsx` | 40 | New |
| `src/components/followups/shared.ts` | 76 | New |
| `src/components/followups/FollowupBoard.tsx` | 294 | New |
| `src/components/followups/LeadDetailsPanel.tsx` | 370 | New |
| `src/components/followups/AddLeadDialog.tsx` | 230 | New |
| `src/components/followups/ManageStagesDialog.tsx` | 154 | New |
| `src/components/DashboardSidebar.tsx` | +13 | Modified, menu item only |

## Verification

| Check | Result |
| --- | --- |
| `next build` | Clean. TypeScript passes, all three routes register |
| `eslint` on every new and changed file | Clean |
| Live schema check against `information_schema` | `pipeline_stages`, `contact_remarks`, and the three `contacts` columns all present. No migration needed |
| `GET /api/followups` as `admin` | `200`, 282 leads |
| `GET /api/followups` as `sales_head` | `200`, 282 leads |
| `GET /api/followups/stages` as `admin` | `200`, 5 stages |
| `GET /api/followups/:id/remarks` as `sales_head` | `200` |
| Five `sales_staff` calls across all three routes, including `PUT` and `POST` | `403 FORBIDDEN` on every one |
| `GET /api/followups` with no token | `401` |

The role checks were exercised with locally signed tokens against the running dev server. Only reads touched the database; the two write attempts were rejected by the guard before any query ran.

## Not yet done

- The board has not been opened in a browser, so the visual layout, the drag interaction, and the mobile stage picker are unconfirmed. Worth a manual pass before release.
- Touch drag is unsupported. Moving a lead on a phone goes through the detail panel's stage select. A touch-capable drag library would close this gap if it matters.
- There is no pagination. All board leads load in one request, currently 282 rows. This will need attention well before the table reaches a few thousand.
- `sales_staff` has no view of their own assigned follow-ups. If they should get a read-only or own-leads-only board, that is a change to `FOLLOWUP_ROLES` in `guard.ts` plus per-lead ownership checks in the write paths.
