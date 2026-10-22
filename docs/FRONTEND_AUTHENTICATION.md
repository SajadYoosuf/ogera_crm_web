# Frontend Authentication

How the web app signs staff in, keeps the session, recovers a forgotten password and signs out. The backend contract is in the root `API.md` (`/auth/*`). Employee management, which depends on the same session, is in [EMPLOYEE_MANAGEMENT.md](./EMPLOYEE_MANAGEMENT.md).

The browser calls the FastAPI backend directly. There are no Next.js auth routes; the only Next route left under `src/app/api` is the dev-only `dev-log` relay.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Base URL of the FastAPI backend. Trailing slashes are stripped. Read at build time. |

The backend must allow the web origin (for example `http://localhost:3000`) through CORS. Otherwise every request fails as a **network** error.

On load, `src/lib/api/auth.ts` logs `[Ogera CRM] API base URL: …` to the console, and notes when the variable was not set at build time.

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/api/auth.ts` | `request()` (timeout, offline check, error mapping), `login()`, `getMe()`, `ApiError`, `Employee` type. |
| `src/hooks/useLogin.ts` | Login state (`idle` / `loading` / `success` / `error`) and writing the session. |
| `src/hooks/useOnlineStatus.ts` | Reactive `navigator.onLine` state, used by the login form and the employee screen. |
| `src/app/page.tsx` | Login screen: form, English / Malayalam copy, offline banner, error alert, "Forgot password?" link. |
| `src/app/forgot-password/page.tsx` | Forgot-password flow: send code, enter code, set new password, done. |
| `src/lib/api/password-reset.ts` | `getResetTarget()`, `requestResetCode()`, `verifyResetCode()`, `resetPassword()`. |
| `src/lib/password-rules.ts` | Client-side rules for the new password on the reset screen. |
| `src/components/auth/OtpInput.tsx` | Six-box code input: auto-advance, backspace, paste. |
| `src/lib/auth-fonts.ts` | Sora, DM Sans and Noto Sans Malayalam for the sign-in screens. |
| `src/components/DashboardSidebar.tsx` | Shows the signed-in user and performs logout. |
| `src/app/dashboard/layout.tsx` | Dashboard shell. It has **no** session check (see Known gaps). |
| `tests/api/auth-client.test.ts` | Unit tests for the error mapping. |
| `e2e/login.spec.ts` | Login flow against the mocked API. |
| `e2e/forgot-password.spec.ts` | Forgot-password flow against the mocked API (see the known issue below). |
| `e2e/fixtures/api.ts` | Mock FastAPI used by the e2e tests, including `signInAs()` for the session. |

## Login flow

```
Login page (src/app/page.tsx)
  -> submit: email and password must be non-empty (else "Enter your email and password to continue.")
  -> useLogin.submit(): state = loading
  -> POST {API}/auth/login  { email, password }
       200 -> store session -> state = success -> router.push("/dashboard")
       else -> ApiError -> state = error -> message shown, button may read "Try again"
```

The request sends `email` trimmed. The form has `noValidate`, so the email format is checked by the backend only.

### Login UI states

| State | Trigger | What the user sees |
| --- | --- | --- |
| Idle | First load, or after editing a field | "Login" button enabled. |
| Loading | Request in flight | Button disabled, reads "Signing in...", `aria-busy` set. Repeat submits are ignored. |
| Success | `200` | Button reads "Redirecting...", then navigates to `/dashboard`. |
| Error | Any failure | Alert under the fields. Editing email or password clears it. |
| Retryable error | `offline`, `network`, `timeout`, `server` | Button reads "Try again". |
| Offline | `navigator.onLine === false` | Amber "You're offline. Reconnect to sign in." banner; button disabled; no request is sent. Recovers when the browser reports online. |
| Validation | Empty email or password | "Enter your email and password to continue." Nothing is sent. |

The page also has an English / Malayalam switch. It changes copy only; it does not change the request.

### Login API

`POST /auth/login` (see `API.md`):

```http
POST {NEXT_PUBLIC_API_BASE_URL}/auth/login
Content-Type: application/json

