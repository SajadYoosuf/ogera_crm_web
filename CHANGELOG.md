# Changelog

## 2026-10-23 — `4c918e0` (branch `version1`)

**feat(pipeline): Sprint 1 — task system redesign + bug fixes**

Author: sajad yoosuf
Previous commit on this side: `4a400c9` feat(web/pipeline): redesign toolbar and add-lead modal (2026-10-23)

### Summary
Cleans up the Schedule Followup form (priority field, auto-title from type) and removes dead date/time/loggedBy fields from ActivityLogForm. Adds meeting and email icons and colour tiles. See `docs/changes/2026-10-23-sprint1-pipeline-tasks.md`. Backend changes are in the same commit.

### Files
| Status | File | Change |
| --- | --- | --- |
| Added | `docs/changes/2026-10-23-sprint1-pipeline-tasks.md` | Change notes |
| Modified | `src/components/followups/ActivityIcons.tsx` | Add meeting (calendar) and email (envelope) icons |
| Modified | `src/components/followups/ActivityLogForm.tsx` | Remove dead date/time/loggedBy fields |
| Modified | `src/components/followups/FollowupScheduleForm.tsx` | Add priority radio, auto-title from type selection |
| Modified | `src/components/followups/designTokens.ts` | Add ACTIVITY_TILE tiles for meeting and email |
| Modified | `src/lib/api/activities.ts` | Add priority to ScheduleInput; coordinates to LogActivityInput |

### Notes
Backend (models, routes, schemas, migration) is in the same commit `4c918e0`.

---

## 2026-10-22 — `fce4d1f` (branch `phase1-redesign`)

**feat: house stage and tank type lists move to Settings**

Author: sajad yoosuf
Previous commit on this side: `99ee473` docs: update changelog for 38b0d3d (2026-10-18)

