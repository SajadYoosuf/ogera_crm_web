"use client";

import { useEffect, useRef, useState } from "react";
import type { ContactSort } from "@/features/contacts/api/contacts";

export const SORT_OPTIONS: { value: ContactSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
];

/** "Sort by" button and its menu. The choice is applied by the server, so paging stays correct. */
export default function ContactsSortMenu({ value, onChange }: { value: ContactSort; onChange: (value: ContactSort) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="inline-flex h-[38px] items-center gap-1.5 rounded-[8px] border border-[#E1E1E6] bg-white px-3 text-sm font-medium text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5]"
      >
        <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" /></svg>
        Sort by
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-44 rounded-[10px] border border-[#E1E1E6] bg-white p-1.5 shadow-lg">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => { setOpen(false); onChange(option.value); }}
              className={`flex w-full items-center rounded-[8px] px-3 py-2 text-left text-sm hover:bg-[#F3F3F5] ${option.value === value ? "font-semibold text-[#1A1C21]" : "font-medium text-[#3A3E4A]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
