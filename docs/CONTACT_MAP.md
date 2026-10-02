# Contact Map

Ported from the venting-next admin dashboard (`src/app/admin/dashboard/contacts/map`) into Ogera CRM. Plots every contact that has stored coordinates onto an interactive Leaflet map, colour-coded by contact type, with search, filtering, and per-contact quick actions.

Route: `/dashboard/map`
Sidebar: **CORE CRM → Contact Map**, second entry, directly under Contacts.

## Role access

| Action | Admin | Sales Head | Sales Staff |
| --- | --- | --- | --- |
| See the sidebar link | Yes | Yes | Yes |
| Open `/dashboard/map` | Yes | Yes | Yes |
| Load map contact data | Yes | Yes | Yes |

No role gate was added. The map is read-only and reuses the existing `GET /api/contacts?fields=map` branch, which is available to every authenticated user (see `CONTACTS_API.md`). Unlike Professionals, the `MenuItem` for this page carries no `roles` array, so it is visible to all.

---

# Backend

**No backend code was written, and no migration was run.** The endpoint the map consumes already existed.

## `GET /api/contacts?fields=map`

Defined in `src/app/api/contacts/route.ts`, inside the `if (fields === "map")` branch that short-circuits before the paginated list query.

### Query parameters

| Parameter | Example | Purpose |
| --- | --- | --- |
| `fields` | `map` | Required. Selects the lightweight map payload. |
| `type` | `lead` | Optional. `lead` or `awareness`. Any other value is ignored and all types are returned. |

The frontend **does not** send `type`. It fetches the unfiltered set once and filters client-side, so the in-memory cache covers every filter combination without extra requests.

### SQL

```sql
SELECT c.id, c.name, c.phone, c.latitude, c.longitude,
       c.contact_type, c.stage, c.address, c.created_at
FROM contacts c
WHERE (c.latitude IS NOT NULL AND c.longitude IS NOT NULL
       AND c.latitude != '' AND c.longitude != '')
ORDER BY c.created_at DESC
```

Nine columns instead of `SELECT c.*` plus three joins, and no `LIMIT` — the whole set goes down in one request and is cached in the browser for the session.

### Success response

```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": 101,
        "name": "Anil Kumar",
        "phone": "9876543210",
        "latitude": "11.2588",
        "longitude": "75.7804",
        "contactType": "lead",
        "stage": "initial_contact",
        "address": "Kunnamangalam",
        "createdAt": "2026-09-09T10:30:00.000Z"
      }
    ],
    "total": 1
  }
}
```

`total` is the length of `contacts`; this branch is not paginated.

### Error responses

| Status | Code | Cause |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Missing or invalid bearer token |
| 500 | `SERVER_ERROR` | Database or unexpected failure |

### Data source

The `contacts` table in `ventino_db`, shared live with venting-next. The map reads the same rows venting-next writes. `latitude` and `longitude` are `VARCHAR` columns populated by the contact intake form's GPS capture (see `CONTACT_INTAKE.md`), which is why they are parsed with `parseFloat` on the client rather than arriving as numbers.

---

# Frontend

## Component structure

| File | Role |
| --- | --- |
| `src/app/dashboard/map/page.tsx` | Server component. Exports `metadata`, renders the loader. Nothing else. |
| `src/components/ContactsMapLoader.tsx` | Client component. `dynamic(..., { ssr: false })` boundary plus the `h-[100dvh] flex flex-col` shell. |
| `src/components/ContactsMap.tsx` | The map. All state, fetching, geocoding, and UI. |

The three-file split is not decoration. Leaflet touches `window` at module scope, so it cannot be server-rendered. `ssr: false` is only permitted inside a client component, so the loader exists purely to be that client boundary and let `page.tsx` stay a server component that can export `metadata`.

## Rendering pipeline

