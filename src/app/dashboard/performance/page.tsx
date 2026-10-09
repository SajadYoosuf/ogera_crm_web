"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import PageHeader from "@/components/products/PageHeader";
import { getLeadSources, getPipeline, getSummary, getTeam, type DateRange, type LeadSourceRow, type PerformanceSummary, type PipelineRow, type TeamRow } from "@/lib/api/performance";

type Preset = "week" | "month" | "last_month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "custom", label: "Custom" },
];
const TEAM_ROLES = ["admin", "manager"];

function ymd(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function presetRange(preset: Exclude<Preset, "custom">): DateRange {
  const now = new Date();
  if (preset === "week") {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { start: ymd(monday), end: ymd(now) };
  }
  if (preset === "last_month") {
    return { start: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  return { start: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), end: ymd(now) };
}

const errorText = (caught: unknown) => (caught instanceof Error ? caught.message : "Something went wrong. Try again.");

type Section<T> = { data: T | null; loading: boolean; error: string; reload: () => void };

/** One independently loading section. A slower, older response never overwrites a newer one. */
function useSection<T>(enabled: boolean, fetcher: (accessToken: string) => Promise<T>): Section<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>({ data: null, loading: enabled, error: "" });
  const ticket = useRef(0);

  const load = useCallback(() => {
    const accessToken = sessionStorage.getItem("ogera_access_token");
    const mine = ++ticket.current;
    if (!accessToken) {
      setState({ data: null, loading: false, error: "Sign in to see performance." });
      return;
    }
    setState((current) => ({ ...current, loading: true, error: "" }));
    fetcher(accessToken)
      .then((data) => mine === ticket.current && setState({ data, loading: false, error: "" }))
      .catch((caught) => mine === ticket.current && setState((current) => ({ ...current, loading: false, error: errorText(caught) })));
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-range-change; load() owns the loading state
    load();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- a counter, not a DOM ref: bumping it drops in-flight responses
      ticket.current++;
    };
  }, [enabled, load]);

  return { ...state, reload: load };
}

export default function PerformancePage() {
  // sessionStorage is a browser-only store, so it is read after hydration with a null server snapshot.
  const storedUser = useSyncExternalStore(() => () => {}, () => sessionStorage.getItem("ogera_user"), () => null);
  const role = useMemo(() => {
    try {
      return storedUser ? ((JSON.parse(storedUser) as { role?: string }).role ?? "") : "";
    } catch {
      return "";
    }
  }, [storedUser]);
  const signedIn = Boolean(storedUser);
  const isTeam = TEAM_ROLES.includes(role);

  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState<DateRange>(() => presetRange("month"));
  const rangeValid = Boolean(range.start && range.end) && range.start <= range.end;

  const summary = useSection<PerformanceSummary>(signedIn && rangeValid, useCallback((token) => getSummary(token, range), [range]));
  const team = useSection<TeamRow[]>(signedIn && rangeValid && isTeam, useCallback((token) => getTeam(token, range), [range]));
  const pipeline = useSection<PipelineRow[]>(signedIn, useCallback((token) => getPipeline(token), []));
  const sources = useSection<LeadSourceRow[]>(signedIn && rangeValid, useCallback((token) => getLeadSources(token, range), [range]));

  if (!signedIn) return null;

  return (
    <div className="space-y-5 p-5 pt-20 lg:p-6 lg:pt-6">
      <PageHeader eyebrow="Sales performance" title="Performance" subtitle={isTeam ? "How the sales team is doing: activity, follow-ups, pipeline and lead sources." : "Your numbers: activity, follow-ups and your pipeline."}>
        {summary.data && summary.data.overdue_followups > 0 && (
          <span className="inline-flex items-center rounded-full bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-100">
            {summary.data.overdue_followups} overdue {summary.data.overdue_followups === 1 ? "follow-up" : "follow-ups"}
          </span>
        )}
      </PageHeader>

      <section className="z-10 space-y-3 lg:sticky lg:top-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Period" className="inline-flex rounded-xl bg-gray-100 p-1">
            {PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={preset === item.key}
                onClick={() => {
                  setPreset(item.key);
                  if (item.key !== "custom") setRange(presetRange(item.key));
                }}
                className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition-colors sm:flex-none sm:px-4 ${preset === item.key ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <DateRangePicker label="Dates" from={range.start} to={range.end} className="w-full sm:w-72" onChange={(start, end) => setRange({ start, end })} />
          )}
        </div>
        {!rangeValid && <p className="text-sm font-semibold text-gray-500">Pick a start and an end date to see numbers.</p>}
      </section>

      <SummaryCards section={summary} isTeam={isTeam} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {isTeam ? <TeamScorecard section={team} /> : <MyStats section={summary} />}
        <PipelineFunnel section={pipeline} />
      </div>

      <LeadSourceChart section={sources} />
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-extrabold text-[#0a192f]">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-6 animate-pulse rounded bg-gray-200" style={{ width: `${100 - i * 8}%` }} />
      ))}
    </div>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center">
      <h3 className="text-base font-extrabold text-[#0a192f]">Something went wrong</h3>
      <p className="mt-2 max-w-sm text-sm text-gray-500">{message}</p>
      <button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Try again</button>
    </div>
  );
}

