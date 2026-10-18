"use client";

import Link from "next/link";
import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { istToday } from "@/components/DatePicker";
import { ApiError } from "@/lib/api/auth";
import { isMonitoringRole, listAllEmployees } from "@/lib/api/employees";
import { usePopoverFit } from "@/hooks/usePopoverFit";
import FilterSelect from "@/components/FilterSelect";
import { listLeadSources, type ApiContact } from "@/features/contacts/api/contacts";
import { changeStage, listLeads, type LeadKind } from "@/lib/api/leads";
import { TODAY_ONLY, periodRange, stepAnchor, titleOf, type Period, type PeriodMode } from "./PeriodFilter";
import { AVATAR_COLORS, FIELD_LABELS, STAGE_DESCRIPTIONS, formatCardDate, initials, stageColors, whatsappLink } from "./stages";
import { useStageTypes } from "./useStages";
import LeadPanel from "./LeadPanel";
import UnverifiedDialog from "./UnverifiedDialog";
import CustomRangePicker from "./CustomRangePicker";

const errorText = (caught: unknown) => (caught instanceof ApiError ? caught.message : "Could not load leads. Please try again.");

function BoardDropdown({ label, value, onChange, options, icon }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listStyle = usePopoverFit(open, ref, 160);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        className={`h-[38px] w-full min-w-0 sm:w-auto px-3 flex items-center gap-1.5 border rounded-[8px] bg-white text-[#3A3E4A] text-[13.5px] font-medium whitespace-nowrap cursor-pointer transition-colors hover:bg-[#F7F8F9] ${open ? "border-[#0E4D3A]" : "border-[#DEE1E5]"}`}
      >
        <span className="text-[#6B7080]">{icon}</span>
        <span className="truncate">{label} · {value || "All"}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <ul style={listStyle} role="listbox" aria-label={label} className="absolute top-full z-[1100] mt-1.5 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
          <li role="option" aria-selected={!value}>
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${!value ? "bg-blue-50 font-bold text-blue-700" : "font-medium text-gray-700 hover:bg-gray-50"}`}>
              All
              {!value && <svg className="ml-auto w-4 h-4 text-[#0E4D3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
            </button>
          </li>
          {options.map((opt) => (
            <li key={opt} role="option" aria-selected={value === opt}>
              <button type="button" onClick={() => { onChange(opt); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm capitalize transition-colors ${value === opt ? "bg-blue-50 font-bold text-blue-700" : "font-medium text-gray-700 hover:bg-gray-50"}`}>
                <span className="truncate">{opt}</span>
                {value === opt && <svg className="ml-auto shrink-0 w-4 h-4 text-[#0E4D3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function currentUserId(): number | null {
  try {
    const id = (JSON.parse(sessionStorage.getItem("ogera_user") ?? "null") as { id?: number } | null)?.id;
    return typeof id === "number" ? id : null;
  } catch { return null; }
}

const PERIOD_TABS: { value: PeriodMode; label: string }[] = [
  { value: "day", label: "Today" }, { value: "week", label: "This Week" },
  { value: "month", label: "This Month" }, { value: "last_month", label: "Last Month" }, { value: "custom", label: "Custom" },
];

const TYPE_COLORS: Record<LeadKind, { activeBg: string; activeFg: string }> = {
  consumer: { activeBg: "#EEF4FF", activeFg: "#1D5BBF" },
  partner:  { activeBg: "#F1EDFF", activeFg: "#5B3FD6" },
  dealer:   { activeBg: "#FFF3E0", activeFg: "#B45309" },
};

