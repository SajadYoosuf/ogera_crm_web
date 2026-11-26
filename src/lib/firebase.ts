"use client";

import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCb1KdnZW7ymUhLfEIzvMSl1NJlAku62Uc",
  authDomain: "ogera-crm.firebaseapp.com",
  projectId: "ogera-crm",
  storageBucket: "ogera-crm.firebasestorage.app",
  messagingSenderId: "409026790943",
  appId: "1:409026790943:web:754d9873dd446569fab72a",
};

const VAPID_KEY = "BK7ilZ_smXa8QEhm8YG3aOg5JsbWpVp8BrBzJ_hslu-PVZUuzxuAfaFLmYj5fZnNowJ5GiP17eMk8tzlv4HPgAE";

/**
 * Request notification permission, register the service worker, and return
 * the FCM token for this browser. Returns null if push is unsupported,
 * permission is denied, or anything fails — callers must handle null silently.
 */
export async function getOrRequestPushToken(): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;
    if (!(await isSupported())) return null;

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    const permission = await Notification.requestPermission();
    console.info("[push] permission:", permission);
    if (permission !== "granted") return null;

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" },
    );

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    console.info("[push] token:", token ? "received" : "empty");
    return token;
  } catch (error) {
    console.error("[push] token request failed:", error);
    return null;
  }
}