{ "email": "admin@ogera.com", "password": "..." }
```

`200` returns `{ access_token, token_type, employee }`. The token lasts 30 minutes (backend setting).

### Login errors

Every failure becomes an `ApiError` (`src/lib/api/auth.ts`) with a `kind`, a `message` and the HTTP `status`.

| Kind | Cause | Message shown | Retryable |
| --- | --- | --- | --- |
| `offline` | Browser is offline (checked before sending) | You're offline. Check your internet connection and try again. | Yes |
| `network` | `fetch` rejected: server down, DNS, CORS | Can't reach the server. Check your connection and try again. | Yes |
| `timeout` | No response within 15 seconds | The server took too long to respond. Please try again. | Yes |
| `invalid_credentials` | `401` (backend: "Invalid email or password") | Incorrect email or password. | No |
| `inactive_account` | `403` (backend: "Employee account is inactive") | This account is inactive. Contact your administrator. | No |
| `validation` | `422` | The backend's message, or "Please check the email and password you entered." | No |
| `server` | `503` with a `detail`, or any `5xx` | The backend's `detail` for `503`; otherwise "The server ran into a problem. Please try again in a moment." | Yes |
| `unknown` | Other status, or an empty `200` body | Something went wrong. Please try again. | No |

## Session

On a successful login, `useLogin` writes two `sessionStorage` keys. Dashboard pages read the same keys.

| Key | Value |
| --- | --- |
| `ogera_access_token` | The `access_token` string. |
| `ogera_user` | JSON: `{ id, name, email, role, phone }`, taken from `employee`. |

Because the keys are in `sessionStorage`, the session ends when the tab or window closes. There is no "remember me".

Every protected call sends the token as a bearer header:

```ts
const token = sessionStorage.getItem("ogera_access_token");
await fetch(`${API_BASE_URL}/employees`, { headers: { Authorization: `Bearer ${token}` } });
```

`getMe(token)` calls `GET /auth/me` and turns a `401` into "Your session has expired. Please sign in again." Nothing calls it yet.

### Logout

`DashboardSidebar` clears `sessionStorage` and sends the user to `/`. There is no server call.

## Forgot password

A user who cannot sign in uses **Forgot password? Reset here** on the login page, which opens `/forgot-password`. The flow is: enter email, receive a 6-digit code, enter it, set a new password, and sign in again.

### Steps and UI states

| Step | Screen | What the user sees |
| --- | --- | --- |
| `email` | "Reset your password" | Email input and "Send code" button. |
| `sending` | "Sending your code…" | Spinner while the request is in flight. |
| `send_failed` | "Check your email" | The error message and "Try again" (or "Back to Login"). |
| `otp` | "Check your email" | "We've sent a 6-digit code to <masked address>." Six boxes, "Verify Code" (enabled when all six are filled), "Resend code" after a cooldown. |
| `reset` | "Create a new password" | New and confirm password fields with show/hide. "Reset Password". |
| `done` | "Password updated" | "Back to Login". |

Transitions:
- The page opens on the `email` step. The user enters their email and submits to move to `sending`.
- A send failure moves to `send_failed`. "Try again" retries with the same email.
- A wrong code clears the boxes and shows the message. A code that is expired, locked or missing also marks "request a new code" and shows "Start again" after the reset step.
- "Resend code" is hidden for the cooldown, then shows "Resend in Ns" until it's available again.
- A successful reset clears the password fields and shows `done`. The user is not signed in.

### Forgot-password API

These are the calls the frontend makes (`src/lib/api/password-reset.ts`). The backend side is in `ogera_crm_backend/routes/password_reset.py`.

| Frontend call | Request | Used for |
| --- | --- | --- |
| `requestResetCode(email)` | `POST /auth/password-reset/request` with `{ email }` | Emails a code. Returns `{ email_masked, expires_in_seconds, resend_in_seconds }`. |
| `verifyResetCode(email, code)` | `POST /auth/password-reset/verify` with `{ email, code }` | Returns `{ reset_token, expires_in_seconds }`. |
| `resetPassword(token, password)` | `POST /auth/password-reset/reset` with `{ reset_token, new_password }` | Sets the new password. |

Backend rules the UI relies on (`routes/password_reset.py`, `config.py`):
- A code is valid for `RESET_CODE_TTL_MINUTES` (default 10).
- A new code can be requested every `RESET_CODE_RESEND_SECONDS` (default 60). A request inside that window returns `429` with the wait time.
- After `RESET_CODE_MAX_ATTEMPTS` (default 5) wrong codes, the code locks.
- A requested code replaces any older code.
- The reset token from `verify` lasts `RESET_TOKEN_TTL_MINUTES` (default 10).
- The backend returns `404` when no active account uses the email.

Error text from the backend is shown as-is. The reset screen uses it to decide whether a new code is needed:

| Backend `detail` contains | UI effect |
| --- | --- |
| "expired", "Too many", "No active code" | Marks "request a new code". |
| "expired or was already used" (reset step) | Marks "Start again". |

## Password rules

| Where | Rule |
| --- | --- |
| Login | None on the client. The backend decides. |
| Reset screen (`password-rules.ts`) | 6 to 15 characters. Confirm must match. |
| Reset backend (`routes/password_reset.py`) | `PASSWORD_MIN_LENGTH` (default 6) to `PASSWORD_MAX_LENGTH` (default 15). The new password must differ from the current one. |
| Employee add/edit form | 8+ characters with a letter and a digit (client). The backend also requires a letter and a digit, and 6 to 15 characters. |

## Known gaps

- **No session check when the dashboard loads.** `dashboard/layout.tsx` renders the shell for anyone. An expired token is only noticed when a data request returns `401`.tMe()` is ready to use for this.
- **Dev-only Next route.** `src/app/api/dev-log/route.ts` relays console logs to the terminal in development. It is not used in production.
- **Stale role value in the sidebar.** One `DashboardSidebar` menu item still lists `sales_head` in its allowed roles (`roles: ["admin", "sales_head"]`). Backend roles are the slugs in `EMPLOYEE_ROLES`, so that entry never matches a current employee. The login flow itself does not check roles.
