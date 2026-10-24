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
