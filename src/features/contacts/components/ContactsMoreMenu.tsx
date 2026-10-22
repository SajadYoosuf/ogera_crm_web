"use client";

import { useEffect, useRef, useState } from "react";
import { usePopoverFit } from "@/hooks/usePopoverFit";

/** Secondary actions for the contacts list: import and export. */
export default function ContactsMoreMenu({ onImport, onExport }: { onImport: () => void; onExport: () => void }) {
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

  const choose = (action: () => void) => { setOpen(false); action(); };
  const menuStyle = usePopoverFit(open, rootRef, 208);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Import or export contacts"
        className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#E1E1E6] bg-white px-2.5 text-sm font-medium text-[#3A3E4A] transition-colors hover:bg-[#F3F3F5] sm:px-3.5"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg>
        <span className="hidden sm:inline">Import / Export</span>
        <svg className="hidden h-3.5 w-3.5 sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div style={menuStyle} role="menu" className="absolute top-full z-30 mt-2 w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
          <button type="button" role="menuitem" onClick={() => choose(onImport)} className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-gray-50">
            Import contacts
          </button>
          <button type="button" role="menuitem" onClick={() => choose(onExport)} className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-gray-50">
            Export contacts
          </button>
        </div>
      )}
    </div>
  );
}