### Summary
House stages and tank types appear in Settings > Lists & Options, and the contact form's house stage dropdown reads that list and sends the stored value. Before this, the form sent labels the backend rejected (422). Notes: [docs/changes/2026-10-22-house-stage-tank-type-settings.md](docs/changes/2026-10-22-house-stage-tank-type-settings.md).

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/lib/api/settings.ts` | `house_stage` and `tank_type` added to `ENUM_CATEGORIES` |
| Modified | `src/components/settings/EnumsTab.tsx` | A hint for each new list |
| Modified | `src/features/contacts/hooks/useContactLookups.ts` | Loads house stages with `useEnumOptions`, with a default list until they load |
| Modified | `src/features/contacts/utils.ts` | `DEFAULT_HOUSE_STAGES` fallback |
| Modified | `src/features/contacts/ContactsView.tsx` | House stage dropdown from Settings; a hidden value stays selectable on its record; the "Construction phase" dropdown removed (never saved) |
| Added | `docs/changes/2026-10-22-house-stage-tank-type-settings.md` | Change notes |

### Notes
- Type-check and lint: no new errors. No tank type field on the web form yet.
- The same commit touched backend and mobile.

## 2026-10-18 — `38b0d3d` (branch `phase1-redesign`)

**feat(web): Settings page and sidebar entry**

Previous commit on this side: `26c4ea7` docs: update changelog for 649b40f

### Summary
Adds the Settings page with its tabs and a Settings item in the sidebar footer. Everyone signed in sees My account. Admin and manager also see General, Lists & Options, Roles & Permissions and Team.

### Files
| Status | File | Lines |
| --- | --- | --- |
| New | `src/app/dashboard/settings/page.tsx` | see commit |
| Modified | `src/components/DashboardSidebar.tsx` | see commit |

### Notes
The backend settings endpoints this page calls are not committed yet.

---

## 2026-10-18 — `649b40f` (branch `phase1-redesign`)

**feat(web): Team settings tab**

Previous commit on this side: `6a9bf07` docs: update changelog for a6f2ed0

### Summary
Lists staff with their role and team lead. The view switch shows All or Team leads. The "No team lead" tab and the Invite button are removed. Each person's team lead is still picked from a dropdown, which keeps a "No team lead" option to unlink them.

### Files
| Status | File | Lines |
| --- | --- | --- |
| New | `src/components/settings/TeamTab.tsx` | see commit |
| New | `tests/components/team-tab.test.tsx` | see commit |

---

## 2026-10-18 — `a6f2ed0` (branch `phase1-redesign`)

**feat(web): Roles & Permissions settings tab**

Previous commit on this side: `e575207` docs: update changelog for 1b8cca7

### Summary
Grid of each role's access to each action. Clicking an editable cell opens a menu of the six levels. Full and No access can be chosen and turn the action on or off. The other four are dimmed as "set by the app", because record visibility is fixed by rule 7. Admin can add, rename and switch off roles.

### Files
| Status | File | Lines |
| --- | --- | --- |
| New | `src/components/settings/RolesTab.tsx` | see commit |
| New | `tests/components/settings-tabs.test.tsx` | see commit |

---

## 2026-10-18 — `1b8cca7` (branch `phase1-redesign`)

**feat(web): Lists & Options settings tab**

Previous commit on this side: `3cc103f` docs: update changelog for 4c8a999

### Summary
Admin and manager rename, reorder, hide and add dropdown values for lead sources, lead stages (per contact type), activity types, loss reasons, partner types and districts. Locked options can be renamed but not turned off. Districts are still listed; removing them is not decided yet.

### Files
| Status | File | Lines |
| --- | --- | --- |
| New | `src/components/settings/EnumsTab.tsx` | see commit |
| New | `tests/components/enums-activity-types.test.tsx` | see commit |

---

## 2026-10-18 — `4c8a999` (branch `phase1-redesign`)

**feat(web): My account and General settings tabs**

Previous commit on this side: `a0824a6` feat(web): settings API client and shared settings UI

### Summary
My account lets every signed-in user change their name, email and password. General lets admin and manager edit the company name and logo.

### Files
| Status | File | Lines |
| --- | --- | --- |
| New | `src/components/settings/AccountTab.tsx` | see commit |
| New | `src/components/settings/GeneralTab.tsx` | see commit |

---

## 2026-10-18 — `a0824a6` (branch `phase1-redesign`)

**feat(web): settings API client and shared settings UI**

Previous commit on this side: `0a9aa84` fix: clear stored localhost:8000 backend addresses on load

### Summary
Adds the web client for the settings endpoints (enum options, company, permission matrix, roles, my account) and the shared panel, button, notice and error pieces the Settings tabs use. The Settings page is not linked from the sidebar until its own commit lands.

### Files
| Status | File | Lines |
| --- | --- | --- |
| Modified | `src/lib/api/settings.ts` | see commit |
| New | `src/components/settings/ui.tsx` | see commit |

---

## 2026-10-18 — `0a9aa84` (branch `phase1-redesign`)

**fix: clear stored localhost:8000 backend addresses on load**

Author: sajad yoosuf
Previous commit on this side: `81a5625` docs: update changelog for 5d7f4fc

### Summary
On each page load the web app removes any localStorage or sessionStorage entry whose value points at localhost:8000 or 127.0.0.1:8000, so a stale local-dev address cannot keep sending requests to the old backend. Storage errors are ignored.

### Files
| Status | File | Lines |
| --- | --- | --- |
| Modified | `src/lib/api/auth.ts` | +20 / -0 |

### Notes
Restart `next dev` after changing `.env.local` so the new NEXT_PUBLIC_API_BASE_URL is picked up. Not yet type-checked: TypeScript is not installed in this checkout.

## 2026-10-18 — `5d7f4fc` (branch `phase1-redesign`)

**fix: production URLs instead of localhost defaults**

Author: sajad yoosuf
Previous commit on this side: `1a09ad3` fix: remove Settings enum test that imports an uncommitted component

### Summary
API_BASE_URL falls back to https://ogera-crm.onrender.com when NEXT_PUBLIC_API_BASE_URL is not set at build time.

### Files
| Status | File | Lines |
| --- | --- | --- |
| Modified | `src/lib/api/auth.ts` | +2 / -2 |

### Notes
Local .env.local still sets NEXT_PUBLIC_API_BASE_URL for development. The Vercel build must have the variable set or uses this fallback.

## 2026-10-18 — `c0ab4a4` (branch `phase1-redesign`)

**fix: Add employee dialog fits phone screens**

Author: sajad yoosuf
Previous commit on this side: `f61673e` docs: update changelog for e377589

### Summary
The Add employee dialog now uses the full viewport height on phones, so its field list scrolls and the Add employee button stays visible at 280px and 320px.

### Files
| Status | File | Lines |
| --- | --- | --- |
| Modified | `src/app/dashboard/employees/page.tsx` | +1 / -1 |

### Notes
Fixes the two failures recorded in e377589. Responsive audit after this change: 182 passed, 0 failed. employees.spec.ts: 64 passed. Tablet and desktop layout unchanged.

## 2026-10-18 — `e377589` (branch `phase1-redesign`)

**feat: design system, design tokens and responsive audit**

Author: sajad yoosuf
Previous commit on this side: `2d48eca` docs: update changelog for the commits from 946afa4 to 9cfef38

### Summary
Adds the design system README and tokens.json, the Playwright responsive audit, and the responsive-preflight and frontend-design skills.

### Files
| Status | File | Lines |
| --- | --- | --- |
| Added | `README_DESIGN_SYSTEM.md` | +50 / -0 |
| Added | `e2e/responsive.spec.ts` | +199 / -0 |
| Added | `tokens.json` | +112 / -0 |

### Notes
Responsive audit run before commit: 180 passed, 2 failed. The failures are the Add employee dialog at 280px (Galaxy Fold) and 320px (small phone): the dialog does not fit. Not yet fixed.

## 2026-10-18 — `863c40c` (branch `phase1-redesign`)

**feat: pipeline, contacts, team and enum-driven web updates**

Author: sajad yoosuf
Previous commit on this side: `eb13d6d` feat: forgot-password flow on the web with 6-digit email code

### Summary
Updates the lead pipeline, follow-up board, contacts list and menus for the three contact types and the role-scoped views; dropdowns read enum options through useEnumOptions.

### Files
| Status | File | Lines |
| --- | --- | --- |
| Modified | `e2e/employees.spec.ts` | +23 / -29 |
| Modified | `src/app/contacts/layout.tsx` | +1 / -1 |
| Modified | `src/app/dashboard/employees/page.tsx` | +28 / -3 |
| Modified | `src/app/dashboard/layout.tsx` | +1 / -1 |
| Modified | `src/app/dashboard/professionals/page.tsx` | +14 / -14 |
| Modified | `src/app/globals.css` | +195 / -0 |
| Modified | `src/app/page.tsx` | +7 / -6 |
| Modified | `src/components/DatePicker.tsx` | +4 / -4 |
| Modified | `src/components/DateRangePicker.tsx` | +29 / -14 |
| Modified | `src/components/FilterPanel.tsx` | +1 / -1 |
| Modified | `src/components/FilterSelect.tsx` | +3 / -1 |
| Modified | `src/components/PhoneField.tsx` | +2 / -2 |
| Modified | `src/components/SchedulePickers.tsx` | +3 / -3 |
| Modified | `src/components/SearchPicker.tsx` | +1 / -1 |
| Modified | `src/components/SelectField.tsx` | +5 / -3 |
| Modified | `src/components/followups/ActivityList.tsx` | +59 / -37 |
| Modified | `src/components/followups/ActivityLogForm.tsx` | +91 / -28 |
| Modified | `src/components/followups/FollowupBoard.tsx` | +38 / -38 |
| Modified | `src/components/followups/LeadPanel.tsx` | +229 / -162 |
| Modified | `src/components/followups/OutcomeForm.tsx` | +2 / -2 |
| Modified | `src/components/followups/UnverifiedDialog.tsx` | +2 / -2 |
| Added | `src/components/followups/designTokens.ts` | +130 / -0 |
| Added | `src/components/followups/useActivityTypes.ts` | +22 / -0 |
| Modified | `src/components/followups/useStages.ts` | +25 / -36 |
| Modified | `src/features/contacts/ContactsView.tsx` | +4 / -3 |
| Modified | `src/features/contacts/api/contacts.ts` | +1 / -1 |
| Modified | `src/features/contacts/api/contactsIo.ts` | +35 / -4 |
| Modified | `src/features/contacts/components/ContactExportModal.tsx` | +3 / -3 |
| Modified | `src/features/contacts/components/ContactsFilterMenu.tsx` | +5 / -3 |
| Modified | `src/features/contacts/components/ContactsMoreMenu.tsx` | +15 / -10 |
| Modified | `src/features/contacts/components/ContactsSortMenu.tsx` | +3 / -1 |
| Modified | `src/features/contacts/components/VerifiedBadge.tsx` | +1 / -1 |
| Modified | `src/features/contacts/utils.ts` | +1 / -1 |
| Added | `src/hooks/useEnumOptions.ts` | +58 / -0 |
| Added | `src/hooks/usePopoverFit.ts` | +25 / -0 |
| Modified | `src/lib/api/employees.ts` | +13 / -2 |
| Added | `src/lib/api/settings.ts` | +93 / -0 |
| Added | `src/lib/permissions.ts` | +22 / -0 |
| Modified | `tests/components/followup-board.test.tsx` | +40 / -0 |
| Added | `tests/components/settings-enums.test.tsx` | +105 / -0 |
| Modified | `tests/followups/activities.test.ts` | +4 / -9 |

### Notes
The settings pages (app/dashboard/settings, components/settings) are not in this commit; they are phase 2. Type-check: `tsc --noEmit` exits 0.

## 2026-10-18 — `eb13d6d` (branch `phase1-redesign`)

**feat: forgot-password flow on the web with 6-digit email code**

Author: sajad yoosuf
Previous commit on this side: `0cac251` feat: products catalogue reinstated with a modal editor

### Summary
Adds the /forgot-password page with the OTP input, the shared password rules and the matching API client.

### Files
| Status | File | Lines |
| --- | --- | --- |
| Modified | `docs/FRONTEND_AUTHENTICATION.md` | +11 / -24 |
| Added | `e2e/forgot-password.spec.ts` | +209 / -0 |
| Added | `src/app/forgot-password/page.tsx` | +366 / -0 |
| Added | `src/components/auth/OtpInput.tsx` | +84 / -0 |
| Modified | `src/lib/api/auth.ts` | +6 / -1 |
| Added | `src/lib/api/password-reset.ts` | +34 / -0 |
| Added | `src/lib/auth-fonts.ts` | +6 / -0 |
| Added | `src/lib/password-rules.ts` | +20 / -0 |
| Added | `tests/components/otp-input.test.tsx` | +48 / -0 |
| Added | `tests/lib/password-rules.test.ts` | +23 / -0 |

### Notes
The backend reset routes were already in place. Unknown or inactive emails get the same 404 as the backend and no email (rule.md section 4). Tests: otp-input and password-rules unit tests, forgot-password e2e spec.

## 2026-10-18 — `0cac251` (branch `phase1-redesign`)

**feat: products catalogue reinstated with a modal editor**

Author: sajad yoosuf
Previous commit on this side: `946afa4` refactor: remove retired modules and superseded files (rule 9)

### Summary
Products list with a modal for view/edit and Add New Product; uses the shared PageHeader.

### Files
| Status | File | Lines |
| --- | --- | --- |
| Added | `docs/changes/2026-10-17-products-reinstated.md` | +20 / -0 |
| Modified | `src/app/dashboard/products/page.tsx` | +324 / -138 |
| Added | `src/components/PageHeader.tsx` | +27 / -0 |
| Added | `src/components/products/ProductModal.tsx` | +479 / -0 |
| Modified | `src/lib/api/products.ts` | +43 / -16 |

### Notes
Notes: docs/changes/2026-10-17-products-reinstated.md. Mobile has no products screen yet (rule 9).

## 2026-10-18 — `946afa4` (branch `phase1-redesign`)

**refactor: remove retired modules and superseded files (rule 9)**

Author: sajad yoosuf
Previous commit on this side: `3ac224a` docs: changelog for 7da9092 (home dashboard)

### Summary
Removes the field map, performance page and staff location UI, and the old product detail/new pages and sales ledger components that the current design replaces.

### Files
| Status | File | Lines |
| --- | --- | --- |
| Deleted | `docs/CONTACT_INTAKE.md` | +0 / -154 |
| Deleted | `docs/CONTACT_MAP.md` | +0 / -217 |
| Deleted | `docs/DB_CONNECTION_RESILIENCE.md` | +0 / -103 |
| Deleted | `docs/PHONE_VALIDATION.md` | +0 / -104 |
| Deleted | `docs/PROFESSIONALS.md` | +0 / -176 |
| Deleted | `docs/SALES_LEDGER.md` | +0 / -296 |
| Deleted | `docs/changes/2026-10-02-contacts-redesign-api.md` | +0 / -21 |
| Deleted | `docs/changes/2026-10-05-contact-verification.md` | +0 / -14 |
| Deleted | `docs/changes/2026-10-05-lead-activities.md` | +0 / -16 |
| Deleted | `docs/changes/2026-10-05-lead-followup-board.md` | +0 / -20 |
| Deleted | `docs/changes/2026-10-06-activity-followup-schedule.md` | +0 / -34 |
| Deleted | `docs/changes/2026-10-06-offline-location-on-create.md` | +0 / -14 |
| Deleted | `docs/changes/2026-10-08-contact-import-export.md` | +0 / -22 |
| Deleted | `docs/changes/2026-10-08-partner-profession-type.md` | +0 / -14 |
| Deleted | `docs/changes/2026-10-09-performance-dashboard.md` | +0 / -21 |
| Deleted | `docs/changes/2026-10-09-products.md` | +0 / -16 |
| Deleted | `docs/changes/2026-10-09-sales-page.md` | +0 / -16 |
| Deleted | `docs/changes/2026-10-09-sales-product-link.md` | +0 / -15 |
| Deleted | `docs/changes/2026-10-09-tasks-calendar-outcome.md` | +0 / -24 |
| Deleted | `docs/changes/2026-10-12-contacts-redesign.md` | +0 / -20 |
| Deleted | `docs/image.png` | +- / -- |
| Deleted | `docs/location-tracking-test-checklist.md` | +0 / -350 |
| Deleted | `docs/staff-live-location-redesign-checklist.md` | +0 / -42 |
| Deleted | `src/app/dashboard/map/page.tsx` | +0 / -11 |
| Deleted | `src/app/dashboard/performance/page.tsx` | +0 / -331 |
| Deleted | `src/app/dashboard/products/[id]/page.tsx` | +0 / -11 |
| Deleted | `src/app/dashboard/products/new/page.tsx` | +0 / -7 |
| Modified | `src/components/DashboardSidebar.tsx` | +17 / -13 |
| Deleted | `src/components/MapWorkspace.tsx` | +0 / -7 |
| Deleted | `src/components/MapWorkspaceLoader.tsx` | +0 / -10 |
| Deleted | `src/components/SaleDetailModal.tsx` | +0 / -225 |
| Deleted | `src/components/SaleEditorDrawer.tsx` | +0 / -308 |
| Deleted | `src/components/StaffLiveMap.tsx` | +0 / -570 |
| Deleted | `src/components/products/PageHeader.tsx` | +0 / -23 |
| Deleted | `src/components/products/ProductForm.tsx` | +0 / -378 |
| Deleted | `src/lib/api/performance.ts` | +0 / -42 |
| Deleted | `src/lib/api/staff-locations.ts` | +0 / -42 |
| Deleted | `src/lib/location.ts` | +0 / -63 |
| Deleted | `src/lib/saleTypes.ts` | +0 / -73 |
| Deleted | `src/lib/salesExport.ts` | +0 / -116 |
| Deleted | `tests/components/performance-page.test.tsx` | +0 / -405 |
| Deleted | `tests/components/sale-form-modal.test.tsx` | +0 / -42 |
| Deleted | `tests/components/sales-page.test.tsx` | +0 / -50 |
| Deleted | `tests/components/staff-live-map.test.tsx` | +0 / -207 |

### Notes
Products are edited in a modal (ProductModal) and the sales register is a separate page; nothing in the build imports the removed files (checked with grep and `tsc --noEmit`, exit 0).

## 2026-10-17 — `7da9092` (branch `phase1-redesign`)

**Home dashboard summary API and IST business clock**

Author: sajad yoosuf
Previous commit on this side: `0e893bd` Lead actions from the Tasks screen, reschedule history, live e2e tests (2026-10-17)

### Summary
New `GET /dashboard/summary?range=today|7d|30d|month|all` returns the home dashboard's numbers and lists in one call: KPIs with change from the previous period, leads by current stage, today's and overdue follow-ups, and recent leads. Scope matches Contacts and Tasks.

Follow-up validation, Tasks "today", retry dates, activity dates, contact import and the contact date filter now use IST through `business_time.py`, not the server clock.

## 2026-10-17 — `6578d3a` (branch `phase1-redesign`)

**Task status tabs To do, In Progress, Completed on the Tasks page**

Author: sajad yoosuf
Previous commit on this side: `58d4e9b` Add Other to activity type list (2026-10-16)

### Summary
Tasks navbar, toolbar and list follow the Tasks design. The status tabs are All, To do, In Progress and Completed; the page opens on To do. The table keeps its header when empty, and the Filter menu adds Dealer to Lead type.

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/components/tasks/TasksBoard.tsx` | Navbar, toolbar with status tabs, search and Filter menu, list states |
| Added | `src/components/tasks/TaskTable.tsx` | Table with Task Title, Assigned, Task Type, Status, Due Date; empty row |
| Modified | `src/components/tasks/TaskCard.tsx` | Status pill colours and button styles |
| Deleted | `src/components/tasks/TaskViews.tsx` | Day/Week/Month calendar views, replaced by the flat list |
| Modified | `src/components/tasks/calendar.ts` | Custom range and no-limit range helpers |
| Modified | `src/app/dashboard/tasks/page.tsx` | DM Sans and Sora on the Tasks route |
| Modified | `src/lib/api/tasks.ts` | `TaskStatus` is todo, inprogress, completed, all; `contactType` accepts dealer |
| Modified | `tests/components/tasks-board.test.tsx` | Tests for the new tabs and Filter menu |

