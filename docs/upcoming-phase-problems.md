# Upcoming Phase: Problems To Fix

**Purpose:** A running list of known problems we will fix in the coming phase.
These are **not** being worked on now. Items here are logged so they are not lost.

**How to use this file:**
- Add one section per problem. Keep the status line up to date.
- When a problem is fixed, change its status to `Fixed` and link the commit or PR.
- Do not fix items from this list during the current work unless the user asks.

---

## 1. Push notifications: FCM service worker fails to register

**Status:** Open
**Area:** Web / Notifications (`src/hooks/useFcmToken.ts`, `public/firebase-messaging-sw.js`)
**Found:** 2026-10-24, browser console on `/dashboard`

### What we see

After login, the browser console logs this twice, plus one earlier failure:

```
[FCM] Token setup failed: FirebaseError: Messaging: We are unable to register the
default service worker. Service worker not registered after 10000 ms
(messaging/failed-service-worker-registration).

[FCM] Token setup failed: AbortError: Registration failed - push service error
```

### Why it matters

- The FCM token is never saved to the backend (`registerFcmToken` is not reached).
- Push notifications will not reach this browser or user.
- The in-app notification inbox still works, so this is a push-only gap.

### What we know (verified by reading the code)

- `useFcmToken.ts` calls `getToken(messaging, { vapidKey })` after permission is granted.
- The service worker is `public/firebase-messaging-sw.js`. It loads Firebase from
  the `gstatic.com` CDN with `importScripts()`.
- The error text says the service worker did not register. The push service error
  is a separate message from the browser push service.
- `VAPID_KEY` comes from `NEXT_PUBLIC_FIREBASE_VAPID_KEY`. If this env var is empty,
  `getToken` fails.

### What we do not know yet (to check in the next phase)

- [ ] Is `NEXT_PUBLIC_FIREBASE_VAPID_KEY` set in the local `.env` and in the deploy environment?
- [ ] Does `/firebase-messaging-sw.js` return 200 in the browser (open it directly at `http://localhost:3000/firebase-messaging-sw.js`)?
- [ ] Is the page served from `localhost` or HTTPS? Service workers need a secure origin.
- [ ] Does the CDN `importScripts` load succeed? Check the Network tab for the two `gstatic.com` files.
- [ ] Is the browser blocking push? Check Chrome settings (`chrome://settings/content/notifications`) and any extension that blocks push.
- [ ] Does the error happen only in dev mode (`next dev`), or also in production?
- [ ] Does the service worker register in an incognito window with no extensions?

### Suggested fix plan (for the next phase)

1. Confirm the env vars and the VAPID key first (cheapest check).
2. Confirm the service worker URL loads and registers with `navigator.serviceWorker.getRegistrations()`.
3. Register the service worker explicitly in the hook with `navigator.serviceWorker.register("/firebase-messaging-sw.js")`
   and pass the registration to `getToken({ vapidKey, serviceWorkerRegistration })`.
4. Show a clear UI state when push is unavailable (permission denied, unsupported browser, or setup failed),
   so the user is not left with only a console warning.
5. Add a test for the setup path with a mocked `getToken` that rejects, to confirm the app does not crash.

### Security note

The Firebase config in `public/firebase-messaging-sw.js` is hard-coded. Firebase web config values
are identifiers, not secrets, so this is acceptable. Still, keep the service worker config in sync
with the `NEXT_PUBLIC_FIREBASE_*` env vars, or move it to a build-time generated file to avoid drift.

---

## 2. Expense management module: pending work

**Status:** Open (module is partly built and not yet committed)
**Area:** Web (`src/app/dashboard/expenses/page.tsx`, `src/lib/api/expenses.ts`), Backend (`/expenses` endpoints), Flutter (claim submission, if in scope)
**Found:** 2026-10-24, review of uncommitted work on the `fix/task-status-in-progress` checkout

### What we see

The web expense review page and its API client exist as untracked files. They are not yet linked from the
dashboard, not covered by tests, and not documented. Nothing in `docs/`, `CHANGELOG.md`, or the sidebar mentions expenses yet.

### Why it matters

Managers and admins cannot reach the page from the UI. The module cannot ship until its contract with the
backend is confirmed and its states are complete.

### What is pending

