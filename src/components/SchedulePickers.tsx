"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/** Simple date and time fields for scheduling. Dates are `YYYY-MM-DD` strings and times are `HH:MM`, so nothing drifts with the timezone. */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const parse = (value: string) => { const [y, m, d] = value.split("-").map(Number); return { y, m: m - 1, d }; };
/** Today as a local YYYY-MM-DD (not UTC, so it is right late in the evening). */
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
const toKey = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/** "Tue, 7 Oct" for a date, or the placeholder when there is none. */
function dayLabel(value: string, placeholder: string) {
  if (!value) return placeholder;
  const { y, m, d } = parse(value);
  return new Date(y, m, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "10:30 am" for an HH:MM time, or the placeholder when there is none. */
export function timeLabel(value: string, placeholder: string) {
  if (!value) return placeholder;
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "pm" : "am"}`;
}

type Placement = { sheet: boolean; left: number; top?: number; bottom?: number };

/** Opens a floating panel under (or over) its trigger, or a bottom sheet on phones. The position is worked out when it opens, so nothing moves while it is shown. */
function usePopover(width: number, height: number) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => setPlacement(null);
  const toggle = () => {
    if (placement) { close(); return; }
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    if (window.innerWidth < 640) { setPlacement({ sheet: true, left: 0 }); return; }
    const left = Math.min(Math.max(box.left, 12), window.innerWidth - width - 12);
    const roomBelow = window.innerHeight - box.bottom;
    setPlacement(roomBelow < height + 16 && box.top > roomBelow
      ? { sheet: false, left, bottom: window.innerHeight - box.top + 8 }
      : { sheet: false, left, top: box.bottom + 8 });
  };

  useEffect(() => {
    if (!placement) return;
    const outside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setPlacement(null);
    };
    // Escape closes only the picker (capture phase), not the drawer it sits in.
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setPlacement(null); } };
    // The drawer behind scrolls; the panel's own scrolling (the time list) must not close it.
    const scroll = (event: Event) => { if (!panelRef.current?.contains(event.target as Node)) setPlacement(null); };
    const resize = () => setPlacement(null);
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside);
    document.addEventListener("keydown", key, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [placement]);

  return { placement, panelRef, triggerRef, toggle, close };
}

function Panel({ placement, panelRef, width, label, children }: { placement: Placement; panelRef: React.RefObject<HTMLDivElement | null>; width: number; label: string; children: ReactNode }) {
  return (
    <>
      {placement.sheet && <div className="fixed inset-0 z-[1290] bg-slate-900/30" aria-hidden="true" />}
      <div ref={panelRef} role="dialog" aria-label={label}
        style={placement.sheet ? undefined : { left: placement.left, top: placement.top, bottom: placement.bottom, width }}
        className={`fixed z-[1300] border border-gray-200 bg-white p-3 shadow-2xl ${placement.sheet ? "inset-x-0 bottom-0 rounded-t-2xl p-4" : "rounded-2xl"}`}>
        {children}
      </div>
    </>
  );
}

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} /></svg>
);

function Trigger({ triggerRef, open, onClick, icon, text, filled, invalid, label }: {
  triggerRef: React.RefObject<HTMLButtonElement | null>; open: boolean; onClick: () => void; icon: ReactNode; text: string; filled: boolean; invalid?: boolean; label: string;
}) {
  return (
    <button ref={triggerRef} type="button" onClick={onClick} aria-haspopup="dialog" aria-expanded={open} aria-label={label}
      className={`flex min-h-11 w-full items-center gap-2 rounded-xl border bg-white px-3.5 text-sm shadow-xs transition-colors hover:border-gray-300 ${open ? "border-blue-600 ring-2 ring-blue-600/15" : invalid ? "border-red-400" : "border-gray-200"}`}>
      <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
      <span className={`truncate font-semibold ${filled ? "text-gray-900" : "text-gray-400"}`}>{text}</span>
    </button>
  );
}

/** One calendar month; days before `min` cannot be picked. */
export function DatePickerField({ value, onChange, min, label = "Date", placeholder = "Select date", invalid }: {
  value: string; onChange: (value: string) => void; min?: string; label?: string; placeholder?: string; invalid?: boolean;
}) {
  const { placement, panelRef, triggerRef, toggle, close } = usePopover(288, 340);
  const [todayKey] = useState(localToday);
  const [view, setView] = useState(() => ({ y: parse(value || min || todayKey).y, m: parse(value || min || todayKey).m }));

  const open = () => {
    if (!placement) { const base = parse(value || min || todayKey); setView({ y: base.y, m: base.m }); }
    toggle();
  };
  const move = (delta: number) => setView((current) => { const d = new Date(Date.UTC(current.y, current.m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  const offset = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7; // Monday-first
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, index) => toKey(view.y, view.m, index + 1))];
  const canGoBack = !min || toKey(view.y, view.m, 1) > min;

  return (
    <div className="relative">
      <Trigger triggerRef={triggerRef} open={Boolean(placement)} onClick={open} filled={Boolean(value)} invalid={invalid} label={`${label}: ${dayLabel(value, "none selected")}`} text={dayLabel(value, placeholder)}
        icon={<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>} />
      {placement && (
        <Panel placement={placement} panelRef={panelRef} width={288} label={`Choose ${label.toLowerCase()}`}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => move(-1)} disabled={!canGoBack} aria-label="Previous month" className="grid h-9 w-9 place-items-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Chevron dir="left" /></button>
            <p className="text-sm font-bold text-[#0a192f]">{MONTHS[view.m]} {view.y}</p>
            <button type="button" onClick={() => move(1)} aria-label="Next month" className="grid h-9 w-9 place-items-center rounded-lg text-gray-600 hover:bg-gray-100"><Chevron dir="right" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-gray-500">{WEEKDAYS.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
          <div role="grid" className="grid grid-cols-7 gap-y-0.5">
            {cells.map((key, index) => {
              if (!key) return <span key={`blank-${index}`} />;
              const off = Boolean(min && key < min);
              const selected = key === value;
              return (
                <button key={key} type="button" role="gridcell" aria-selected={selected} aria-label={new Date(parse(key).y, parse(key).m, parse(key).d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  disabled={off} onClick={() => { onChange(key); close(); }}
                  className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-sm transition ${selected ? "bg-blue-600 font-semibold text-white shadow-sm" : off ? "cursor-not-allowed text-gray-300" : "text-gray-800 hover:bg-blue-50"} ${key === todayKey && !selected ? "font-semibold text-blue-700 ring-1 ring-inset ring-blue-300" : ""}`}>
                  {parse(key).d}
                </button>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

const SLOTS = Array.from({ length: 27 }, (_, index) => {
  const minutes = 8 * 60 + index * 30; // 8:00 am to 9:00 pm in half-hour steps
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/** Half-hour slots through the working day, with a way back to "no specific time". */
export function TimePickerField({ value, onChange, label = "Time", placeholder = "Any time" }: { value: string; onChange: (value: string) => void; label?: string; placeholder?: string }) {
  const { placement, panelRef, triggerRef, toggle, close } = usePopover(288, 320);
  return (
    <div className="relative">
      <Trigger triggerRef={triggerRef} open={Boolean(placement)} onClick={toggle} filled={Boolean(value)} label={`${label}: ${timeLabel(value, "any time")}`} text={timeLabel(value, placeholder)}
        icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
      {placement && (
        <Panel placement={placement} panelRef={panelRef} width={288} label={`Choose ${label.toLowerCase()}`}>
          <button type="button" onClick={() => { onChange(""); close(); }} className={`mb-2 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${value === "" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}>No specific time</button>
          <div role="listbox" aria-label="Times" className="grid max-h-60 grid-cols-3 gap-1.5 overflow-y-auto">
            {SLOTS.map((slot) => (
              <button key={slot} type="button" role="option" aria-selected={slot === value} onClick={() => { onChange(slot); close(); }}
                className={`rounded-lg px-2 py-2 text-sm font-semibold transition ${slot === value ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-800 hover:bg-blue-50"}`}>{timeLabel(slot, "")}</button>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
