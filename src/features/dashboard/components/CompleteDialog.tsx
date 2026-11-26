"use client";

import { useEffect } from "react";
import LeadTaskActions from "@/features/leads/components/LeadTaskActions";
import type { QueueItem } from "../api/dashboard";

/**
 * Completes a lead follow-up with the same form the Tasks page uses. A bottom sheet on phones.
 *
 * `onClose` should reload: the follow-up may already be completed, with only "schedule next" left to answer.
 */
export default function CompleteDialog({ item, onClose, onChanged, onCancel }: {
  item: QueueItem; onClose: () => void; onChanged: () => void; onCancel: () => void;
}) {
  // The page scrolls inside <main>, so that is what has to be held still behind the dialog.
  useEffect(() => {
    const scroller = document.querySelector("main");
    const before = scroller?.style.overflow ?? "";
    if (scroller) scroller.style.overflow = "hidden";
    return () => { if (scroller) scroller.style.overflow = before; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Complete follow-up for ${item.name}`} className="fixed inset-0 z-[1100] flex items-end justify-center bg-[rgba(17,18,20,0.45)] sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#0E4D3A]">{item.name}</p>
            <p className="truncate text-xs text-[#6B7080]">{item.title ?? "Follow-up"}</p>
          </div>
          <button type="button" onClick={onClose} className="h-11 shrink-0 rounded-lg px-3 !text-sm !font-semibold text-[#6B7080] hover:bg-[#F3F3F5] sm:h-9">Close</button>
        </div>
        <LeadTaskActions task={item} leadId={item.entity_id} leadName={item.name} initialMode="complete" onChanged={onChanged} onCancel={onCancel} />
      </div>
    </div>
  );
}
