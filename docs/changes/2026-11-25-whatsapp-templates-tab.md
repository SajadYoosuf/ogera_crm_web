# 2026-11-25 — Settings → WhatsApp Templates tab

Web side of the template engine (backend: `ogera_crm_backend-leads/docs/changes/2026-11-25-whatsapp-templates.md`).

## Added
- `src/features/whatsapp/api/templates.ts` — client for `/whatsapp/templates`, types, Meta's limits, `variableIndices` / `fillSamples`.
- `src/components/settings/TemplatesTab.tsx` — list with status badges, quality dot, filter chips, search, Sync from Meta,
  Send to Meta, Edit, Delete (asks first, says when it also deletes on Meta). Meta's rejection reason and last error are shown.
- `src/components/settings/TemplateEditor.tsx` — form (name, language, category, header, body with Add variable, sample values,
  footer, buttons) and a live WhatsApp-style preview. "Save draft", "Save and send to Meta"; a submitted template shows
  "Save and resubmit to Meta" with a warning, and its name and language are locked.
- `SettingsView.tsx` — "WhatsApp Templates" tab (`integrations` read).
- `tests/components/whatsapp-templates-tab.test.tsx` — 17 tests.

## Behaviour
- Meta's rules are checked by the server; its one-sentence answer is shown above the form.
- The form keeps names in Meta's format, shows counters at each limit, and gives one sample box per variable.
- Read-only without `integrations` update: no New, Sync, Send, Edit or Delete.

## Not done yet
- Media header upload (the form takes a sample link), and the template picker in the lead inbox.
