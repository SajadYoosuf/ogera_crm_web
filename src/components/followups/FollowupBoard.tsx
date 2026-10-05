"use client";

import Link from "next/link";
import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import FilterSelect from "@/components/FilterSelect";
import { ApiError } from "@/lib/api/auth";
import type { ApiContact } from "@/lib/api/contacts";
import { changeStage, listConsumerLeads } from "@/lib/api/leads";
import LeadPanel from "./LeadPanel";
import { NEXT_STAGE, STAGES, STAGE_BAR, columnFor, initials, stageClock, stageMeta, whatsappLink, type StageSlug } from "./stages";

const errorText = (caught: unknown) => (caught instanceof ApiError ? caught.message : "Leads could not be loaded. Please try again.");

function currentUserId(): number | null {
  try {
    const id = (JSON.parse(sessionStorage.getItem("ogera_user") ?? "null") as { id?: number } | null)?.id;
    return typeof id === "number" ? id : null;
  } catch { return null; }
}

const iconProps = { className: "w-4 h-4", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export default function FollowupBoard() {
  const [leads, setLeads] = useState<ApiContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [activeStage, setActiveStage] = useState<StageSlug>("new_lead");
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

  const isOverdue = useCallback((lead: ApiContact) =>
    Boolean(lead.lead_stage && stageClock(columnFor(lead.lead_stage.stage), lead.lead_stage.changed_at, now)?.overdue), [now]);

  const assignees = useMemo(
    () => [...new Set(leads.map((lead) => lead.assigned_to?.name).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b)),
    [leads],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) =>
      (!assignee || lead.assigned_to?.name === assignee) &&
      (!onlyOverdue || isOverdue(lead)) &&
      (!needle || lead.name.toLowerCase().includes(needle) || lead.phone.includes(needle) || (lead.district ?? "").toLowerCase().includes(needle)));
  }, [leads, search, assignee, onlyOverdue, isOverdue]);

  const byStage = useMemo(() => {
    const groups = new Map<StageSlug, ApiContact[]>(STAGES.map((stage) => [stage.slug, []]));
    for (const lead of visible) groups.get(columnFor(lead.lead_stage?.stage))?.push(lead);
    return groups;
  }, [visible]);

  const count = (slug: StageSlug) => byStage.get(slug)?.length ?? 0;
  const overdueCount = leads.filter(isOverdue).length;
  const activeCount = leads.filter((lead) => !["won", "lost", "repeat_customer"].includes(columnFor(lead.lead_stage?.stage))).length;
  const wonCount = leads.filter((lead) => columnFor(lead.lead_stage?.stage) === "won").length;
  const hasFilters = Boolean(search.trim() || assignee || onlyOverdue);
  const panelLead = panel ? leads.find((lead) => lead.id === panel.id) ?? null : null;

  async function moveLead(lead: ApiContact, slug: StageSlug) {
    if (columnFor(lead.lead_stage?.stage) === slug) return;
    if (slug === "lost" || slug === "aware") { setPanel({ id: lead.id, target: slug }); return; } // these capture a reason or note
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken || userId === null) { setError("Sign in again to continue."); return; }
    setError("");
    try {
      await changeStage(accessToken, lead.id, userId, { stage: slug });
      await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The stage could not be changed. Please try again."); }
  }

  const drop = (event: DragEvent<HTMLElement>, slug: StageSlug) => {
    event.preventDefault();
    const id = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
    const lead = leads.find((item) => item.id === id);
    if (lead) void moveLead(lead, slug);
  };

  // On desktop the strip jumps to the column; on phones only the chosen column is shown.
  const focusStage = (slug: StageSlug) => {
    setActiveStage(slug);
    document.getElementById(`stage-${slug}`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
        <span className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-blue-600 animate-spin" />
        <h2 className="mt-4 text-base font-bold text-[#0a192f]">Loading leads</h2>
        <p className="mt-2 text-sm text-gray-500">Fetching the latest pipeline from your workspace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#071428] via-[#0c2148] to-[#1a4a8a] text-white shadow-xl shadow-blue-950/10">
        <div className="pointer-events-none absolute -top-24 -left-16 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[#1d7ac4]/30 blur-3xl" />
        <div className="relative p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-sky-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse" /> Sales pipeline
            </p>
            <h1 className="mt-2 text-[26px] sm:text-[34px] font-extrabold tracking-tight leading-tight">Lead Followup</h1>
            <p className="mt-2 text-sm sm:text-[15px] text-white/65 leading-relaxed">Move consumer leads from first contact to a closed sale.</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            <dl className="grid grid-cols-3 gap-2">
              {[["Active", activeCount, "text-white"], ["Overdue", overdueCount, overdueCount ? "text-amber-300" : "text-white"], ["Won", wonCount, "text-emerald-300"]].map(([label, value, tone]) => (
                <div key={label as string} className="rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/10 backdrop-blur-sm text-center sm:min-w-20">
                  <dd className={`text-xl font-extrabold leading-none ${tone}`}>{value}</dd>
                  <dt className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</dt>
                </div>
              ))}
            </dl>
            <Link href="/contacts" className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-white text-[#0a192f] text-sm font-bold shadow-lg shadow-black/20 hover:bg-sky-50 active:scale-[.98] transition-all">
              <svg {...iconProps} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
              Add lead
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center h-11 w-full lg:max-w-md rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
          <label className="sr-only" htmlFor="lead-search">Search leads</label>
          <svg className="w-4 h-4 ml-3.5 mr-2 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
          <input id="lead-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, phone or district" className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="p-2 mr-1 text-gray-400 hover:text-gray-700"><svg {...iconProps}><path d="M18 6 6 18M6 6l12 12" /></svg></button>}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:ml-auto">
          <FilterSelect label="Assigned to" value={assignee} onChange={setAssignee} className="w-full sm:w-60"
            options={[{ value: "", label: "Everyone" }, ...assignees.map((name) => ({ value: name, label: name }))]}
            icon={<><circle cx="12" cy="8" r="3.25" /><path d="M5 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1" /></>} />
          <button type="button" aria-pressed={onlyOverdue} onClick={() => setOnlyOverdue((value) => !value)}
            className={`inline-flex items-center justify-center gap-2 min-h-11 px-3.5 rounded-xl border text-sm font-bold transition-colors ${onlyOverdue ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>
            <span className={`h-2 w-2 rounded-full ${overdueCount ? "bg-amber-500" : "bg-gray-300"}`} />
            Needs attention ({overdueCount})
          </button>
          {hasFilters && <button type="button" onClick={() => { setSearch(""); setAssignee(""); setOnlyOverdue(false); }} className="min-h-11 px-3 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">Clear filters</button>}
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => { setIsLoading(true); void load(); }} className="self-start sm:self-auto min-h-11 px-4 rounded-lg border border-rose-200 bg-white font-semibold hover:bg-rose-100">Try again</button>
        </div>
      )}

      {!error && leads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <h2 className="text-base font-bold text-[#0a192f]">No consumer leads yet</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">Consumer contacts you add appear here as New Leads.</p>
          <Link href="/contacts" className="mt-5 inline-flex min-h-11 items-center px-4 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">Go to Contacts</Link>
        </div>
      ) : (
        <>
          {/* Pipeline strip: counts per stage, and the way to pick a stage on a phone. */}
          <nav aria-label="Pipeline stages" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {STAGES.map((stage) => {
              const selected = stage.slug === activeStage;
              return (
                <button key={stage.slug} type="button" aria-pressed={selected} onClick={() => focusStage(stage.slug)}
                  className={`shrink-0 inline-flex items-center gap-2 min-h-11 px-3.5 rounded-xl border text-sm font-bold transition-colors ${selected ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>
                  <span className={`h-2 w-2 rounded-full ${selected ? "bg-white" : stage.dot}`} />
                  {stage.label}
                  <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${selected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{count(stage.slug)}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex flex-col sm:flex-row gap-4 sm:overflow-x-auto sm:pb-3 sm:items-start">
            {STAGES.map((stage) => {
              const stageLeads = byStage.get(stage.slug) ?? [];
              const next = NEXT_STAGE[stage.slug];
              return (
                <section key={stage.slug} id={`stage-${stage.slug}`} aria-label={stage.label} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, stage.slug)}
                  className={`w-full sm:w-[300px] sm:shrink-0 flex-col rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden ${stage.slug === activeStage ? "flex" : "hidden sm:flex"}`}>
                  <div className={`h-1 ${STAGE_BAR[stage.slug]}`} />
                  <div className="px-4 pt-3 pb-3 bg-white border-b border-gray-200">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-extrabold text-[#0a192f] truncate">{stage.label}</h2>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${stage.badge}`}>{stageLeads.length}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-gray-500">{stage.description}</p>
                  </div>

                  <div className="p-3 space-y-3 sm:max-h-[calc(100vh-27rem)] sm:min-h-40 sm:overflow-y-auto">
                    {stageLeads.map((lead) => {
                      const clock = lead.lead_stage ? stageClock(stage.slug, lead.lead_stage.changed_at, now) : null;
                      return (
                        <article key={lead.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(lead.id))}
                          onClick={() => setPanel({ id: lead.id })}
                          className={`group rounded-xl border bg-white shadow-sm hover:shadow-md cursor-pointer sm:cursor-grab transition-all ${clock?.overdue ? "border-amber-300" : "border-gray-200 hover:border-blue-200"}`}>
                          <div className="p-3.5">
                            <div className="flex items-start gap-3">
                              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold ${stageMeta(stage.slug).badge}`}>{initials(lead.name)}</span>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-gray-900 truncate">{lead.name}</h3>
                                <p className="text-xs text-gray-500 truncate">{lead.phone}{lead.district ? ` · ${lead.district}` : ""}</p>
                              </div>
                              {!lead.is_verified && <span title="Some details are still missing" className="shrink-0 h-2 w-2 mt-1.5 rounded-full bg-amber-400" />}
                            </div>
                            {clock && (
                              <p className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold ${clock.overdue ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                                <svg {...iconProps} className="w-3.5 h-3.5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                                {clock.label}
                              </p>
                            )}
                            <p className="mt-2 text-[11px] text-gray-500 truncate">Owner: <span className="font-semibold text-gray-700">{lead.assigned_to?.name ?? "Unassigned"}</span></p>
                          </div>
                          <div className="flex items-center gap-1.5 border-t border-gray-100 px-2.5 py-2" onClick={(event) => event.stopPropagation()}>
                            <a href={`tel:${lead.phone}`} aria-label={`Call ${lead.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                              <svg {...iconProps}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
                            </a>
                            <a href={whatsappLink(lead.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${lead.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                              <svg {...iconProps}><path d="M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12Z" /></svg>
                            </a>
                            {next && (
                              <button type="button" onClick={() => void moveLead(lead, next)} className="ml-auto inline-flex items-center gap-1 min-h-9 rounded-lg bg-blue-50 px-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
                                {stageMeta(next).label}
                                <svg {...iconProps} className="w-3.5 h-3.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    {stageLeads.length === 0 && (
                      <p className="h-24 grid place-items-center px-4 text-center rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400">
                        {hasFilters ? "No matching leads" : "Drop leads here"}
                      </p>
                    )}
                  </div>
                </section>
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
