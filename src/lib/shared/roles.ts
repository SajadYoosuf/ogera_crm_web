/**
 * Permission helpers — replace all hardcoded role-slug checks.
 *
 * canDo(user, module, action) reads the permissions JSONB from the user's role.
 * HEAD_ROLES and isHeadRole are kept for gradual migration; prefer canDo().
 *
 * Permissions shape:  { "leads": "crud", "contacts": "cru", ... }
 *   c=create  r=read  u=update  d=delete  ""=no access
 */

export type PermissionsMap = Record<string, string>;

export const HEAD_ROLES = ["admin", "manager"] as const;

export function isHeadRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

/**
 * Returns true if the user's permissions grant `action` on `module`.
 * Falls back to isHeadRole when permissions are absent (old sessions).
 */
export function canDo(
  user: { role?: string; permissions?: PermissionsMap | null } | null | undefined,
  module: string,
  action: "c" | "r" | "u" | "d",
): boolean {
  if (!user) return false;
  if (user.permissions) {
    return (user.permissions[module] ?? "").includes(action);
  }
  // Fallback for sessions without permissions yet (before next login).
  // Treat heads as having full access to all modules.
  return isHeadRole(user.role);
}
