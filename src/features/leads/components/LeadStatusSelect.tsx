"use client";

/**
 * LeadStatusSelect — ONE colour-coded control for a lead's status: the pill
 * itself is the trigger, clicking it opens a themed popup list (styled the
 * same way as FilterSelect/SelectField elsewhere in the app — native <select>
 * popups can't be themed). No separate read-only badge next to it, so there's
 * only ever one status indicator per row.
 *
 * Shows a spinner in place of the pill while saving, then a green "Saved"
 * pill briefly on success (driven by the parent, which owns the request).
 */

import { useEffect, useRef, useState } from "react";
import { usePopoverFit } from "@/hooks/usePopoverFit";
import { statusBadgeClass, statusDotClass } from "./LeadStatusPill";
import type { LeadStatus, LeadStatusOption } from "@/features/leads/api/leads";

type Props = {
  status: LeadStatus;
  statuses: LeadStatusOption[];
  onChange: (value: LeadStatus) => void;
  isUpdating: boolean;
  justUpdated: boolean;
  label: string;
  /** True for converted leads: show the status as plain text, no popup. */
  locked?: boolean;
};

export default function LeadStatusSelect({ status, statuses, onChange, isUpdating, justUpdated, label, locked = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listStyle = usePopoverFit(open, rootRef, 180);

  // "converted" isn't a lead_statuses row (it's set by the Convert action), but an
  // already-converted lead must still appear as an option so its current value shows.
  const options = status === "converted" && !statuses.some((s) => s.value === "converted")
    ? [...statuses, { value: "converted", label: "Converted" }]
    : statuses;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("mousedown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  if (isUpdating) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" aria-hidden="true" />
        Saving…
      </span>
    );
  }
  if (justUpdated) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
        Saved
      </span>
    );
  }

  if (locked) {
    // Converted leads: plain pill, no popup, so the status cannot be changed here.
    return (
      <span
        title="Converted leads can't change status"
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(status)}`}
      >
        {options.find((s) => s.value === status)?.label ?? status}
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change status for ${label}`}
        onClick={() => setOpen((previous) => !previous)}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:brightness-95 ${statusBadgeClass(status)}`}
      >
        {options.find((s) => s.value === status)?.label ?? status}
        <svg className={`h-3 w-3 shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <ul style={listStyle} role="listbox" aria-label="Status" className="absolute top-full z-[1100] mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
          {options.map((option) => {
            const selected = option.value === status;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { setOpen(false); if (!selected) onChange(option.value); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${selected ? "bg-gray-50 font-bold text-gray-900" : "font-medium text-gray-700 hover:bg-gray-50"}`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(option.value)}`} />
                  <span className="truncate">{option.label}</span>
                  {selected && <svg className="ml-auto h-4 w-4 shrink-0 text-[#0E4D3A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