### Notes
Tab counts are off: the summary does not yet include To do or In Progress counts. Overdue still shows on each row as a status pill. Not browser-checked yet.

## 2026-10-12 — `c944450` (branch `phase1-redesign`)

**Redesign the Contacts page to the design and add Sort by**

Author: sajad yoosuf
Previous commit on this side: `a0574d5` Redesign login page to match the Login design (2026-10-12)

### Summary
Contacts page and sidebar follow the Contacts design: sticky header, type tabs with counts, search, Sort by and Filter, the monitoring table, and numbered pagination. Status is only Verified or Unverified. Notes: `docs/changes/2026-10-12-contacts-redesign.md`.

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/features/contacts/ContactsView.tsx` | Design layout: header, toolbar, table, cards, pagination |
| Added | `src/features/contacts/components/ContactRowMenu.tsx` | Row "…" menu with Edit and Delete, fixed-positioned |
| Added | `src/features/contacts/components/ContactsSortMenu.tsx` | Sort by menu: newest, oldest, name A–Z, name Z–A |
| Modified | `src/features/contacts/components/VerifiedBadge.tsx` | Verified / Unverified pill in the design colours |
| Modified | `src/features/contacts/components/ContactsMoreMenu.tsx`, `ContactsFilterMenu.tsx` | Import / Export and Filter buttons at design size |
| Modified | `src/features/contacts/hooks/useContactsList.ts` | Sort state; per-type totals for the tab counts |
| Modified | `src/features/contacts/api/contacts.ts` | `sort` parameter; `ContactSort` type |
| Modified | `src/features/contacts/utils.ts` | Page size 10; "All Contacts" tab label |
| Modified | `src/app/contacts/layout.tsx` | DM Sans for the Contacts route |
| Modified | `src/components/DashboardSidebar.tsx` | Account block, design icons, Settings and Log out at the bottom |

### Notes
Needs the backend `sort` parameter (same commit). Assignee picker no longer lists admins or managers (rule 1). Not browser-checked yet.

## 2026-10-12 — `a0574d5` (branch `phase1-redesign`)

**Redesign login page to match the Login design**

Author: sajad yoosuf
Previous commit on this side: `ea8fee6` Redesign the contacts page and move it into a contacts feature (2026-10-10)

### Summary
Login page rebuilt to the Login design, with the Ogera login logo and DM Sans. Notes: none written for this commit.

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/app/page.tsx` | Login layout, Malayalam mode, fields and states |
| Modified | `src/app/globals.css` | Login design tokens and styles |
| Modified | `src/app/layout.tsx` | Font setup |
| Added | `public/images/ogera-login-logo.png` | Login logo |
| Modified | `e2e/login.spec.ts` | Selectors updated for the new page |

