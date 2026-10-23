"use client";

/**
 * NotificationBell — bell icon with unread badge + dropdown panel.
 *
 * HOW IT WORKS:
 *   - Renders a bell icon button with a red badge when unread_count > 0.
 *   - Clicking toggles a dropdown panel (NotificationPanel).
 *   - Clicking outside closes the panel.
 *   - All notification data comes from `useNotifications()` (60s polling).
 *   - FCM foreground messages trigger an immediate refresh via `useFcmToken(refresh)`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useFcmToken } from "@/hooks/useFcmToken";
import NotificationPanel from "./NotificationPanel";

interface Props {
  collapsed?: boolean;
}

export default function NotificationBell({ collapsed }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, markRead, markAllRead, refresh } = useNotifications();

  // Register FCM token once and refresh the inbox on foreground push.
  useFcmToken(refresh);

  const close = useCallback(() => setOpen(false), []);

  // Close panel on outside click
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onOutsideClick);
      return () => document.removeEventListener("mousedown", onOutsideClick);
    }
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className={`flex h-10 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-sm font-medium text-[#4B5060] transition-colors hover:bg-white/60 hover:text-[#1A1C21] ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
      >
        {/* Bell icon with badge */}
        <span className="relative shrink-0">
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </span>
        <span className={collapsed ? "lg:hidden" : ""}>Notifications</span>
      </button>

      {open && (
        <NotificationPanel
          notifications={notifications}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onClose={close}
        />
      )}
    </div>
  );
}
