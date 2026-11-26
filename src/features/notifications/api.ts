/**
 * Notifications API — the bell panel in the dashboard header.
 *
 * Every call only ever touches the signed-in employee's own notifications.
 */

import { apiCall } from "@/lib/api/auth";

export type AppNotification = {
  id: number;
  /** lead_assigned | lead_created | followup_assigned | … */
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: number | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationList = { items: AppNotification[]; unread_count: number };

/** The panel shows at most this many. */
export const PANEL_LIMIT = 50;

/** GET /notifications — unread first, newest first. */
export const listNotifications = (token: string): Promise<NotificationList> =>
  apiCall<NotificationList>(token, "GET", `/notifications?limit=${PANEL_LIMIT}`);

/** POST /notifications/{id}/read */
export const markNotificationRead = (token: string, id: number): Promise<{ ok: boolean }> =>
  apiCall<{ ok: boolean }>(token, "POST", `/notifications/${id}/read`);

/** POST /notifications/read-all */
export const markAllNotificationsRead = (token: string): Promise<{ ok: boolean }> =>
  apiCall<{ ok: boolean }>(token, "POST", "/notifications/read-all");

/** DELETE /notifications/{id} — dismiss one. */
export const dismissNotification = (token: string, id: number): Promise<void> =>
  apiCall<void>(token, "DELETE", `/notifications/${id}`);

/** POST /notifications/purge — removes read notifications older than 30 days. */
export const purgeOldNotifications = (token: string): Promise<{ deleted: number }> =>
  apiCall<{ deleted: number }>(token, "POST", "/notifications/purge");

/** POST /employees/me/fcm-token — register this browser's push token. */
export const registerFcmToken = (token: string, fcmToken: string): Promise<{ ok: boolean }> =>
  apiCall<{ ok: boolean }>(token, "POST", "/employees/me/fcm-token", {
    token: fcmToken,
    platform: "web",
  });