### Notes
Not browser-checked against the design yet.

## 2026-10-09 — `a207130` (branch `phase1`)

**Add Tasks screen (day, week, month) and require an outcome when a follow-up is done**

Author: sajad yoosuf
Previous commit on this side: `99798ab` docs: update changelog for addee71 (2026-10-09)

### Summary
New Tasks screen with day, week and month views and an employee filter for managers, and an outcome form when a follow-up is marked done. Notes: `docs/changes/2026-10-09-tasks-calendar-outcome.md`.

### Files
| Status | File | Change |
| --- | --- | --- |
| Added | `src/app/dashboard/tasks/page.tsx` | The `/dashboard/tasks` route |
| Added | `src/components/tasks/TasksBoard.tsx` | Toolbar, filters, summary, loading / empty / error states |
| Added | `src/components/tasks/TaskViews.tsx` | Day, week and month views |
| Added | `src/components/tasks/TaskCard.tsx` | Task card with call, WhatsApp, mark done and reschedule |
| Added | `src/components/tasks/calendar.ts` | Date range maths |
| Added | `src/components/followups/OutcomeForm.tsx` | "What happened?" form, text required |
| Modified | `src/components/followups/ActivityList.tsx`, `LeadPanel.tsx` | Mark Done asks for the outcome; same-day overdue label |
| Modified | `src/components/DashboardSidebar.tsx` | "Tasks" menu item for every role |
| Added | `src/lib/api/tasks.ts` | `listTasks` |
| Modified | `src/lib/api/activities.ts` | `markFollowupDone` takes the outcome; `task_id` |
| Added/Modified | `tests/tasks/calendar.test.ts`, `tests/components/tasks-board.test.tsx`, `lead-activity.test.tsx` | Tests |
| Added | `docs/changes/2026-10-09-tasks-calendar-outcome.md` | Change notes |

