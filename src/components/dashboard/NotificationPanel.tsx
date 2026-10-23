"use client";

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

  function handleItemClick(n: Notification) {
    onMarkRead(n.id);
    const link = entityLink(n);
    if (link) router.push(link);
    onClose();
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-[340px] z-[2000] rounded-2xl bg-white shadow-[0_8px_32px_rgba(31,38,135,0.16)] border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-[#1A1C21]">Notifications</span>
        <button
          onClick={onMarkAllRead}
          className="text-xs text-[#0E4D3A] hover:underline font-medium"
        >
          Mark all read
        </button>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
        {notifications.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#6B7080]">
            No notifications yet
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors block ${
                !n.is_read ? "bg-[#F0FAF5]" : ""
              }`}
            >
              <div className="flex gap-2.5 items-start">
                {/* Unread dot */}
                <span
                  className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${
                    !n.is_read ? "bg-[#0E4D3A]" : "bg-transparent"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${!n.is_read ? "font-semibold text-[#1A1C21]" : "font-medium text-[#4B5060]"}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-[#6B7080] mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-[#9BA3B2] mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
