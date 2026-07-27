"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getAdminRouteDescriptor } from "@/lib/admin-performance";
import { getCurrentAdminViewport } from "@/lib/admin-viewport";
import { trackProductEvent } from "@/lib/product-events";

const TASK_KEY_PATTERN = /^admin\.[a-z0-9._-]+$/i;
const TASK_START_STORAGE_PREFIX = "analytics:admin-task-start:";
const TASK_OUTCOME_STORAGE_PREFIX = "analytics:admin-task-outcome:";
const MAX_TASK_DURATION_MS = 120_000;
const TASK_START_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

type AdminTaskSource =
  | "task_inbox"
  | "home"
  | "search"
  | "navigation"
  | "direct";

type AdminTaskRecoveryReason =
  | "validation"
  | "permission"
  | "not_found"
  | "timeout"
  | "server"
  | "unknown";

function isSafeTaskKey(value: string | null): value is string {
  return Boolean(value && TASK_KEY_PATTERN.test(value));
}

function getStorageKey(prefix: string, taskKey: string) {
  return `${prefix}${taskKey}`;
}

function getStoredStart(taskKey: string) {
  try {
    const raw = window.sessionStorage.getItem(
      getStorageKey(TASK_START_STORAGE_PREFIX, taskKey),
    );
    const startedAt = raw ? Number(raw) : NaN;
    if (!Number.isFinite(startedAt) || Date.now() - startedAt > TASK_START_MAX_AGE_MS) {
      window.sessionStorage.removeItem(
        getStorageKey(TASK_START_STORAGE_PREFIX, taskKey),
      );
      return null;
    }
    return startedAt;
  } catch {
    return null;
  }
}

function storeStart(taskKey: string) {
  try {
    window.sessionStorage.setItem(
      getStorageKey(TASK_START_STORAGE_PREFIX, taskKey),
      String(Date.now()),
    );
  } catch {
    // Telemetry must never block an operational navigation.
  }
}

function clearStart(taskKey: string) {
  try {
    window.sessionStorage.removeItem(
      getStorageKey(TASK_START_STORAGE_PREFIX, taskKey),
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
}

function hasReportedOutcome(
  taskKey: string,
  outcome: "complete" | "recovery",
  startedAt: number,
) {
  try {
    return window.sessionStorage.getItem(
      getStorageKey(
        TASK_OUTCOME_STORAGE_PREFIX,
        `${taskKey}:${outcome}:${startedAt}`,
      ),
    ) === "1";
  } catch {
    return false;
  }
}

function markReportedOutcome(
  taskKey: string,
  outcome: "complete" | "recovery",
  startedAt: number,
) {
  try {
    window.sessionStorage.setItem(
      getStorageKey(
        TASK_OUTCOME_STORAGE_PREFIX,
        `${taskKey}:${outcome}:${startedAt}`,
      ),
      "1",
    );
  } catch {
    // Telemetry must remain best effort.
  }
}

function getDurationMs(taskKey: string) {
  const startedAt = getStoredStart(taskKey);
  if (startedAt === null) {
    return undefined;
  }

  return Math.min(MAX_TASK_DURATION_MS, Math.max(0, Date.now() - startedAt));
}

function getRecoveryReason(value: string | null): AdminTaskRecoveryReason {
  const normalized = value?.toLocaleLowerCase("en-US") ?? "";
  if (/(invalid|validation|required|missing)/.test(normalized)) {
    return "validation";
  }
  if (/(forbidden|permission|unauthorized|denied)/.test(normalized)) {
    return "permission";
  }
  if (/(not[_-]?found|missing_resource)/.test(normalized)) {
    return "not_found";
  }
  if (/timeout/.test(normalized)) {
    return "timeout";
  }
  if (/(failed|failure|error|unavailable)/.test(normalized)) {
    return "server";
  }
  return "unknown";
}

function trackAdminTaskEvent(
  eventName: "admin_task_start" | "admin_task_complete" | "admin_task_recovery",
  taskKey: string,
  properties: Record<string, unknown>,
) {
  const descriptor = getAdminRouteDescriptor(window.location.pathname);
  trackProductEvent({
    eventName,
    path: descriptor?.path ?? "/admin",
    targetType: "admin_task",
    targetId: taskKey,
    properties: {
      ...properties,
      viewport: getCurrentAdminViewport(),
    },
  });
}

function markAdminTaskStart(taskKey: string | null, source: AdminTaskSource) {
  if (!isSafeTaskKey(taskKey)) {
    return;
  }

  storeStart(taskKey);
  trackAdminTaskEvent("admin_task_start", taskKey, { source });
}

export default function AdminTaskTelemetry() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serializedSearchParams = searchParams.toString();
  const reportedLocationRef = useRef<string | null>(null);

  useEffect(() => {
    const handleTaskLinkClick = (event: MouseEvent) => {
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

      const anchor = event.target.closest("a[data-admin-task-key]");
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const sourceValue = anchor.getAttribute("data-admin-task-source");
      const source: AdminTaskSource =
        sourceValue === "task_inbox" ||
        sourceValue === "home" ||
        sourceValue === "search" ||
        sourceValue === "direct"
          ? sourceValue
          : "navigation";
      markAdminTaskStart(anchor.getAttribute("data-admin-task-key"), source);
    };

    document.addEventListener("click", handleTaskLinkClick);
    return () => document.removeEventListener("click", handleTaskLinkClick);
  }, []);

  useEffect(() => {
    const descriptor = getAdminRouteDescriptor(pathname);
    if (!descriptor) {
      return;
    }

    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (!success && !error) {
      return;
    }

    const outcome = success ? "complete" : "recovery";
    const locationKey = `${descriptor.key}:${outcome}:${serializedSearchParams}`;
    const startedAt = getStoredStart(descriptor.key);
    if (
      reportedLocationRef.current === locationKey ||
      (startedAt !== null &&
        hasReportedOutcome(descriptor.key, outcome, startedAt))
    ) {
      return;
    }
    reportedLocationRef.current = locationKey;

    const durationMs = getDurationMs(descriptor.key);
    if (outcome === "complete") {
      trackAdminTaskEvent("admin_task_complete", descriptor.key, {
        ...(durationMs === undefined ? {} : { durationMs }),
        outcome: "success",
      });
      clearStart(descriptor.key);
    } else {
      trackAdminTaskEvent("admin_task_recovery", descriptor.key, {
        ...(durationMs === undefined ? {} : { durationMs }),
        reason: getRecoveryReason(error),
        retryAvailable: true,
      });
    }
    if (startedAt !== null) {
      markReportedOutcome(descriptor.key, outcome, startedAt);
    }
  }, [pathname, searchParams, serializedSearchParams]);

  return null;
}
