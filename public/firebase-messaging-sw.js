// Firebase Cloud Messaging background service worker.
// Handles push notifications when BusPulse is not in the foreground.
//
// Firebase Messaging requires this file at exactly /firebase-messaging-sw.js
// (or a path configured via getMessaging({ serviceWorkerRegistration }).
//
// The Firebase config is passed via the query string when this SW is registered
// by lib/firebase/messaging.ts (avoids hard-coding credentials).

importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js");

// Config is read from the URL query string so no credentials are hard-coded.
// e.g.  /firebase-messaging-sw.js?apiKey=...&projectId=...
function getConfigFromQuery() {
  const params = new URLSearchParams(self.location.search);
  return {
    apiKey:            params.get("apiKey")            ?? "",
    authDomain:        params.get("authDomain")        ?? "",
    projectId:         params.get("projectId")         ?? "",
    storageBucket:     params.get("storageBucket")     ?? "",
    messagingSenderId: params.get("messagingSenderId") ?? "",
    appId:             params.get("appId")             ?? "",
  };
}

const config = getConfigFromQuery();
if (config.apiKey) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // Handle background notifications (app not visible / tab closed).
  messaging.onBackgroundMessage((payload) => {
    const { title = "BusPulse", body = "", icon = "/icon-192.png", data = {} } =
      payload.notification ?? {};

    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/icon-192.png",
      tag: data.busId ? `bus-${data.busId}` : "buspulse",
      data,
      // Collapse duplicate "bus approaching" notifications for the same bus
      renotify: false,
    });
  });

  // Tap on notification → navigate to the bus view
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const busId = event.notification.data?.busId;
    const url = busId ? `/bus/${busId}` : "/dashboard";
    event.waitUntil(
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((windowClients) => {
          for (const client of windowClients) {
            if (client.url.includes(url) && "focus" in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) return clients.openWindow(url);
        }),
    );
  });
}
