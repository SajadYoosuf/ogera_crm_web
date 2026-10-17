# Live end-to-end tests

These run the real backend and the real web app together (no browser stubs).

1. Backend, seeded throwaway SQLite database, port 8765:
   `cd ogera_crm_backend && python tests/e2e_server.py --port 8765`
2. Web app pointed at that backend, port 3100:
   `cd ogera_crm_web && NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8765 npx next dev --port 3100`
   (If a dev server already holds this folder, run from a copy of the folder.)
3. `cd ogera_crm_web && npx playwright test -c playwright.live.config.ts`

Env: `LIVE_API_URL` (default http://127.0.0.1:8765), `LIVE_WEB_URL` (default http://localhost:3100).
