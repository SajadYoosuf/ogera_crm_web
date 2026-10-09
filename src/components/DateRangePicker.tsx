"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { istToday, shiftDate } from "./DatePicker";

/** Values are `YYYY-MM-DD` strings ("" = open ended). All arithmetic is on UTC dates so it never drifts with the browser timezone. */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const parse = (value: string) => { const [y, m, d] = value.split("-").map(Number); return { y, m: m - 1, d }; };
const toKey = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const short = (value: string, withYear: boolean) => { const { y, m, d } = parse(value); return `${d} ${MONTHS[m].slice(0, 3)}${withYear ? ` ${y}` : ""}`; };

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
  </svg>
);

/** Month shown on the left: the start date's month, or last month so that the right side shows this month. Never later than last month, since the right one cannot be in the future. */
function leftMonthFor(from: string, today: string) {
  const base = parse(from || today);
  const last = new Date(Date.UTC(parse(today).y, parse(today).m - 1, 1));
  const wanted = from ? new Date(Date.UTC(base.y, base.m, 1)) : last;
  const left = wanted > last ? last : wanted;
  return { y: left.getUTCFullYear(), m: left.getUTCMonth() };
}

function monthCells(y: number, m: number) {
  const offset = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // Monday-first
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const out: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) out.push(toKey(y, m, d));
  return out;
}

type Props = { label: string; from: string; to: string; onChange: (from: string, to: string) => void; className?: string;
  /** Form-field look: the caller shows the label above, so the trigger only shows the value, in regular weight. */
  bare?: boolean };

