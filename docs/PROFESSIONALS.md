# Professionals

Ported from the venting-next admin dashboard (`src/app/admin/dashboard/professionals`) into Ogera CRM, restricted to admin and sales head users.

Base path: `/api/professionals`

All endpoints require the bearer token returned by `POST /api/auth/login`.

```http
Authorization: Bearer <accessToken>
```

## Role access

| Action | Admin | Sales Head | Sales Staff |
| --- | --- | --- | --- |
| List and search professionals | Yes | Yes | No |
| Create a professional | Yes | Yes | No |
| Update a professional | Yes | Yes | No |
| Delete a professional | Yes | Yes | No |
| See the sidebar link | Yes | Yes | No |

Sales staff receive `403 FORBIDDEN` on every method. The role is read from the JWT, so hiding the sidebar link is a convenience only — the API is the enforcement point.

## Data source

The `professionals` table already exists in `ventino_db` and is shared with venting-next, which writes to the same rows. **No migration was required or run.**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `INT UNSIGNED` | Primary key |
| `name` | `VARCHAR(150)` | Nullable |
| `phone` | `VARCHAR(20)` | Required |
| `type` | `ENUM('Engineer','Plumber','Contractor','Other')` | Required |
| `place` | `VARCHAR(100)` | Nullable |
| `created_at` / `updated_at` | `TIMESTAMP` | Managed by MySQL |

`UNIQUE KEY (phone, type)` means the same phone number may exist once per type. A collision returns `409 DUPLICATE`.

The CRM exposes `Engineer`, `Plumber`, and `Contractor` only, matching venting-next. The `Other` value is valid in the database but has no tab, so those rows are not reachable from this page.

## `GET /api/professionals`

Returns professionals of one type, newest first.

### Query parameters

| Parameter | Example | Purpose |
| --- | --- | --- |
| `type` | `Plumber` | One of `Engineer`, `Plumber`, `Contractor`. Defaults to `Engineer`; an unrecognised value also falls back to `Engineer`. |
| `query` | `noufal` | Case-insensitive partial match on name, phone, or place. |

### Success response

```json
{
  "success": true,
  "data": {
    "professionals": [
      {
        "id": 20,
        "name": "noufal",
        "phone": "9847301221",
        "type": "Engineer",
        "place": "ENGINEER",
        "createdAt": "2026-07-29T04:53:00.000Z",
        "updatedAt": "2026-07-29T04:53:00.000Z"
      }
    ],
    "total": 11
  }
}
```

`total` is the number of rows returned for the active type; this endpoint is not paginated.

## `POST /api/professionals`

### Request body

| Field | Required | Rules |
| --- | --- | --- |
| `phone` | Yes | 10–20 characters |
| `type` | Yes | `Engineer`, `Plumber`, or `Contractor` |
| `name` | No | Up to 150 characters; blank is stored as `NULL` |
| `place` | No | Up to 100 characters; blank is stored as `NULL` |

```json
{ "name": "John Doe", "phone": "9876543210", "type": "Plumber", "place": "Vettathur" }
```

Returns `201` with the created row under `data`, in the same shape as the list response.

## `PUT /api/professionals/[id]`

Accepts any subset of `name`, `phone`, `type`, and `place`; omitted fields are left untouched. An empty body returns `200` with `"No changes made"` and writes nothing.

```json
{ "success": true, "message": "Professional updated" }
```

## `DELETE /api/professionals/[id]`

```json
{ "success": true, "message": "Professional deleted" }
```

## Error responses

| Status | Code | Cause |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Body failed schema validation, or the ID is not a positive integer |
| 401 | `UNAUTHORIZED` | Missing or invalid bearer token |
| 403 | `FORBIDDEN` | Authenticated as sales staff |
| 404 | `NOT_FOUND` | No row matched the ID |
| 409 | `DUPLICATE` | A professional with that phone and type already exists |
| 500 | `SERVER_ERROR` | Database or unexpected failure |

## Files added

### Backend

| File | Contents |
| --- | --- |
| `src/app/api/professionals/route.ts` | `GET` list/search and `POST` create |
| `src/app/api/professionals/[id]/route.ts` | `PUT` update and `DELETE` |

Both files follow the existing contacts route conventions: `runtime = "nodejs"`, inline bearer parsing via `verifyAccessToken`, zod schemas, `getDatabase().execute` with parameterised SQL, and `RouteContext<"/api/professionals/[id]">` for typed params.

### Frontend

| File | Contents |
| --- | --- |
| `src/app/dashboard/professionals/page.tsx` | Full page: type tabs, search, responsive card grid, add/edit modal, delete confirmation |
| `src/components/DashboardSidebar.tsx` | Added a role-gated `Professionals` menu entry |

The page mirrors the contacts page styling — white `rounded-xl` cards, `#0a192f` headings, `blue-600` accents, inline `<svg>` icons and template-literal conditional classes, since this project has neither `lucide-react` nor a `cn` helper. Engineers are tinted blue, plumbers amber, contractors emerald. Edit and delete are icon-only buttons with `aria-label`s.

`MenuItem` gained an optional `roles` array; items without it stay visible to everyone.

Both the sidebar and the page read the session user through `useSyncExternalStore` with a `null` server snapshot, and the data fetch is deferred with `setTimeout(0)`. Both patterns are required to satisfy the `react-hooks/set-state-in-effect` lint rule that the rest of the codebase already follows.

## Verification performed

Run against the live database with tokens signed using the app's own `JWT_SECRET`.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean |
| `npx eslint` on all changed files | Clean |
| `GET` as admin / sales head / sales staff | 200 / 200 / 403 |
| Type filter counts | Engineer 11, Plumber 3, Contractor 15 — matches the table exactly |
| Search `query=nou` | 1 result (`noufal`) |
| Unrecognised `type` | Falls back to Engineer |
| `POST` with a short phone / bad type | 400 `VALIDATION_ERROR`, nothing written |
| `POST` and `DELETE` as sales staff | 403 `FORBIDDEN` |
| `PUT` and `DELETE` on a missing ID | 404 `NOT_FOUND`, 0 rows affected |
| `PUT` with a non-numeric ID | 400 `VALIDATION_ERROR` |
| No bearer token | 401 `UNAUTHORIZED` |
| `/dashboard/professionals` renders | 200, no `Restricted area` flash before hydration |
| `/dashboard` still renders | 200 |

Note: `next typegen` had to be run once so that `RouteContext<"/api/professionals/[id]">` resolved — the already-running dev server does not refresh `.next/types/routes.d.ts` for newly added routes.

## Not yet verified

A successful create, update, and delete has **not** been executed. Every write path was confirmed only up to the point where it rejects — validation, role, and not-found branches. Exercising a real write would insert a row into the production database that venting-next also serves, so it was left for a manual test through the UI.

## Also changed in this session

Unrelated to the professionals feature, on the contacts page (`src/app/dashboard/page.tsx`):

- Removed the `Stage` column from the desktop table and the `Stage` field from the mobile card.
- Replaced the `Edit` and `Delete` text buttons with icon buttons (pencil and trash), blue and rose on hover, with `aria-label`s. Mobile keeps the icon alongside its label.

The `stage` field is still returned by the contacts API and still present on the `Contact` type; only the table display was removed.
