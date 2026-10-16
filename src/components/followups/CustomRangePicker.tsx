"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, fromISO, toISO } from "@/components/tasks/calendar";

const ACCENT = "#0E7A4F";
const ACCENT_LIGHT = "rgba(14,122,79,0.1)";
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── calendar grid helpers ────────────────────────────────────────────────────

function monFirstOffset(d: Date) { return (d.getDay() + 6) % 7; }

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = monFirstOffset(first);
  const cells: { iso: string; num: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i);
    cells.push({ iso: toISO(d), num: d.getDate(), inMonth: d.getMonth() === month });
  }
  // trim last row if all out-of-month
  return cells.slice(36).every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
}

function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// ── display helpers ──────────────────────────────────────────────────────────

function fmtLong(iso: string) {
  const d = fromISO(iso);
  return `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })} ${d.getFullYear()}`;
}

// ── presets ──────────────────────────────────────────────────────────────────

export const PRESETS = [
  { id: "last_week",  label: "Last week" },
  { id: "last_month", label: "Last month" },
  { id: "last_3",     label: "Last 3 months" },
  { id: "last_6",     label: "Last 6 months" },
  { id: "last_year",  label: "Last year" },
];

export function presetRange(today: string, id: string): { from: string; to: string } {
  const d = fromISO(today);
  const y = d.getFullYear(); const m = d.getMonth();
  switch (id) {
    case "last_week": {
      const dow = (d.getDay() + 6) % 7;
      const mon = addDays(today, -dow);
      return { from: addDays(mon, -7), to: addDays(mon, -1) };
    }
    case "last_month":
      return { from: toISO(new Date(y, m - 1, 1)), to: toISO(new Date(y, m, 0)) };
    case "last_3":
      return { from: toISO(new Date(y, m - 3, 1)), to: today };
    case "last_6":
      return { from: toISO(new Date(y, m - 6, 1)), to: today };
    case "last_year":
      return { from: toISO(new Date(y - 1, 0, 1)), to: toISO(new Date(y - 1, 11, 31)) };
    default:
      return { from: today, to: today };
  }
}

function activePreset(today: string, from: string, to: string): string | null {
  for (const p of PRESETS) {
    const r = presetRange(today, p.id);
    if (r.from === from && r.to === to) return p.id;
  }
  return null;
}

// ── component ────────────────────────────────────────────────────────────────