export default function FollowupBoard() {
  const [kind, setKind] = useState<LeadKind>("consumer");
  const [leads, setLeads] = useState<ApiContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("");
  const [source, setSource] = useState("");
  const [allSources, setAllSources] = useState<string[] | null>(null);
  const [today] = useState(istToday);
  const defaultPeriod = useCallback(() => TODAY_ONLY(istToday()), []);
  const [periods, setPeriods] = useState<Record<LeadKind, Period>>(() => ({
    consumer: defaultPeriod(), partner: defaultPeriod(), dealer: defaultPeriod(),
  }));
  const period = periods[kind];
  const setPeriod = useCallback((next: Period) => setPeriods((cur) => ({ ...cur, [kind]: next })), [kind]);
  const { from: dateFrom, to: dateTo } = period;
  const [showPicker, setShowPicker] = useState(false);
  const [blocked, setBlocked] = useState<{ leadName: string; stageLabel: string; missing: string[] } | null>(null);
  const [panel, setPanel] = useState<{ id: number; targetId?: number } | null>(null);
  const [userId] = useState(currentUserId);
  const [staff, setStaff] = useState<{ id: number; name: string; role: string }[] | null>(null);

  const { stages, isLoading: stagesLoading } = useStageTypes(kind);

  const load = useCallback(async () => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken) { setError("Sign in to load your leads."); setIsLoading(false); return; }
    setError("");
    try {
      const [leadRows, staffRows, sourceNames] = await Promise.all([
        listLeads(accessToken, kind, dateFrom || undefined, dateTo || undefined),
        listAllEmployees(accessToken).catch(() => null),
        listLeadSources(accessToken).then((items) => items.map((item) => item.name)).catch(() => null),
      ]);
      setLeads(leadRows);
      if (sourceNames) setAllSources(sourceNames);
      if (staffRows) setStaff(staffRows.employees.filter((e) => e.is_active).map(({ id, name, role }) => ({ id, name, role })));
    } catch (caught) {
      setError(errorText(caught));
    } finally { setIsLoading(false); }
  }, [kind, dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function selectKind(next: LeadKind) {
    if (next === kind) return;
    setPanel(null); setBlocked(null); setLeads([]); setIsLoading(true); setShowPicker(false); setKind(next);
  }

  const movePeriod = (dir: -1 | 1) => {
    const next = stepAnchor(period.mode, period.anchor, dir);
    setPeriod({ mode: period.mode, anchor: next, ...periodRange(period.mode, next, period) });
  };
  const pickPeriodMode = (mode: PeriodMode) => {
    setShowPicker(false);
    if (mode === "custom") {
      setPeriod({ mode: "custom", anchor: today, from: period.from || "", to: period.to || "" });
      setShowPicker(true);
      return;
    }
    if (mode === "last_month") {
      setPeriod({ mode: "last_month", anchor: today, ...periodRange("last_month", today, period) });
      return;
    }
    if (mode === period.mode) return;
    const anchor = period.mode === "custom" ? today : period.anchor;
    setPeriod({ mode, anchor, ...periodRange(mode, anchor, period) });
  };
  const { to: periodTo } = periodRange(period.mode, period.anchor, period);

  const assignees = useMemo(
    () => [...new Set(staff ? staff.filter((m) => !isMonitoringRole(m.role)).map((m) => m.name) : leads.map((l) => l.assigned_to?.name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [leads, staff],
  );
  const sources = useMemo(
    () => [...new Set(allSources ?? leads.map((l) => l.lead_source?.name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [leads, allSources],
  );
  const owners = useMemo(() => staff?.filter((m) => !isMonitoringRole(m.role)).sort((a, b) => a.name.localeCompare(b.name)) ?? null, [staff]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) =>
      (!assignee || lead.assigned_to?.name === assignee) &&
      (!source || lead.lead_source?.name === source) &&
      (!needle || (lead.name ?? "").toLowerCase().includes(needle) || lead.phone.includes(needle) || (lead.district ?? "").toLowerCase().includes(needle))
    );
  }, [leads, search, assignee, source]);

  const byStage = useMemo(() => {
    const groups = new Map<number, ApiContact[]>(stages.map((s) => [s.id, []]));
    for (const lead of visible) {
      const stageId = lead.lead_stage?.stage_id;
      if (stageId !== undefined && groups.has(stageId)) groups.get(stageId)?.push(lead);
    }
    return groups;
  }, [visible, stages]);

  const hasFilters = Boolean(search.trim() || assignee || source || period.mode !== "day" || period.anchor !== today);

  const panelLead = panel ? leads.find((l) => l.id === panel.id) ?? null : null;

  async function moveLead(lead: ApiContact, stageId: number, stageSlug: string) {
    const currentId = lead.lead_stage?.stage_id;
    if (currentId === stageId) return;
    if (stageSlug === "lost" || stageSlug === "aware") { setPanel({ id: lead.id, targetId: stageId }); return; }
    const accessToken = sessionStorage.getItem("ogera_access_token");
    if (!accessToken || userId === null) { setError("Sign in again to continue."); return; }
    setError("");
    try {
      await changeStage(accessToken, lead.id, userId, { stage_id: stageId });
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.missingFields) {
        const stageLabel = stages.find((s) => s.id === stageId)?.label ?? "that stage";
        setBlocked({ leadName: lead.name ?? lead.phone, stageLabel, missing: caught.missingFields });
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "The stage could not be changed. Please try again.");
    }
  }

  const drop = (event: DragEvent<HTMLElement>, stageId: number, stageSlug: string) => {
    event.preventDefault();
    const id = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
    const lead = leads.find((l) => l.id === id);
    if (lead) void moveLead(lead, stageId, stageSlug);
  };

  const boardLoading = isLoading || stagesLoading;

  return (
    <div className="flex flex-col bg-[#F4FBF7]" style={{ minHeight: "100dvh" }}>
      {/* ── Page header ── */}
      <header className="shrink-0 h-[72px] bg-white border-b border-[#E5E7EA] flex items-center justify-between gap-3 pl-16 pr-4 sm:pr-7 lg:pl-7">
        <h1 className="min-w-0 truncate text-xl sm:text-[26px] font-bold tracking-tight text-[#1A1C21]">Lead Pipeline</h1>
        <Link href="/contacts?add=1&returnTo=/dashboard/followups" className="shrink-0">
          <button type="button" className="h-10 px-3.5 sm:px-4 flex items-center gap-2 rounded-[10px] bg-[#0E7A4F] text-white text-sm font-semibold hover:bg-[#0B6640] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Add Lead
          </button>
        </Link>
      </header>

      {/* ── Content area ── */}
      <div className="flex-1 flex flex-col gap-3.5 p-5 lg:p-7 min-w-0">
        {/* ── Filter toolbar ── */}
        <div className="bg-white border border-[#E5E7EA] rounded-2xl px-3.5 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-3.5">
          <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">

            {/* Contact type tabs */}
            <div role="tablist" aria-label="Contact type" className="grid grid-cols-3 p-[3px] gap-[2px] bg-[#F2F3F5] border border-[#E5E7EA] rounded-[9px] sm:inline-flex">
              {(["consumer", "partner", "dealer"] as const).map((type) => {
                const on = kind === type;
                const colors = TYPE_COLORS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => selectKind(type)}
                    style={on ? { background: colors.activeBg, color: colors.activeFg } : undefined}
                    className={`h-[34px] min-w-0 truncate px-2 sm:px-4 rounded-[7px] text-sm font-bold border-none transition-colors ${on ? "shadow-sm" : "text-[#5F6473] font-medium bg-transparent hover:bg-white/60"}`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <label className="relative flex w-full items-center sm:w-auto">
              <span className="sr-only">Search leads</span>
              <svg className="absolute left-3 w-4 h-4 text-[#8A8F9C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone or district"
                className="h-[38px] w-full sm:w-[230px] pl-9 pr-3 border border-[#DEE1E5] rounded-[8px] text-[13.5px] text-[#1A1C21] bg-white placeholder:text-[#8A8F9C] focus:outline-none focus:ring-2 focus:ring-[#BFE6D2] focus:ring-offset-0"
              />
            </label>

            {/* Date range tabs */}
            <div className="relative w-full sm:w-auto">
              {/* Phones: one dropdown instead of the tab row, which doesn't fit */}
              <FilterSelect
                label="Period"
                value={period.mode}
                onChange={(next) => pickPeriodMode(next as PeriodMode)}
                options={PERIOD_TABS}
                className="w-full sm:hidden"
              />
              <div role="tablist" aria-label="Created period" className="hidden sm:flex p-[3px] gap-[2px] bg-[#F2F3F5] border border-[#E5E7EA] rounded-[9px]">
                {PERIOD_TABS.map(({ value, label }) => {
                  const on = period.mode === value;
                  return (
                    <button key={value} type="button" role="tab" aria-selected={on} onClick={() => pickPeriodMode(value)}
                      className={`h-[30px] px-3 rounded-[7px] text-[13px] border-none transition-colors ${on ? "bg-white text-[#1A1C21] font-semibold shadow-sm" : "bg-transparent text-[#5F6473] font-medium hover:bg-white/60"}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
              {period.mode === "custom" && showPicker && (
                <CustomRangePicker
                  from={period.from}
                  to={period.to}
                  today={today}
                  onApply={(f, t) => { setPeriod({ mode: "custom", anchor: today, from: f, to: t }); setShowPicker(false); }}
                  onCancel={() => setShowPicker(false)}
                  onClear={() => { setPeriod({ mode: "custom", anchor: today, from: "", to: "" }); setShowPicker(false); }}
                />
              )}
            </div>

            {/* Date navigation arrows + label (day / week / month only) */}
            {(period.mode === "day" || period.mode === "week" || period.mode === "month") && (
              <div className="flex items-center gap-1">
                <button type="button" aria-label={`Previous ${period.mode}`} onClick={() => movePeriod(-1)} className="w-8 h-8 flex items-center justify-center border border-[#DEE1E5] rounded-[7px] bg-white text-[#4B5060] hover:bg-gray-50 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span aria-live="polite" className="text-[13.5px] font-semibold text-[#1A1C21] px-0.5 whitespace-nowrap">{titleOf(period.mode, period.anchor)}</span>
                <button type="button" aria-label={`Next ${period.mode}`} onClick={() => movePeriod(1)} disabled={periodTo >= today} className="w-8 h-8 flex items-center justify-center border border-[#DEE1E5] rounded-[7px] bg-white text-[#4B5060] hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            )}
            {/* Last month label */}
            {period.mode === "last_month" && (
              <span className="text-[13.5px] font-semibold text-[#1A1C21] whitespace-nowrap">{titleOf("last_month", period.anchor)}</span>
            )}
            {/* Custom date range chip */}
            {period.mode === "custom" && !showPicker && (
              <button type="button" onClick={() => setShowPicker(true)} className="h-8 px-3 border border-[#DEE1E5] rounded-[7px] bg-white text-[#3A3E4A] text-[13px] font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#6B7080]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                {period.from && period.to
                  ? `${new Date(period.from).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(period.to).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                  : "Pick a date range"}
              </button>
            )}

          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
            {/* Lead owner */}
            <BoardDropdown
              label="Lead owner"
              value={assignee}
              onChange={setAssignee}
              options={assignees}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /></svg>}
            />

            {/* Source */}
            <BoardDropdown
              label="Source"
              value={source}
              onChange={setSource}
              options={sources}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" /></svg>}
            />

            {hasFilters && (
              <button type="button" onClick={() => { setSearch(""); setAssignee(""); setSource(""); setShowPicker(false); setPeriod(defaultPeriod()); }} className="h-[38px] px-3 border border-[#DEE1E5] rounded-[10px] bg-white text-[#3A3E4A] text-[13px] font-semibold hover:bg-gray-50 transition-colors">
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Board ── */}
        {error && !boardLoading ? (
          <div role="alert" className="bg-white rounded-2xl border border-gray-200 py-16 px-6 flex flex-col items-center text-center">
            <span className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
            </span>
            <h2 className="mt-5 text-lg font-bold text-[#1A1C21]">Something went wrong</h2>
            <p className="mt-2 max-w-sm text-sm text-gray-500">{error}</p>
            <button type="button" onClick={() => { setIsLoading(true); void load(); }} className="mt-6 min-h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Try again</button>
          </div>
        ) : boardLoading ? (
          <div aria-busy="true" aria-label="Loading pipeline" className="flex gap-3.5 overflow-hidden">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="w-[266px] shrink-0 rounded-2xl border border-[#E5E7EA] bg-white overflow-hidden animate-pulse">
                <div className="h-1 bg-gray-200" />
                <div className="px-3.5 py-3 border-b border-gray-100 space-y-2"><div className="h-3.5 w-24 rounded bg-gray-200" /><div className="h-3 w-40 rounded bg-gray-100" /></div>
                <div className="p-2.5 space-y-2.5">{Array.from({ length: 2 }, (_, j) => <div key={j} className="rounded-xl border border-gray-100 bg-gray-50 p-2.5 space-y-1.5"><div className="h-3.5 w-3/4 rounded bg-gray-200" /><div className="h-3 w-1/2 rounded bg-gray-100" /><div className="h-2.5 w-1/3 rounded bg-gray-100" /></div>)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex gap-3.5 overflow-x-auto pb-2.5"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#DEE1E5 transparent" }}
          >
            {stages.map((stage) => {
              const stageLeads = byStage.get(stage.id) ?? [];
              const colors = stageColors(stage.slug);
              const desc = STAGE_DESCRIPTIONS[stage.slug] ?? "";

              return (
                <section
                  key={stage.id}
                  aria-label={stage.label}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => drop(e, stage.id, stage.slug)}
                  className="w-[266px] shrink-0 flex flex-col bg-white border border-[#E5E7EA] rounded-2xl overflow-hidden"
                >
                  {/* Colored top bar */}
                  <div aria-hidden="true" style={{ height: 4, background: colors.bar }} />

                  {/* Column header */}
                  <div className="px-3.5 pt-3.5 pb-2.5 border-b border-[#EFEFF2]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-bold text-[#1A1C21]">{stage.label}</span>
                      <span
                        className="text-[11.5px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: colors.badgeBg, color: colors.badgeFg }}
                      >
                        {stageLeads.length}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-[#8A8F9C] leading-snug">{desc}</p>
                  </div>

                  {/* Cards */}
                  <div className="p-2.5 flex flex-col gap-[9px] flex-1 min-h-44 overflow-y-auto max-h-[calc(100vh-22rem)]">
                    {stageLeads.map((lead, idx) => {
                      const av = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                      const displayName = lead.name || lead.phone;
                      const meta = [lead.district, lead.lead_source?.name].filter(Boolean).join(" · ");
                      return (
                        <article
                          key={lead.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", String(lead.id))}
                          onClick={() => setPanel({ id: lead.id })}
                          className="bg-[#F7F8F9] border border-[#ECEEF0] rounded-xl px-[11px] py-[10px] flex flex-col gap-[6px] cursor-pointer hover:border-[#D8DBE0] hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12.5px] font-bold text-[#1A1C21] truncate">{displayName}</span>
                            <span
                              aria-hidden="true"
                              className="w-[21px] h-[21px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ background: av.bg, color: av.fg }}
                            >
                              {initials(displayName).charAt(0)}
                            </span>
                          </div>
                          <span className="text-[11.5px] text-[#6B7080] truncate">{meta || lead.phone}</span>
                          <span className="text-[10.5px] text-[#9AA0AC]">{formatCardDate(lead.created_at)}</span>
                        </article>
                      );
                    })}

                    {stageLeads.length === 0 && (
                      <div className="flex-1 min-h-24 border-[1.5px] border-dashed border-[#DEE1E5] rounded-xl flex items-center justify-center text-[11.5px] text-[#9AA0AC] text-center px-2">
                        {hasFilters ? "No matching leads" : "Drop leads here"}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}

            {stages.length === 0 && !boardLoading && (
              <div role="status" className="flex-1 bg-white rounded-2xl border border-[#E5E7EA] py-16 px-6 flex flex-col items-center text-center">
                <h2 className="text-base font-bold text-[#1A1C21]">No stages configured</h2>
                <p className="mt-2 text-sm text-gray-500">Add pipeline stages in Settings to start using the board.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {panelLead && (
        <LeadPanel
          key={`${panelLead.id}-${panel?.targetId ?? ""}`}
          lead={panelLead}
          kind={kind}
          stages={stages}
          userId={userId}
          owners={owners}
          initialTargetId={panel?.targetId}
          onUnverified={(stageLabel, missing) => setBlocked({ leadName: panelLead.name ?? panelLead.phone, stageLabel, missing })}
          onClose={() => setPanel(null)}
          onChanged={load}
        />
      )}

      {blocked && (
        <UnverifiedDialog
          leadName={blocked.leadName}
          stageLabel={blocked.stageLabel}
          missing={blocked.missing}
          onClose={() => setBlocked(null)}
        />
      )}
    </div>
  );
}
