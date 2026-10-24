"use client";

/**
 * NotificationPanel — the notification inbox shown as a centred modal.
 *
 * WHY A MODAL?
 *   The bell now lives in the dashboard header (right side). A modal gives the inbox
 *   enough room to read messages and closes with Escape or a click on the backdrop.
 *
 * INPUTS / OUTPUTS:
 *   - notifications: the list to show (newest first, from the API).
 *   - onMarkRead(id): marks one item as read on the server and in local state.
 *   - onMarkAllRead(): marks every item as read.
 *   - onClose(): asks the parent to hide the modal.
 *
 * SIDE EFFECTS:
 *   - Clicking an item marks it read, opens the linked page (if any) and closes the modal.
 *
 * WHY createPortal?
 *   The bell sits inside the dashboard header. A "fixed" element inside a parent that has
 *   a transform, filter or similar style is positioned relative to that parent, not the
 *   screen, so the modal would appear under the bell. Portal draws it directly in
 *   document.body, so it is always centred on the screen.
 */
import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Notification } from "@/types/notification";

interface Props {
  notifications: Notification[];
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function entityLink(notification: Notification): string | null {
  if (notification.entity_type === "contact" && notification.entity_id) {
    return `/contacts/${notification.entity_id}`;
  }
  if (
    (notification.entity_type === "task" || notification.entity_type === "followup") &&
    notification.entity_id
  ) {
    return `/dashboard/tasks`;
  }
  return null;
}

export default function NotificationPanel({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: Props) {
  const router = useRouter();
  const titleId = useId();

  // Escape closes the modal, like the other dialogs in the app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleItemClick(n: Notification) {
    onMarkRead(n.id);
    const link = entityLink(n);
    if (link) router.push(link);
    onClose();
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(640px,85dvh)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_8px_32px_rgba(31,38,135,0.16)]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 id={titleId} className="text-[16px] font-bold text-[#1A1C21]">Notifications</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs font-medium text-[#0E4D3A] hover:underline"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="grid h-8 w-8 place-items-center rounded-lg text-[#6B7080] hover:bg-gray-100"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 divide-y divide-gray-50 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[#6B7080]">
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleItemClick(n)}
                className={`block w-full px-5 py-3 text-left transition-colors hover:bg-gray-50 ${
                  !n.is_read ? "bg-[#F0FAF5]" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Unread dot */}
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      !n.is_read ? "bg-[#0E4D3A]" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${!n.is_read ? "font-semibold text-[#1A1C21]" : "font-medium text-[#4B5060]"}`}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#6B7080]">{n.message}</p>
                    <p className="mt-1 text-xs text-[#9BA3B2]">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