export default function CustomRangePicker({ from, to, today, onApply, onCancel, onClear }: {
  from: string;
  to: string;
  today: string;
  onApply: (from: string, to: string) => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  const [draftFrom, setDraftFrom] = useState(from || "");
  const [draftTo,   setDraftTo]   = useState(to   || "");
  const [hover, setHover] = useState("");
  const [left, setLeft] = useState(() => {
    const d = from ? fromISO(from) : fromISO(today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const right = addMonths(left.year, left.month, 1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onCancel(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onCancel]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onCancel]);

  function clickDay(iso: string) {
    if (iso > today) return;
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(iso); setDraftTo(""); setHover("");
    } else if (iso < draftFrom) {
      setDraftFrom(iso); setDraftTo("");
    } else if (iso === draftFrom) {
      setDraftFrom(""); setDraftTo("");
    } else {
      setDraftTo(iso); setHover("");
    }
  }

  function applyPreset(id: string) {
    const r = presetRange(today, id);
    setDraftFrom(r.from); setDraftTo(r.to); setHover("");
    const d = fromISO(r.from);
    setLeft({ year: d.getFullYear(), month: d.getMonth() });
  }

  function dayCls(iso: string, inMonth: boolean) {
    const base = "flex items-center justify-center h-7 text-[12px] select-none rounded-[7px] transition-colors ";
    if (!inMonth || iso > today) return base + "text-[#C7CBD1] pointer-events-none";
    const effectiveTo = draftTo || (draftFrom && hover && hover >= draftFrom ? hover : "");
    if (iso === draftFrom || iso === draftTo) return base + "text-white font-bold cursor-pointer";
    if (effectiveTo && iso > draftFrom && iso < effectiveTo) return base + "text-[#0E4D3A] font-semibold cursor-pointer";
    if (iso === today) return base + "text-[#1A1C21] font-bold cursor-pointer";
    return base + "text-[#3A3E4A] cursor-pointer hover:bg-[#EAF2EC]";
  }

  function dayStyle(iso: string, inMonth: boolean): React.CSSProperties {
    if (!inMonth || iso > today) return {};
    const effectiveTo = draftTo || (draftFrom && hover && hover >= draftFrom ? hover : "");
    if (iso === draftFrom || iso === draftTo) return { background: ACCENT };
    if (effectiveTo && iso > draftFrom && iso < effectiveTo) return { background: ACCENT_LIGHT };
    if (iso === today) return { boxShadow: `inset 0 0 0 1.5px ${ACCENT}` };
    return {};
  }

  function renderMonth(year: number, month: number, side: "left" | "right") {
    const cells = monthGrid(year, month);
    return (
      <div className={`flex-1 px-3.5 py-3 ${side === "left" ? "border-r border-[#F3F3F5]" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          {side === "left"
            ? <button type="button" aria-label="Previous month" onClick={() => setLeft(addMonths(left.year, left.month, -1))} className="w-[26px] h-[26px] flex items-center justify-center bg-transparent border-none rounded-md text-[#6B7080] hover:bg-gray-100 cursor-pointer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            : <span className="w-[26px]" />}
          <span className="text-[13.5px] font-bold text-[#1A1C21]">{MONTHS[month]} {year}</span>
          {side === "right"
            ? <button type="button" aria-label="Next month" onClick={() => setLeft(addMonths(left.year, left.month, 1))} className="w-[26px] h-[26px] flex items-center justify-center bg-transparent border-none rounded-md text-[#6B7080] hover:bg-gray-100 cursor-pointer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            : <span className="w-[26px]" />}
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-0.5">
          {WEEKDAYS.map((w) => <span key={w} className="text-center text-[10.5px] font-bold text-[#9AA0AC] py-1">{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell) => (
            <span
              key={cell.iso}
              className={dayCls(cell.iso, cell.inMonth)}
              style={dayStyle(cell.iso, cell.inMonth)}
              onClick={() => clickDay(cell.iso)}
              onMouseEnter={() => { if (draftFrom && !draftTo) setHover(cell.iso); }}
              onMouseLeave={() => { if (!draftTo) setHover(""); }}
            >
              {cell.inMonth ? cell.num : ""}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const active = draftFrom && draftTo ? activePreset(today, draftFrom, draftTo) : null;
  const canApply = Boolean(draftFrom);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Choose a custom date range"
      className="absolute top-[calc(100%+8px)] left-0 w-[648px] bg-white border border-[#E5E7EA] rounded-[14px] shadow-[0_20px_48px_rgba(16,24,40,0.2)] flex flex-col overflow-hidden z-20"
      style={{ animation: "dpPop 0.16s ease both" }}
    >
      <style>{`@keyframes dpPop{0%{transform:translateY(-6px);opacity:0}100%{transform:translateY(0);opacity:1}}`}</style>

      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#EFEFF2] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-[34px] px-3 border border-[#DEE1E5] rounded-lg flex items-center text-[13.5px] font-semibold bg-[#F7F8F9]" style={{ color: draftFrom ? "#1A1C21" : "#9AA0AC" }}>
            {draftFrom ? fmtLong(draftFrom) : "Start date"}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A8F9C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          <span className="h-[34px] px-3 border border-[#DEE1E5] rounded-lg flex items-center text-[13.5px] font-semibold bg-[#F7F8F9]" style={{ color: draftTo ? "#1A1C21" : "#9AA0AC" }}>
            {draftTo ? fmtLong(draftTo) : "End date"}
          </span>
        </div>
        <button type="button" aria-label="Close" onClick={onCancel}
          className="w-[30px] h-[30px] flex items-center justify-center border-none bg-transparent rounded-[7px] text-[#6B7080] hover:bg-gray-100 cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex">
        {/* Preset rail */}
        <div className="w-[156px] shrink-0 border-r border-[#EFEFF2] p-2.5 flex flex-col gap-0.5">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => applyPreset(p.id)}
              className="text-left h-9 px-2.5 border-none rounded-lg font-[inherit] text-[13px] cursor-pointer transition-colors"
              style={active === p.id
                ? { background: ACCENT_LIGHT, color: "#0E4D3A", fontWeight: 700 }
                : { background: "transparent", color: "#3A3E4A", fontWeight: 500 }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Two calendars */}
        <div className="flex flex-1 min-w-0">
          {renderMonth(left.year, left.month, "left")}
          {renderMonth(right.year, right.month, "right")}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#EFEFF2] flex items-center justify-between gap-3">
        <button type="button" onClick={() => { setDraftFrom(""); setDraftTo(""); onClear(); }}
          className="h-9 px-2.5 border-none bg-transparent text-[#6B7080] font-[inherit] text-[13.5px] font-semibold cursor-pointer hover:text-[#1A1C21] transition-colors">
          Clear
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="h-9 px-4 border border-[#DEE1E5] bg-white rounded-lg text-[#3A3E4A] font-[inherit] text-[13.5px] font-semibold cursor-pointer hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="button" disabled={!canApply}
            onClick={() => onApply(draftFrom, draftTo || draftFrom)}
            className="h-9 px-[18px] border-none rounded-lg text-white font-[inherit] text-[13.5px] font-bold cursor-pointer disabled:opacity-40 transition-opacity"
            style={{ background: ACCENT }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
