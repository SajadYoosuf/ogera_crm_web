# Sales Ledger

Feature name: **Sales Ledger**

This feature ports the Sales Ledger from venting-next (`/admin/dashboard/sales`) into Ogera CRM at `/dashboard/sales`, rebuilt in this project's own conventions: bearer-token APIs, zod validation, plain Tailwind, and inline `<svg>` icons.

## Summary

| Area | venting-next | Ogera CRM |
| --- | --- | --- |
| Route | `/admin/dashboard/sales` | `/dashboard/sales` |
| API base | `/api/admin/sales` | `/api/sales` |
| Auth | Cookie session via `withAdminAuth` | `Authorization: Bearer <accessToken>` |
| UI dependencies | `lucide-react`, shadcn `Button`/`Input`/`Calendar`/`Popover`, `date-fns`, `use-debounce`, `sonner` | None. Inline SVG, native `<input type="date">`, inline error banners |
| Export | `xlsx` + `jspdf` + `jspdf-autotable` | Dependency-free: CSV, `.xls` HTML table, print-to-PDF |
| `total_price` on write | Written explicitly (fails — see below) | Not written; MySQL generates it |
| `source_of_sale` options | 8, two of which the column rejects | 6, matching the ENUM exactly |

No database migration was required or run. Ogera CRM shares `ventino_db` with venting-next and the `sales` table already existed with every needed column. The schema was read from `information_schema` before the API was written.

## Data source

The `sales` table is shared with venting-next, which writes to the same rows.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `INT UNSIGNED` | Primary key, auto increment |
| `sale_date` | `DATE` | Required; defaults to today when omitted |
| `buyer_name` | `VARCHAR(200)` | Required |
| `buyer_phone` | `VARCHAR(20)` | Nullable in the table, required by the API |
| `address` | `TEXT` | Nullable |
| `panchayath` | `VARCHAR(200)` | Nullable |
| `ward` | `VARCHAR(100)` | Nullable |
| `tank_size` | `VARCHAR(100)` | Product name, not a size code |
| `quantity` | `TINYINT UNSIGNED` | Max 255 |
| `unit_price` | `DECIMAL(10,2)` | Nullable |
| `total_price` | `DECIMAL(10,2)` | **STORED GENERATED** — `quantity * unit_price` |
| `house_stage` | `ENUM('under_construction','built','renovation')` | Nullable |
| `current_tank` | `ENUM('plastic','other_ss','none')` | Nullable; not exposed in the UI |
| `water_source` | `VARCHAR(200)` | Free text |
| `source_of_sale` | `ENUM('direct_call','walk_in','referral','facebook','google','other')` | Nullable |
| `engineer_name` / `engineer_phone` | `VARCHAR(200)` / `VARCHAR(20)` | Accepted by the API, not in the UI |
| `plumber_name` / `plumber_phone` | `VARCHAR(200)` / `VARCHAR(20)` | Accepted by the API, not in the UI |
| `contact_id` | `INT UNSIGNED` | Nullable link to `contacts` |
| `entered_by` | `VARCHAR(200)` | Stores the authenticated user ID as a string, like `contacts.added_by` |
| `remarks` | `TEXT` | Nullable |
| `created_at` / `updated_at` | `DATETIME` | Managed by MySQL |

### Two schema traps found during this work

**`total_price` is a generated column.** Any `INSERT` or `UPDATE` naming it fails with `ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN`. venting-next's `PUT /api/admin/sales/[id]` sets `total_price` explicitly, so every edit through that screen fails. The CRM omits the column entirely and lets MySQL compute it from `quantity * unit_price`.

**`source_of_sale` has no `offline` or `showroom` value.** venting-next's add-sale modal offers both, and pre-selects one based on the user's role. Neither can be stored. The CRM's dropdown lists only the six ENUM values, and the API rejects anything else with `400 VALIDATION_ERROR`.

### Current data state

All 86 existing rows have `unit_price IS NULL`, so `total_price` is NULL throughout and the **Total revenue** card reads ₹0 until sales are entered with a unit price. Every row also has `panchayath IS NULL`, so **Active panchayaths** reads 0. Both are data conditions, not bugs.

