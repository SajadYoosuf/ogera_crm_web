"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

/** The "..." actions for one contact row. The menu is fixed-positioned because the table wrapper clips anything absolute inside it. */
export default function ContactRowMenu({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const open = anchor !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setAnchor(null);
    const onPointerDown = (event: globalThis.MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) close(); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // The anchor is measured once, so any scroll or resize closes the menu instead of drifting away from its button.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    if (open) { setAnchor(null); return; }
    const box = event.currentTarget.getBoundingClientRect();
    setAnchor({ top: box.bottom + 4, right: window.innerWidth - box.right });
  };

  const choose = (action: () => void) => { setAnchor(null); action(); };

  return (
    <div ref={rootRef} className="inline-flex" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${label}`}
        onClick={toggle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#1A1C21] transition-colors hover:bg-[#F0F0F3]"
      >
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {anchor && (
        <div role="menu" style={{ top: anchor.top, right: anchor.right }} className="fixed z-50 w-44 rounded-xl border border-[#E1E1E6] bg-white p-1.5 text-left shadow-lg">
          <button type="button" role="menuitem" onClick={() => choose(onEdit)} className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-[#3A3E4A] hover:bg-[#F3F3F5]">
            Edit contact
          </button>
          <button type="button" role="menuitem" onClick={() => choose(onDelete)} className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
            Delete contact
          </button>
        </div>
      )}
    </div>
  );
}
