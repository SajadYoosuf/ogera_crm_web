"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { canDo } from "@/lib/shared/roles";
import { listRoles, updateRole, type RoleSummary } from "@/lib/api/settings";
import { ErrorBlock, Panel, Spinner, Toast, errorText } from "./ui";

const MODULES = [
  { key: "leads", label: "Leads" },
  { key: "contacts", label: "Contacts" },
  { key: "employees", label: "Employees" },
  { key: "settings", label: "Settings" },
  { key: "team", label: "Team" },
  { key: "integrations", label: "Integrations" },
  { key: "lead_statuses", label: "Lead statuses" },
  { key: "company", label: "Company" },
] as const;

const ACTIONS = ["c", "r", "u", "d"] as const;
type Action = (typeof ACTIONS)[number];
const ACTION_LABELS: Record<Action, string> = { c: "Create", r: "Read", u: "Update", d: "Delete" };

function PermissionsMatrix({
  role,
  onSave,
  onClose,
}: {
  role: RoleSummary;
  onSave: (updated: RoleSummary) => void;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [perms, setPerms] = useState<Record<string, string>>(role.permissions ?? {});
  const [seeAll, setSeeAll] = useState(role.see_all_records ?? false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function toggle(module: string, action: Action) {
    setPerms((prev) => {
      const current = prev[module] ?? "";
      const next = current.includes(action)
        ? current.replace(action, "")
        : (current + action).split("").sort().join("");
      return { ...prev, [module]: next };
    });
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateRole(token, role.id, { permissions: perms, see_all_records: seeAll });
      onSave(updated);
      onClose();
    } catch (err) {
      setSaveError(errorText(err, "Could not save permissions."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E7E7EA] px-5 py-4">
          <div>
            <p className="text-[15px] font-bold text-[#1A1C21]">{role.name}</p>
            <p className="text-[12px] text-[#8A8F9C]">Edit module permissions</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#8A8F9C] hover:bg-[#F3F3F5]" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="flex items-center gap-3 rounded-xl border border-[#E7E7EA] p-3">
            <input
              type="checkbox"
              checked={seeAll}
              onChange={(e) => setSeeAll(e.target.checked)}
              className="h-4 w-4 rounded border-[#DEE1E5] accent-[#0E4D3A]"
            />
            <div>
              <p className="text-[13px] font-semibold text-[#1A1C21]">See all records</p>
              <p className="text-[11.5px] text-[#8A8F9C]">When on, this role sees every lead and contact — not just assigned ones</p>
            </div>
          </label>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#F7F7F9] text-[#4B5060]">
                  <th className="px-3 py-2 text-left font-medium">Module</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="px-3 py-2 text-center font-medium">{ACTION_LABELS[a]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map(({ key, label }) => (
                  <tr key={key} className="border-t border-[#EFEFF2]">
                    <td className="px-3 py-2 font-medium text-[#1A1C21]">{label}</td>
                    {ACTIONS.map((action) => (
                      <td key={action} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={(perms[key] ?? "").includes(action)}
                          onChange={() => toggle(key, action)}
                          className="h-4 w-4 rounded border-[#DEE1E5] accent-[#0E4D3A]"
                          aria-label={`${ACTION_LABELS[action]} ${label}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E7E7EA] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#DEE1E5] px-4 py-1.5 text-sm font-medium text-[#4B5060] hover:bg-[#F7F7F9]"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-[#0E4D3A] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0B3E2F] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save permissions"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamTab() {
  const { token, user } = useAuth();
  const canEdit = canDo(user, "team", "u");
  const [roles, setRoles] = useState<RoleSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [editingRole, setEditingRole] = useState<RoleSummary | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoadError("Sign in again to view roles."); return; }
    setLoadError("");
    try {
      const list = await listRoles(token);
      setRoles(list.items);
    } catch (caught) { setLoadError(errorText(caught, "Roles could not be loaded.")); }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!roles) return <Spinner />;

  return (
    <div className="space-y-4">
      <Toast message={notice?.text ?? ""} tone={notice?.tone} />

      {editingRole && (
        <PermissionsMatrix
          role={editingRole}
          onSave={(updated) => {
            setRoles((prev) => prev && prev.map((r) => (r.id === updated.id ? updated : r)));
            setNotice({ text: `${updated.name} permissions saved.`, tone: "ok" });
          }}
          onClose={() => setEditingRole(null)}
        />
      )}

      <Panel title="Roles & Permissions" subtitle="Click a role to edit its module permissions">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F7F7F9] text-left text-[12px] text-[#4B5060]">
                <th className="px-3.5 py-2.5 font-medium">Role</th>
                <th className="px-2.5 py-2.5 font-medium">Staff</th>
                <th className="px-2.5 py-2.5 font-medium">Sees all records</th>
                <th className="px-2.5 py-2.5 font-medium">Leads</th>
                <th className="px-2.5 py-2.5 font-medium">Contacts</th>
                <th className="px-2.5 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-t border-[#EFEFF2] hover:bg-[#FAFAFB]">
                  <td className="px-3.5 py-2.5">
                    <p className="font-semibold text-[#1A1C21]">{role.name}</p>
                    {role.description && <p className="text-[11px] text-[#9AA0AC]">{role.description}</p>}
                  </td>
                  <td className="px-2.5 py-2.5 text-[#4B5060]">{role.employee_count}</td>
                  <td className="px-2.5 py-2.5">
                    {role.see_all_records ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF4EF] px-2 py-0.5 text-[11px] font-semibold text-[#0E4D3A]">Yes</span>
                    ) : (
                      <span className="text-[11.5px] text-[#9AA0AC]">Assigned only</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2.5 font-mono text-[11.5px] text-[#4B5060]">{role.permissions?.leads ?? "—"}</td>
                  <td className="px-2.5 py-2.5 font-mono text-[11.5px] text-[#4B5060]">{role.permissions?.contacts ?? "—"}</td>
                  <td className="px-2.5 py-2.5 text-right">
                    {canEdit && (
                      <button
                        onClick={() => setEditingRole(role)}
                        className="rounded-lg border border-[#DEE1E5] px-2.5 py-1 text-[11.5px] font-medium text-[#4B5060] hover:bg-[#F7F7F9]"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
