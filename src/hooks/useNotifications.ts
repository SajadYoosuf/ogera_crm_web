"use client";

/**
 * useNotifications — polls the notification inbox every 60 seconds.
 *
 * WHY POLLING AND NOT WEBSOCKETS?
 *   Polling is simpler to deploy (no persistent connection needed) and 60 seconds
 *   is fast enough for a CRM context. WebSockets or SSE can replace this later
 *   without changing the UI components.
 *
 * WHAT IT RETURNS:
 *   notifications  — the current inbox items
 *   unreadCount    — how many are unread (drives the bell badge)
 *   markRead(id)   — mark one notification as read
 *   markAllRead()  — clear the badge
 *   refresh()      — force an immediate fetch (called after an FCM foreground message)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Notification } from "@/types/notification";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api/notifications";

const POLL_INTERVAL_MS = 60_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch {
      // Silently ignore — a failed poll should not show an error to the user.
    }
  }, []);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  const markRead = useCallback(async (id: number) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, markRead, markAllRead, refresh };
}
