"use client";

/**
 * NotificationBell — bell button for the dashboard header with an unread badge.
 *
 * HOW IT WORKS:
 *   - Shows a bell icon. A red badge appears when there are unread notifications.
 *   - Clicking the bell opens the notification inbox as a modal (NotificationPanel).
 *   - Data comes from `useNotifications()` (60s polling).
 *   - FCM foreground messages trigger an immediate refresh via `useFcmToken(refresh)`.
 *
 * WHO SEES IT?
 *   Only managers and admins. The dashboard header decides this and only renders
 *   this component for them, so the polling and FCM setup run only for them.
 */
import { useCallback, useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useFcmToken } from "@/hooks/useFcmToken";
import NotificationPanel from "./NotificationPanel";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { notifications, unreadCount, markRead, markAllRead, refresh } = useNotifications();

  // Register FCM token once and refresh the inbox on foreground push.
  useFcmToken(refresh);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Notifications"
        aria-haspopup="dialog"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#DEE1E5] bg-white text-[#3A3E4A] hover:bg-[#F7F7F9]"
      >
        <svg className="size-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel
          notifications={notifications}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onClose={close}
        />
      )}
    </>
  );
}
