"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { usePopoverFit } from "@/hooks/usePopoverFit";

export type FilterOption = { value: string; label: string; count?: number; dot?: string };

function Icon({ children, className = "w-4 h-4" }: { children: ReactNode; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

/**
 * Styled single-select dropdown (native <select> popups can't be themed).
 * `clearable`: with no option chosen the button shows only the label, and picking the chosen option again clears it (value "").
 */
export default function FilterSelect({ label, value, onChange, options, icon, className = "w-full sm:w-60", compact = false, hideLabel = false, clearable = false, fit = false }: {
  label: string; value: string; onChange: (value: string) => void; options: FilterOption[]; icon?: ReactNode; className?: string; compact?: boolean; hideLabel?: boolean; clearable?: boolean;
  /** Button sized to its content at the design's 38px height, with no minimum width. */
  fit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listStyle = usePopoverFit(open, rootRef, 240);
  const current = clearable && !value ? undefined : options.find((option) => option.value === value) ?? (clearable ? undefined : options[0]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("mousedown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current ? `${label}: ${current.label}` : label}
        onClick={() => setOpen((previous) => !previous)}
        className={fit
          ? `flex h-[38px] w-auto items-center gap-1.5 whitespace-nowrap rounded-[8px] border bg-white px-3 text-sm font-medium text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] ${open ? "border-[#0E4D3A]" : "border-[#DEE1E5]"}`
          : compact
          ? `flex h-11 w-full min-w-40 items-center justify-between gap-2 rounded-xl border bg-white px-3.5 text-sm shadow-xs transition-colors hover:border-slate-400 ${open ? "border-[#0E4D3A] ring-2 ring-[#0E4D3A]/15" : "border-slate-300"}`
          : `flex w-full min-h-11 items-center justify-between gap-2 rounded-xl border bg-white px-3.5 text-sm shadow-xs transition-colors hover:border-gray-300 ${open ? "border-[#0E4D3A] ring-2 ring-[#0E4D3A]/15" : "border-gray-200"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {!compact && icon && <span className="text-gray-400"><Icon>{icon}</Icon></span>}
          {!hideLabel && <span className={compact ? "text-slate-500" : "font-medium text-gray-400"}>{label}</span>}
          {current && <span className={`truncate capitalize ${compact ? "font-semibold text-slate-900" : "font-bold text-gray-900"}`}>{current.label}</span>}
        </span>
        <Icon className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></Icon>
      </button>

      {open && (
        <ul style={listStyle} role="listbox" aria-label={label} className="absolute top-full z-[1100] mt-2 max-h-[min(30rem,calc(100vh-14rem))] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { onChange(clearable && selected ? "" : option.value); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm capitalize transition-colors ${selected ? "bg-blue-50 font-bold text-blue-700" : "font-medium text-gray-700 hover:bg-gray-50"}`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {option.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${option.dot}`} />}
                    <span className="truncate">{option.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {option.count !== undefined && <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${selected ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{option.count}</span>}
                    {selected && <Icon className="w-4 h-4 text-[#0E4D3A]"><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