### Notes
Needs the backend migration. Filters are not kept in the URL yet. The 17 `staff-live-map` test failures are not from this change. The same commit changed the backend.

## 2026-10-09 — `addee71` (branch `phase1`)

**Add contact import and export (CSV, Excel, PDF) for backend and web**

Author: sajad yoosuf
Previous commit on this side: `d26872d` docs: update changelog for a47a286 (2026-10-08)

### Summary
Import and Export buttons on the contacts page open modals to import a sheet and download filtered lists. Notes: `docs/changes/2026-10-08-contact-import-export.md`.

### Files
| Status | File | Change |
| --- | --- | --- |
| Added | `docs/changes/2026-10-08-contact-import-export.md` | Change notes |
| Modified | `src/app/contacts/page.tsx` | Import (admin/manager) and Export buttons, modals, plus responsive table/card breakpoints |
| Added | `src/components/ContactExportModal.tsx` | Date range, type, source and format picker |
| Added | `src/components/ContactImportModal.tsx` | File, column review, problem rows, import rules |
| Modified | `src/components/DateRangePicker.tsx` | New `bare` prop |
| Modified | `src/lib/api/contacts.ts` | `created_from`/`created_to` on `listContacts` |
| Added | `src/lib/api/contactsIo.ts` | Import/export API helpers |
| Added | `tests/components/contact-import-export.test.tsx` | 7 tests |

