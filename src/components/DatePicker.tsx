"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Values are `YYYY-MM-DD` strings. All arithmetic is done on UTC dates so it never drifts with the browser timezone. */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function istToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function parse(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return { y, m: m - 1, d };
}

function toKey(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

export function shiftDate(value: string, days: number) {
  const { y, m, d } = parse(value);
  return toKey(y, m, d + days);
}

function formatLabel(value: string, today: string) {
  if (value === today) return "Today";
  if (value === shiftDate(today, -1)) return "Yesterday";
  const { y, m, d } = parse(value);
  return d + " " + MONTHS[m].slice(0, 3) + " " + y;
}

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
  </svg>
);

type Props = {
  value: string;
  onChange: (value: string) => void;
  max?: string;
  min?: string;
};

export default function DatePicker({ value, onChange, max, min }: Props) {
  const today = istToday();
  const maxDate = max ?? today;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ y: parse(value).y, m: parse(value).m }));
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const disabled = useCallback((key: string) => key > maxDate || (min !== undefined && key < min), [maxDate, min]);

  useEffect(() => {
    if (!open) return;
    const down = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("touchstart", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m, 1));
    const offset = (first.getUTCDay() + 6) % 7; // Monday-first
    const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    const out: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= days; d++) out.push(toKey(view.y, view.m, d));
    return out;
  }, [view]);

  function toggle() {
    if (!open) setView({ y: parse(value).y, m: parse(value).m });
    setOpen((current) => !current);
  }

  function pick(key: string) {
    if (disabled(key)) return;
    onChange(key);
    setOpen(false);
  }

  function moveView(delta: number) {
    setView((current) => {
      const d = new Date(Date.UTC(current.y, current.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  function onGridKey(event: React.KeyboardEvent) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const step = steps[event.key];
    if (step === undefined) return;
    const active = (document.activeElement as HTMLElement | null)?.dataset.date;
    if (!active) return;
    event.preventDefault();
    const next = shiftDate(active, step);
    if (disabled(next)) return;
    const { y, m } = parse(next);
    setView({ y, m });
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>('[data-date="' + next + '"]')?.focus());
  }

  const prev = shiftDate(value, -1);
  const next = shiftDate(value, 1);
  const presets = [
    { label: "Today", key: today },
    { label: "Yesterday", key: shiftDate(today, -1) },
    { label: "7 days ago", key: shiftDate(today, -7) },
  ];

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(prev)} disabled={disabled(prev)} aria-label="Previous day" className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
          <Chevron dir="left" />
        </button>
        <button type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open} className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15">
          <svg className="h-4 w-4 shrink-0 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
            <path d="M8 3v4M16 3v4M3.5 10h17" />
          </svg>
          <span className="truncate">{formatLabel(value, today)}</span>
        </button>
        <button type="button" onClick={() => onChange(next)} disabled={disabled(next)} aria-label="Next day" className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
          <Chevron dir="right" />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-[1290] bg-slate-900/30 sm:hidden" aria-hidden="true" />
          <div role="dialog" aria-label="Choose date" className="fixed inset-x-0 bottom-0 z-[1300] rounded-t-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-12 sm:w-72 sm:rounded-2xl sm:p-3">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => moveView(-1)} aria-label="Previous month" className="grid h-8 w-8 place-items-center rounded-lg text-gray-600 hover:bg-gray-100"><Chevron dir="left" /></button>
              <p className="text-sm font-semibold text-gray-900">{MONTHS[view.m]} {view.y}</p>
              <button type="button" onClick={() => moveView(1)} aria-label="Next month" disabled={toKey(view.y, view.m + 1, 1) > maxDate} className="grid h-8 w-8 place-items-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Chevron dir="right" /></button>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-gray-500">
              {WEEKDAYS.map((day) => <span key={day} className="py-1">{day}</span>)}
            </div>
            <div ref={gridRef} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-y-0.5">
              {cells.map((key, index) => {
                if (!key) return <span key={"blank-" + index} />;
                const selected = key === value;
                const off = disabled(key);
                return (
                  <button
                    key={key}
                    type="button"
                    data-date={key}
                    role="gridcell"
                    aria-selected={selected}
                    disabled={off}
                    tabIndex={selected || (!cells.includes(value) && key.endsWith("-01")) ? 0 : -1}
                    onClick={() => pick(key)}
                    className={
                      "mx-auto grid h-9 w-9 place-items-center rounded-full text-sm transition " +
                      (selected ? "bg-blue-600 font-semibold text-white shadow-sm" : off ? "cursor-not-allowed text-gray-300" : "text-gray-800 hover:bg-blue-50") +
                      (key === today && !selected ? " ring-1 ring-inset ring-blue-300 font-semibold text-blue-700" : "")
                    }
                  >
                    {parse(key).d}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
              {presets.map((preset) => (
                <button key={preset.label} type="button" onClick={() => pick(preset.key)} className={"rounded-full px-3 py-1 text-xs font-semibold transition " + (preset.key === value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
