"use client";

import DateRangePicker from "@/components/DateRangePicker";
import { addDays, fromISO, startOfWeek, toISO } from "@/components/tasks/calendar";

export type PeriodMode = "day" | "week" | "month" | "last_month" | "all" | "custom";
export type Period = { mode: PeriodMode; anchor: string; from: string; to: string };

export const TODAY_ONLY = (today: string): Period => ({ mode: "day", anchor: today, from: today, to: today });

export const THIS_MONTH = (today: string): Period => {
  const d = fromISO(today);
  const from = toISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const to = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { mode: "month", anchor: today, from, to };
};

const MODES: { value: PeriodMode; label: string }[] = [
  { value: "day", label: "Today" }, { value: "week", label: "This Week" },
  { value: "month", label: "This Month" }, { value: "last_month", label: "Last Month" }, { value: "custom", label: "Custom" },
];

export function periodRange(mode: PeriodMode, anchor: string, custom: { from: string; to: string }) {
  if (mode === "day") return { from: anchor, to: anchor };
  if (mode === "week") { const from = startOfWeek(anchor); return { from, to: addDays(from, 6) }; }
  if (mode === "month") {
    const d = fromISO(anchor);
    return { from: toISO(new Date(d.getFullYear(), d.getMonth(), 1)), to: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }
  if (mode === "last_month") {
    const d = fromISO(anchor);
    return { from: toISO(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: toISO(new Date(d.getFullYear(), d.getMonth(), 0)) };
  }
  return mode === "custom" ? custom : { from: "", to: "" };
}

export function stepAnchor(mode: PeriodMode, anchor: string, direction: -1 | 1) {
  if (mode === "day") return addDays(anchor, direction);
  if (mode === "week") return addDays(anchor, 7 * direction);
  const d = fromISO(anchor);
  return toISO(new Date(d.getFullYear(), d.getMonth() + direction, 1));
}

export function titleOf(mode: PeriodMode, anchor: string) {
  if (mode === "day") return fromISO(anchor).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (mode === "month") return fromISO(anchor).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  if (mode === "last_month") {
    const d = fromISO(anchor);
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  const { from, to } = periodRange("week", anchor, { from: "", to: "" });
  const short = { day: "numeric", month: "short" } as const;
  return `${fromISO(from).toLocaleDateString("en-GB", short)} – ${fromISO(to).toLocaleDateString("en-GB", { ...short, year: "numeric" })}`;
}

const iconProps = { className: "h-4 w-4", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

/** Narrow a list to when leads were created: a day, week, month, year or custom range, with arrows to step through. */
export default function PeriodFilter({ period, today, onChange }: { period: Period; today: string; onChange: (period: Period) => void }) {
  const { mode, anchor } = period;
  const set = (next: Period) => onChange(next);
  const pickMode = (next: PeriodMode) => {
    if (next === mode) return;
    if (next === "custom") set({ mode: "custom", anchor: today, from: "", to: "" });
    else set({ mode: next, anchor: mode === "custom" ? today : anchor, ...periodRange(next, mode === "custom" ? today : anchor, period) });
  };
  const move = (next: string) => set({ mode, anchor: next, ...periodRange(mode, next, period) });
  const stepped = mode === "day" || mode === "week" || mode === "month";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div role="group" aria-label="Created period" className="inline-flex rounded-xl bg-gray-100 p-1">
        {MODES.map((option) => (
          <button key={option.value} type="button" aria-pressed={mode === option.value} onClick={() => pickMode(option.value)}
            className={`min-h-9 flex-1 rounded-lg px-3.5 text-sm font-bold transition-colors sm:flex-none ${mode === option.value ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>{option.label}</button>
        ))}
      </div>

      {stepped && (
        <div className="flex items-center justify-between gap-1">
          <button type="button" aria-label={`Previous ${mode}`} onClick={() => move(stepAnchor(mode, anchor, -1))} className="grid h-11 w-11 place-items-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"><svg {...iconProps}><path d="m15 6-6 6 6 6" /></svg></button>
          <p aria-live="polite" className="min-w-0 flex-1 px-1 text-center text-sm font-extrabold text-[#0a192f] sm:w-auto sm:min-w-40 sm:flex-none">{titleOf(mode, anchor)}</p>
          <button type="button" aria-label={`Next ${mode}`} onClick={() => move(stepAnchor(mode, anchor, 1))} disabled={periodRange(mode, anchor, period).to >= today} className="grid h-11 w-11 place-items-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"><svg {...iconProps}><path d="m9 6 6 6-6 6" /></svg></button>
          <button type="button" onClick={() => move(today)} disabled={periodRange(mode, anchor, period).to >= today && periodRange(mode, anchor, period).from <= today} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Today</button>
        </div>
      )}

      {mode === "custom" && (
        <DateRangePicker label="Created" from={period.from} to={period.to} onChange={(from, to) => set({ mode: "custom", anchor: today, from, to })} clearable={false} defaultOpen={!period.from} emptyLabel="Pick dates" className="w-full sm:w-72" />
      )}
    </div>
  );
}