## Role access

| Action | Admin | Sales Head | Sales Staff |
| --- | --- | --- | --- |
| List, search, filter, export | Yes | Yes | Yes |
| View a sale and its breakdown | Yes | Yes | Yes |
| Create, update, delete | Yes | Yes | Yes |

The ledger follows the contacts model — open to every authenticated user — not the professionals model, which is admin/sales-head only. Every endpoint requires the bearer token from `POST /api/auth/login`.

## Backend

### `GET /api/sales`

Returns one page of sales, newest first (`sale_date DESC, id DESC`), plus ledger metrics.

| Parameter | Example | Purpose |
| --- | --- | --- |
| `query` | `firos` | Partial match on buyer name, phone, or panchayath |
| `panchayath` | `Parappur` | Partial match |
| `ward` | `Ward 4` | Partial match |
| `waterSource` | `borewell` | Exact match; `all` is ignored |
| `sourceOfSale` | `walk_in` | Exact match; `all` is ignored |
| `startDate` / `endDate` | `2026-01-01` | Inclusive bounds on `sale_date` |
| `page` | `2` | Defaults to 1 |
| `limit` | `25` | Defaults to 10, capped at 100 |
| `export` | `true` | Returns every matching row with no pagination |

```json
{
  "success": true,
  "data": {
    "sales": [
      {
        "id": 87,
        "saleDate": "2026-06-27",
        "buyerName": "Firos Babu VT",
        "buyerPhone": "9037174874",
        "address": "Valiyathodi House, pattikkad, kammanam, 679325",
        "quantity": 1,
        "sourceOfSale": "other",
        "enteredBy": "1",
        "createdAt": "2026-07-30T07:02:37.000Z"
      }
    ],
    "total": 86,
    "page": 1,
    "totalPages": 9,
    "totalSales": 86,
    "totalRevenue": 0,
    "totalTanks": 86,
    "activePanchayaths": 0
  }
}
```

`total` counts rows matching the active filters; `totalSales` is the unfiltered table count shown in the header badge. `totalRevenue`, `totalTanks`, and `activePanchayaths` are computed over the filtered set.

`saleDate` is formatted from local date parts rather than `toISOString()`, so a `DATE` column never shifts a day for users east of UTC.

### `POST /api/sales`

| Field | Required | Rules |
| --- | --- | --- |
| `buyerName` | Yes | 2–200 characters |
| `buyerPhone` | Yes | 6–20 characters |
| `saleDate` | No | `YYYY-MM-DD`; defaults to today |
| `quantity` | No | Positive integer, max 255 |
| `unitPrice` | No | Non-negative number |
| `sourceOfSale` | No | One of the six ENUM values |
| `houseStage` | No | `under_construction`, `built`, `renovation` |
| `currentTank` | No | `plastic`, `other_ss`, `none` |
| `address`, `remarks` | No | Up to 2000 characters |
| `panchayath`, `waterSource`, `engineerName`, `plumberName` | No | Up to 200 characters |
| `ward`, `tankSize` | No | Up to 100 characters |
| `engineerPhone`, `plumberPhone` | No | Up to 20 characters |
| `contactId` | No | Positive integer |

Field limits mirror the column widths so a long value is rejected with a clear message instead of being truncated by MySQL. `entered_by` is set from the token, never from the body. Returns `201` with the created row, including the generated `totalPrice`.

### `PUT /api/sales/[id]`

Same rules as create, minus `currentTank`, `engineer*`, `plumber*`, and `contactId`. Replaces the sale's editable fields and returns the updated row. `404 NOT_FOUND` when no row matches.

### `DELETE /api/sales/[id]`

```json
{ "success": true, "data": { "id": 87 } }
```

### `GET /api/sales/[id]/details`

Returns the three related record sets shown in the detail modal tabs.

```json
{
  "success": true,
  "data": { "referrals": [], "reviews": [], "complaints": [] }
}
```

- `referrals` — `contacts` where `referred_by_sale_id` matches
- `reviews` — `testimonials` where `sale_id` matches
- `complaints` — `complaints_suggestions` where `sale_id` matches

