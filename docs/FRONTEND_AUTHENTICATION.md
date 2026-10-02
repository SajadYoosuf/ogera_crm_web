# Frontend Authentication (Login Flow)

The login screen (`src/app/page.tsx`) authenticates against the Ogera CRM FastAPI backend described in `API.md`. The browser calls the backend directly; the old Next.js `/api/auth/login` route is no longer used.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Base URL of the FastAPI backend (trailing slashes are stripped). |

The backend must allow the web origin (e.g. `http://localhost:3000`) through CORS, otherwise every request fails as a **network** error.

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/api/auth.ts` | `login()` and `getMe()` requests, `ApiError` type, status-to-error mapping, 15 s timeout. |
| `src/hooks/useLogin.ts` | Login state machine (`idle` / `loading` / `success` / `error`) and session storage. |
| `src/hooks/useOnlineStatus.ts` | Reactive browser online/offline state. |
| `src/app/page.tsx` | Login form; renders loading, offline and error states. |
| `tests/api/auth-client.test.ts` | Unit tests for the error mapping. |

## Request

```http
POST {NEXT_PUBLIC_API_BASE_URL}/auth/login
Content-Type: application/json

{ "email": "admin@ogera.com", "password": "admin" }
```

Success (`200`) returns `{ access_token, token_type, employee }`. The token expires after 30 minutes (backend setting).

`GET /auth/me` with `Authorization: Bearer <token>` is available as `getMe(token)` for session checks. It is not called anywhere yet.

## UI states

| State | Trigger | What the user sees |
| --- | --- | --- |
| Idle | Initial / after editing a field | "Sign in" button. |
| Loading | Request in flight | Button disabled, reads "Signing in...", `aria-busy` set. Duplicate submits are ignored. |
| Success | `200` | Button reads "Redirecting..."; navigates to `/dashboard`. |
| Error | Any failure | Red alert with the message below. Editing email or password clears it. |
| Offline | `navigator.onLine === false` | Amber "You're offline" banner; button disabled; no request is sent. Recovers automatically when the connection returns. |

## Error handling

Every failure becomes an `ApiError` with a `kind`, a user-facing `message`, and an optional HTTP `status`.

| Kind | Cause | Message | Retryable |
| --- | --- | --- | --- |
| `offline` | Browser reports no connection (checked before sending) | You're offline. Check your internet connection and try again. | Yes |
| `network` | `fetch` rejected: server down, DNS, CORS | Can't reach the server. Check your connection and try again. | Yes |
| `timeout` | No response within 15 s | The server took too long to respond. Please try again. | Yes |
| `invalid_credentials` | `401` | Incorrect email or password. | No |
| `inactive_account` | `403` | This account is inactive. Contact your administrator. | No |
| `validation` | `422` | The backend's validation text (FastAPI `detail[].msg`), or a generic fallback. | No |
| `server` | `5xx` | The server ran into a problem. Please try again in a moment. | Yes |
| `unknown` | Other status, or a non-JSON `200` body | Something went wrong. Please try again. | No |

When the error is retryable, the submit button label changes to "Try again".

Client-side check: an empty email or password is rejected before any request with "Enter your email and password to continue." Email format is left to the backend (`noValidate` on the form).

For `getMe()`, a `401` is reworded to "Your session has expired. Please sign in again."

## Session storage

On success the hook writes to `sessionStorage` (same keys the dashboard already reads):

| Key | Value |
| --- | --- |
| `ogera_access_token` | The `access_token` string. |
| `ogera_user` | JSON: `{ id, name, email, role, phone }` taken from `employee`. |

Logout (`DashboardSidebar`) clears `sessionStorage` and redirects to `/`.

## Using the token in other calls

```ts
const token = sessionStorage.getItem("ogera_access_token");

await fetch(`${API_BASE_URL}/contacts`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

## Known limitations

- Dashboard pages still call `/api/...` Next routes that have been removed from the working tree; they have not been migrated to the FastAPI backend yet.
- There is no session check on dashboard load, so an expired token is only discovered when a data request fails with `401`. `getMe()` is ready to use for this.
- The backend's `/contacts/*` routes are currently unauthenticated (see "Known Gaps" in `API.md`).
- Roles: the dashboard menu filters on `admin`, `sales_head` and `sales_staff`. Make sure the backend's `employee.role` uses these values.
