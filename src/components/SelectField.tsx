"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePopoverFit } from "@/hooks/usePopoverFit";

export type SelectOption = { value: string; label: string };

/** Form-field dropdown with the same look as FilterSelect: label above, themed popup list, keyboard + outside-click close. */
export default function SelectField({ label, value, onChange, options, placeholder = "Select" }: {
  label: string; value: string; onChange: (value: string) => void; options: SelectOption[]; placeholder?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listStyle = usePopoverFit(open, rootRef, 160);
  const current = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("mousedown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <span id={id} className="text-xs font-semibold text-gray-700">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={id}
        onClick={() => setOpen((previous) => !previous)}
        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-sm shadow-xs transition-colors hover:border-gray-300 ${open ? "border-[#0E4D3A] ring-2 ring-[#0E4D3A]/15" : "border-gray-200"}`}
      >
        <span className={`truncate font-medium ${current && current.value ? "text-gray-900" : "text-gray-400"}`}>{current?.label ?? placeholder}</span>
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <ul style={listStyle} role="listbox" aria-labelledby={id} className="absolute top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { onChange(option.value); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${selected ? "bg-blue-50 font-bold text-blue-700" : "font-medium text-gray-700 hover:bg-gray-50"}`}
                >
                  <span className="truncate">{option.label}</span>
                  {selected && <svg className="h-4 w-4 shrink-0 text-[#0E4D3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
