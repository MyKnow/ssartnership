"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackProductEvent } from "@/lib/product-events";
import {
  getAdminRouteDescriptor,
  toAdminRouteTimingProperties,
  type AdminRouteTimingTrigger,
} from "@/lib/admin-performance";

type PendingNavigation = {
  startedAt: number;
  trigger: AdminRouteTimingTrigger;
};

let pendingNavigation: PendingNavigation | null = null;

export function markAdminNavigationStart(trigger: AdminRouteTimingTrigger) {
  if (typeof window === "undefined" || !Number.isFinite(performance.now())) {
    return;
  }
  pendingNavigation = { startedAt: performance.now(), trigger };
}

function consumePendingNavigation() {
  const current = pendingNavigation;
  pendingNavigation = null;
  if (!current || performance.now() - current.startedAt > 120_000) {
    return null;
  }
  return current;
}

function resolveNavigationPath(value: string | URL | null) {
  if (!value || typeof window === "undefined") {
    return null;
  }

  try {
    const url = new URL(String(value), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin")) {
      return null;
    }
    return url.pathname;
  } catch {
    return null;
  }
}

function getInitialNavigationDuration() {
  const entry = performance.getEntriesByType("navigation")[0];
  return entry && entry.entryType === "navigation" && entry.duration > 0
    ? entry.duration
    : null;
}

export default function AdminNavigationTiming() {
  const pathname = usePathname();
  const lastReportedPathRef = useRef<string | null>(null);

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

      const targetPath = resolveNavigationPath(anchor.href);
      if (targetPath && targetPath !== window.location.pathname) {
        markAdminNavigationStart("link");
      }
    };

    const markFromHistory = () => {
      markAdminNavigationStart("history");
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function pushState(state, unused, url) {
      const targetPath = resolveNavigationPath(url ? String(url) : null);
      if (targetPath && targetPath !== window.location.pathname) {
        markAdminNavigationStart("programmatic");
      }
      return originalPushState.call(window.history, state, unused, url);
    };
    window.history.replaceState = function replaceState(state, unused, url) {
      const targetPath = resolveNavigationPath(url ? String(url) : null);
      if (targetPath && targetPath !== window.location.pathname) {
        markAdminNavigationStart("programmatic");
      }
      return originalReplaceState.call(window.history, state, unused, url);
    };

    document.addEventListener("click", markFromClick);
    window.addEventListener("popstate", markFromHistory);

    return () => {
      document.removeEventListener("click", markFromClick);
      window.removeEventListener("popstate", markFromHistory);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  useEffect(() => {
    const descriptor = getAdminRouteDescriptor(pathname);
    if (!descriptor || lastReportedPathRef.current === pathname) {
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
    });

    lastReportedPathRef.current = pathname;
    trackProductEvent({
      eventName: "admin_route_timing",
      path: descriptor.path,
      targetType: "admin_performance",
      targetId: descriptor.key,
      properties,
    });
  }, [pathname]);

  return null;
}
