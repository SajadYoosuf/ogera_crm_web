"use client";

import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import AddLeadDialog from "./AddLeadDialog";
import LeadDetailsPanel from "./LeadDetailsPanel";
import ManageStagesDialog from "./ManageStagesDialog";
import {
  errorMessage,
  formatDueDate,
  ghostButtonClass,
  inputClass,
  isQualified,
  primaryButtonClass,
  requestJson,
  todayIsoDate,
  type Lead,
  type Stage,
  type Staff,
} from "./shared";

const QUALIFICATION_PROMPT =
  "Qualify this lead first — panchayath, ward, water source, house stage, and tank interest are all needed before it moves on.";

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const pattern = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return (
    <>
      {text.split(pattern).map((part, index) =>
        part.toLowerCase() === needle.toLowerCase()
          ? <mark key={index} className="rounded bg-amber-200 px-0.5 text-amber-900">{part}</mark>
          : <span key={index}>{part}</span>,
      )}
    </>
  );
}

export default function FollowupBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [mobileStageId, setMobileStageId] = useState("");

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [qualificationPrompt, setQualificationPrompt] = useState("");
  const [addStageId, setAddStageId] = useState<string | null>(null);
  const [isManagingStages, setIsManagingStages] = useState(false);

  const loadBoard = useCallback(async () => {
    setError("");
    try {
      const [stageData, leadData, staffData] = await Promise.all([
        requestJson<{ id: string; label: string; orderIndex: number }[]>("/api/followups/stages"),
        requestJson<{ leads: Lead[] }>("/api/followups"),
        requestJson<Staff[]>("/api/staff").catch(() => [] as Staff[]),
      ]);
      setStages(stageData);
      setLeads(leadData.leads);
      setStaff(staffData);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBoard(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBoard]);

  // The phone view falls back to the first stage until one is picked or the picked one disappears.
  const activeMobileStageId = stages.some((stage) => stage.id === mobileStageId) ? mobileStageId : stages[0]?.id ?? "";

  const assignees = useMemo(() => {
    const names = new Set(staff.map((member) => member.name));
    for (const lead of leads) if (lead.followupAssignedTo) names.add(lead.followupAssignedTo);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [leads, staff]);

  const visibleLeads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (assigneeFilter === "unassigned" ? Boolean(lead.followupAssignedTo) : assigneeFilter !== "all" && lead.followupAssignedTo !== assigneeFilter) return false;
      if (!needle) return true;
      return [lead.name, lead.phone, lead.panchayath].some((value) => (value || "").toLowerCase().includes(needle));
    });
  }, [leads, search, assigneeFilter]);

  const today = todayIsoDate();
  const dueCount = useMemo(
    () => leads.filter((lead) => lead.followupDueDate && lead.followupDueDate <= today).length,
    [leads, today],
  );

  const fallbackStageId = stages[0]?.id ?? "";
  const leadsInStage = (stageId: string) => visibleLeads.filter((lead) => (lead.stage || fallbackStageId) === stageId);
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;

  async function moveLead(leadId: number, targetStageId: string) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || (lead.stage || fallbackStageId) === targetStageId) return;

    // Leaving the first stage means the lead has been worked, so demand the qualifying details first.
    if ((lead.stage || fallbackStageId) === fallbackStageId && !isQualified(lead)) {
      setQualificationPrompt(QUALIFICATION_PROMPT);
      setSelectedLeadId(lead.id);
      return;
    }

    const previous = leads;
    setLeads((current) => current.map((item) => (item.id === leadId ? { ...item, stage: targetStageId } : item)));
    try {
      await requestJson("/api/followups", { method: "PUT", body: JSON.stringify({ id: leadId, stage: targetStageId }) });
      await loadBoard();
    } catch (caught) {
      setLeads(previous);
      setError(errorMessage(caught));
    }
  }

  const onDrop = (event: DragEvent<HTMLDivElement>, stageId: string) => {
    event.preventDefault();
    const leadId = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
    if (Number.isSafeInteger(leadId)) void moveLead(leadId, stageId);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
        <span className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-blue-600 animate-spin" />
        <h2 className="mt-4 text-base font-bold text-[#0a192f]">Loading follow-ups</h2>
        <p className="mt-2 text-sm text-gray-500">Fetching the latest pipeline from your workspace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-[22px] sm:text-[28px] font-extrabold text-[#0a192f] tracking-tight leading-tight">Sales Followup</h1>
          <p className="text-sm text-gray-500 mt-1">Track, assign, and move leads through your follow-up stages.</p>
        </div>
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <button type="button" onClick={() => setIsManagingStages(true)} className={`${ghostButtonClass} flex-1 sm:flex-none`}>Manage stages</button>
          <button type="button" disabled={!stages.length} onClick={() => setAddStageId(fallbackStageId)} className={`${primaryButtonClass} flex-1 sm:flex-none shadow-md shadow-blue-600/20`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add lead
          </button>
        </div>
      </header>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center h-11 flex-1 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
          <label className="sr-only" htmlFor="followup-search">Search leads</label>
          <svg className="w-4 h-4 ml-3 mr-2 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
          <input id="followup-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, phone, or panchayath" className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
        </div>

        <label className="sr-only" htmlFor="followup-assignee">Filter by assignee</label>
        <select id="followup-assignee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className={`${inputClass} md:w-52 shrink-0`}>
          <option value="all">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {assignees.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>

        <div className="shrink-0 px-4 h-11 rounded-xl border border-gray-200 bg-gray-50 flex items-center gap-2.5">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Leads</span>
          <span className="text-base font-extrabold text-[#0a192f]">{visibleLeads.length}</span>
        </div>
      </section>

      {error && (
        <p role="alert" className="px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</p>
      )}

      {dueCount > 0 && (
        <p className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50 text-sm font-bold text-amber-900">
          <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-amber-500 animate-pulse" />
          {dueCount} follow-up{dueCount === 1 ? " is" : "s are"} due today or overdue
        </p>
      )}

      {stages.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <h2 className="text-base font-bold text-[#0a192f]">No follow-up stages yet</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">Add your first stage to start building the follow-up board.</p>
          <button type="button" onClick={() => setIsManagingStages(true)} className={`${primaryButtonClass} mt-5`}>Manage stages</button>
        </div>
      ) : (
        <>
          {/* One column at a time on phones — a kanban board does not fit a small screen. */}
          <div className="sm:hidden">
            <label className="sr-only" htmlFor="followup-mobile-stage">Visible stage</label>
            <select id="followup-mobile-stage" value={activeMobileStageId} onChange={(event) => setMobileStageId(event.target.value)} className={inputClass}>
              {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label} ({leadsInStage(stage.id).length})</option>)}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:overflow-x-auto sm:pb-3">
            {stages.map((stage) => {
              const stageLeads = leadsInStage(stage.id);
              return (
                <div
                  key={stage.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onDrop(event, stage.id)}
                  className={`w-full sm:w-[310px] sm:shrink-0 flex flex-col rounded-xl border border-gray-200 bg-gray-50 overflow-hidden ${stage.id === activeMobileStageId ? "" : "hidden sm:flex"}`}
                >
                  <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white border-b border-gray-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-sm font-bold text-[#0a192f] truncate">{stage.label}</h2>
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">{stageLeads.length}</span>
                    </div>
                    <button type="button" onClick={() => setAddStageId(stage.id)} aria-label={`Add lead to ${stage.label}`} className="p-1 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </div>

                  <div className="flex-1 p-3 space-y-3 sm:max-h-[calc(100vh-22rem)] sm:overflow-y-auto">
                    {stageLeads.map((lead) => {
                      const isDue = Boolean(lead.followupDueDate && lead.followupDueDate <= today);
                      return (
                        <article
                          key={lead.id}
                          draggable
                          onDragStart={(event) => event.dataTransfer.setData("text/plain", String(lead.id))}
                          onClick={() => { setQualificationPrompt(""); setSelectedLeadId(lead.id); }}
                          className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200 cursor-grab active:cursor-grabbing transition-all"
                        >
                          <h3 className="text-sm font-bold text-gray-900 truncate"><Highlight text={lead.name || "Unnamed lead"} query={search} /></h3>
                          <p className="mt-0.5 text-xs text-gray-500"><Highlight text={lead.phone} query={search} /></p>
                          {lead.remarks && <p className="mt-2 text-xs text-gray-500 line-clamp-2">{lead.remarks}</p>}
                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate px-2 py-1 rounded-md bg-gray-50 text-[11px] font-medium text-gray-600">{lead.followupAssignedTo || "Unassigned"}</span>
                            {lead.followupDueDate && (
                              <span className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold ${isDue ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-600"}`}>
                                {formatDueDate(lead.followupDueDate)}
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}

                    {stageLeads.length === 0 && (
                      <p className="h-24 grid place-items-center px-4 text-center rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400">
                        {search.trim() ? `No matches for “${search.trim()}”` : "Drop leads here"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedLead && (
        <LeadDetailsPanel
          key={selectedLead.id}
          lead={selectedLead}
          stages={stages}
          staff={staff}
          qualificationPrompt={qualificationPrompt || undefined}
          onClose={() => { setSelectedLeadId(null); setQualificationPrompt(""); }}
          onChanged={loadBoard}
          onDeleted={async () => { setSelectedLeadId(null); setQualificationPrompt(""); await loadBoard(); }}
        />
      )}

      {addStageId !== null && (
        <AddLeadDialog
          stages={stages}
          staff={staff}
          initialStage={addStageId || fallbackStageId}
          onClose={() => setAddStageId(null)}
          onCreated={async () => { setAddStageId(null); await loadBoard(); }}
        />
      )}

      {isManagingStages && (
        <ManageStagesDialog stages={stages} onClose={() => setIsManagingStages(false)} onStagesChanged={loadBoard} />
      )}
    </div>
  );
}