1. **Fetch** — on first mount, `GET /api/contacts?fields=map` with `Authorization: Bearer` from `sessionStorage.getItem("ogera_access_token")`, matching the pattern in `src/app/dashboard/page.tsx`. The result is stored in a module-level `_cachedContacts` variable, so navigating away and back does not refetch for the rest of the session.
2. **Filter** — the `all` / `lead` / `awareness` tab filters the cached array in memory. No network request.
3. **Resolve** — each contact is turned into a `{ resolvedLat, resolvedLng, isGeocoded }` triple. Contacts whose stored coordinates parse to a valid non-zero float are resolved directly (`isGeocoded: false`). Anything else falls through to geocoding.
4. **Render** — a `CircleMarker` per resolved contact, plus `FitBoundsHelper`, which calls `map.fitBounds` on the marker set with `padding: [50, 50]` and `maxZoom: 14` whenever the filtered list changes.
5. **Search** — the search box filters the already-resolved markers on name, phone, district, panchayath, and address. Purely visual; it does not re-resolve.

## Geocoding fallback

For contacts without usable coordinates, the component builds a location key (`panchayath, district`, falling back to `address`), then geocodes it through the free OpenStreetMap Nominatim endpoint.

- **Deduplicated** — contacts sharing a location key are grouped and geocoded once.
- **Rate limited** — 1100 ms between requests, honouring Nominatim's ~1 req/sec policy.
- **Cached** — results persist in `localStorage` under `contact_map_geocode_cache_v1`, so a location is geocoded once per browser, ever.
- **Progressive** — GPS-resolved and cache-hit markers paint immediately; geocoded ones stream in as each request returns, behind a progress bar.
- **Conflict-guarded** — a module-level `_activeGeocodeId` counter is incremented per run. A run re-checks its own ID before and after every `await` and self-terminates if a newer run superseded it, so rapid filter switching cannot interleave two batches. A `geocodeAbortRef` stops the loop on unmount.
- **Marked as approximate** — geocoded markers get a dashed border (`dashArray: "4 3"`) and an `≈ Approx` badge in their popup.

> **This path is currently dormant.** The API's `WHERE` clause already excludes every row with a null or empty `latitude`/`longitude`, so in practice each returned contact has coordinates and resolves at step 3. The geocoder only engages for the rare row whose stored coordinate string parses to `NaN` or exactly `0`. The logic was ported as-is from venting-next, which has the identical filter and therefore the same dormancy. See **Known gaps** below.

## UI

Dark `#09152b` header bar over a full-bleed map, matching the sidebar.

- **Header** — title, subtitle (hidden below `sm`), and a search toggle button.
- **Search** — collapsed by default; expands into a slate input, autofocuses, and clears itself when toggled shut.
- **Filter tabs** — `All` / `Leads` / `Awareness` in a segmented pill control.
- **Stat badges** — total pins, plus lead and awareness counts (hidden below `sm`).
- **Progress bar** — amber, shown only while geocoding is running.
- **Markers** — blue (`#3b82f6` fill, `#2563eb` stroke) for leads, emerald (`#34d399` / `#10b981`) for awareness. Radius 7, growing to 10 with a heavier stroke when selected.
- **Popup** — gradient header with the contact's initial, name, and type badge; body with a `tel:` phone link, location, address, stage label; footer with WhatsApp and Google Maps Directions links, both `target="_blank" rel="noopener noreferrer"`.
- **Legend** — bottom-left overlay explaining the two colours and the dashed "approximate" border.
- **Zoom control** — repositioned to `bottomright` by `ZoomControlCustom`. It clears any pre-existing `.leaflet-control-zoom` node before mounting, because Leaflet appends controls straight to the DOM outside React's tracking and a dev hot-reload can otherwise leave duplicates stacked up.
- **Empty, loading, and error states** — full-area overlays above the map, each with its own copy. The empty state distinguishes "no contacts have location data" from "your search matched nothing" and offers a Clear Search button in the latter case.

Stage codes are mapped to labels through a `STAGE_LABELS` record (`initial_contact` → "Initial Contact", and so on), with the raw code as fallback.

## Adaptations from venting-next

The source component was rewritten rather than copied, because ogera_crm's stack is narrower:

| venting-next | ogera_crm | Reason |
| --- | --- | --- |
| `lucide-react` icons | Inline `<svg>` via a local `Svg` wrapper and seven small icon components | No icon library in this project; matches the sidebar and contacts page |
| `cn()` from `@/lib/utils` | Template-literal conditional classNames | No `clsx` / `tailwind-merge` dependency |
| `<style jsx global>` | `<style dangerouslySetInnerHTML={{ __html: LEAFLET_OVERRIDES }} />` | Avoids a styled-jsx dependency and keeps `globals.css` untouched |
| Cookie session via `useAdminAuth` | `Authorization: Bearer` from `sessionStorage` | Matches this project's auth (`FRONTEND_AUTHENTICATION.md`) |
| Bottom-nav offsets on legend and Leaflet controls | Plain `bottom-5` / default control position | ogera_crm has no mobile bottom nav |
| Search matched name, phone, district, panchayath | Also matches `address` | The map payload carries `address` but not district or panchayath |
| Custom `User-Agent` header on the Nominatim call | Header removed | Browsers forbid setting `User-Agent` via `fetch`; it was silently dropped anyway |

