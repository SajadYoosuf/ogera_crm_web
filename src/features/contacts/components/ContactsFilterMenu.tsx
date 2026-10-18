"use client";

import { useEffect, useRef, useState } from "react";
import FilterSelect from "@/components/FilterSelect";
import type { FilterGroup } from "@/components/FilterPanel";

/** One "Filters" button that opens a panel with every secondary filter, so the toolbar stays calm. */
export default function ContactsFilterMenu({ groups, onChange, onClear }: {
  groups: FilterGroup[]; onChange: (key: string, value: string) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeCount = groups.filter((group) => group.value).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("mousedown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="inline-flex h-[38px] items-center gap-1.5 rounded-[8px] border border-[#E1E1E6] bg-white px-3 text-sm font-medium text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5]"
      >
        <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" /></svg>
        Filter
        {activeCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0E4D3A] px-1.5 text-[11px] font-bold text-white">{activeCount}</span>}
      </button>

      {open && (
        // Phones: a full-screen sheet that scrolls, so the nested option lists are never clipped.
        // Wider screens: a panel under the button.
        <div role="dialog" aria-label="Filter contacts" className="fixed inset-0 z-[1100] overflow-y-auto bg-white p-5 sm:absolute sm:inset-auto sm:right-0 sm:z-30 sm:mt-2 sm:top-full sm:w-[min(640px,calc(100vw-2rem))] sm:overflow-visible sm:rounded-2xl sm:shadow-xl sm:ring-1 sm:ring-slate-900/5">
          <h2 className="text-sm font-semibold text-slate-900">Filter contacts</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.key}>
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">{group.label}</span>
                <FilterSelect
                  compact
                  hideLabel
                  label={group.label}
                  value={group.value}
                  onChange={(value) => onChange(group.key, value)}
                  options={[{ value: "", label: "All" }, ...group.options]}
                  className="w-full"
                />
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <button type="button" onClick={onClear} disabled={activeCount === 0} className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-40">
              Reset all
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
