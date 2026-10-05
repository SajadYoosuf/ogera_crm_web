"use client";

import Link from "next/link";
import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/auth";
import type { ApiContact } from "@/lib/api/contacts";
import { changeStage, listConsumerLeads } from "@/lib/api/leads";
import LeadPanel from "./LeadPanel";
import { STAGES, columnFor, stageClock, type StageSlug } from "./stages";

const errorText = (caught: unknown) => (caught instanceof ApiError ? caught.message : "Leads could not be loaded. Please try again.");

function currentUserId(): number | null {
  try {
    const id = (JSON.parse(sessionStorage.getItem("ogera_user") ?? "null") as { id?: number } | null)?.id;
    return typeof id === "number" ? id : null;
  } catch { return null; }
}

export default function FollowupBoard() {
  const [leads, setLeads] = useState<ApiContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("");
  const [mobileStage, setMobileStage] = useState<StageSlug>("new_lead");
  const [panel, setPanel] = useState<{ id: number; target?: StageSlug } | null>(null);
  const [userId] = useState(currentUserId);
  const [now, setNow] = useState(0); // refreshed with each load so the clocks stay pure during render

  const load = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in to load your leads."); setIsLoading(false); return; }
    setError("");
    try {
      setLeads(await listConsumerLeads(accessToken));
      setNow(Date.now());
    } catch (caught) {
      setError(errorText(caught));
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const assignees = useMemo(
    () => [...new Set(leads.map((lead) => lead.assigned_to?.name).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b)),
    [leads],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) =>
      (!assignee || lead.assigned_to?.name === assignee) &&
      (!needle || lead.name.toLowerCase().includes(needle) || lead.phone.includes(needle) || (lead.district ?? "").toLowerCase().includes(needle)));
  }, [leads, search, assignee]);

  const byStage = useMemo(() => {
    const groups = new Map<StageSlug, ApiContact[]>(STAGES.map((stage) => [stage.slug, []]));
    for (const lead of visible) groups.get(columnFor(lead.lead_stage?.stage))?.push(lead);
    return groups;
  }, [visible]);

  const overdueCount = leads.filter((lead) => lead.lead_stage && stageClock(columnFor(lead.lead_stage.stage), lead.lead_stage.changed_at, now)?.overdue).length;
  const panelLead = panel ? leads.find((lead) => lead.id === panel.id) ?? null : null;

  async function drop(event: DragEvent<HTMLDivElement>, slug: StageSlug) {
    event.preventDefault();
    const id = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
    const lead = leads.find((item) => item.id === id);
    if (!lead || columnFor(lead.lead_stage?.stage) === slug) return;
    if (slug === "lost" || slug === "aware") { setPanel({ id, target: slug }); return; } // these capture a reason or note
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken || userId === null) { setError("Sign in again to continue."); return; }
    setError("");
    try {
      await changeStage(accessToken, id, userId, { stage: slug });
      await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The stage could not be changed. Please try again."); }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
        <span className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-blue-600 animate-spin" />
        <h2 className="mt-4 text-base font-bold text-[#0a192f]">Loading leads</h2>
        <p className="mt-2 text-sm text-gray-500">Fetching the latest pipeline from your workspace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-[22px] sm:text-[28px] font-extrabold text-[#0a192f] tracking-tight leading-tight">Lead Followup</h1>
          <p className="text-sm text-gray-500 mt-1">Move consumer leads from first contact to a closed sale.</p>
        </div>
        <Link href="/contacts" className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center px-4 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-colors">Add lead in Contacts</Link>
      </header>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center h-11 flex-1 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
          <label className="sr-only" htmlFor="lead-search">Search leads</label>
          <svg className="w-4 h-4 ml-3 mr-2 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
          <input id="lead-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, phone, or district" className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
        </div>
        <label className="sr-only" htmlFor="lead-assignee">Filter by assignee</label>
        <select id="lead-assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)} className="crm-select md:w-52 shrink-0">
          <option value="">All assignees</option>
          {assignees.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <div className="shrink-0 px-4 h-11 rounded-xl border border-gray-200 bg-gray-50 flex items-center gap-2.5">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Leads</span>
          <span className="text-base font-extrabold text-[#0a192f]">{visible.length}</span>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => { setIsLoading(true); void load(); }} className="self-start sm:self-auto min-h-11 px-4 rounded-lg border border-rose-200 bg-white font-semibold hover:bg-rose-100">Try again</button>
        </div>
      )}

      {overdueCount > 0 && (
        <p className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50 text-sm font-bold text-amber-900">
          <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-amber-500 animate-pulse" />
          {overdueCount} lead{overdueCount === 1 ? " needs" : "s need"} attention: first contact, follow-up or re-engagement is overdue
        </p>
      )}

      {!error && leads.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <h2 className="text-base font-bold text-[#0a192f]">No consumer leads yet</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">Consumer contacts you add appear here as New Leads.</p>
          <Link href="/contacts" className="mt-5 inline-flex min-h-11 items-center px-4 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">Go to Contacts</Link>
        </div>
      ) : (
        <>
          {/* One column at a time on phones: a kanban board does not fit a small screen. */}
          <div className="sm:hidden">
            <label className="sr-only" htmlFor="lead-mobile-stage">Visible stage</label>
            <select id="lead-mobile-stage" value={mobileStage} onChange={(event) => setMobileStage(event.target.value as StageSlug)} className="crm-select">
              {STAGES.map((stage) => <option key={stage.slug} value={stage.slug}>{stage.label} ({byStage.get(stage.slug)?.length ?? 0})</option>)}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:overflow-x-auto sm:pb-3">
            {STAGES.map((stage) => {
              const stageLeads = byStage.get(stage.slug) ?? [];
              return (
                <div key={stage.slug} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void drop(event, stage.slug)}
                  className={`w-full sm:w-[290px] sm:shrink-0 flex flex-col rounded-xl border border-gray-200 bg-gray-50 overflow-hidden ${stage.slug === mobileStage ? "" : "hidden sm:flex"}`}>
                  <div className="px-4 py-3 bg-white border-b border-gray-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stage.dot}`} />
                      <h2 className="text-sm font-bold text-[#0a192f] truncate">{stage.label}</h2>
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">{stageLeads.length}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-gray-500">{stage.description}</p>
                  </div>
                  <div className="flex-1 p-3 space-y-3 sm:max-h-[calc(100vh-24rem)] sm:overflow-y-auto">
                    {stageLeads.map((lead) => {
                      const clock = lead.lead_stage ? stageClock(stage.slug, lead.lead_stage.changed_at, now) : null;
                      return (
                        <article key={lead.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(lead.id))}
                          onClick={() => setPanel({ id: lead.id })}
                          className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer sm:cursor-grab transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-gray-900 truncate">{lead.name}</h3>
                            {!lead.is_verified && <span className="shrink-0 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Unverified</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">{lead.phone}</p>
                          {lead.district && <p className="mt-1 text-xs text-gray-500 truncate">{lead.district}</p>}
                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate px-2 py-1 rounded-md bg-gray-50 text-[11px] font-medium text-gray-600">{lead.assigned_to?.name ?? "Unassigned"}</span>
                            {clock && <span className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold ${clock.overdue ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-600"}`}>{clock.label}</span>}
                          </div>
                        </article>
                      );
                    })}
                    {stageLeads.length === 0 && (
                      <p className="h-24 grid place-items-center px-4 text-center rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400">
                        {search.trim() || assignee ? "No matching leads" : "Drop leads here"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {panelLead && (
        <LeadPanel key={`${panelLead.id}-${panel?.target ?? ""}`} lead={panelLead} userId={userId} initialTarget={panel?.target} onClose={() => setPanel(null)} onChanged={load} />
      )}
    </div>
  );
}
