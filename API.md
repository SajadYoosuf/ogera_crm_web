# Ogera CRM API Documentation

Base URL: `http://localhost:8000`

Interactive docs (auto-generated): `http://localhost:8000/docs`

---

## Table of Contents

- [Authentication](#authentication)
  - [POST /auth/login](#post-authlogin)
  - [GET /auth/me](#get-authme)
- [Contacts](#contacts)
  - [GET /contacts](#get-contacts)
  - [GET /contacts/{id}](#get-contactsid)
  - [POST /contacts](#post-contacts)
  - [PUT /contacts/{id}](#put-contactsid)
  - [DELETE /contacts/{id}](#delete-contactsid)
  - [GET /contacts/{id}/stages](#get-contactsidstages)
  - [POST /contacts/{id}/stages](#post-contactsidstages)
- [Known Gaps](#known-gaps)

---

## Authentication

JWT-based auth. Login returns a bearer token; pass it as `Authorization: Bearer <token>` on protected routes.

### POST `/auth/login`

Authenticate with email and password.

**Auth required:** No

**Request body:**
```json
{
  "email": "admin@ogera.com",
  "password": "admin"
}
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "employee": {
    "id": 1,
    "name": "Admin",
    "email": "admin@ogera.com",
    "role": "admin",
    "is_field_staff": false,
    "phone": null,
    "is_active": true,
    "created_at": "2026-09-30T08:40:00",
    "updated_at": "2026-09-30T08:40:00",
    "deleted_at": null
  }
}
```

**Errors:**
| Status | Cause |
|---|---|
| `401` | Wrong email or password |
| `403` | Account is inactive (`is_active=false` or soft-deleted) |

Token expires after 30 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES` in `.env`).

---

### GET `/auth/me`

Return the profile of the currently authenticated employee.

**Auth required:** Yes — `Authorization: Bearer <token>`

**Response `200`:**
```json
{
  "id": 1,
  "name": "Admin",
  "email": "admin@ogera.com",
  "role": "admin",
  "is_field_staff": false,
  "phone": null,
  "is_active": true,
  "created_at": "2026-09-30T08:40:00",
  "updated_at": "2026-09-30T08:40:00",
  "deleted_at": null
}
```

**Errors:**
| Status | Cause |
|---|---|
| `401` | Missing/invalid/expired token |

---

## Contacts

A `Contact` is the single entry point for consumers, partners, and dealers (`contact_type` field). Type-specific data lives in nested `consumer_profile` / `partner_profile` objects.

> ⚠️ **These routes currently accept no `Authorization` header check** — see [Known Gaps](#known-gaps).

### GET `/contacts`

List contacts with pagination and filtering. Soft-deleted contacts are excluded automatically.

**Query parameters:**
| Param | Type | Default | Notes |
|---|---|---|---|
| `skip` | int | `0` | Offset, must be ≥ 0 |
| `limit` | int | `10` | Max 100 |
| `contact_type` | string | — | `consumer` \| `partner` \| `dealer` |
| `district` | string | — | Case-insensitive partial match |

**Response `200`:** array of `ContactResponse` (see shape below).

---

### GET `/contacts/{id}`

Fetch a single contact, including nested `assigned_employee`, `lead_source`, `referred_by`, `referrals_count`, `current_stage`, `consumer_profile`, `partner_profile`.

**Response `200` — `ContactResponse` shape:**
```json
{
  "id": 12,
  "contact_type": "consumer",
  "name": "Arun Kumar",
  "phone": "9876543210",
  "phone_alt": null,
  "district": "Calicut",
  "address": null,
  "assigned_to": 1,
  "referred_by_id": null,
  "lead_source_id": 2,
  "notes": null,
  "created_at": "2026-09-01T10:00:00",
  "updated_at": "2026-09-20T14:30:00",
  "deleted_at": null,
  "assigned_employee": {
    "id": 1,
    "name": "Admin",
    "email": "admin@ogera.com",
    "role": "admin",
    "phone": null
  },
  "lead_source": { "id": 2, "name": "Website", "slug": "website" },
  "referred_by": null,
  "referrals_count": 0,
  "current_stage": {
    "id": 5,
    "stage": "won",
    "loss_reason": null,
    "loss_notes": null,
    "awareness_note": null,
    "changed_by": 1,
    "changed_at": "2026-09-20T14:30:00"
  },
  "consumer_profile": {
    "id": 3,
    "contact_id": 12,
    "awareness_mode": 0,
    "house_stage": "ready",
    "current_tank_type": "plastic",
    "current_tank_capacity": 1000,
    "current_tank_age": 2
  },
  "partner_profile": null
}
```

**Errors:**
| Status | Cause |
|---|---|
| `404` | Contact not found or soft-deleted |

---

### POST `/contacts`

Create a new contact.

**Request body — `ContactCreate`:**
```json
{
  "contact_type": "consumer",
  "name": "Arun Kumar",
  "phone": "9876543210",
  "phone_alt": null,
  "district": "Calicut",
  "address": null,
  "assigned_to": 1,
  "referred_by_id": null,
  "lead_source_id": 2,
  "notes": null
}
```

| Field | Required | Notes |
|---|---|---|
| `contact_type` | No | Default `consumer` |
| `name` | Yes | 1–150 chars |
| `phone` | Yes | 1–20 chars |
| `phone_alt` | No | Max 20 chars |
| `district` | Yes | 1–80 chars |
| `address` | No | Max 255 chars |
| `assigned_to` | Yes | Must reference an existing `employees.id` |
| `referred_by_id` | No | Must reference an existing `contacts.id` (not validated server-side yet) |
| `lead_source_id` | No | Should reference `lead_sources.id` (not validated server-side yet) |
| `notes` | No | Free text |

**Response `201`:** `ContactResponse` (see above), `referrals_count` starts at `0`, `current_stage` is `null` until a stage is added.

**Errors:**
| Status | Cause |
|---|---|
| `400` | `assigned_to` does not match an existing employee |
| `422` | Validation error (bad enum, string too long, etc.) |

> Note: this endpoint only creates the base `Contact` row. To attach `consumer_profile` / `partner_profile` data, there is currently no dedicated endpoint — see [Known Gaps](#known-gaps).

---

### PUT `/contacts/{id}`

Partial update — send only the fields you want to change (`ContactUpdate`, all fields optional).

**Request body example:**
```json
{
  "district": "Kozhikode",
  "assigned_to": 2
}
```

**Response `200`:** updated `ContactResponse`.

**Errors:**
| Status | Cause |
|---|---|
| `404` | Contact not found or soft-deleted |
| `400` | `assigned_to` provided but employee not found |

---

### DELETE `/contacts/{id}`

Soft-delete a contact (sets `deleted_at`, row is not physically removed).

**Response:** `204 No Content`

**Errors:**
| Status | Cause |
|---|---|
| `404` | Contact not found or already deleted |

---

### GET `/contacts/{id}/stages`

Full stage history for a contact, newest first.

**Response `200`:** array of `LeadStageResponse`:
```json
[
  {
    "id": 5,
    "stage": "won",
    "loss_reason": null,
    "loss_notes": null,
    "awareness_note": null,
    "changed_by": 1,
    "changed_at": "2026-09-20T14:30:00"
  },
  {
    "id": 4,
    "stage": "quoted",
    "loss_reason": null,
    "loss_notes": null,
    "awareness_note": null,
    "changed_by": 1,
    "changed_at": "2026-09-15T09:00:00"
  }
]
```

Note: `contact_id` is intentionally omitted from this schema since it's always accessed in the context of a contact (see URL path).

**Errors:**
| Status | Cause |
|---|---|
| `404` | Contact not found or soft-deleted |

---

### POST `/contacts/{id}/stages`

Append a new stage entry to a contact's history (append-only log — never edits a past entry's `stage` value).

**Request body — `LeadStageCreate`:**
```json
{
  "stage": "lost",
  "loss_reason": "price",
  "loss_notes": "Chose a cheaper competitor",
  "changed_by": 1
}
```

**Validation rules (enforced by schema):**
| Rule | Detail |
|---|---|
| `loss_reason` required | When `stage = "lost"` |
| `loss_reason` / `loss_notes` forbidden | When `stage != "lost"` |
| `awareness_note` forbidden | When `stage != "aware"` |

**Available `stage` values:** `new_lead`, `first_call`, `aware`, `interested`, `quoted`, `won`, `lost`, `referral`

**Response `201`:** `LeadStageResponse` (see shape above).

**Errors:**
| Status | Cause |
|---|---|
| `404` | Contact not found or soft-deleted |
| `400` | `changed_by` does not match an existing employee |
| `422` | Cross-field validation failed (see rules above) |

---

## Known Gaps

These exist in the current implementation and should be addressed before production use:

1. **`/contacts/*` routes are not actually protected.** They don't call `Depends(get_current_user)`, so no `Authorization` header is enforced despite auth infrastructure existing. Add the dependency to each route (or a router-level dependency) to require login.
2. **No CRUD endpoints yet for:** `LeadSource`, `StageType`, `Employee` (management), `ConsumerProfile`, `PartnerProfile` as standalone resources. Profiles currently can only be read as nested objects on `ContactResponse` — there's no way to create/update them via the API yet.
3. **`referred_by_id` and `lead_source_id` are not validated** on create/update — you can currently set them to non-existent IDs and only find out when reading nested data (`referred_by`/`lead_source` will just be missing).
4. **No role-based access control** — any authenticated (or, currently, unauthenticated) request can perform any action; there's no admin-only restriction anywhere yet.
