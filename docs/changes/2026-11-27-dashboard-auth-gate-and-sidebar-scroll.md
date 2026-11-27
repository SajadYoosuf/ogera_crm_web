# Dashboard auth gate and sidebar scroll fix (2026-11-27)

## What changed

- **Auth gate for `/dashboard/*`.** New `src/components/DashboardAuthGate.tsx`, used by `src/app/dashboard/layout.tsx`.
  Before, the dashboard shell and its pages rendered for signed-out visitors, and each page made API calls with no
  token. Now the gate shows a short "Checking your sign-in…" placeholder while the session is read, and sends
  signed-out visitors to `/` without rendering the shell.
- **Expired session ends the session everywhere.** `apiCall()` in `src/lib/api/auth.ts` dispatches
  `SESSION_EXPIRED_EVENT` (`ogera-session-expired`) on a 401. `AuthProvider` (`src/context/AuthContext.tsx`) listens
  for it and clears the session, so the gate sends the user to sign-in. Before, only the Dashboard and Employees
  pages handled 401; other pages showed "Unable to load…" with a dead token.
- **Sidebar scroll.** `src/components/DashboardSidebar.tsx`: brand, menu and footer are now one scroll area
  (`aside > div`). Before, the menu had its own scroll and the footer stayed pinned, so on a short window only
  Settings was visible. The collapse handle stays outside the scroll area, because it sits half outside the rail.
  Menu spacing is tighter under 760px of height.
- **Viewport height.** `h-screen` → `h-dvh` on the dashboard root and the sidebar, so phones and Chrome with its
  toolbar do not push the bottom of the page out of reach.

## Access / data impact

- No role or permission rules changed. Signed-out users now get no dashboard shell and no API calls from it.
- Live data: none. Nothing was written to the database.

## Verification

- `npx tsc --noEmit`: passes.
- ESLint on changed files: two findings, both already in the code before this change (an unused `SessionUser`
  import in `DashboardSidebar.tsx`, and `setState` in the storage-read effect in `AuthContext.tsx`). Not fixed here.
- Browser (dev server, local): signed-out `/dashboard/contacts` and `/dashboard/settings` redirect to `/`.
  A planted invalid token on `/dashboard/contacts` clears the session and redirects to `/`.
  At a 1100×380 window the sidebar scrolls as one block and every menu item is reachable (before: only the footer
  stayed visible).
- Not verified: the layout at a typical 700px height with a valid login (no test credentials used; the dev server
  points at the live API), and the mobile drawer after this change. Login itself was not tested.

## Known issues or not done yet

- The session is stored in `sessionStorage`, so it lasts only for one browser tab. Opening a new tab or
  restoring a closed one means signing in again. Changing that is a security decision, not part of this fix.
- At very short windows (under about 550px high) the sidebar and the page can both still scroll. That is expected
  for the window size.
- The sign-in page does not yet say "your session expired" after a redirect.
