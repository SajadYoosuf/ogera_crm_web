# Frontend modules

The Next.js web app, module by module. Each guide lists its files, what they do and how they behave. The API each module calls is in the root `API.md`; the backend side of each module is in `ogera_crm_backend/docs/modules/`.

## Current modules

| Module | Guide | Screen (route) | Main folders |
| --- | --- | --- | --- |
| Sign in and forgot password | [FRONTEND_AUTHENTICATION.md](FRONTEND_AUTHENTICATION.md) | `/`, `/forgot-password` | `src/app/page.tsx`, `src/app/forgot-password/`, `src/lib/api/auth.ts`, `src/lib/api/password-reset.ts` |
| Contacts | [CONTACTS.md](CONTACTS.md) | `/contacts` | `src/features/contacts/` |
| Employees | [EMPLOYEE_MANAGEMENT.md](EMPLOYEE_MANAGEMENT.md) | `/dashboard/employees` | `src/app/dashboard/employees/`, `src/lib/api/employees.ts` |
| Lead pipeline: board, lead panel, follow-ups, activity log, history | [LEAD_PIPELINE.md](LEAD_PIPELINE.md) | `/dashboard/followups` | `src/components/followups/`, `src/lib/api/activities.ts`, `src/lib/api/leads.ts` |
| Tasks | [TASKS.md](TASKS.md) | `/dashboard/tasks` | `src/components/tasks/`, `src/lib/api/tasks.ts` |
| Settings (dropdown lists, stages, company) | (in `src/app/dashboard/settings/`) | `/dashboard/settings` | `src/lib/api/settings.ts`, `src/hooks/useEnumOptions.ts` |
| Dashboard shell and navigation | (in `src/components/DashboardSidebar.tsx`) | every `/dashboard` screen | `src/app/dashboard/layout.tsx` |

## Removed modules

Rule 9 in `rule.md` removes the performance dashboard, sales ledger, products catalogue and field map from the web app as well. Their screens and API calls are gone from `src/`.

## Shared pieces

| Piece | File | Used by |
| --- | --- | --- |
| Request helper, error messages, offline and timeout handling | `src/lib/api/auth.ts` (`request`, `ApiError`) | every API call |
| Modal frame (Escape and backdrop close; `noValidate` so our own messages show) | `src/components/followups/ModalShell.tsx` | activity log, schedule, task dialogs |
| Design tokens for modals and buttons | `src/components/followups/designTokens.ts` | modals, lead panel |
| Dropdown options from Settings | `src/hooks/useEnumOptions.ts` | activity types everywhere |
| Date helpers | `src/components/followups/activities.ts` | lead pipeline and tasks |

## Testing

See [TESTING.md](TESTING.md): unit tests (Vitest), the live end-to-end suite, and the responsive checks.
