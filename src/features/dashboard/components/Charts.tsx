"use client";

import { useState } from "react";
import { Empty } from "./Card";

/** Series colours, checked together for colour-blind separation and contrast on white. */
export const SERIES_GREEN = "#0E7A4F";
export const SERIES_VIOLET = "#5B3FD6";

export type Bar = { key: string; label: string; count: number };

/** Horizontal bars for one measure: every row names itself and shows its number. */
export function BarList({ items, empty }: { items: Bar[]; empty: string }) {
  const max = Math.max(0, ...items.map((item) => item.count));
  if (max === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-2 text-xs">
          <span className="truncate text-[#4B5060]" title={item.label}>{item.label}</span>
          <span className="h-3" aria-hidden="true">
            <span className="block h-3 rounded-r-[4px]" style={{ width: `${(item.count / max) * 100}%`, minWidth: item.count ? 3 : 0, background: SERIES_GREEN }} />
          </span>
          <span className="text-right font-semibold tabular-nums text-[#1A1C21]">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

export type Series = { key: string; label: string; color: string };
export type ColumnPoint = { label: string; values: Record<string, number> };

/** A clean top for the axis, chosen so that the middle tick is a whole number. */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 4, 6, 8, 10].map((step) => step * power).find((top) => top >= value) ?? 10 * power;
}

const HEIGHT = 140;

/**
 * Columns over time, one or two series on one axis. Hovering, tapping or focusing a date reads its values
 * out above the chart; the same numbers are in a table for screen readers.
 */
export function ColumnChart({ title, series, points, empty }: { title: string; series: Series[]; points: ColumnPoint[]; empty: string }) {
  const [active, setActive] = useState<number | null>(null);
  const largest = Math.max(0, ...points.flatMap((point) => series.map((s) => point.values[s.key] ?? 0)));
  if (largest === 0) return <Empty>{empty}</Empty>;
  const top = niceMax(largest);
  const shown = active !== null ? points[active] : undefined;
  const total = (key: string) => points.reduce((sum, point) => sum + (point.values[key] ?? 0), 0);
  const values = (read: (key: string) => number) => series.map((s) => `${s.label} ${read(s.key)}`).join(" · ");

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B5060]">
        <p aria-live="polite">{shown ? `${shown.label}: ${values((key) => shown.values[key] ?? 0)}` : `Total: ${values(total)}`}</p>
        {series.length > 1 && (
          <ul className="flex gap-3">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} aria-hidden="true" />{s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2" aria-hidden="true">
        <div className="flex flex-col justify-between text-right text-[11px] tabular-nums text-[#8A8F9C]" style={{ height: HEIGHT }}>
          <span className="-mt-1.5">{top}</span><span>{top / 2}</span><span className="-mb-1.5">0</span>
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: HEIGHT }}>
          {[0, 50, 100].map((at) => <span key={at} className="absolute inset-x-0 h-px bg-[#ECECF0]" style={{ top: `${at}%` }} />)}
          <div className="relative flex h-full items-end" onMouseLeave={() => setActive(null)}>
            {points.map((point, index) => (
              <button
                key={point.label}
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActive(index)}
                onClick={() => setActive(index)}
                className={`flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] px-px ${active === index ? "bg-[#0E7A4F]/[0.06]" : ""}`}
              >
                {series.map((s) => {
                  const value = point.values[s.key] ?? 0;
                  return <span key={s.key} className="block w-full max-w-6 rounded-t-[4px]" style={{ height: `${(value / top) * 100}%`, minHeight: value ? 2 : 0, background: s.color }} />;
                })}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pl-6 text-[11px] text-[#8A8F9C]" aria-hidden="true">
        <span>{points[0]?.label}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)].label}</span>}
        <span>{points[points.length - 1]?.label}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th scope="col">Date</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}><th scope="row">{point.label}</th>{series.map((s) => <td key={s.key}>{point.values[s.key] ?? 0}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
