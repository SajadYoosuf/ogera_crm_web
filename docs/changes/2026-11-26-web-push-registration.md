# Web push: register the browser after sign-in

## What changed

- `src/lib/firebase.ts` (new): asks for notification permission, registers `public/firebase-messaging-sw.js` and
  returns this browser's FCM token. Returns `null` if push is unsupported, refused or fails.
- `src/context/AuthContext.tsx`: after sign-in (or a restored session) the token is requested once and sent to
  the backend.
- `src/features/notifications/api.ts`: `registerFcmToken()` posts to `POST /employees/me/fcm-token`.

## Access / data impact

- Every signed-in user is asked by the browser to allow notifications.
- Allowing it stores the device token against the employee in the backend.

## Verification

- `tsc --noEmit`: no errors. `npm run build`: compiled.
- `vitest run`: 188 passed, 1 failed (`tests/components/lead-settings-tabs.test.tsx`, in code not touched here).
- Not checked: the permission prompt, token registration or delivery of a push, in a browser.

## Known issues or not done yet

- The Firebase web config and VAPID public key are written into `src/lib/firebase.ts`. The
  `NEXT_PUBLIC_FIREBASE_*` variables in `.env.example` are not read.
- No tests for the registration.
- The token is not unregistered on sign-out.
- Registration runs once per page load, so a second account signing in without a reload is not registered.
- ESLint reports `react-hooks/set-state-in-effect` in `AuthContext.tsx`, on the session-restore effect, not on
  the new one.
