# Contact Intake and Location Capture

Feature name: **Contact Intake and Location Capture**

This feature brings the contact add/edit modal in Ogera CRM up to the full field set documented in [CONTACTS_API.md](./CONTACTS_API.md), and replaces manual latitude/longitude entry with a one-tap GPS capture that resolves a readable address.

## Summary

| Area | Before | After |
| --- | --- | --- |
| Modal fields | 7 (name, phone, contact type, source, address, latitude, longitude) | 22 fields covering location, property, referral, professional, and campaign details |
| Coordinates | Two free-text inputs the user typed by hand | No inputs. Captured by a **Get current location** button and saved silently |
| Create endpoint | Accepted 7 fields | Accepts the full documented field set |
| Update endpoint | Updated 7 fields | Updates the full set, except `referredBySaleId` which is create-only |
| Supporting endpoints | None | `GET /api/staff` and `GET /api/sales/search` |

No database migration was required. Ogera CRM shares its MySQL database with venting-next, and every target column already existed on the `contacts` table. This was verified against `information_schema` before the API was widened.

## Fields

All fields below are optional unless marked required.

| Field | Control | Notes |
| --- | --- | --- |
| `name` | Text | |
| `phone` | Text | Required |
| `contactType` | Select | Required. `lead` or `awareness`. Drives conditional sections |
| `source` | Select | `online`, `offline`, `showroom`, `Meta` |
| `address` | Textarea | Auto-filled by GPS capture, still editable by hand |
| `district` | Text | Auto-filled by GPS capture |
| `panchayath` | Text with datalist | Previously used values are remembered, see below |
| `ward` | Text | |
| `houseStage` | Select | Choosing "Under construction" reveals a phase sub-select |
| `currentTank` | Text | |
| `waterSource` | Text | |
| `tankSizeInterest` | Text | |
| `awarenessLevel` | Select | Only shown when contact type is `awareness` |
| `remarks` | Textarea | |
| `latitude` | None | No input. Set by GPS capture only |
| `longitude` | None | No input. Set by GPS capture only |
| `referredBySaleId` | Search picker | Only shown when creating. Not editable afterwards |
| `referredByContactId` | Search picker | Excludes the contact currently being edited |
| `professionalType` | Tabs | `Engineer`, `Plumber`, `Contractor`. Clicking the active tab clears the section |
| `professionalName` | Text | Only shown once a professional type is selected |
| `professionalPhone` | Text | Only shown once a professional type is selected |
| `isCampaignTarget` | Radio | Only shown when contact type is `lead` |
| `campaignStaffId` | Select | Required when `isCampaignTarget` is yes. Populated from `/api/staff` |

### Conditional behaviour

- `awarenessLevel` is sent as `null` unless the contact type is `awareness`.
- `isCampaignTarget` and `campaignStaffId` are sent as `false`/`null` unless the contact type is `lead`.
- `professionalName` and `professionalPhone` are sent as `null` unless a `professionalType` is selected.
- `houseStage` is stored as a single string. The construction phase is appended, producing values like `Under Construction - Plastering`.

### Panchayath suggestions

Panchayath values are remembered per browser. On save, a new value is appended to the list in `localStorage` under the key `ogera_panchayaths`, and the list is offered as a datalist the next time the modal opens. This is a local convenience only and is never sent to the server.

## Frontend

### `src/lib/location.ts` (new)

Exports `getGPSLocationAndGeocode()`, which reads coordinates from the browser Geolocation API and reverse-geocodes them through OpenStreetMap Nominatim.

```ts
interface GeolocationResult {
  latitude: string;
  longitude: string;
  address: string;
  isOffline: boolean;
}
```

Behaviour:

- Requests high-accuracy position with a 12 second timeout.
- If the device is offline, or the geocoding request fails, it resolves with the raw coordinates as the address text and `isOffline: true` rather than rejecting. The contact can still be saved with usable coordinates.
- It rejects only when geolocation is unsupported or the position could not be read, with a distinct message for permission denied, position unavailable, and timeout.

### `src/components/SearchPicker.tsx` (new)

A reusable searchable dropdown used for both referral fields. It debounces input by 300 ms, closes on outside click, and shows the current selection as a chip with a Clear action.

```tsx
interface PickerItem { id: number; primary: string; secondary?: string }
```

The parent supplies a `search(query)` function, so the same component drives both the sales picker and the contacts picker.

### `src/app/dashboard/page.tsx`

- The contact modal renders the full field set described above.
- The two latitude and longitude inputs were removed. The address field now carries a **Get current location** button in its top-right corner, which shows a spinner while locating and writes `address`, `latitude`, and `longitude` into form state on success. Failures surface in the existing form error banner.
- `openEditor(contact?)` replaces the previous inline `setEditor(...)` calls at all four entry points, so the referral pickers are seeded from the contact being edited.
- Staff options are fetched once per modal open, not on every keystroke.

## Backend

### `POST /api/contacts`

The Zod schema now covers the full documented field set. A `refine` enforces that `campaignStaffId` is present when `isCampaignTarget` is true. The `INSERT` writes 24 columns:

```text
name, phone, source, address, district, panchayath, ward,
house_stage, current_tank, water_source, tank_size_interest,
contact_type, awareness_level, remarks, latitude, longitude,
referred_by_sale_id, referred_by_contact_id,
professional_type, professional_name, professional_phone,
is_campaign_target, campaign_staff_id, added_by
```

`mapContact` was extended to return every new field, along with the joined `referredBySaleBuyerName`, `referredByContactName`, and `referredByContactPhone` values that the modal uses to display an existing referral selection.

### `PUT /api/contacts/:id`

The update schema mirrors the create schema minus `referredBySaleId`, matching the contract in CONTACTS_API.md. The existing sparse-update loop was extended with the new column mappings, and booleans are converted to `0`/`1` for MySQL. Only fields present in the request body are written.

### `GET /api/staff` (new)

Returns the active admin users used to populate the campaign staff dropdown.

```json
{ "success": true, "data": [{ "id": "12", "name": "Anil Kumar" }] }
```

### `GET /api/sales/search` (new)

Searches sales by buyer name, buyer phone, or exact sale ID. Returns at most 10 rows, newest first. With no `query` it returns the 10 most recent sales.

```json
{
  "success": true,
  "data": [
    { "id": 41, "saleDate": "2026-08-02", "buyerName": "Anil Kumar", "buyerPhone": "9876543210", "tankSize": "1000" }
  ]
}
```

Both new endpoints require the same bearer token as the contacts endpoints and return `401 UNAUTHORIZED` without it.

## Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` | Clean for all files in this feature |
| `eslint` on changed files | Clean |
| Dev server compile | Clean, `/dashboard` serves HTTP 200 |
| `/api/staff` and `/api/sales/search` without a token | `401` as expected |
| Live `contacts` schema vs the 24 written columns | No missing columns |

Not yet verified: the modal has not been rendered in a browser, so the visual layout of the new fields is unconfirmed. Worth a manual pass before release, particularly the conditional sections and the two search pickers.

Unrelated pre-existing issue: `src/app/api/professionals/[id]/route.ts` has two TypeScript errors that predate this work and were left untouched.
