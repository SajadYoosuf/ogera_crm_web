# Notification bell: live stream instead of polling

## What changed
- `src/features/notifications/stream.ts` (new): `subscribeNotificationStream()` opens `GET /notifications/stream` with fetch and the Authorization header, reads server-sent events, and calls back on each `notification` event. It reconnects with backoff (1 s doubling to 30 s) and reloads the list on every (re)connect.
- `src/features/notifications/NotificationBell.tsx`: removed the 60 s / 30 s timer and visibility/focus refresh. The bell loads once on mount, then refreshes on each pushed notification.

## Access / data impact
- None on permissions. The stream uses the signed-in user's token.

## Verification
- `npx tsc --noEmit`, `npx eslint src/features/notifications/`: pass.
- `npx vitest run tests/components/notification-bell.test.tsx`: 7 pass. These tests do not exercise the stream itself.
- Not run: a live check that a backend notification appears in the open bell without a click.

## Known issues or not done yet
- The notification feature files (bell, api, stream) are still untracked in this repo and need committing.