/** One control for a date range: presets, a calendar where two clicks pick the start and the end, and a clear action. */
export default function DateRangePicker({ label, from, to, onChange, className = "w-full sm:w-64", bare = false }: Props) {
  const today = istToday();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => leftMonthFor(from, today));
  const [anchor, setAnchor] = useState<string | null>(null); // first click of a range in progress
  const [hover, setHover] = useState<string | null>(null);
  const [top, setTop] = useState(0); // where the popover starts below the button (tablet and desktop)
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (event: MouseEvent | TouchEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("touchstart", down); document.removeEventListener("keydown", key); window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [open]);

  const right = useMemo(() => { const d = new Date(Date.UTC(view.y, view.m + 1, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; }, [view]);

  const monthStart = toKey(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1);
  const lastMonthStart = toKey(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1);
  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Yesterday", from: shiftDate(today, -1), to: shiftDate(today, -1) },
    { label: "Last 7 days", from: shiftDate(today, -6), to: today },
    { label: "Last 30 days", from: shiftDate(today, -29), to: today },
    { label: "This month", from: monthStart, to: today },
    { label: "Last month", from: lastMonthStart, to: shiftDate(monthStart, -1) },
    { label: "All time", from: "", to: "" },
  ];

  // The range being shown: the one in progress (anchor to hover) or the applied one.
  const [shownFrom, shownTo] = anchor
    ? [anchor, hover ?? anchor].sort()
    : [from, to];

  const hasValue = Boolean(from || to);
  const summary = !hasValue ? "All time" : from && to ? (from === to ? short(from, true) : `${short(from, parse(from).y !== parse(to).y)} – ${short(to, true)}`) : from ? `From ${short(from, true)}` : `Until ${short(to, true)}`;

  function toggle() {
    if (!open) { setTop((rootRef.current?.getBoundingClientRect().bottom ?? 0) + 8); setView(leftMonthFor(from, today)); setAnchor(null); setHover(null); }
    setOpen((current) => !current);
  }

  function pick(key: string) {
    if (key > today) return;
    if (!anchor) { setAnchor(key); setHover(key); return; }
    const [start, end] = [anchor, key].sort();
    onChange(start, end);
    setAnchor(null); setHover(null); setOpen(false);
  }

  function applyPreset(range: { from: string; to: string }) {
    onChange(range.from, range.to);
    setAnchor(null); setOpen(false);
  }

  function moveView(delta: number) {
    setView((current) => { const d = new Date(Date.UTC(current.y, current.m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${summary}`}
        className={`flex w-full min-h-11 items-center justify-between gap-2 rounded-xl border bg-white px-3.5 text-sm shadow-xs transition-colors hover:border-gray-300 ${open ? "border-blue-600 ring-2 ring-blue-600/15" : "border-gray-200"}`}>
        <span className="flex min-w-0 items-center gap-2">
          <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
          {!bare && <span className="font-medium text-gray-400">{label}</span>}
          <span className={`truncate ${bare ? "font-medium" : "font-bold"} ${hasValue ? "text-gray-900" : "text-gray-700"}`}>{summary}</span>
        </span>
        {hasValue ? (
          <span role="button" tabIndex={0} aria-label="Clear dates" onClick={(event) => { event.stopPropagation(); onChange("", ""); }}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onChange("", ""); } }}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </span>
        ) : (
          <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[1290] bg-slate-900/30 sm:hidden" aria-hidden="true" />
          <div role="dialog" aria-label={`Choose ${label.toLowerCase()} range`} style={{ top }} className="fixed inset-x-0 bottom-0 z-[1300] rounded-t-2xl border border-gray-200 bg-white p-4 shadow-2xl max-sm:top-auto! sm:inset-x-auto sm:bottom-auto sm:right-[50px] sm:w-[36.5rem] sm:max-w-[calc(100vw-5rem)] sm:rounded-2xl">
            <div className="flex flex-wrap gap-1.5 pb-3">
              {presets.map((preset) => {
                const active = preset.from === from && preset.to === to;
                return (
                  <button key={preset.label} type="button" onClick={() => applyPreset(preset)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{preset.label}</button>
                );
              })}
            </div>

            <div className="flex gap-6 border-t border-gray-100 pt-3">
              {([{ month: view, side: "left" }, { month: right, side: "right" }] as const).map(({ month, side }) => (
                <div key={side} className={side === "right" ? "hidden sm:block sm:w-[16.5rem]" : "w-full sm:w-[16.5rem]"}>
                  <div className="mb-2 flex h-9 items-center justify-between">
                    {side === "left" ? (
                      <button type="button" onClick={() => moveView(-1)} aria-label="Previous month" className="grid h-9 w-9 place-items-center rounded-lg text-gray-600 hover:bg-gray-100"><Chevron dir="left" /></button>
                    ) : <span className="hidden h-9 w-9 sm:block" />}
                    <p className="text-sm font-bold text-gray-900">{MONTHS[month.m]} {month.y}</p>
                    {/* On phones only the left month shows, so its arrow steps one month; on wider screens the right one carries the arrow. */}
                    {side === "left" ? (
                      <button type="button" onClick={() => moveView(1)} aria-label="Next month" disabled={toKey(month.y, month.m + 1, 1) > today} className="grid h-9 w-9 place-items-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 sm:hidden"><Chevron dir="right" /></button>
                    ) : (
                      <button type="button" onClick={() => moveView(1)} aria-label="Next month" disabled={toKey(month.y, month.m + 1, 1) > today} className="grid h-9 w-9 place-items-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Chevron dir="right" /></button>
                    )}
                    {side === "left" && <span className="hidden h-9 w-9 sm:block" />}
                  </div>
                  <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-gray-500">
                    {WEEKDAYS.map((day) => <span key={day} className="py-1">{day}</span>)}
                  </div>
                  <div role="grid" aria-label={`${MONTHS[month.m]} ${month.y}`} className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => setHover(anchor)}>
                    {monthCells(month.y, month.m).map((key, index) => {
                      if (!key) return <span key={`blank-${index}`} />;
                      const off = key > today;
                      const isStart = key === shownFrom;
                      const isEnd = key === shownTo;
                      const inRange = Boolean(shownFrom && shownTo && key > shownFrom && key < shownTo);
                      const edge = isStart || isEnd;
                      return (
                        <button key={key} type="button" role="gridcell" aria-selected={edge} disabled={off} onClick={() => pick(key)} onMouseEnter={() => { if (anchor) setHover(key); }}
                          className={`h-9 w-full text-sm transition ${edge ? "bg-blue-600 font-semibold text-white" : inRange ? "bg-blue-50 text-blue-800" : off ? "cursor-not-allowed text-gray-300" : "rounded-full text-gray-800 hover:bg-blue-50"} ${edge ? (isStart && isEnd ? "rounded-full" : isStart ? "rounded-l-full" : "rounded-r-full") : ""} ${key === today && !edge ? "font-semibold text-blue-700 ring-1 ring-inset ring-blue-300 rounded-full" : ""}`}>
                          {parse(key).d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
              {anchor ? `Start ${short(anchor, true)}. Now pick the end date.` : "Pick a start date, then an end date."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
