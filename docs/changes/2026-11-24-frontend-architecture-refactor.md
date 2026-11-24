# Frontend Architecture Refactor — 2026-11-24

## Removed modules

Deleted all frontend code for 13 backend modules that no longer exist:
Firebase / push notifications, follow-up scheduling, activity logs (standalone),
attendance, expenses, products, sales, pipeline kanban, staff location tracking,
consumer profiles, performance dashboard, tasks & calendar, settings / enum config.

Kept: Auth, Employees, Roles / Branches, API Keys, Leads, Lead Sources,
Contacts, Contact Field Definitions.

---

## API layer

- Added `apiCall<T>(token, method, path, body?)` to `lib/api/auth.ts` — one shared
  authenticated fetch wrapper used by every module.
- Removed duplicated `call<T>()` / `authed<T>()` wrappers from `settings.ts`,
  `employees.ts`, and `interactions.ts`.
- Moved leads API from `lib/api/leads-module.ts` → `features/leads/api/leads.ts`
  so leads and contacts are structurally identical.
- Deleted stale re-export shims `lib/api/contacts.ts` and `lib/api/contactsIo.ts`.

---

## State management

- Installed Redux Toolkit + React-Redux.
- Created `store/` with `lookupsSlice` — caches employees, lead sources, and
  branches globally so they are fetched once per session, not once per modal.
- `clearSession()` dispatches `resetLookups()` and calls `invalidateEnumOptions()`
  on logout so a subsequent login for a different tenant starts clean.
- Added `Providers.tsx` wrapping Redux `<Provider>` around `<AuthProvider>`.

---

## Token access

`AuthContext` is now the only place that reads or writes `sessionStorage` for the
token. Removed all `sessionStorage.getItem("ogera_access_token")` calls from every
hook and component — replaced with `const { token } = useAuth()`.

Files updated: `useLeadsList`, `useLeadEditor`, `useLeadConvert`, `useContactsList`,
`useContactEditor`, `useContactLookups`, `useEnumOptions`, `LeadsView`,
`LeadModal`, `LeadDetailModal`, `LeadActivityLogModal`, `LeadFollowupModal`,
`WhatsAppButton`, both `BulkAssignModal` files, `AccountTab`.

`AccountTab.rememberProfile()` was deleted — profile saves now call
`setSession(token, { ...user, name, email })` so React state stays in sync.

---

## Routing

Moved `/contacts` and `/leads` under `/dashboard` so all authenticated pages
share one layout with the sidebar:

- `/dashboard/contacts` (was `/contacts`)
- `/dashboard/leads` (was `/leads`)
- `/dashboard/employees` (unchanged)

`dashboard/layout.tsx` now loads DM Sans once for all children.
Deleted the duplicate `contacts/layout.tsx` and `leads/layout.tsx`.

---

## Feature folder cleanup

- `components/followups/useActivityTypes.ts` deleted — both call sites now use
  `useEnumOptions("activity_type")` directly.
- `components/auth/OtpInput.tsx` → `features/auth/components/OtpInput.tsx`
- `hooks/useLogin.ts` → `features/auth/hooks/useLogin.ts`
- Deleted `components/AuthProvider.tsx` (redundant re-export shim).
