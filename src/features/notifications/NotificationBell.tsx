"use client";

/**
 * NotificationBell — bell with an unread badge and a dropdown panel.
 *
 * - Shows up to 50 notifications, unread first.
 * - Click a row: marks it read and, for leads, opens /dashboard/leads?lead={id}.
 * - Dismiss (×) deletes one; "Mark all read" clears the badge.
 * - Opening the panel also purges read notifications older than 30 days.
 * - Polls every 60 seconds while the tab is visible.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/auth";
import { subscribeNotificationStream } from "./stream";
import Spinner from "@/components/Spinner";
import {
  dismissNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  purgeOldNotifications,
  type AppNotification,
} from "./api";


export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`).getTime();
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** `align="left"` opens the panel to the right of the bell (used in the sidebar). */
export default function NotificationBell({ align = "right" }: { align?: "left" | "right" }) {
  const { token } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listNotifications(token);
      setItems(data.items);
      setUnread(data.unread_count);
      setError("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Live: the server pushes each new notification over a stream, and the list refreshes on every push.
  // onConnected reloads on each (re)connect, so anything sent while disconnected is picked up.
  useEffect(() => {
    if (!token) return;
    const first = window.setTimeout(() => { void load(); }, 0);
    const stop = subscribeNotificationStream(token, () => { void load(); }, () => { void load(); });
    return () => { window.clearTimeout(first); stop(); };
  }, [token, load]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && token) {
      setLoading(true);
      // Best-effort cleanup; the list reloads either way.
      void purgeOldNotifications(token).catch(() => undefined).finally(() => { void load(); });
    }
  }

  async function openItem(n: AppNotification) {
    if (!token) return;
    if (!n.is_read) {
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      void markNotificationRead(token, n.id).catch(() => undefined);
    }
    if (n.entity_type === "lead" && n.entity_id) {
      setOpen(false);
      const page = n.type === "whatsapp_inbound" ? "whatsapp-inbox" : "leads";
      router.push(`/dashboard/${page}?lead=${n.entity_id}`);
    }
  }

  async function dismiss(n: AppNotification) {
    if (!token) return;
    setItems((cur) => cur.filter((x) => x.id !== n.id));
    if (!n.is_read) setUnread((u) => Math.max(0, u - 1));
    try { await dismissNotification(token, n.id); } catch { void load(); }
  }

  async function readAll() {
    if (!token) return;
    setItems((cur) => cur.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
    try { await markAllNotificationsRead(token); } catch { void load(); }
  }

  if (!token) return null;

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-[#4B5060] shadow-sm transition-colors hover:text-[#0E4D3A]"
      >
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span data-testid="unread-badge" className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#B42323] px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications"
          className={`absolute ${align === "left" ? "left-0" : "right-0"} z-[1200] mt-2 w-[min(92vw,380px)] overflow-hidden rounded-[14px] border border-[#DEE1E5] bg-white shadow-[0_16px_40px_rgba(16,24,40,0.18)]`}>
          <div className="flex items-center justify-between border-b border-[#EFEFF2] px-4 py-3">
            <p className="text-sm font-bold text-[#1A1C21]">Notifications</p>
            <button type="button" onClick={() => void readAll()} disabled={unread === 0}
              className="text-xs font-semibold text-[#0E7A4F] hover:underline disabled:text-gray-300 disabled:no-underline">
              Mark all read
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {error && <p role="alert" className="px-4 py-3 text-sm text-red-600">{error}</p>}
            {loading && items.length === 0 && (
              <div className="flex items-center justify-center gap-2 px-4 py-6">
                <Spinner size="sm" /><span className="text-sm text-gray-400">Loading…</span>
              </div>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-gray-500">You&apos;re all caught up.</p>
            )}
            <ul>
              {items.map((n) => (
                <li key={n.id} className={`group flex gap-3 border-b border-[#F3F4F6] px-4 py-3 last:border-0 ${n.is_read ? "bg-white" : "bg-[#0E7A4F]/[0.06]"}`}>
                  <button type="button" onClick={() => void openItem(n)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#1A1C21]">
                      {!n.is_read && <span aria-label="unread" className="h-2 w-2 shrink-0 rounded-full bg-[#0E7A4F]" />}
                      <span className="truncate">{n.title}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-[#3A3E4A]">{n.message}</p>
                    <p className="mt-1 text-[11.5px] text-[#8A8F9C]">{timeAgo(n.created_at)}</p>
                  </button>
                  <button type="button" onClick={() => void dismiss(n)} aria-label={`Dismiss ${n.title}`}
                    className="h-7 w-7 shrink-0 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
