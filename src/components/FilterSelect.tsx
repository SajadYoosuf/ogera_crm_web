"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

export type FilterOption = { value: string; label: string; count?: number; dot?: string };

function Icon({ children, className = "w-4 h-4" }: { children: ReactNode; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

/** Styled single-select dropdown (native <select> popups can't be themed). */
export default function FilterSelect({ label, value, onChange, options, icon, className = "w-full sm:w-60" }: {
  label: string; value: string; onChange: (value: string) => void; options: FilterOption[]; icon: ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

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
        aria-label={`${label}: ${current.label}`}
        onClick={() => setOpen((previous) => !previous)}
        className={`flex w-full min-h-11 items-center justify-between gap-2 rounded-xl border bg-white px-3.5 text-sm shadow-xs transition-colors hover:border-gray-300 ${open ? "border-blue-600 ring-2 ring-blue-600/15" : "border-gray-200"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-gray-400"><Icon>{icon}</Icon></span>
          <span className="font-medium text-gray-400">{label}</span>
          <span className="truncate font-bold capitalize text-gray-900">{current.label}</span>
        </span>
        <Icon className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></Icon>
      </button>

      {open && (
        <ul role="listbox" aria-label={label} className="absolute right-0 z-30 mt-2 max-h-80 w-full min-w-60 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { onChange(option.value); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm capitalize transition-colors ${selected ? "bg-blue-50 font-bold text-blue-700" : "font-medium text-gray-700 hover:bg-gray-50"}`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {option.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${option.dot}`} />}
                    <span className="truncate">{option.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {option.count !== undefined && <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${selected ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{option.count}</span>}
                    {selected && <Icon className="w-4 h-4 text-blue-600"><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>}
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