/** Loading skeleton, error with retry, or the body. `empty` swaps in the empty-state text. */
function Body<T>({ section, empty, rows, children }: { section: Section<T>; empty?: (data: T) => boolean; rows?: number; children: (data: T) => React.ReactNode }) {
  if (section.error && !section.data) return <ErrorRow message={section.error} onRetry={section.reload} />;
  if (!section.data) return <Skeleton rows={rows} />;
  if (empty?.(section.data)) return <div role="status" className="rounded-xl border-2 border-dashed border-gray-200 px-6 py-10 text-center">
      <h3 className="text-base font-extrabold text-[#0a192f]">Nothing here yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">No data for this period. Try a wider date range.</p>
    </div>;
  return <div className={section.loading ? "opacity-60 transition-opacity" : ""}>{children(section.data)}</div>;
}

function SummaryCards({ section, isTeam }: { section: Section<PerformanceSummary>; isTeam: boolean }) {
  const data = section.data;
  const cards = [
    { label: isTeam ? "New contacts" : "My new contacts", value: data?.total_new_contacts, tone: "text-[#0a192f]" },
    { label: "Activities", value: data?.total_activities, tone: "text-[#0a192f]" },
    { label: "Deals won", value: data?.deals_won, tone: "text-emerald-600" },
    { label: "Deals lost", value: data?.deals_lost, tone: "text-rose-600" },
  ];
  return (
    <div>
      {section.error && !data && <ErrorRow message={section.error} onRetry={section.reload} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">{card.label}</p>
            {data ? (
              <p className={`mt-2 text-3xl font-extrabold tabular-nums ${card.tone}`}>{card.value}</p>
            ) : (
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-gray-100" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MyStats({ section }: { section: Section<PerformanceSummary> }) {
  return (
    <Card title="My stats" subtitle="Follow-ups waiting on you">
      <Body section={section} rows={2}>
        {(data) => (
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-extrabold tabular-nums ${data.overdue_followups > 0 ? "text-red-600" : "text-[#0a192f]"}`}>{data.overdue_followups}</span>
            <span className="text-sm text-gray-500">{data.overdue_followups === 1 ? "follow-up is overdue" : "follow-ups are overdue"}</span>
          </div>
        )}
      </Body>
    </Card>
  );
}

function TeamScorecard({ section }: { section: Section<TeamRow[]> }) {
  return (
    <Card title="Team scorecard" subtitle="Most overdue first, so you see who needs attention">
      <Body section={section} empty={(rows) => rows.length === 0}>
        {(rows) => (
          <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-3 text-[11px] font-extrabold">Name</th>
                  <th className="px-2 py-2 text-right">Added</th>
                  <th className="px-2 py-2 text-right">Activities</th>
                  <th className="px-2 py-2 text-right">Pending</th>
                  <th className="px-2 py-2 text-right">Overdue</th>
                  <th className="py-2 pl-2 text-right">Won</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.user_id} className="border-t border-gray-100">
                    <td className="py-3 pr-3 font-medium text-[#0a192f]">{row.name}</td>
                    <td className="px-2 text-right tabular-nums">{row.contacts_added_period}</td>
                    <td className="px-2 text-right tabular-nums">{row.activities_period}</td>
                    <td className="px-2 text-right tabular-nums">{row.followups_pending}</td>
                    <td className={`px-2 text-right tabular-nums ${row.followups_overdue > 0 ? "font-semibold text-red-600" : "text-gray-400"}`}>{row.followups_overdue}</td>
                    <td className="py-3 pl-2 text-right font-semibold tabular-nums text-emerald-600">{row.deals_won_period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Body>
    </Card>
  );
}

/** Blue gradient from the first stage to Negotiating, green for Won, red for Lost, teal for repeat customers. */
const OPEN_STAGES = ["new_lead", "first_call", "connected", "aware", "interested", "quoted", "negotiating"];
function stageColor(stage: string) {
  if (stage === "won") return "#059669";
  if (stage === "lost") return "#e11d48";
  if (stage === "repeat_customer") return "#0d9488";
  const step = Math.max(0, OPEN_STAGES.indexOf(stage));
  return `hsl(215 80% ${78 - step * (48 / (OPEN_STAGES.length - 1))}%)`;
}

function PipelineFunnel({ section }: { section: Section<PipelineRow[]> }) {
  return (
    <Card title="Pipeline" subtitle="Consumer contacts at each stage right now">
      <Body section={section} rows={8} empty={(rows) => rows.every((row) => row.count === 0)}>
        {(rows) => {
          const max = Math.max(1, ...rows.map((row) => row.count));
          return (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.stage} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[8rem_1fr]">
                  <span className="truncate text-sm text-gray-600">{row.label}</span>
                  <div className="flex h-7 items-center rounded bg-gray-50">
                    <div className="flex h-full items-center justify-end rounded px-2 text-xs font-semibold text-white" style={{ width: `${Math.max((row.count / max) * 100, row.count ? 8 : 0)}%`, backgroundColor: stageColor(row.stage) }}>
                      {row.count > 0 ? row.count : ""}
                    </div>
                    {row.count === 0 && <span className="pl-2 text-xs text-gray-400">0</span>}
                  </div>
                </li>
              ))}
            </ul>
          );
        }}
      </Body>
    </Card>
  );
}

function LeadSourceChart({ section }: { section: Section<LeadSourceRow[]> }) {
  return (
    <Card title="Lead sources" subtitle="Where this period's contacts came from, and how many were won">
      <Body section={section} empty={(rows) => rows.length === 0}>
        {(rows) => {
          const max = Math.max(1, ...rows.map((row) => row.count));
          return (
            <>
              <ul className="space-y-4">
                {rows.slice(0, 8).map((row) => (
                  <li key={row.source}>
                    <p className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-[#0a192f]">{row.source}</span>
                      <span className="text-gray-500">{row.converted} of {row.count} won</span>
                    </p>
                    <div className="space-y-1">
                      <div className="h-3 rounded bg-gray-100"><div className="h-full rounded bg-gray-400" style={{ width: `${(row.count / max) * 100}%` }} /></div>
                      <div className="h-3 rounded bg-gray-100"><div className="h-full rounded bg-emerald-500" style={{ width: `${(row.converted / max) * 100}%` }} /></div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-400" /> Total leads</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Won</span>
              </div>
            </>
          );
        }}
      </Body>
    </Card>
  );
}