### Notes
Needs the backend routes from the same commit. Mobile not included.

## 2026-10-08 — `a47a286` (branch `phase1`)

**Add partner profession type enum and partner type picker in contact form**

Author: sajad yoosuf
Previous commit on this side: `03f8934` Log the API base URL and failed API calls in the browser console (2026-10-07)

### Summary
The add/edit contact form has a required Partner type select, fed by the backend list. Notes: `docs/changes/2026-10-08-partner-profession-type.md`.

### Files
| Status | File | Change |
| --- | --- | --- |
| Added | `docs/changes/2026-10-08-partner-profession-type.md` | Change notes |
| Modified | `src/app/contacts/page.tsx` | Partner type select (required for partners), sent as `partner_profile.profession_type`; filter and badges use backend values and labels |
| Modified | `src/lib/api/contacts.ts` | `listProfessionTypes()` and `partner_profile` on the contact types |

### Notes
Needs the backend change from the same commit (`GET /contacts/profession-types`, `partner_profile` on create/update). Falls back to a built-in list of the six types if that request fails.

## 2026-10-07 — `4914a08`..`cc64a9e` (branch `phase1`)

**Lead Followup page (replaces Sales Followup), lead panel with activity log and follow-up tasks, new pickers, tests**

Author: sajad yoosuf
Previous commit on this side: `48b3df0` Add verified / unverified filter to contacts (2026-10-05)