Each query runs in its own `try`/`catch`. A failure logs and yields an empty list rather than failing the whole response, so the modal degrades to an empty tab if one of those venting-next-owned tables changes.

### `GET /api/sales/products`

Feeds the product dropdown from `products WHERE is_active = 1`, ordered by name. Selecting a product autofills the unit price.

```json
{ "success": true, "data": [{ "id": 18, "name": "100 LTR Vertical Stainless Steel Water Tank", "priceSale": 6000 }] }
```

### `GET /api/sales/search`

Pre-existing endpoint, unchanged. Used by the contacts page to link a referring sale.

### Error responses

| Status | Code | Cause |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Body failed schema validation |
| 400 | `INVALID_ID` | Route ID is not a number |
| 401 | `UNAUTHORIZED` | Missing, malformed, or invalid bearer token |
| 404 | `NOT_FOUND` | No row matched the ID |
| 500 | `SERVER_ERROR` | Database or unexpected failure |

## Frontend

`/dashboard/sales` is a client page that holds search, filter, and pagination state locally — the same approach as the contacts page, rather than venting-next's URL search params.

**Header** — title, export dropdown, and an **Add sale** button (a floating action button on mobile).

**Controls bar** — submit-on-enter search over buyer name, phone, and panchayath; From/To date inputs that apply immediately; a Filter popover for panchayath (with a datalist of Malappuram panchayaths) and ward; a **Clear all** button when any filter is active; and a total-sales badge.

**Metric cards** — total revenue, total tanks sold, active panchayaths, all reflecting the active filters.

**List** — a horizontally scrollable table on `lg` and up (buyer, phone, source, tank, panchayath, ward, water source, value, actions); stacked cards below that, with a colour-seeded initial avatar. A row opens the detail modal; edit and delete are icon buttons that stop propagation.

**Detail modal** — Details / Referrals / Reviews / Feedback tabs, with counts on the tabs that have records. Only the three related tabs hit the network; the Details tab renders from the row already in memory.

**Editor drawer** — a right-hand slide-over for both add and edit: customer block, location block with a **Fill location** button, sale specifics, and water source plus remarks. Total value updates live from quantity × unit price.

**States** — dedicated error, loading, and empty panels matching the professionals page, with the empty copy varying by whether a search or a filter is active.

### GPS location fill

The drawer reuses `getGPSLocationAndGeocode()` from `src/lib/location.ts` — the same helper the contacts page uses. It fills the address, then matches the resolved address text against the Malappuram panchayath list and fills the panchayath if one matches, reporting either the matched name or a prompt to pick one manually. Both fields stay editable. venting-next used a different geocoder helper that returned a panchayath directly; that helper does not exist here.

### Export

`src/lib/salesExport.ts` implements all three formats with no dependencies, in both **Normal** (14 columns) and **WhatsApp automation** (Name, Mobile Number, `ORGANIC`, Tags) layouts. An optional date range in the export menu overrides the page's active date filter.

| Format | Implementation |
| --- | --- |
| CSV | `Blob` with a UTF-8 BOM so Excel keeps non-ASCII buyer names intact |
| Excel | An HTML `<table>` served as `application/vnd.ms-excel` with an `.xls` name, which Excel opens natively |
| PDF | A styled print document in a new tab, then `window.print()` — the browser saves it as PDF. Reports a message if pop-ups are blocked |

This replaces venting-next's `xlsx`, `jspdf`, and `jspdf-autotable`. Adding three export libraries to a project that deliberately hand-rolls its icons was not worth the weight.

## Files added

### Backend

| File | Contents |
| --- | --- |
| `src/app/api/sales/route.ts` | `GET` list/filter/export/metrics, `POST` create |
| `src/app/api/sales/[id]/route.ts` | `PUT` update, `DELETE` |
| `src/app/api/sales/[id]/details/route.ts` | `GET` referrals, reviews, and complaints for one sale |
| `src/app/api/sales/products/route.ts` | `GET` active products for the tank dropdown |
| `src/lib/sales.ts` | Shared `SaleRow` type, bearer guard, error helper, row mapper |

