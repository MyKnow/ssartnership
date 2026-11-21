// Service worker for the installed app: push notifications plus an offline
// page for failed navigations. Responses are never cached except the
// self-contained offline page. Bump CACHE_VERSION whenever offline.html changes
// (tests/service-worker.test.mts records each version's page fingerprint).
const CACHE_PREFIX = "ssartnership-";
const CACHE_VERSION = "v2";
const OFFLINE_CACHE = `${CACHE_PREFIX}offline-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
// Basic-auth and API navigations go straight to the network.
const BYPASS_PATH_PREFIXES = ["/admin", "/api/"];

async function precacheOfflinePage() {
  try {
    // No cookies: the offline page must never be a session-specific redirect.
    const response = await fetch(
      new Request(OFFLINE_URL, { cache: "reload", credentials: "omit" }),
    );
    if (response.ok && !response.redirected) {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.put(OFFLINE_URL, response);
    }
  } catch {
    // Installation must not fail when the fallback page is unreachable.
  }
}

async function deleteStaleCaches() {
  try {
    // A failed update must not delete the installed app's last working fallback.
    const replacement = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
    if (!replacement?.ok || replacement.redirected) return;
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== OFFLINE_CACHE)
        .map((key) => caches.delete(key)),
    );
  } catch {
    // A stale cache only wastes storage; activation continues.
  }
}

async function getOfflineFallback() {
  try {
    const current = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
    if (current?.ok && !current.redirected) return current;
    // Only our versioned offline pages are eligible; never use cached app data.
    const previousCaches = (await caches.keys()).filter(
      (key) => key.startsWith(`${CACHE_PREFIX}offline-`) && key !== OFFLINE_CACHE,
    );
    for (const cacheName of previousCaches.reverse()) {
      const previous = await caches.match(OFFLINE_URL, { cacheName });
      if (previous?.ok && !previous.redirected) return previous;
    }
  } catch {
    // Storage may be unavailable. Preserve the original network failure below.
  }
  return null;
}

function shouldHandleNavigation(request) {
  if (request.mode !== "navigate" || request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return !BYPASS_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await getOfflineFallback();
    if (cached) return cached;
    throw error;
  }
}

function readPushPayload(data) {
  if (!data) return {};
  try {
    const value = data.json();
    if (value && typeof value === "object") return value;
    return value == null ? {} : { body: String(value) };
  } catch {
    try {
      const text = data.text().trim();
      return text ? { body: text } : {};
    } catch {
      return {};
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteStaleCaches().then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (!shouldHandleNavigation(event.request)) return;
  event.respondWith(networkFirstNavigation(event.request));
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event.data);
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