- [ ] **Sidebar link:** add an "Expenses" item to `src/components/DashboardSidebar.tsx` (currently only Dashboard, Contacts, Followups, Tasks, Sales, Products, Employees).
- [ ] **Role gating:** show the link and page only to managers and admins. The API returns 403 for other roles; the UI should not offer the page to them at all.
- [ ] **Replace `alert()` on approve failure** (`page.tsx`, around line 133) with an inline error message, as the reject modal already does.
- [ ] **Backend contract check:** confirm the backend routes match `src/lib/api/expenses.ts`:
  `GET /expenses`, `GET /expenses/{id}`, `POST /expenses/{id}/approve`, `POST /expenses/{id}/reject`. The backend code is not in this repo, so check it there.
- [ ] **Receipt access:** `bill_photo_url` is shown in an `<img>` tag. Confirm the backend serves receipts only to authorized managers and admins (prevent IDOR, per CLAUDE.md), and that a direct link does not expose other employees' bills.
- [ ] **Claim submission:** the web client has no create-claim call. Decide whether employees submit claims from the Flutter app, and if so, add that flow and its API contract.
- [ ] **UI states:** check loading, empty, error, and success for the list, the detail view, approve, and reject (use the `ui-states` checklist).
- [ ] **Responsive layout:** check the KPI cards, filter bar, table, and receipt view on phone and tablet widths (use the `responsive-ui` checklist).
- [ ] **Tests:** add unit tests for the filter and KPI logic, an integration test with a mocked API for approve and reject, and one Playwright flow for review. Follow `feature-testing`.
- [ ] **Commit and docs:** commit the expense files on their own branch, and add the module to `docs/MODULES.md` and `CHANGELOG.md` when done.

### What we do not know yet

- [ ] Does the backend `/expenses` module exist and match these routes?
- [ ] Who may create a claim, and from which app?
- [ ] Are bill photos stored with access checks, or as public files?

### Suggested fix plan

1. Confirm the backend contract first (the cheapest check that can block everything else).
2. Add the sidebar link with role gating, and remove the `alert()`.
3. Check the receipt access rules with the backend.
4. Finish the UI states and responsive checks.
5. Add tests, then docs, then commit.

---

## 3. Tasks page: "Add New" button does nothing

**Status:** Open
**Area:** Web / Tasks (`src/components/tasks/TasksBoard.tsx`, around line 176-180; dialogs in `src/components/tasks/TaskDialogs.tsx`)
**Found:** 2026-10-24, manual check of the `/dashboard/tasks` page

### What we see

On the Tasks page, clicking the green **Add New** button in the header does not open anything. Nothing happens and no error is shown.

### Why it matters

Users cannot create a task from the Tasks page. The only visible path is to schedule a follow-up from a lead, which the empty state tells them to do.

### What we know (verified by reading the code)

- The button is a plain `<button type="button">` with no `onClick` prop, so clicking it runs no code.
- A search of `src/components/tasks/` finds no create-task dialog or handler. `TaskDialogs.tsx` only has the reschedule and edit-note flows.
- The empty-state text says "Schedule a follow-up from a lead and it shows up on its day." This suggests creation is meant to start from a lead, not from this page.

### What we do not know yet

- [ ] Should "Add New" create a standalone task, or only a follow-up linked to a lead? A task needs a `contact_id` to appear on the board (see the reschedule guard in `TasksBoard.tsx`), so a standalone task may not be possible with the current data model.
- [ ] Does the backend have a create-task or create-followup endpoint, and what does it require? The backend code is not in this repo.
- [ ] Was the button meant to link to the Contacts page (pick a lead first) instead of opening a dialog?

### Suggested fix plan

1. Decide the behavior with the product owner. Options: (a) open a "New follow-up" dialog that asks for a lead, date, and type; (b) send the user to the Contacts page to pick a lead; (c) hide the button until the flow exists.
2. Confirm the backend create endpoint and its request and response schema.
3. Build the chosen flow with loading, empty, error, and success states (use the `ui-states` checklist), then check phone and tablet layout (use `responsive-ui`).
4. Add a test that clicking the button opens the flow, plus one for a failed create.

### Quick fix if the flow is not ready

Until the flow exists, either hide the button or disable it with a tooltip ("Coming soon"), so users do not click a button that looks broken.

---

## Template for new items

```
## N. Short title

**Status:** Open
**Area:** Backend / Web / Flutter (file paths)
**Found:** YYYY-MM-DD, where it was seen

### What we see
### Why it matters
### What we know
### What we do not know yet
### Suggested fix plan
```
