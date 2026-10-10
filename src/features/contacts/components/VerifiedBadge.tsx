"use client";

import { useState } from "react";
import { FIELD_LABELS, type Contact } from "@/features/contacts/utils";

// Fixed-position tooltip, because the table wrapper clips anything absolutely positioned inside it.
export default function VerifiedBadge({ contact }: { contact: Contact }) {
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const show = (element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    setAnchor({ left: Math.min(Math.max(box.left + box.width / 2, 144), window.innerWidth - 144), top: box.bottom + 8 });
  };
  const hide = () => setAnchor(null);
  const verified = contact.isVerified;
  const tone = verified ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200 cursor-help";
  return (
    <span
      tabIndex={0}
      onMouseEnter={(event) => show(event.currentTarget)} onMouseLeave={hide}
      onFocus={(event) => show(event.currentTarget)} onBlur={hide}
      onKeyDown={(event) => { if (event.key === "Escape") hide(); }}
      aria-label={verified ? "Verified. All details are complete." : `Unverified. Still needed: ${contact.missingFields.map((field) => FIELD_LABELS[field] ?? field).join(", ")}`}
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider focus-visible:outline-2 focus-visible:outline-blue-600 ${tone}`}
    >
      {verified ? "Verified" : "Unverified"}
      {anchor && (
        <span role="tooltip" style={{ left: anchor.left, top: anchor.top }} className="fixed z-50 w-72 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 rounded-xl bg-[#0a192f] px-3.5 py-3 text-left text-xs font-medium normal-case tracking-normal text-white shadow-xl pointer-events-none">
          {verified ? "All details are complete." : (
            <>
              <span className="block font-bold">Fill in the remaining details:</span>
              <span className="mt-1.5 flex flex-col gap-1">
                {contact.missingFields.map((field) => <span key={field} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{FIELD_LABELS[field] ?? field.replaceAll("_", " ")}</span>)}
              </span>
              <span className="mt-2 block text-[11px] text-slate-300">Click the row to edit this contact.</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
