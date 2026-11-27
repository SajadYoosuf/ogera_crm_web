# Session expiry hardening and multi-tenant resilience (2026-11-27)

## What changed

### 1. Generic event name (`src/lib/api/auth.ts`)
- `SESSION_EXPIRED_EVENT` value changed from `"ogera-session-expired"` to `"crm:session-expired"`.
  Brand names do not belong in internal DOM event strings, especially in a multi-tenant system where the brand name displayed to a user depends on which company they belong to. The event is already private (not visible outside the app), but keeping it neutral avoids confusion and future rename churn.

### 2. Single logout owner — no more duplicate handling (`src/features/dashboard/DashboardView.tsx`, `src/app/dashboard/employees/page.tsx`)
- **Before**: Several pages (DashboardView, employees page) each caught 401 errors themselves and independently called `clearSession()` + `router.push("/")`. This raced with the global `SESSION_EXPIRED_EVENT` handler and bypassed the `/?expired=1` hint.
- **After**: Pages no longer handle 401 redirects. The event fires → `AuthProvider.clearSession()` → `DashboardAuthGate` redirects. Pages still display their local error state briefly while the redirect is in-flight, which is fine.
- User-facing "Sign in again" buttons (employees page) remain untouched — those are deliberate user actions, not automatic redirects.

### 3. Session-expired banner on the login page (`src/app/page.tsx`, `src/components/DashboardAuthGate.tsx`)
- `DashboardAuthGate` now distinguishes between two cases:
  - **Fresh unauthenticated visit** (never had a session): redirects to `/` silently.
  - **Mid-session expiry** (had a valid token that became null): redirects to `/?expired=1`.
- The login page reads `?expired=1` on mount (lazy `useState` initializer), shows an amber banner ("Your session expired. Please sign in again.") in both English and Malayalam, then cleans the URL param so a refresh does not re-show it.

### 4. Sidebar polls hardened for mobile and poor networks (`src/components/DashboardSidebar.tsx`)
- Both background polls (WhatsApp unread count, overdue tasks badge) now check `navigator.onLine` **and** `document.visibilityState` before firing a request.
- Polls are skipped when offline, preventing a cascade of `network` errors on mobile devices that briefly lose signal — which could previously trigger multiple 401-looking errors and confuse state.
- The polls also re-fire on the `online` and `visibilitychange` events, so badges update as soon as the user comes back online or returns to the tab, rather than waiting up to 2 minutes (WhatsApp) or 8 minutes (tasks) for the next scheduled tick.

## Access / data impact
- No role or permission rules changed.
- No data was read from or written to the database.
- Session storage behaviour is unchanged (token still lives in `sessionStorage`, per-tab).

## Verification
- `npx tsc --noEmit`: passes.
- ESLint: one pre-existing error (AuthContext.tsx:150 `setState` in storage-read effect, present before this change). Zero new errors from this change.
- Browser (dev server, local):
  - A fake session with an invalid token navigated to `/dashboard/contacts` → got 401 → redirected to `/?expired=1`.
  - Login page read the flag, showed the amber banner, cleaned the URL.
  - Direct unauthenticated visit to `/dashboard/settings` redirected to `/` (no banner).
- Not verified end-to-end with a real login (dev server points at the live API; no test credentials used).

## Known issues or not done yet
- The sidebar "Log out" button still calls `clearSession()` itself and immediately navigates to `/`, bypassing the gate. It is a deliberate user action, so the banner is correctly absent, but the gate does not control that flow. If a future change wants the gate to own all exits, the sidebar logout should let the gate handle navigation.
- The sessions are per-tab (sessionStorage). Opening a new tab always requires signing in again. Changing that is a security decision deferred to a later sprint.
