/**
 * Firebase Cloud Messaging service worker — handles push messages
 * that arrive when the browser tab is closed or in the background.
 *
 * WHY A SERVICE WORKER?
 *   When the web app tab is not focused (or is closed), the Firebase SDK
 *   inside the app cannot receive push messages. The browser sends them to
 *   this service worker instead, which then shows a native OS notification.
 *
 * WHY THE "COMPAT" SDK?
 *   Service workers cannot use ES modules, so we use the Firebase compat CDN
 *   build which registers `firebase` on the global scope via importScripts().
 *
 * HOW IS IT REGISTERED?
 *   The browser automatically looks for this file at /firebase-messaging-sw.js
 *   when getToken() is called from the app. No manual registration needed.
 */

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// These values are safe to be public — they identify the Firebase project only.
// They match the NEXT_PUBLIC_FIREBASE_* env vars in the web app.
firebase.initializeApp({
  apiKey: "AIzaSyCb1KdnZW7ymUhLfEIzvMSl1NJlAku62Uc",
  authDomain: "ogera-crm.firebaseapp.com",
  projectId: "ogera-crm",
  storageBucket: "ogera-crm.firebasestorage.app",
  messagingSenderId: "409026790943",
  appId: "1:409026790943:web:754d9873dd446569fab72a",
});

const messaging = firebase.messaging();

// Show notification when the app is in the background.
// FCM sends the payload; the service worker renders it as an OS notification.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Ogera CRM";
  const body = payload.notification?.body || "";

  self.registration.showNotification(title, {
    body,
    icon: "/images/ogera-login-logo.png",
    badge: "/images/ogera-login-logo.png",
    data: payload.data,
  });
});

// When the user clicks the notification, open/focus the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = self.location.origin + "/dashboard";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
