"use client";

/**
 * LeadActionMenu — kebab (⋮) dropdown for each lead row.
 *
 * Actions:
 *   Edit        — opens the lead detail modal
 *   Activity Log — opens the activity log form for this lead
 *   Follow-up   — opens the follow-up scheduler for this lead
 *   Convert     — opens the 2-step convert modal
 *   Delete      — inline confirmation (no window.confirm)
 *
 * Props:
 *   lead         — the lead row
 *   onEdit       — called when "Edit" is chosen
 *   onActivityLog — called when "Activity Log" is chosen
 *   onFollowup   — called when "Follow-up" is chosen
 *   onConvert    — called when "Convert" is chosen
 *   onDelete     — called when delete is confirmed; receives lead id
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LeadListItem } from "@/features/leads/api/leads";

type Props = {
  lead: LeadListItem;
  onEdit: () => void;
  onActivityLog: () => void;
  onFollowup: () => void;
  onConvert: () => void;
  /** Omit for staff: only admin/manager may delete, so no Delete item is shown. */
  onDelete?: (leadId: number) => Promise<void>;
};

export default function LeadActionMenu({ lead, onEdit, onActivityLog, onFollowup, onConvert, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The menu is portalled to <body> so the table's sticky Action column and its
  // overflow scroller can neither cover nor clip it. Position comes from the trigger.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setConfirming(false);
    }
    function close() {
      setOpen(false);
      setConfirming(false);
    }
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen((v) => !v);
    setConfirming(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(lead.id);
    } finally {
      setDeleting(false);
      setOpen(false);
      setConfirming(false);
    }
  }

  const isConverted = lead.status === "converted";
  const isLost = lead.status === "lost_lead";

  return (
    <div className="relative inline-block">
      {/* Kebab trigger */}
      <button
        ref={triggerRef}
        onClick={toggle}
        aria-label="Lead actions"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        <KebabIcon />
      </button>

      {open && pos && createPortal(
        <div ref={menuRef} style={{ top: pos.top, right: pos.right }} className="fixed z-50 min-w-[160px] rounded-xl border border-gray-100 bg-white shadow-lg ring-1 ring-black/5">
          {confirming ? (
            /* Delete confirmation inline */
            <div className="w-56 p-3">
              <p className="mb-2 text-xs font-medium text-gray-700">Delete this lead?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 whitespace-nowrap rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
                  className="flex-1 whitespace-nowrap rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <ul className="py-1" role="menu">
              <MenuItem onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}>
                Edit
              </MenuItem>
              <MenuItem onClick={(e) => { e.stopPropagation(); setOpen(false); onActivityLog(); }}>
                Activity Log
              </MenuItem>
              <MenuItem onClick={(e) => { e.stopPropagation(); setOpen(false); onFollowup(); }}>
                Follow-up
              </MenuItem>
              {!isConverted && !isLost && (
                <MenuItem onClick={(e) => { e.stopPropagation(); setOpen(false); onConvert(); }}>
                  Convert
                </MenuItem>
              )}
              {onDelete && (
                <>
                  <li role="separator" className="my-1 border-t border-gray-100" />
                  <MenuItem
                    onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
                    danger
                  >
                    Delete
                  </MenuItem>
                </>
              )}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  return (
    <li role="menuitem">
      <button
        onClick={onClick}
        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
          danger
            ? "text-red-600 hover:bg-red-50"
            : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        {children}
      </button>
    </li>
  );
}

function KebabIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="4" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="10" cy="16" r="1.5" />
    </svg>
  );
}
