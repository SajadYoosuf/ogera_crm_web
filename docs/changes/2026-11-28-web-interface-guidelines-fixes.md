# Web Interface Guidelines — responsive, state and stream fixes

## What changed

**Responsive layout (6 files)**
- `src/features/whatsapp-inbox/WhatsAppInboxView.tsx` — `h-screen` → `h-dvh`
- `src/features/contacts/components/BulkAssignModal.tsx` — `max-h-[90vh]` → `max-h-[90dvh]`
- `src/features/leads/components/BulkAssignModal.tsx` — `max-h-[90vh]` → `max-h-[90dvh]`
- `src/features/notifications/NotificationBell.tsx` — `max-h-[60vh]` → `max-h-[60dvh]`
- `src/app/dashboard/employees/page.tsx` (×2 dialogs) — `sm:max-h-[90vh]` → `sm:max-h-[90dvh]`

`dvh` (dynamic viewport height) shrinks when the mobile browser toolbar is visible; `vh` does not, causing modals and full-height panels to extend below the visible area on iOS/Android.

**State management (3 bugs fixed)**
- `src/context/AuthContext.tsx` — `pushRegistered.current` now resets to `false` in `clearSession()`. Previously a second user logging in on the same tab would never register their FCM token because the ref was never cleared.
- `src/hooks/useEnumOptions.ts` — module-level `Map` cache is now keyed by `${token}:${category}` (same pattern as `useFollowupSettings`). Previously a re-login as a different tenant could briefly show the previous tenant's dropdown labels.
- `src/features/notifications/stream.ts` — SSE stream now stops and dispatches `SESSION_EXPIRED_EVENT` on a 401 response instead of reconnecting infinitely. Import added from `@/lib/api/auth`.

**Test (1 fix)**
- `tests/dashboard/dashboard-view.test.tsx` — "signs the person out" test rewritten to match the current architecture: `DashboardView` no longer calls `clearSession` or `router.push` directly on 401; that path goes through `SESSION_EXPIRED_EVENT` → `AuthProvider` → `DashboardAuthGate`. Test now asserts the event is dispatched and no retry button appears.

## Access / data impact

No schema or API changes. The enum cache key change means all cached enum labels are invalidated on the next page load (they will be re-fetched once per session, same as before).

## Verification

- `npx tsc --noEmit` — 0 errors
- `npx vitest run tests/dashboard/dashboard-view.test.tsx` — 14/14 passed
- Responsive changes are visual (mobile browser toolbar); verified by code inspection

## Known issues / not done yet

Remaining findings from the Web Interface Guidelines audit (lower priority, no behaviour change):
- No `touch-action: manipulation` on interactive elements (double-tap zoom on mobile)
- No `overscroll-behavior: contain` on modal scroll areas
- Bare `outline-none` without `focus-visible` replacement in `globals.css` and several components
- `spellCheck={false}` missing on three email inputs
- `transition-all` on sidebar and a few buttons (should be specific properties)
- No `text-wrap: balance` on headings
- No `env(safe-area-inset-*)` for iPhone notch/home-bar
- No dark mode / `theme-color` meta
