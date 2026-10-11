# Ogera CRM — web

Next.js (App Router) front end for the Ogera CRM. It talks to the FastAPI backend in `../ogera_crm_backend`.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Set `NEXT_PUBLIC_API_BASE_URL` to the backend address (for example `http://127.0.0.1:8000`). The backend must be running.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:integration` | Integration tests |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run migrate` | Data migration script (`scripts/migrate.js`) |

## Layout

- `src/app/` — routes: login (`/`), `/contacts`, `/dashboard/*`
- `src/features/contacts/` — the Contacts screen: view, hooks, API calls and components
- `src/components/` — shared pieces, including `DashboardSidebar`
- `src/lib/api/` — API clients
- `docs/changes/` — change notes for each feature
- `CHANGELOG.md` — what changed, commit by commit

Project rules that shape the product are in `../rule.md`. Read them before building a feature.
