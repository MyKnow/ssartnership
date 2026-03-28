self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "SSARTNERSHIP";
  const options = {
    body: payload.body || "새 알림이 도착했습니다.",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag || "ssartnership-notification",
    data: {
      url: payload.url || "/",
      type: payload.type || "announcement",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  ).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if (client.url === targetUrl && "navigate" in client) {
            return client.focus();
          }
          if (client.url.startsWith(self.location.origin)) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
