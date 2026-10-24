"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { ApiError } from "@/lib/api/auth";
import { getDashboardSummary, type DashboardLead, type DashboardRange, type DashboardSummary } from "@/lib/api/dashboard";
import {
  changeLine,
  dueTimeLabel,
  formatCount,
  initialOf,
  leadDisplayName,
  leadTypeLabel,
  overdueLabel,
  RANGE_OPTIONS,
  shortDate,
  stageColor,
  type Tone,
} from "./dashboard-format";

const SIGN_IN = "Sign in to see your dashboard.";
const LOAD_FAILED = "The dashboard could not be loaded. Please try again.";
const STAGE_ROWS = 8;
const TONE_CLASS: Record<Tone, string> = { up: "text-emerald-700", down: "text-red-600", muted: "text-[#8A8F9C]" };
const card = "rounded-2xl border border-[#E5E7EA] bg-white";
const noopSubscribe = () => () => {};

const icon = (children: ReactNode) => (
  <svg className="size-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const ICON_CONTACTS = icon(<><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" /><circle cx="10" cy="8" r="3.25" /><path d="M17.5 11.5h3M19 10v3" /></>);
const ICON_LEADS = icon(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="3" /></>);
const ICON_FOLLOWUPS = icon(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
const ICON_WON = icon(<><path d="M3 17.5 9 11l4 4 7.5-7.5" /><path d="M15 7.5h5.5V13" /></>);

function firstNameOf(stored: string | null): string {
  try {
    const name = (JSON.parse(stored ?? "null") as { name?: string } | null)?.name?.trim() ?? "";
    return name.split(/\s+/)[0] ?? "";
  } catch {
    return "";
  }
}

// Only managers and admins see the notification bell. Reads the role saved at login.
function roleOf(stored: string | null): string {
  try {
    return (JSON.parse(stored ?? "null") as { role?: string } | null)?.role ?? "";
  } catch {
    return "";
  }
}

function KpiCard({ label, glyph, tone, value, line }: { label: string; glyph: ReactNode; tone: string; value: number; line: { text: string; tone: Tone } }) {
  return (
    <div className={`${card} flex flex-col gap-2 p-3.5 shadow-sm sm:p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-[#6B7080] sm:text-[12.5px]">{label}</span>
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>{glyph}</span>
      </div>
      <span className="font-[family-name:var(--font-sora)] text-[24px] font-bold tracking-[-0.01em] text-[#1A1C21] sm:text-[26px]">{formatCount(value)}</span>
      <span className={`text-[11.5px] ${TONE_CLASS[line.tone]}`}>{line.text}</span>
    </div>
  );
}

function KpiSkeleton() {
  return <div className={`${card} h-[118px] animate-pulse bg-[#FAFAFB]`} aria-hidden="true" />;
}

function StatusPill({ slug, name }: { slug: string | null; name: string | null }) {
  const color = stageColor(slug);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap" style={{ background: `${color}1A`, color }}>
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: color }} />
      {name ?? "No stage"}
    </span>
  );
}

function LeadRow({ lead }: { lead: DashboardLead }) {
  const name = leadDisplayName(lead.name, lead.phone);
  return (
    <tr className="border-t border-[#EFEFF2] hover:bg-[#FAFAFB]">
      <td className="px-5">
        <div className="flex h-[54px] items-center gap-2.5">
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E7F5EE] text-[12px] font-bold text-[#0E4D3A]">{initialOf(name)}</span>
          <span className="font-semibold whitespace-nowrap text-[#1A1C21]">{name}</span>
        </div>
      </td>
      <td className="px-2.5 whitespace-nowrap text-[#3A3E4A]">{leadTypeLabel(lead.contact_type)}</td>
      <td className="px-2.5"><StatusPill slug={lead.stage_slug} name={lead.stage_name} /></td>
      <td className="px-2.5 whitespace-nowrap text-[#3A3E4A]">{lead.owner_name ?? "—"}</td>
      <td className="px-5 whitespace-nowrap text-[#6B7080]">{shortDate(lead.created_at)}</td>
    </tr>
  );
}

export default function DashboardHome() {
  const [range, setRange] = useState<DashboardRange>("month");
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // sessionStorage is browser-only, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(noopSubscribe, () => sessionStorage.getItem("ogera_user"), () => null);
  const firstName = firstNameOf(storedUser);
  const role = roleOf(storedUser);
  const canSeeNotifications = role === "manager" || role === "admin";

  useEffect(() => {
    let active = true; // a slower response for a range the user has left must not overwrite the current one
    (async () => {
      const accessToken = sessionStorage.getItem("ogera_access_token");
      if (!accessToken) {
        if (active) setError(SIGN_IN);
        return;
      }
      try {
        const summary = await getDashboardSummary(accessToken, range);
        if (active) {
          setData(summary);
          setError("");
        }
      } catch (caught) {
        if (active) setError(caught instanceof ApiError ? caught.message : LOAD_FAILED);
      }
    })();
    return () => {
      active = false;
    };
  }, [range, attempt]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  // Only numbers for the range on screen are shown. Anything older is left out while the new range loads.
  const shown = data?.range === range ? data : null;
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "";

  const pickRange = (value: DashboardRange) => {
    setRange(value);
    setError("");
    setMenuOpen(false);
  };

  const retry = () => {
    setError("");
    setAttempt((count) => count + 1);
  };

  const stages = shown?.stages ?? [];
  const maxStage = Math.max(1, ...stages.map((stage) => stage.count));
  const visibleStages = stages.slice(0, STAGE_ROWS);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex min-h-[72px] flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EA] bg-white px-5 pt-20 pb-4 sm:px-7 lg:pt-4">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-[20px] font-bold tracking-[-0.01em] text-[#1A1C21]">Dashboard</h1>
          <p className="mt-0.5 text-[12.5px] text-[#8A8F9C]">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canSeeNotifications && <NotificationBell />}

          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-[#DEE1E5] bg-white px-3.5 text-[13.5px] font-semibold text-[#3A3E4A] hover:bg-[#F7F7F9]"
            >
              <svg className="size-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
              {rangeLabel}
              <svg className="size-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute top-[44px] right-0 z-10 flex w-[180px] flex-col gap-0.5 rounded-[10px] border border-[#DEE1E5] bg-white p-1.5 shadow-[0_12px_28px_rgba(16,24,40,0.16)]">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.value === range}
                    onClick={() => pickRange(option.value)}
                    className={`rounded-md px-3 py-2 text-left text-[13px] ${option.value === range ? "bg-[rgba(14,122,79,0.08)] font-semibold text-[#0E4D3A]" : "text-[#3A3E4A] hover:bg-[#F3F3F5]"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-5 sm:gap-[18px] sm:px-7 sm:py-[22px]">
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            <span>{error}</span>
            {error !== SIGN_IN && (
              <button type="button" onClick={retry} className="cursor-pointer rounded-md border border-red-300 bg-white px-3 py-1 font-semibold text-red-700 hover:bg-red-100">Try again</button>
            )}
          </div>
        )}

        <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-3.5 xl:grid-cols-4">
          {shown ? (
            <>
              <KpiCard
                label="Total contacts"
                glyph={ICON_CONTACTS}
                tone="bg-[#E7F5EE] text-[#0E4D3A]"
                value={shown.kpis.total_contacts}
                line={{ text: `${formatCount(shown.kpis.new_leads.value)} added · ${shown.range_label.toLowerCase()}`, tone: "muted" }}
              />
              <KpiCard label="New leads" glyph={ICON_LEADS} tone="bg-sky-50 text-sky-600" value={shown.kpis.new_leads.value} line={changeLine(shown.kpis.new_leads)} />
              <KpiCard
                label="Open follow-ups"
                glyph={ICON_FOLLOWUPS}
                tone="bg-amber-50 text-amber-600"
                value={shown.kpis.open_followups.value}
                line={shown.kpis.open_followups.overdue > 0
                  ? { text: `${formatCount(shown.kpis.open_followups.overdue)} overdue`, tone: "down" }
                  : { text: "Nothing overdue", tone: "muted" }}
              />
              <KpiCard label="Won" glyph={ICON_WON} tone="bg-emerald-50 text-emerald-600" value={shown.kpis.won.value} line={changeLine(shown.kpis.won)} />
            </>
          ) : (
            <>
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </>
          )}
        </section>

        <div className="grid gap-3.5 lg:grid-cols-[1.2fr_1fr]">
          <section aria-label="Leads by status" className={`${card} flex flex-col gap-3.5 p-4 sm:p-5`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-bold text-[#1A1C21]">Leads by status</h2>
              <span className="text-[12px] text-[#9AA0AC]">{rangeLabel}</span>
            </div>
            {!shown ? (
              <div className="flex flex-col gap-3" aria-hidden="true">
                {[0, 1, 2, 3].map((row) => <div key={row} className="h-[30px] animate-pulse rounded-md bg-[#FAFAFB]" />)}
              </div>
            ) : stages.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#8A8F9C]">No leads were added in this period.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {visibleStages.map((stage) => (
                  <li key={stage.slug} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 font-semibold text-[#3A3E4A]">
                        <span aria-hidden="true" className="size-2 rounded-full" style={{ background: stageColor(stage.slug) }} />
                        {stage.name}
                      </span>
                      <span className="font-bold text-[#1A1C21]">{formatCount(stage.count)}</span>
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-full bg-[#F0F0F3]" role="img" aria-label={`${stage.name}: ${stage.count}`}>
                      <div className="h-full rounded-full" style={{ width: `${(stage.count / maxStage) * 100}%`, background: stageColor(stage.slug) }} />
                    </div>
                  </li>
                ))}
                {stages.length > STAGE_ROWS && (
                  <li className="text-[12px] text-[#8A8F9C]">+{stages.length - STAGE_ROWS} more stages</li>
                )}
              </ul>
            )}
          </section>

          <section aria-label="Today's followups" className={`${card} flex flex-col gap-3 p-4 sm:p-5`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-bold text-[#1A1C21]">Today&apos;s followups</h2>
              <Link href="/dashboard/tasks" className="text-[12.5px] font-semibold text-[#0E4D3A] hover:underline">View all</Link>
            </div>
            {!shown ? (
              <div className="flex flex-col gap-3" aria-hidden="true">
                {[0, 1, 2].map((row) => <div key={row} className="h-[44px] animate-pulse rounded-md bg-[#FAFAFB]" />)}
              </div>
            ) : shown.followups.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#8A8F9C]">No follow-ups due today. You&apos;re clear.</p>
            ) : (
              <>
                <ul className="flex flex-col">
                  {shown.followups.map((item) => {
                    const name = item.contact_id ? leadDisplayName(item.contact_name, item.contact_phone) : (item.title || "Task");
                    const detail = [item.contact_id ? item.title || "Follow-up" : "Standalone task", item.assigned_to_name].filter(Boolean).join(" · ");
                    const overdue = item.overdue_days > 0;
                    return (
                      <li key={item.id} className="flex items-center gap-2.5 border-t border-[#F3F3F5] py-2.5 first:border-t-0">
                        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E7F5EE] text-[12px] font-bold text-[#0E4D3A]">{initialOf(name)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-[#1A1C21]">{name}</p>
                          <p className="truncate text-[11.5px] text-[#8A8F9C]">{detail}</p>
                        </div>
                        <span className={`shrink-0 text-[11.5px] whitespace-nowrap ${overdue ? "font-semibold text-red-600" : "text-[#6B7080]"}`}>
                          {overdue ? overdueLabel(item.overdue_days) : dueTimeLabel(item.due_at)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {shown.followups_total > shown.followups.length && (
                  <Link href="/dashboard/tasks" className="text-[12px] font-semibold text-[#0E4D3A] hover:underline">
                    +{shown.followups_total - shown.followups.length} more on Tasks
                  </Link>
                )}
              </>
            )}
          </section>
        </div>

        <section aria-label="Recent leads" className={`${card} flex flex-col overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]`}>
          <div className="flex items-center justify-between border-b border-[#EFEFF2] px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#1A1C21]">Recent leads</h2>
            <Link href="/contacts" className="text-[12.5px] font-semibold text-[#0E4D3A] hover:underline">View all leads</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-[#F7F7F9] text-left text-[12.5px] text-[#4B5060]">
                  <th scope="col" className="px-5 py-2.5 font-medium">Lead</th>
                  <th scope="col" className="px-2.5 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-2.5 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-2.5 py-2.5 font-medium">Assigned To</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {!shown ? (
                  [0, 1, 2, 3, 4].map((row) => (
                    <tr key={row} className="border-t border-[#EFEFF2]"><td colSpan={5} className="h-[54px] animate-pulse bg-[#FAFAFB]" /></tr>
                  ))
                ) : shown.recent_leads.length === 0 ? (
                  <tr className="border-t border-[#EFEFF2]"><td colSpan={5} className="px-5 py-8 text-center text-[13px] text-[#8A8F9C]">No leads yet. New leads appear here as soon as they are added.</td></tr>
                ) : (
                  shown.recent_leads.map((lead) => <LeadRow key={lead.id} lead={lead} />)
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