The mobile hamburger from `DashboardSidebar` is fixed at `top-4 left-4`, so the header bar carries `pl-16 lg:pl-4` to keep the title clear of it.

## Dependencies added

| Package | Version | Type |
| --- | --- | --- |
| `leaflet` | `^1.9.4` | dependency |
| `react-leaflet` | `^5.0.0` | dependency |
| `@types/leaflet` | `^1.9.22` | devDependency |

Same versions venting-next pins. `react-leaflet` 5 is the React 19 compatible major. `leaflet/dist/leaflet.css` is imported inside `ContactsMap.tsx` rather than added to `globals.css`, so the stylesheet loads only on this route.

---

## Files added and changed

### Added

| File | Contents |
| --- | --- |
| `src/app/dashboard/map/page.tsx` | Route + `metadata` |
| `src/components/ContactsMapLoader.tsx` | Client boundary, `ssr: false` dynamic import, layout shell |
| `src/components/ContactsMap.tsx` | Map, markers, popups, search, filters, geocoding, Leaflet CSS overrides |

### Changed

| File | Change |
| --- | --- |
| `src/components/DashboardSidebar.tsx` | Added the `contact-map` entry to `menuItems` (no `roles` key, so it is visible to everyone) |
| `package.json` / `package-lock.json` | Three map dependencies |

No API route, database, schema, or shared stylesheet was modified.

---

## Verification performed

| Check | Result |
| --- | --- |
| `npm run build` | Compiles clean; TypeScript passes |
| `/dashboard/map` in the build route table | Present, prerendered as static |
| `GET /dashboard/map` against the running dev server | 200 |
| `GET /dashboard` after the change | 200, unaffected |
| Sidebar renders the new link | `/dashboard/map` present in the served HTML |
| Existing routes in the build table | All still listed; nothing dropped |

`npx tsc --noEmit` run standalone reports pre-existing errors in `src/app/api/followups/[id]/remarks/route.ts` caused by a stale `.next/types/routes.d.ts`. They are unrelated to this feature and do not appear in `npm run build`, which regenerates route types first.

## Not yet verified

The map body renders **client-side only**, so the server HTML contains no markers and none of the interactive surface could be checked from a `curl`. The following need a logged-in browser session:

- Markers actually plotting, and at the right coordinates
- `fitBounds` framing the marker set sensibly
- Popup contents, and the WhatsApp / Directions / `tel:` links
- Filter tabs, search, and the empty state
- The geocoding progress bar (unlikely to appear at all — see below)
- Mobile layout, especially the header clearing the hamburger

## Known gaps

1. **Address-only contacts never reach the map.** The API filters on non-empty `latitude` and `longitude`, so a contact with a good address but no GPS fix is excluded server-side and the client's geocoding fallback never sees it. Making geocoding meaningful would mean relaxing the `WHERE` clause to also admit rows with an address, district, or panchayath — a change to the shared endpoint that venting-next also consumes, so it was left alone. Note that `CONTACTS_API.md` currently describes this endpoint as including contacts "with GPS coordinates or a usable address, district, or panchayath", which does not match the SQL.
2. **No district or panchayath in the map payload.** The `SELECT` omits both, so popups show only the free-text `address`, and the geocode key falls back to that address. Adding the two columns is a one-line change if the popup detail is wanted.
3. **Session cache is not invalidated by writes.** `_cachedContacts` lives until a full page reload, so contacts added or edited elsewhere in the app do not appear on the map until the tab is refreshed.
4. **`sessionStorage` vs `localStorage` token.** The fetch reads the token from `sessionStorage`, matching every other page. `DashboardSidebar.logout()` clears `sessionStorage` but removes `ogera_access_token` from `localStorage` — a pre-existing inconsistency in the sidebar, not introduced here.
