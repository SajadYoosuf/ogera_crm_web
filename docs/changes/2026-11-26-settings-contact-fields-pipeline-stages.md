# Settings: Contact Fields and Pipeline Stages tabs

## What changed

**New files:**
- `src/components/settings/ContactFieldsTab.tsx` — admin tab to add, rename, reorder, hide/show and configure dropdown options for contact profile field definitions (consumer, partner, dealer panels)
- `src/components/settings/PipelineStagesTab.tsx` — admin/manager tab to add, rename, reorder, hide/show and delete pipeline stages across Consumer, Partner and Dealer pipelines
- `src/features/settings/api/contactFieldsSettings.ts` — API calls: `listAllContactFields` (admin, includes inactive), `createContactField`, `updateContactField`
- `src/features/settings/api/pipelineSettings.ts` — API calls: `listAllPipelineStages`, `createPipelineStage`, `updatePipelineStage`, `deletePipelineStage`, `reorderPipelineStages`

**Modified:**
- `src/components/settings/SettingsView.tsx` — added `contact_fields` and `pipeline_stages` tabs; both gated on `module: "team"` (admin access)

## Access / data impact

- Contact Fields tab: reads `GET /contact-field-definitions/all` (admin-only new endpoint) and writes `POST /contact-field-definitions` and `PATCH /contact-field-definitions/by-id/{id}`. No schema migration needed.
- Pipeline Stages tab: reads/writes existing `/pipeline/stages/*` endpoints. No schema migration needed.

## Verification

- TypeScript: `npx tsc --noEmit` — clean
- ESLint: no errors in new files (pre-existing errors in LeadFollowupModal, AuthContext unrelated to this change)
- Build: `npm run build` — passes, all routes static-prerendered as before

## Known issues or not done yet

- Vitest unit tests not written for the new tabs
- Dealer contact fields require the backend to accept `entity_type=dealer` on `GET /contact-field-definitions/{entity_type}` (now fixed in the backend change note)
- Change note for backend: `docs/changes/2026-11-26-settings-contact-fields-pipeline-stages.md` in `ogera_crm_backend-leads/`
