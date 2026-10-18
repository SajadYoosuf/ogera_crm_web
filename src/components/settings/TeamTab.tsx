"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listAllEmployees, teamLeadOptions, updateEmployee, type Employee, type EmployeeRole } from "@/lib/api/employees";
import { listRoles, type RoleSummary } from "@/lib/api/settings";
import { ErrorBlock, Icon, Panel, Spinner, Toast, errorText, getToken, icons } from "./ui";

type View = "all" | "leads";
const VIEWS: { key: View; label: string }[] = [
  { key: "all", label: "All" },
  { key: "leads", label: "Team leads" },
];

export default function TeamTab({ canEdit, viewerId, isManager = false }: { canEdit: boolean; viewerId: number | null; isManager?: boolean }) {
  const [staff, setStaff] = useState<Employee[] | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [view, setView] = useState<View>("all");

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoadError("Sign in again to view the team."); return; }
    setLoadError("");
    try {
      const [people, list] = await Promise.all([listAllEmployees(token), listRoles(token)]);
      setStaff(people.employees.filter((person) => !person.deleted_at)); setRoles(list.items);
    } catch (caught) { setLoadError(errorText(caught, "The team could not be loaded.")); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function changeRole(person: Employee, role: string) {
    const token = getToken();
    if (!token) { setNotice({ text: "Sign in again before saving.", tone: "error" }); return; }
    setBusyId(person.id); setNotice(null);
    try {
      const saved = await updateEmployee(token, person.id, { role: role as EmployeeRole });
      setStaff((current) => current && current.map((item) => (item.id === saved.id ? { ...item, role: saved.role } : item)));
      setNotice({ text: `${person.name} is now ${roles.find((item) => item.slug === role)?.name ?? role}.`, tone: "ok" });
    } catch (caught) { setNotice({ text: errorText(caught, "The role could not be changed."), tone: "error" }); }
    finally { setBusyId(null); }
  }

  async function changeTeamLead(person: Employee, value: string) {
    const token = getToken();
    if (!token) { setNotice({ text: "Sign in again before saving.", tone: "error" }); return; }
    const teamLeadId = value ? Number(value) : null;
    setBusyId(person.id); setNotice(null);
    try {
      const saved = await updateEmployee(token, person.id, { team_lead_id: teamLeadId });
      setStaff((current) => current && current.map((item) => (item.id === saved.id ? { ...item, team_lead_id: saved.team_lead_id } : item)));
      setNotice({ text: teamLeadId ? `${person.name} now reports to a new team lead.` : `${person.name} has no team lead.`, tone: "ok" });
    } catch (caught) { setNotice({ text: errorText(caught, "The team lead could not be changed."), tone: "error" }); }
    finally { setBusyId(null); }
  }

  const visible = useMemo(() => {
    if (!staff) return [];
    if (view === "leads") return staff.filter((person) => person.role === "team_lead");
    return staff;
  }, [staff, view]);

  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  if (!staff) return <Spinner />;

  const assignable = roles.filter((role) => role.is_active);
  const leads = teamLeadOptions(staff);
  const nameOf = (slug: string) => roles.find((role) => role.slug === slug)?.name ?? slug.replaceAll("_", " ");
  const count = staff.length;

  const viewSwitch = (
    <div role="group" aria-label="Show" className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-[#F3F3F5] p-[3px]">
      {VIEWS.map((item) => {
        const active = item.key === view;
        return (
          <button key={item.key} type="button" aria-pressed={active} onClick={() => setView(item.key)}
            className={`h-8 shrink-0 rounded-[6px] px-3 text-[12.5px] font-semibold transition-colors ${active ? "bg-white text-[#1A1C21] shadow-sm" : "text-[#6B7080] hover:text-[#1A1C21]"}`}>
            {item.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <Toast message={notice?.text ?? ""} tone={notice?.tone} />
      <Panel
        title="Team Members"
        subtitle={`${count} ${count === 1 ? "person" : "people"} in your workspace`}
        status={
          <div className="flex max-w-full flex-wrap items-center gap-2.5">
            {viewSwitch}
          </div>
        }
      >
        {isManager && (
          <p className="rounded-lg bg-[#F3F6F4] px-3 py-1.5 text-xs text-[#9AA0AC]">Manager view — admin accounts aren&apos;t shown here</p>
        )}

        {count === 0 ? (
          <p className="py-8 text-center text-sm text-[#8A8F9C]">No team members yet.</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#8A8F9C]">No one matches this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-[#F7F7F9] text-left text-[12.5px] text-[#4B5060]">
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-2.5 py-2.5 font-medium">Role</th>
                  <th scope="col" className="px-2.5 py-2.5 font-medium">Team Lead</th>
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((person) => {
                  const isSelf = person.id === viewerId;
                  const options = assignable.some((role) => role.slug === person.role) ? assignable : [...assignable, { slug: person.role, name: nameOf(person.role) } as RoleSummary];
                  const lead = staff.find((item) => item.id === person.team_lead_id);
                  return (
                    <tr key={person.id} className="border-t border-[#EFEFF2] hover:bg-[#FAFAFB]">
                      <td className="h-[58px] px-3.5">
                        <div className="flex items-center gap-2.5">
                          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF4EF] text-xs font-bold text-[#0E4D3A]">
                            {person.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="whitespace-nowrap text-[13.5px] font-semibold text-[#1A1C21]">
                              {person.name}{isSelf && <span className="ml-2 text-xs font-normal text-[#9AA0AC]">(you)</span>}
                            </p>
                            <p className="whitespace-nowrap text-[11.5px] text-[#9AA0AC]">{person.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2.5">
                        {canEdit ? (
                          <label>
                            <span className="sr-only">Role for {person.name}</span>
                            <select value={person.role} disabled={isSelf || busyId === person.id} onChange={(event) => void changeRole(person, event.target.value)} className="crm-select min-h-11 w-40"
                              title={isSelf ? "You can't change your own role." : undefined}>
                              {options.map((role) => <option key={role.slug} value={role.slug}>{role.name}</option>)}
                            </select>
                          </label>
                        ) : (
                          <span className="whitespace-nowrap text-[12.5px] text-[#4B5060]">{nameOf(person.role)}</span>
                        )}
                      </td>
                      <td className="px-2.5">
                        {canEdit && person.role !== "team_lead" ? (
                          <label>
                            <span className="sr-only">Team lead for {person.name}</span>
                            <select value={person.team_lead_id ?? ""} disabled={busyId === person.id} onChange={(event) => void changeTeamLead(person, event.target.value)} className="crm-select min-h-11 w-44">
                              <option value="">No team lead</option>
                              {leads.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                              {lead && !leads.some((item) => item.id === lead.id) && <option value={lead.id}>{lead.name}</option>}
                            </select>
                          </label>
                        ) : (
                          <span className="whitespace-nowrap text-[12.5px] text-[#4B5060]">{lead ? lead.name : "—"}</span>
                        )}
                      </td>
                      <td className="px-3.5">
                        {person.is_active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF4EF] px-2.5 py-0.5 text-xs font-semibold text-[#0E4D3A]">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#1F9D6B]" />Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F3F5] px-2.5 py-0.5 text-xs font-semibold text-[#6B7080]">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#9AA0AC]" />Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
