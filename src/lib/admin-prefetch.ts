import { getAdminRouteDescriptor } from "@/lib/admin-performance";
import { getCurrentAdminViewport } from "@/lib/admin-viewport";
import { trackProductEvent } from "@/lib/product-events";

export const ADMIN_PREFETCH_TTL_MS = 30_000;

export type AdminPrefetchTrigger = "hover" | "focus";

type PrefetchRecord = {
  routeKey: string;
  path: string;
  requestedAt: number;
  trigger: AdminPrefetchTrigger;
};

const prefetchedRoutes = new Map<string, PrefetchRecord>();

function normalizeAdminHref(href: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin")) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function pruneExpiredPrefetches(now: number) {
  for (const [href, record] of prefetchedRoutes) {
    if (now - record.requestedAt > ADMIN_PREFETCH_TTL_MS) {
      prefetchedRoutes.delete(href);
    }
  }
}

function trackPrefetchEvent(
  record: PrefetchRecord,
  stage: "requested" | "used",
  requestAgeMs?: number,
) {
  trackProductEvent({
    eventName: "admin_prefetch",
    path: record.path,
    targetType: "admin_performance",
    targetId: record.routeKey,
    properties: {
      stage,
      trigger: record.trigger,
      ...(requestAgeMs === undefined ? {} : { requestAgeMs }),
      viewport: getCurrentAdminViewport(),
    },
  });
}

/**
 * Records one intent-triggered router prefetch. This measures a safe,
 * observable proxy: a requested route that is used within the TTL. Next.js
 * does not expose its internal RSC cache-hit bit to application code.
 */
export function markAdminPrefetchIntent(
  href: string,
  trigger: AdminPrefetchTrigger,
  now = Date.now(),
) {
  const normalizedHref = normalizeAdminHref(href);
  const descriptor = getAdminRouteDescriptor(normalizedHref);
  if (!normalizedHref || !descriptor) {
    return false;
  }

  pruneExpiredPrefetches(now);
  if (prefetchedRoutes.has(normalizedHref)) {
    return false;
  }

  const record: PrefetchRecord = {
    routeKey: descriptor.key,
    path: descriptor.path,
    requestedAt: now,
    trigger,
  };
  prefetchedRoutes.set(normalizedHref, record);
  trackPrefetchEvent(record, "requested");
  return true;
}

/**
 * Consumes a prefetched destination when the user follows it. The returned
 * value is intentionally route-safe and contains no raw query or identifier.
 */
export function consumeAdminPrefetchUsage(href: string, now = Date.now()) {
  const normalizedHref = normalizeAdminHref(href);
  if (!normalizedHref) {
    return null;
  }

  pruneExpiredPrefetches(now);
  const record = prefetchedRoutes.get(normalizedHref);
  if (!record) {
    return null;
  }

  prefetchedRoutes.delete(normalizedHref);
  const requestAgeMs = Math.min(
    ADMIN_PREFETCH_TTL_MS,
    Math.max(0, now - record.requestedAt),
  );
  trackPrefetchEvent(record, "used", requestAgeMs);
  return {
    routeKey: record.routeKey,
    requestAgeMs,
  } as const;
}

export function resetAdminPrefetchRegistryForTest() {
  prefetchedRoutes.clear();
}
