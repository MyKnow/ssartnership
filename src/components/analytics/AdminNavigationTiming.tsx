"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackProductEvent } from "@/lib/product-events";
import {
  getAdminRouteDescriptor,
  toAdminRouteTimingProperties,
  type AdminRouteTimingTrigger,
} from "@/lib/admin-performance";
import { getCurrentAdminViewport } from "@/lib/admin-viewport";
import { consumeAdminPrefetchUsage } from "@/lib/admin-prefetch";

type PendingNavigation = {
  startedAt: number;
  trigger: AdminRouteTimingTrigger;
  prefetch: "used" | "not-used";
};

let pendingNavigation: PendingNavigation | null = null;
let navigationIndicatorTimer: number | null = null;
let navigationExpiryTimer: number | null = null;
const ADMIN_NAVIGATION_PROGRESS_ID = "admin-navigation-progress";

function clearNavigationIndicatorTimer() {
  if (navigationIndicatorTimer === null || typeof window === "undefined") {
    return;
  }

  window.clearTimeout(navigationIndicatorTimer);
  navigationIndicatorTimer = null;
}

function clearNavigationExpiryTimer() {
  if (navigationExpiryTimer === null || typeof window === "undefined") {
    return;
  }

  window.clearTimeout(navigationExpiryTimer);
  navigationExpiryTimer = null;
}

function setNavigationIndicatorVisible(visible: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  const indicator = document.getElementById(ADMIN_NAVIGATION_PROGRESS_ID);
  if (indicator) {
    indicator.toggleAttribute("hidden", !visible);
  }
}

function clearPendingNavigation() {
  pendingNavigation = null;
  clearNavigationIndicatorTimer();
  clearNavigationExpiryTimer();
  setNavigationIndicatorVisible(false);
}

export function markAdminNavigationStart(
  trigger: AdminRouteTimingTrigger,
  prefetch: "used" | "not-used" = "not-used",
) {
  if (typeof window === "undefined" || !Number.isFinite(performance.now())) {
    return;
  }
  const startedAt = performance.now();
  pendingNavigation = { startedAt, trigger, prefetch };
  clearNavigationIndicatorTimer();
  clearNavigationExpiryTimer();

  // Next.js can call history.pushState from an insertion effect. Keep the
  // progress affordance outside React state so this instrumentation never
  // schedules a render from that lifecycle, while fast navigations avoid a
  // visible flash.
  navigationIndicatorTimer = window.setTimeout(() => {
    navigationIndicatorTimer = null;
    if (pendingNavigation?.startedAt !== startedAt) {
      return;
    }
    setNavigationIndicatorVisible(true);
  }, 80);
  navigationExpiryTimer = window.setTimeout(() => {
    if (pendingNavigation?.startedAt === startedAt) {
      clearPendingNavigation();
    }
  }, 15_000);
}

function consumePendingNavigation() {
  const current = pendingNavigation;
  clearPendingNavigation();
  if (!current || performance.now() - current.startedAt > 120_000) {
    return null;
  }
  return current;
}

function resolveAdminLocationKey(value: string | URL | null) {
  if (!value || typeof window === "undefined") {
    return null;
  }

  try {
    const url = new URL(String(value), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin")) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function getCurrentAdminLocationKey() {
  if (typeof window === "undefined") {
    return null;
  }

  return `${window.location.pathname}${window.location.search}`;
}

function getInitialNavigationDuration() {
  const entry = performance.getEntriesByType("navigation")[0];
  return entry && entry.entryType === "navigation" && entry.duration > 0
    ? entry.duration
    : null;
}

export default function AdminNavigationTiming() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serializedSearchParams = searchParams.toString();
  const locationKey = `${pathname}${serializedSearchParams ? `?${serializedSearchParams}` : ""}`;
  const lastReportedLocationRef = useRef<string | null>(null);
  const lastNavigationLocationRef = useRef(locationKey);

  useEffect(() => {
    const locationChanged = lastNavigationLocationRef.current !== locationKey;
    lastNavigationLocationRef.current = locationKey;
    if (!pendingNavigation || !locationChanged) {
      return;
    }

    clearNavigationIndicatorTimer();
    clearNavigationExpiryTimer();
    setNavigationIndicatorVisible(false);
  }, [locationKey]);

  useEffect(() => {
    const markFromClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const targetLocationKey = resolveAdminLocationKey(anchor.href);
      if (
        targetLocationKey &&
        targetLocationKey !== getCurrentAdminLocationKey()
      ) {
        markAdminNavigationStart(
          "link",
          consumeAdminPrefetchUsage(anchor.href) ? "used" : "not-used",
        );
      }
    };

    const markFromHistory = () => {
      markAdminNavigationStart("history");
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function pushState(state, unused, url) {
      const targetLocationKey = resolveAdminLocationKey(url ? String(url) : null);
      if (
        targetLocationKey &&
        targetLocationKey !== getCurrentAdminLocationKey()
      ) {
        markAdminNavigationStart("programmatic");
      }
      return originalPushState.call(window.history, state, unused, url);
    };
    window.history.replaceState = function replaceState(state, unused, url) {
      const targetLocationKey = resolveAdminLocationKey(url ? String(url) : null);
      if (
        targetLocationKey &&
        targetLocationKey !== getCurrentAdminLocationKey()
      ) {
        markAdminNavigationStart("programmatic");
      }
      return originalReplaceState.call(window.history, state, unused, url);
    };

    // Observe before Next Link's bubble handler calls preventDefault so the
    // prefetch registry can record a real click as used.
    document.addEventListener("click", markFromClick, true);
    window.addEventListener("popstate", markFromHistory);

    return () => {
      document.removeEventListener("click", markFromClick, true);
      window.removeEventListener("popstate", markFromHistory);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  useEffect(() => {
    const descriptor = getAdminRouteDescriptor(pathname);
    if (!descriptor || lastReportedLocationRef.current === locationKey) {
      return;
    }

    const pending = consumePendingNavigation();
    const durationMs = pending
      ? performance.now() - pending.startedAt
      : getInitialNavigationDuration() ?? 0;
    const trigger = pending?.trigger ?? "initial-load";
    const properties = toAdminRouteTimingProperties({
      durationMs,
      outcome: pending || durationMs > 0 ? "complete" : "unknown",
      trigger,
      prefetch: pending?.prefetch ?? "not-used",
    });

    lastReportedLocationRef.current = locationKey;
    trackProductEvent({
      eventName: "admin_route_timing",
      path: descriptor.path,
      targetType: "admin_performance",
      targetId: descriptor.key,
      properties: {
        ...properties,
        viewport: getCurrentAdminViewport(),
      },
    });
  }, [locationKey, pathname]);

  return (
    <div
      id={ADMIN_NAVIGATION_PROGRESS_ID}
      hidden
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 bg-primary/15"
    >
      <span className="sr-only">화면을 불러오는 중입니다.</span>
      <span
        aria-hidden="true"
        className="block h-full w-2/5 origin-left animate-pulse bg-primary motion-reduce:animate-none"
      />
    </div>
  );
}
