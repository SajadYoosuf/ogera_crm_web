# Contacts API

Base path: `/api/contacts`

All contacts endpoints require the bearer token returned by `POST /api/auth/login`.

```http
Authorization: Bearer <accessToken>
```

## Role access

| Action | Admin | Sales Head | Sales Staff |
| --- | --- | --- | --- |
| List and search contacts | Yes | Yes | Yes |
| View map contact data | Yes | Yes | Yes |
| Create a contact | Yes | Yes | Yes |
| Update a contact | Any contact | Any contact | Only a contact created by that staff user |
| Delete a contact | Any contact | Any contact | Only a contact created by that staff user |

New contacts store the authenticated user ID in `contacts.added_by`. Sales staff ownership is checked against this value. Older contacts without a matching stable user ID cannot be changed by sales staff.

## `GET /api/contacts`

Returns contacts ordered from newest to oldest.

### Query parameters

| Parameter | Example | Purpose |
| --- | --- | --- |
| `page` | `1` | Page number. Default: `1`. |
| `limit` | `10` | Results per page. Maximum: `100`. Use `all` to export all matching rows. |
| `query` or `search` | `9876543210` | Search name, phone, or panchayath. |
| `type` | `lead` | Filter by `lead` or `awareness`. |
| `source` | `website` | Filter by contact source. |
| `waterSource` | `well` | Filter by water source. |
| `panchayath` | `Kozhikode` | Filter by panchayath. |
| `startDate` | `2026-09-01` | Include contacts created on/after this date. |
| `endDate` | `2026-09-30` | Include contacts created on/before this date. |

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
        "contactType": "lead",
        "stage": "initial_contact",
        "source": "website",
        "district": "Kozhikode",
        "panchayath": "Kunnamangalam",
        "createdAt": "2026-09-09T10:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "totalPages": 1,
    "leadsCount": 1,
    "awarenessCount": 0
  }
}
```

## `GET /api/contacts?fields=map`

Returns the lightweight contact data used for maps. It includes contacts with GPS coordinates or a usable address, district, or panchayath.

Optional filter:

```text
?fields=map&type=lead
```

## `POST /api/contacts`

Creates a contact. `phone` and `contactType` are required.

```json
{
  "name": "Anil Kumar",
  "phone": "9876543210",
  "contactType": "lead",
  "source": "website",
  "address": "Kunnamangalam",
  "district": "Kozhikode",
  "panchayath": "Kunnamangalam",
  "remarks": "Requested a product demonstration",
  "latitude": "11.2588",
  "longitude": "75.7804"
}
```

Supported optional fields:

```text
name, source, address, district, panchayath, ward,
houseStage, currentTank, waterSource, tankSizeInterest,
awarenessLevel, remarks, latitude, longitude,
referredBySaleId, referredByContactId,
professionalType, professionalName, professionalPhone,
isCampaignTarget, campaignStaffId
```

`contactType` must be `lead` or `awareness`.

`professionalType` must be `Engineer`, `Plumber`, or `Contractor`.

When `isCampaignTarget` is `true`, `campaignStaffId` is required.

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": 101,
    "name": "Anil Kumar",
    "phone": "9876543210",
    "contactType": "lead"
  }
}
```

## `PUT /api/contacts/:id`

Updates only the fields supplied in the request. The editable fields are the same as `POST`, except `referredBySaleId` is not editable after creation.

```json
{
  "remarks": "Demo booked for Friday",
  "waterSource": "well"
}
```

Note: the current endpoint supports the fields documented for `POST`, except `referredBySaleId`; it does not currently accept `stage`. Update stage through the future follow-up/pipeline API.

**Success:**

```json
{
  "success": true,
  "message": "Contact updated"
}
```

## `DELETE /api/contacts/:id`

Permanently deletes a contact when the current role and ownership rules allow it.

**Success:**

```json
{
  "success": true,
  "message": "Contact deleted"
}
```

## Errors

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Request data or contact ID is invalid. |
| `401` | `UNAUTHORIZED` | The bearer token is missing, invalid, or expired. |
| `403` | `FORBIDDEN` | The user cannot modify this contact. |
| `404` | `NOT_FOUND` | The contact does not exist. |
| `500` | `SERVER_ERROR` | The server or database could not complete the request. |
