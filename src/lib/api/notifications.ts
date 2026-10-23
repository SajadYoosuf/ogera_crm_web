import { API_BASE_URL } from "./auth";
import type { NotificationListResponse } from "@/types/notification";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function getToken(): string {
  try {
    return localStorage.getItem("ogera_access_token") ?? "";
  } catch {
    return "";
  }
}

/** GET /notifications — fetch the inbox for the current user. */
export async function fetchNotifications(skip = 0, limit = 30): Promise<NotificationListResponse> {
  const token = getToken();
  if (!token) return { items: [], unread_count: 0 };
  const res = await fetch(`${API_BASE_URL}/notifications?skip=${skip}&limit=${limit}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return { items: [], unread_count: 0 };
  return res.json() as Promise<NotificationListResponse>;
}

/** POST /notifications/{id}/read — mark one as read. */
export async function markNotificationRead(id: number): Promise<void> {
  const token = getToken();
  if (!token) return;
  await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

/** POST /notifications/read-all — clear the badge. */
export async function markAllNotificationsRead(): Promise<void> {
  const token = getToken();
  if (!token) return;
  await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

/** POST /employees/me/fcm-token — register the FCM device/browser token. */
export async function registerFcmToken(fcmToken: string): Promise<void> {
  const token = getToken();
  if (!token) return;
  await fetch(`${API_BASE_URL}/employees/me/fcm-token`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ token: fcmToken }),
  });
}
