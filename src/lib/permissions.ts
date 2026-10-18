/**
 * Which roles may do what in the UI. Mirrors ACTION_ROLES in ogera_crm_backend/role_access.py.
 * The backend is the real gate; these only hide controls the server would refuse.
 */

const roleIn = (role: string | undefined, roles: readonly string[]) => !!role && roles.includes(role);

/** Contact export (CSV, Excel, PDF). */
export const canExportContacts = (role: string | undefined) =>
  roleIn(role, ["admin", "manager", "team_lead"]);

/** Creating a lead. Support is after-sales only. */
export const canCreateContact = (role: string | undefined) =>
  roleIn(role, ["admin", "manager", "team_lead", "sales_executive", "tele_caller", "field_executive"]);

/** Moving a lead through the pipeline. Support cannot; field executives are limited to early stages by the server. */
export const canMoveStage = (role: string | undefined) =>
  roleIn(role, ["admin", "manager", "team_lead", "sales_executive", "tele_caller", "field_executive"]);

/** Scheduling a follow-up or task. Support may only schedule for itself; the server enforces that. */
export const canScheduleFollowup = (role: string | undefined) =>
  roleIn(role, ["admin", "manager", "team_lead", "sales_executive", "tele_caller", "field_executive", "support"]);
