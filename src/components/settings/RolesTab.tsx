"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createRole, getPermissionMatrix, listRoles, setRolePermission, updateRole, type PermissionLevel, type PermissionMatrix, type RoleSummary } from "@/lib/api/settings";
import { Card, ErrorBlock, Icon, Spinner, Toast, errorText, getToken, icons, primaryButton, secondaryButton } from "./ui";

const LEVELS: Record<PermissionLevel, { label: string; style: string; dot: string }> = {
  full: { label: "Full", style: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  view: { label: "View only", style: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  team: { label: "Team", style: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  own: { label: "Own only", style: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  customers: { label: "Own + customers", style: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  none: { label: "No access", style: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

export default function RolesTab({ canEdit }: { canEdit: boolean }) {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const newRoleInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoadError("Sign in again to view roles."); return; }
    setLoadError("");
    try {
      const [grid, list] = await Promise.all([getPermissionMatrix(token), listRoles(token)]);
      setMatrix(grid); setRoles(list.items);
    } catch (caught) { setLoadError(errorText(caught, "Roles could not be loaded.")); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function run(action: (token: string) => Promise<unknown>, done: string) {
    const token = getToken();
    if (!token) { setNotice({ text: "Sign in again before saving.", tone: "error" }); return false; }
    setBusy(true); setNotice(null);
    try { await action(token); await load(); setNotice({ text: done, tone: "ok" }); return true; }
    catch (caught) { setNotice({ text: errorText(caught, "Could not save. Please try again."), tone: "error" }); return false; }
    finally { setBusy(false); }
  }

  /** Switches one editable cell. The server answers with the full matrix, so the grid is redrawn from it. */
  async function setCell(featureKey: string, action: string, roleSlug: string, roleName: string, allowed: boolean) {
    const token = getToken();
    if (!token) { setNotice({ text: "Sign in again before saving.", tone: "error" }); return; }
    setSaving(`${roleSlug}:${action}`); setNotice(null);
    try {
      setMatrix(await setRolePermission(token, roleSlug, action, allowed));
      const feature = matrix?.features.find((item) => item.key === featureKey)?.label ?? "Access";
      setNotice({ text: `${feature} ${allowed ? "turned on" : "turned off"} for ${roleName}.`, tone: "ok" });
    } catch (caught) {
      setNotice({ text: errorText(caught, "Could not save. Please try again."), tone: "error" });
    } finally { setSaving(null); }
  }

  async function addRole(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (name.length < 2) return;
    if (await run((token) => createRole(token, { name }), `${name} role added.`)) setNewName("");
  }

  async function rename() {
    if (!editing) return;
    const role = roles.find((item) => item.id === editing.id);
    const name = editing.name.trim();
    setEditing(null);
    if (role && name.length >= 2 && name !== role.name) await run((token) => updateRole(token, role.id, { name }), "Role renamed.");
  }

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!matrix) return <Spinner />;
  const visibleRoles = matrix.roles.filter((role) => role.is_active);

  return (
    <div className="space-y-4">
      <Toast message={notice?.text ?? ""} tone={notice?.tone} />

      <section className="space-y-4 rounded-[14px] border border-[#E5E7EA] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#1A1C21]">Roles &amp; Permissions</h2>
            <p className="mt-0.5 text-[12.5px] text-[#8A8F9C]">Click a cell to change what a role can do</p>
          </div>
          {canEdit && (
            <button type="button" onClick={() => { newRoleInput.current?.scrollIntoView({ behavior: "smooth", block: "center" }); newRoleInput.current?.focus(); }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0E4D3A] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0B3E2F]">
              <Icon className="h-3.5 w-3.5" >{icons.plus}</Icon>
              Add role
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th scope="col" className="border-b border-[#EFEFF2] px-3 py-2.5 text-left text-[12.5px] font-medium text-[#4B5060]">Feature</th>
                {visibleRoles.map((role) => (
                  <th key={role.slug} scope="col" className="min-w-[140px] border-b border-[#EFEFF2] px-3 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1A1C21]">
                      {role.name}
                      {role.is_system && <Icon className="h-3 w-3 text-[#9AA0AC]">{icons.lock}</Icon>}
                      {canEdit && <Icon className="h-3 w-3 text-[#9AA0AC]">{icons.pencil}</Icon>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.features.map((feature) => (
                <tr key={feature.key} className="border-t border-[#F3F3F5]">
                  <th scope="row" title={feature.description} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-[#3A3E4A]">{feature.label}</th>
                  {visibleRoles.map((role) => {
                    const cell = feature.levels[role.slug];
                    const level = LEVELS[cell?.level ?? "none"];
                    const key = `${role.slug}:${feature.action}`;
                    const on = cell?.level !== "none";
                    const editable = Boolean(cell?.editable && feature.action);
                    return (
                      <td key={role.slug} className="relative px-3 py-2 text-center align-top">
                        <button type="button" aria-haspopup={editable ? "menu" : undefined} aria-expanded={editable ? menuKey === key : undefined} disabled={!editable || saving !== null}
                          aria-label={`${feature.label} for ${role.name}`}
                          title={cell?.note ?? undefined}
                          onClick={() => setMenuKey(menuKey === key ? null : key)}
                          className={`inline-flex h-9 w-[152px] items-center justify-between gap-2 rounded-lg border px-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-60 ${level.style}`}>
                          <span className="truncate">{saving === key ? "Saving…" : level.label}</span>
                          {editable && <Icon className="h-3 w-3 shrink-0"><path d="m6 9 6 6 6-6" /></Icon>}
                        </button>
                        {menuKey === key && editable && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuKey(null)} />
                            <div role="menu" aria-label={`${feature.label} for ${role.name}`}
                              className="absolute left-1/2 top-full z-20 mt-1 flex w-[170px] -translate-x-1/2 flex-col gap-0.5 rounded-[10px] border border-[#DEE1E5] bg-white p-1.5 text-left shadow-[0_12px_28px_rgba(16,24,40,0.18)]">
                              {(Object.keys(LEVELS) as PermissionLevel[]).map((item) => {
                                const selectable = item === "full" || item === "none";
                                return (
                                  <button key={item} type="button" role="menuitem" disabled={!selectable || cell?.level === item}
                                    title={selectable ? undefined : "Set by the app"}
                                    onClick={() => { setMenuKey(null); void setCell(feature.key, feature.action!, role.slug, role.name, item === "full"); }}
                                    className="flex h-9 items-center gap-2 rounded-md px-2.5 text-[12.5px] font-semibold text-[#3A3E4A] hover:bg-[#F3F3F5] disabled:cursor-default disabled:bg-transparent disabled:text-[#9AA0AC]">
                                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${LEVELS[item].dot} ${selectable ? "" : "opacity-40"}`} />
                                    {LEVELS[item].label}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                        {cell?.note && <span className="mt-1 block max-w-[10rem] text-[11px] leading-snug text-[#8A8F9C]">{cell.note}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul aria-label="Legend" className="flex flex-wrap gap-3.5 border-t border-[#EFEFF2] pt-3">
          {(Object.keys(LEVELS) as PermissionLevel[]).map((level) => (
            <li key={level} className="flex items-center gap-1.5 text-[11.5px] text-[#6B7080]">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${LEVELS[level].dot}`} />
              {LEVELS[level].label}
            </li>
          ))}
        </ul>
      </section>

      <Card title="Roles" subtitle={canEdit ? "Add a role for a new kind of team member, then assign it in the Team tab." : "Roles in your team."}>
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {roles.map((role) => (
            <li key={role.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
              <div className="min-w-0 flex-1 basis-40">
                {editing?.id === role.id ? (
                  <input autoFocus value={editing.name} maxLength={80} aria-label={`Rename ${role.name}`} onChange={(event) => setEditing({ id: role.id, name: event.target.value })} onBlur={() => void rename()}
                    onKeyDown={(event) => { if (event.key === "Enter") void rename(); if (event.key === "Escape") setEditing(null); }} className="crm-input" />
                ) : (
                  <button type="button" disabled={!canEdit} onClick={() => setEditing({ id: role.id, name: role.name })} title={canEdit ? "Click to rename" : undefined}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold ${role.is_active ? "text-gray-900" : "text-gray-400 line-through"} ${canEdit ? "hover:bg-gray-50" : ""}`}>
                    <span className="truncate">{role.name}</span>
                    {role.is_system && <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400">{icons.lock}</Icon>}
                  </button>
                )}
              </div>
              <span className="shrink-0 text-xs text-gray-500">{role.employee_count} {role.employee_count === 1 ? "person" : "people"}</span>
              {canEdit && (
                <label className="flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold text-gray-600">
                  <input type="checkbox" role="switch" checked={role.is_active} disabled={busy || role.is_system} aria-label={`${role.name} active`}
                    onChange={() => void run((token) => updateRole(token, role.id, { is_active: !role.is_active }), role.is_active ? `${role.name} turned off.` : `${role.name} turned on.`)} className="h-5 w-5 accent-blue-600" />
                  {role.is_active ? "Active" : "Off"}
                </label>
              )}
            </li>
          ))}
        </ul>

        {canEdit && (
          <form onSubmit={(event) => void addRole(event)} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="new-role-name">New role name</label>
            <input ref={newRoleInput} id="new-role-name" value={newName} maxLength={80} placeholder="New role, e.g. Showroom Staff" onChange={(event) => setNewName(event.target.value)} className="crm-input flex-1" />
            <button type="submit" disabled={busy || newName.trim().length < 2} className={primaryButton}><Icon>{icons.plus}</Icon> Add role</button>
          </form>
        )}
        {!canEdit && <button type="button" onClick={() => void load()} className={`${secondaryButton} mt-4`}>Refresh</button>}
      </Card>
    </div>
  );
}