`src/lib/sales.ts` exists because Next.js validates `route.ts` exports and rejects anything that is not an HTTP method or a route config value, so shared helpers cannot live in the route file.

### Frontend

| File | Contents |
| --- | --- |
| `src/app/dashboard/sales/page.tsx` | The ledger page |
| `src/components/SaleEditorDrawer.tsx` | Add/edit slide-over |
| `src/components/SaleDetailModal.tsx` | Detail modal with four tabs |
| `src/lib/saleTypes.ts` | `Sale` type, ENUM lists, label maps, date/currency formatters |
| `src/lib/salesExport.ts` | CSV, Excel, and print-to-PDF builders |
| `src/lib/panchayaths.ts` | Malappuram panchayath list for the dropdowns |

### Changed

| File | Change |
| --- | --- |
| `src/components/DashboardSidebar.tsx` | Added an ungated `Sales Ledger` entry under CORE CRM |

Both the page and the detail modal defer their first fetch with `setTimeout(0)`, the pattern the professionals page already uses to satisfy the `react-hooks/set-state-in-effect` lint rule.

## Verification performed

Against the live database, through the running dev server, with tokens signed using the app's own `JWT_SECRET`.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean |
| `npx eslint` on all new and changed files | Clean |
| `npm run build` | Succeeds; all four new API routes and `/dashboard/sales` registered |
| `GET /api/sales` | 200 — 10 rows, `total` 86, `totalPages` 9 |
| `?page=2` | 200, `page` 2, 10 rows |
| `?query=firos` | 1 match |
| `?panchayath=parappur` | 0 matches (no row has a panchayath) |
| `?startDate=2026-01-01&endDate=2026-12-31` | 72 matches |
| `?export=true` | 86 rows, unpaginated |
| `GET /api/sales/products` | 200 — 17 active products with prices |
| `GET /api/sales/[id]/details` | 200 — all three lists present and empty for the sampled sale |
| `GET /api/sales/abc/details` | 400 `INVALID_ID` |
| `POST` with a 1-character name and 1-digit phone | 400 `VALIDATION_ERROR`, nothing written |
| `POST` with `sourceOfSale: "showroom"` | 400 `VALIDATION_ERROR` — the ENUM guard holds |
| `POST` with `quantity: 300` | 400 `VALIDATION_ERROR` — the TINYINT guard holds |
| `PUT` on a missing ID | 404 `NOT_FOUND` |
| `DELETE` on a missing ID | 404 `NOT_FOUND` |
| `GET` as sales staff | 200 |
| No token / malformed token | 401 `UNAUTHORIZED` |
| `/dashboard/sales` renders | 200 |
| `INSERT` and `UPDATE` statements | Executed against the live table inside a transaction and rolled back: insert succeeded, `total_price` auto-computed to 12000.00 from 2 × 6000, update recomputed it to 21000.00, `affectedRows` 1. Row count returned to 86 after rollback |

The rolled-back transaction is how the generated-column failure was caught; the same probe confirms both write statements are valid against the real schema.

## Not yet verified

- No sale has been created, edited, or deleted **and committed**. The write SQL is proven, but the full round trip through the drawer has not been exercised, because a committed insert would appear in the production database that venting-next also serves.
- The Reviews and Feedback tabs have only been seen empty. `testimonials` and `complaints_suggestions` exist in the database, but no sampled sale had rows in either, so the populated rendering is untested.
- The three export files have not been opened. The builders were not run in a browser — CSV/Excel downloads and the print window need a real click.
- The GPS **Fill location** button needs a device with location permission.

## Possible follow-ups

- `src/lib/db.ts` now exports a retrying `execute()` helper for the ECONNRESET drops on this MySQL host. No route uses it yet, including these; migrating all routes together would be the cleaner change.
- venting-next's own Sales Ledger still writes `total_price` on update and still offers `offline`/`showroom` as sources. Both are broken there and worth fixing at the source.
- `current_tank`, `engineer*`, `plumber*`, and `contactId` are accepted by `POST` but have no fields in the drawer, matching venting-next's own modal.