### Summary
The old board called an API that does not exist; it is rebuilt over consumer contacts with the agreed stages. Notes: [lead-followup-board](docs/changes/2026-10-05-lead-followup-board.md), [lead-activities](docs/changes/2026-10-05-lead-activities.md), [activity-followup-schedule](docs/changes/2026-10-06-activity-followup-schedule.md), [offline-location-on-create](docs/changes/2026-10-06-offline-location-on-create.md).

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/components/followups/FollowupBoard.tsx`, `stages.ts` | 10 stage columns, cards with WhatsApp and next-stage buttons, search / assigned-to / source / created date range filters, skeleton, error and empty states |
| Added | `src/components/followups/LeadPanel.tsx`, `UnverifiedDialog.tsx` | Right-side panel: contact information, move to stage, lead assigned to, activity, history tabs; popup for unverified leads |
| Added | `ActivityLogForm.tsx`, `FollowupScheduleForm.tsx`, `ActivityList.tsx`, `FollowupPrompt.tsx`, `ActivityIcons.tsx`, `activities.ts` | Log Activity and Schedule Follow-up forms, combined list, "schedule the next follow-up?" prompt |
| Added | `src/components/DateRangePicker.tsx`, `SchedulePickers.tsx` | Two-month range picker; one-month date picker and half-hour time list |
| Modified | `src/components/FilterSelect.tsx`, `DashboardSidebar.tsx`, `src/app/dashboard/followups/page.tsx` | Taller option list; sidebar label "Lead Followup" |
| Added | `src/lib/api/leads.ts`, `src/lib/api/activities.ts` | API clients for leads, stages and activities |
| Modified | `src/lib/api/auth.ts` | `ApiError.missingFields` for the 409 verification response |
| Modified | `src/app/contacts/page.tsx` | No browser GPS and no Offline source when adding a contact (offline data is entered on mobile); optional return to another page after saving |
| Removed | `AddLeadDialog.tsx`, `LeadDetailsPanel.tsx`, `ManageStagesDialog.tsx`, `shared.ts` | Legacy board pieces |
| Added | `tests/followups/*`, `tests/components/followup-board.test.tsx`, `lead-activity.test.tsx` | Unit and panel tests |
| Added | `.claude/skills/feature-testing/*` | Skill: unit, integration and end-to-end testing for every finished feature |
| Added | `docs/changes/*` | Change notes |

### Notes
- Point the web app at the live API with `NEXT_PUBLIC_API_BASE_URL=https://ogera-crm.onrender.com` (build-time variable on the web host; `.env.local` locally). The example env files are git-ignored, so the value is documented in the backend's `docs/changes/2026-10-07-cors-origins.md`.
- The full unit suite still has 17 failing tests in `tests/components/staff-live-map.test.tsx`, which predate this work.
- Browser end-to-end tests for Lead Followup are not written yet (the e2e fixture has no lead routes).
- The backend side of the same work is in `ogera_crm_backend/CHANGELOG.md`. The mobile app was not changed.

## 2026-10-05 — `48b3df0` (branch `phase1`)

**Add verified / unverified filter to contacts**

Author: sajad yoosuf
Previous commit on this side: `bf76cde` Add hover tooltip listing pending contact details (2026-10-05)

### Summary
The contacts filter bar gets a Status dropdown (Verified / Unverified) that drives the new `verified` API parameter.

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/lib/api/contacts.ts` | `listContacts` accepts `verified` |
| Modified | `src/app/contacts/page.tsx` | Status filter added to the filter bar and the load call |

### Notes
Web part of a commit that also touched the backend. Checked with eslint and tsc, not in a browser.

## 2026-10-05 — `bf76cde` (branch `phase1`)

**Add hover tooltip listing pending contact details**

Author: sajad yoosuf
Previous commit on this side: `f6ca49e` Show a table skeleton while contacts load (2026-10-05)

### Summary
The Verified / Unverified badge shows a tooltip on hover and focus. Unverified lists the details still to fill in; Verified says all are complete.

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/app/contacts/page.tsx` | `VerifiedBadge` gets a fixed-position tooltip (not clipped by the table wrapper), keyboard focus support and an aria-label |

### Notes
Web only. Checked with eslint and tsc, not in a browser.

## 2026-10-05 — `f6ca49e` (branch `phase1`)

**Show a table skeleton while contacts load**

Author: sajad yoosuf
Previous commit on this side: `d39dc1b` Add verified / unverified status to contacts (2026-10-05)

### Summary
Desktop and tablet show one skeleton table with the real headers while contacts load; phones keep the card skeleton.

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/app/contacts/page.tsx` | Loading state renders a header-matched skeleton table (12 rows) at `md` and up |

### Notes
Web only. Checked with eslint and tsc, not in a browser.

## 2026-10-05 — `d39dc1b` (branch `phase1`)

**Add verified / unverified status to contacts**

Author: sajad yoosuf
Previous commit on this side: `c93ee92` docs: update changelog for 2ce70d2 (2026-10-03)

### Summary
The contacts page gets a Status column showing Verified or Unverified. Notes: [docs/changes/2026-10-05-contact-verification.md](docs/changes/2026-10-05-contact-verification.md).

### Files
| Status | File | Change |
| --- | --- | --- |
| Modified | `src/lib/api/contacts.ts` | `ApiContact` gains `is_verified` and `missing_fields` |
| Modified | `src/app/contacts/page.tsx` | Status column on the table and a badge on phone cards; Unverified lists the pending fields |
| Added | `docs/changes/2026-10-05-contact-verification.md` | Change notes |

### Notes
The same commit also touched the backend, which supplies the fields. No filter by status yet.

## 2026-10-02 — `2ce70d2` (branch `phase1`)

**Restructure repo into backend / web / mobile folders**

Author: sajad yoosuf
Previous commit on this side: `da568aa` Redesign contacts page and wire it to the FastAPI backend (2026-10-02)

### Summary

The web app moved from the repo root into `ogera_crm_web/`, so one repo now holds the backend, web and mobile folders. No application code changed; git records most of the move as renames, so file history carries over. Notes: [docs/changes/2026-10-02-contacts-redesign-api.md](docs/changes/2026-10-02-contacts-redesign-api.md) (earlier change, moved with the app).

### Files

Git lists these as new paths under `ogera_crm_web/` because the old paths were outside the folder; most are renames of files that lived at the repo root.

| Status | File | Change |
| --- | --- | --- |
| Renamed | `src/`, `public/`, `tests/`, `e2e/`, `scripts/` | Moved under `ogera_crm_web/` unchanged. |
| Renamed | `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.mts`, `playwright.config.ts` | Project config moved with the app. |
| Renamed | `docs/`, `README.md`, `API.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md` | Documentation moved with the app. |
| Added | `.claude/skills/responsive-ui/`, `.claude/skills/ui-states/` | Web UI skills, now tracked. |
| Added | `.gitignore` | Web-specific ignores (`.env*`, Playwright output); the root `.gitignore` now covers `node_modules/` and `.next/`. |
| Deleted | `src/app/api/**`, `src/lib/auth/`, `src/lib/sales.ts`, `migrations/`, `tests/api/*route*` | Old Next.js API routes, SQL migrations and server-side code. Already removed from the working tree when the web app moved to the FastAPI backend; recorded here. |

### Notes

- Run commands (`npm run dev`, `npx eslint`) from `ogera_crm_web/` now.
- The old Professionals page (`src/app/dashboard/professionals/`) still exists and depends on the deleted `/api/professionals` routes.
- The previous commit above lived at the old layout, so a path-scoped history of `ogera_crm_web/` starts at this commit; use `git log --follow` on a file to see its earlier history.
- Pairs with the backend entry for `2ce70d2` and the root `.gitignore` / `.claude/skills/feature-workflow` additions.

## 2026-10-02 — `da568aa` (branch `phase1`)

**Redesign contacts page and wire it to the FastAPI backend**

Author: sajad yoosuf

### Summary

The contacts page now matches the employees page and uses the FastAPI contacts API for list, create, edit and delete, with a redesigned add/edit modal. Notes: [docs/changes/2026-10-02-contacts-redesign-api.md](docs/changes/2026-10-02-contacts-redesign-api.md).

### Files

| Status | File | Change |
| --- | --- | --- |
| Modified | `src/app/dashboard/page.tsx` | Header, live search, horizontal filters, table/cards, new modal, API-backed save/delete. |
| Added | `src/lib/api/contacts.ts` | Contacts and lead-sources API client with console logging. |
| Added | `src/lib/api/devlog.ts` | Shared dev-only request/response logger. |
| Added | `src/components/PhoneField.tsx` | Country picker with per-country phone length validation. |
| Added | `src/components/SelectField.tsx` | Themed form dropdown. |
| Added | `src/components/FilterSelect.tsx` | Filter dropdown extracted from the employees page. |
| Added | `src/components/FilterPanel.tsx` | Horizontal filter row. |
| Added | `src/app/dashboard/employees/page.tsx`, `src/lib/api/employees.ts`, `src/app/api/dev-log/route.ts` | Existing local work the contacts code depends on. |
| Modified | `src/lib/api/auth.ts` | Exports `request`, adds `forbidden` error kind, handles 204. |
| Modified | `src/app/globals.css` | Removed old `react-phone-number-input` styles. |
| Modified | `package.json`, `package-lock.json` | Added `libphonenumber-js` (also carries earlier Playwright entries). |

### Notes

- The backend (`ogera_crm_backend`) changes are not in this commit: `GET /lead-sources`, a `created_by` list filter, Offline replacing Field Visit in the seed, and `scripts/merge_field_visit_into_offline.sql`.
- Not tested against a running backend or in a browser.

## 2026-09-30 — `f393cff` (branch `phase1`)

**Integrate FastAPI login with loading, network and error states**

Author: sajad yoosuf

### Summary

The login screen now authenticates against the FastAPI backend (`POST /auth/login`, documented in `API.md`) instead of the removed Next.js `/api/auth/login` route. It handles loading, offline/network and error states.

### Files

| Status | File | Change |
| --- | --- | --- |
| Added | `API.md` | Backend API reference (auth and contacts endpoints). |
| Added | `src/lib/api/auth.ts` | `login()` and `getMe()` client, `ApiError` kinds, 15 s timeout. |
| Added | `src/hooks/useLogin.ts` | Idle / loading / success / error state and session storage. |
| Added | `src/hooks/useOnlineStatus.ts` | Reactive browser online/offline state. |
| Added | `tests/api/auth-client.test.ts` | Unit tests for status-to-error mapping. |
| Modified | `src/app/page.tsx` | Login form uses the hooks; offline banner, retry button. |
| Modified | `src/app/globals.css` | Offline banner style (also includes earlier uncommitted style edits). |
| Modified | `docs/FRONTEND_AUTHENTICATION.md` | Rewritten for the new flow. |

### Notes

- Set `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`). The backend must allow the web origin via CORS.
- Session keys `ogera_access_token` and `ogera_user` are unchanged, so existing dashboard code keeps reading them.
- Not included in this commit: the `.env*` files and unrelated working-tree changes.
