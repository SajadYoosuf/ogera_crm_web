"use client";

/**
 * useFcmToken — requests browser notification permission and registers the FCM token.
 *
 * HOW IT WORKS:
 *   1. Calls Notification.requestPermission() to ask the user for browser push permission.
 *   2. Gets the FCM token from Firebase using getToken() with our VAPID key.
 *   3. POSTs the token to POST /employees/me/fcm-token on the backend.
 *   4. Also sets up onMessage() to handle push messages that arrive while the browser
 *      tab is open (foreground messages don't show native notifications automatically).
 *
 * WHEN IS IT CALLED?
 *   Once per session after login, from DashboardSidebar. The token is stored server-side
 *   and refreshed on each login.
 *
 * SAFETY:
 *   - All steps are wrapped in try/catch; failures are logged but never thrown.
 *   - The service worker handles background messages (tab not focused).
 */
import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "@/lib/firebase";
import { registerFcmToken } from "@/lib/api/notifications";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

export function useFcmToken(onForegroundMessage?: () => void) {
  useEffect(() => {
    if (!messaging) return;

    async function setupFcm() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const token = await getToken(messaging!, { vapidKey: VAPID_KEY });
        if (token) {
          await registerFcmToken(token);
        }
      } catch (err) {
        console.warn("[FCM] Token setup failed:", err);
      }
    }

    setupFcm();

    // Handle messages that arrive while the tab is open (foreground).
    // The service worker handles background ones.
    const unsubscribe = onMessage(messaging!, () => {
      onForegroundMessage?.();
    });

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
