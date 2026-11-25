# 2026-11-25 — Settings → WhatsApp tab

Web side of the WhatsApp connection settings (backend: `ogera_crm_backend-leads/docs/changes/2026-11-25-whatsapp-connection-settings.md`).

## Added
- `src/features/whatsapp/api/config.ts` — client for `/whatsapp/config` (get, save, test, subscribe, rotate verify token, disconnect).
- `src/components/settings/WhatsAppTab.tsx` — three panels: Connection (status, test, subscribe, disconnect), Credentials (phone number ID, WABA ID, access token, app secret, app ID, business ID, API version), Webhook (callback URL and verify token with copy buttons).
- `SettingsView.tsx` — new "WhatsApp" tab, shown to anyone with `integrations` read.
- `tests/components/whatsapp-tab.test.tsx` — 10 tests.

## Behaviour
- The access token and app secret are write-only. Their inputs start empty; a blank value keeps the saved one, and the placeholder shows the masked hint.
- Saving needs both IDs as digits and, on first save, the access token.
- Saving, testing, subscribing, rotating and disconnecting need `integrations` update; read-only users see disabled fields and no action buttons.
- Disconnect and "Generate a new verify token" ask for confirmation first.

## Known, not from this change
- `SECTIONS` in `SettingsView.tsx` has `key: "role permissions"` for the staff tab, which is not in `SettingsTabKey` (tsc error), so the Team tab never renders, and `tests/components/lead-settings-tabs.test.tsx` "Settings tab visibility" fails on it (expects `"team"`).
