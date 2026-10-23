/**
 * Firebase client-side initialisation for the web app.
 *
 * WHY getApps().length CHECK?
 *   In Next.js, modules can be imported multiple times during hot-reload or server
 *   pre-rendering. initializeApp() throws if called twice with the same config, so
 *   we only call it when no app has been initialised yet.
 *
 * WHY typeof window !== "undefined"?
 *   getMessaging() requires a browser environment. During server-side rendering in
 *   Next.js there is no window, so we guard the call so SSR doesn't crash.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp: FirebaseApp =
  getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const messaging: Messaging | null =
  typeof window !== "undefined" ? getMessaging(firebaseApp) : null;
