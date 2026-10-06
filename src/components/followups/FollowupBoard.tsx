"use client";

import Link from "next/link";
import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import FilterSelect from "@/components/FilterSelect";
import { ApiError } from "@/lib/api/auth";
import { listAllEmployees } from "@/lib/api/employees";
import { listLeadSources, type ApiContact } from "@/lib/api/contacts";
import { changeStage, listConsumerLeads } from "@/lib/api/leads";
import LeadPanel from "./LeadPanel";
import UnverifiedDialog from "./UnverifiedDialog";
import { NEXT_STAGE, STAGES, STAGE_BAR, columnFor, initials, stageMeta, whatsappLink, type StageSlug } from "./stages";

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
  const [source, setSource] = useState("");
  const [allSources, setAllSources] = useState<string[] | null>(null); // every active lead source, so the filter lists them all
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [blocked, setBlocked] = useState<{ leadName: string; stage: StageSlug; missing: string[] } | null>(null);
  const [panel, setPanel] = useState<{ id: number; target?: StageSlug } | null>(null);
  const [userId] = useState(currentUserId);
  const [staff, setStaff] = useState<{ id: number; name: string; role: string }[] | null>(null); // null until loaded, or when the viewer cannot read the staff list

  const load = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in to load your leads."); setIsLoading(false); return; }
    setError("");
    try {
      const [leadRows, staff, sourceNames] = await Promise.all([
        listConsumerLeads(accessToken),
        listAllEmployees(accessToken).catch(() => null),
        listLeadSources(accessToken).then((items) => items.map((item) => item.name)).catch(() => null),
      ]);
      setLeads(leadRows);
      if (sourceNames) setAllSources(sourceNames);
      if (staff) setStaff(staff.employees.filter((employee) => employee.is_active).map(({ id, name, role }) => ({ id, name, role })));
    } catch (caught) {
      setError(errorText(caught));
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Owners are the managers and other staff; admins are not listed. Without the staff list, fall back to who owns leads.
  const assignees = useMemo(
    () => [...new Set(staff ? staff.filter((member) => member.role !== "admin").map((member) => member.name) : leads.map((lead) => lead.assigned_to?.name).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b)),
    [leads, staff],
  );

  // All active sources from the API; if that call fails, fall back to the sources the leads use.
  const sources = useMemo(
    () => [...new Set(allSources ?? leads.map((lead) => lead.lead_source?.name).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b)),
    [leads, allSources],
  );

  // Leads are handed to sales executives and other staff, never to admins or managers.
  const owners = useMemo(() => staff?.filter((member) => member.role !== "admin" && member.role !== "manager").sort((a, b) => a.name.localeCompare(b.name)) ?? null, [staff]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) =>
      (!assignee || lead.assigned_to?.name === assignee) &&
      (!source || lead.lead_source?.name === source) &&
      (!dateFrom || lead.created_at.slice(0, 10) >= dateFrom) &&
      (!dateTo || lead.created_at.slice(0, 10) <= dateTo) &&
      (!needle || lead.name.toLowerCase().includes(needle) || lead.phone.includes(needle) || (lead.district ?? "").toLowerCase().includes(needle)));
  }, [leads, search, assignee, source, dateFrom, dateTo]);

  const byStage = useMemo(() => {
    const groups = new Map<StageSlug, ApiContact[]>(STAGES.map((stage) => [stage.slug, []]));
    for (const lead of visible) groups.get(columnFor(lead.lead_stage?.stage))?.push(lead);
    return groups;
  }, [visible]);

  const hasFilters = Boolean(search.trim() || assignee || source || dateFrom || dateTo);
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
    } catch (caught) {
      if (caught instanceof ApiError && caught.missingFields) { setBlocked({ leadName: lead.name, stage: slug, missing: caught.missingFields }); return; }
      setError(caught instanceof ApiError ? caught.message : "The stage could not be changed. Please try again.");
    }
  }

  const drop = (event: DragEvent<HTMLElement>, slug: StageSlug) => {
    event.preventDefault();
    const id = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
    const lead = leads.find((item) => item.id === id);
    if (lead) void moveLead(lead, slug);
  };

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
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex items-center h-11 w-full lg:max-w-md rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/15 transition-colors">
          <label className="sr-only" htmlFor="lead-search">Search leads</label>
          <svg className="w-4 h-4 ml-3.5 mr-2 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m16 16 4.25 4.25" /></svg>
          <input id="lead-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, phone or district" className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="p-2 mr-1 text-gray-400 hover:text-gray-700"><svg {...iconProps}><path d="M18 6 6 18M6 6l12 12" /></svg></button>}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto">
          <FilterSelect label="Assigned to" value={assignee} onChange={setAssignee} className="w-full sm:w-52"
            options={[{ value: "", label: "All" }, ...assignees.map((name) => ({ value: name, label: name }))]}
            icon={<><circle cx="12" cy="8" r="3.25" /><path d="M5 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1" /></>} />
          <FilterSelect label="Source" value={source} onChange={setSource} className="w-full sm:w-52"
            options={[{ value: "", label: "All" }, ...sources.map((name) => ({ value: name, label: name }))]}
            icon={<path d="M4 6h16M7 12h10M10 18h4" />} />
          <DateRangePicker label="Created" from={dateFrom} to={dateTo} onChange={(from, to) => { setDateFrom(from); setDateTo(to); }} className="w-full sm:w-72" />
          {hasFilters && <button type="button" onClick={() => { setSearch(""); setAssignee(""); setSource(""); setDateFrom(""); setDateTo(""); }} className="min-h-11 px-3 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">Clear filters</button>}
        </div>
      </section>

      {error && !isLoading ? (
        <div role="alert" className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
          </span>
          <h2 className="mt-5 text-lg font-extrabold text-[#0a192f] tracking-tight">Something went wrong</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">{error}</p>
          <button type="button" onClick={() => { setIsLoading(true); void load(); }} className="mt-6 inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Try again</button>
        </div>
      ) : isLoading ? (
        <div aria-busy="true" aria-label="Loading leads" className="space-y-6">
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }, (_, column) => (
              <div key={column} className="w-full sm:w-[300px] shrink-0 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden animate-pulse">
                <div className="h-1 bg-gray-200" />
                <div className="px-4 py-3 bg-white border-b border-gray-200 space-y-2"><div className="h-3.5 w-24 rounded bg-gray-200" /><div className="h-3 w-48 rounded bg-gray-100" /></div>
                <div className="p-3 space-y-3">
                  {Array.from({ length: column === 0 ? 3 : 2 }, (_, card) => (
                    <div key={card} className="rounded-xl border border-gray-200 bg-white p-3.5">
                      <div className="flex items-center gap-3"><span className="h-9 w-9 rounded-full bg-gray-200" /><span className="flex-1 space-y-2"><span className="block h-3.5 w-2/3 rounded bg-gray-200" /><span className="block h-3 w-1/2 rounded bg-gray-100" /></span></div>
                      <span className="mt-3 block h-5 w-28 rounded bg-gray-100" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : leads.length === 0 ? (
        <div role="status" className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" /><circle cx="10" cy="8" r="3.25" /><path d="M17.5 11.5h3M19 10v3" /></svg>
          </span>
          <h2 className="mt-5 text-lg font-extrabold text-[#0a192f] tracking-tight">No consumer leads yet</h2>
          <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">Consumer contacts you add appear here as New Leads.</p>
          <Link href="/contacts" className="mt-6 inline-flex min-h-11 items-center px-4 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">Go to Contacts</Link>
        </div>
      ) : (
        <>
          <div className="flex gap-4 overflow-x-auto pb-3 items-start snap-x snap-mandatory sm:snap-none">
            {STAGES.map((stage) => {
              const stageLeads = byStage.get(stage.slug) ?? [];
              const next = NEXT_STAGE[stage.slug];
              return (
                <section key={stage.slug} id={`stage-${stage.slug}`} aria-label={stage.label} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, stage.slug)}
                  className="w-[85vw] sm:w-[300px] shrink-0 snap-start flex flex-col rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
                  <div className={`h-1 ${STAGE_BAR[stage.slug]}`} />
                  <div className="px-4 pt-3 pb-3 bg-white border-b border-gray-200">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-extrabold text-[#0a192f] truncate">{stage.label}</h2>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${stage.badge}`}>{stageLeads.length}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-gray-500">{stage.description}</p>
                  </div>

                  <div className="p-3 space-y-3 max-h-[calc(100vh-22rem)] min-h-40 overflow-y-auto">
                    {stageLeads.map((lead) => {
                      return (
                        <article key={lead.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(lead.id))}
                          onClick={() => setPanel({ id: lead.id })}
                          className={`group rounded-xl border bg-white shadow-sm hover:shadow-md cursor-pointer sm:cursor-grab transition-all border-gray-200 hover:border-blue-200`}>
                          <div className="p-3.5">
                            <div className="flex items-start gap-3">
                              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold ${stageMeta(stage.slug).badge}`}>{initials(lead.name)}</span>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-gray-900 truncate">{lead.name}</h3>
                                <p className="text-xs text-gray-500 truncate">{lead.phone}{lead.district ? ` · ${lead.district}` : ""}</p>
                              </div>
                              {!lead.is_verified && <span title="Some details are still missing" className="shrink-0 h-2 w-2 mt-1.5 rounded-full bg-amber-400" />}
                            </div>
                            <p className="mt-2 text-[11px] text-gray-500 truncate">Assigned to: <span className="font-semibold text-gray-700">{lead.assigned_to?.name ?? "Unassigned"}</span></p>
                          </div>
                          <div className="flex items-center gap-1.5 border-t border-gray-100 px-2.5 py-2" onClick={(event) => event.stopPropagation()}>
                            <a href={whatsappLink(lead.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${lead.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.5 0 .17 5.33.17 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.35-1.66a11.86 11.86 0 0 0 5.7 1.45h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.16-3.42-8.43ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.77.99 1-3.67-.24-.38a9.87 9.87 0 0 1-1.52-5.27c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.98 2.9a9.8 9.8 0 0 1 2.9 6.99c0 5.46-4.44 9.9-9.89 9.9Zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" /></svg>
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
        <LeadPanel key={`${panelLead.id}-${panel?.target ?? ""}`} lead={panelLead} userId={userId} owners={owners} initialTarget={panel?.target} onUnverified={(stage, missing) => setBlocked({ leadName: panelLead.name, stage, missing })} onClose={() => setPanel(null)} onChanged={load} />
      )}

      {blocked && <UnverifiedDialog leadName={blocked.leadName} stageLabel={stageMeta(blocked.stage).label} missing={blocked.missing} onClose={() => setBlocked(null)} />}
    </div>
  );
}
