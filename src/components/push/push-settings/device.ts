"use client";

import type { PushSettingsApiResponse } from "./types";

export type PushSettingsClientErrorCode =
  "request_failed" | "network_unavailable" | "invalid_response";

export class PushSettingsClientError extends Error {
  readonly code: PushSettingsClientErrorCode;

  constructor(code: PushSettingsClientErrorCode, message: string) {
    super(message);
    this.name = "PushSettingsClientError";
    this.code = code;
  }
}

function buildPushSettingsSafeMessage(
  actionLabel: string,
  code: PushSettingsClientErrorCode,
) {
  switch (code) {
    case "network_unavailable":
      return `${actionLabel} 중 네트워크 오류가 발생했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.`;
    case "invalid_response":
      return `${actionLabel} 중 서버 응답을 확인하지 못했습니다. 다시 시도해 주세요.`;
    case "request_failed":
    default:
      return `${actionLabel}에 실패했습니다. 잠시 후 다시 시도해 주세요.`;
  }
}

export function getPushSettingsClientError(
  error: unknown,
  actionLabel: string,
) {
  if (error instanceof PushSettingsClientError) {
    return new PushSettingsClientError(
      error.code,
      buildPushSettingsSafeMessage(actionLabel, error.code),
    );
  }

  if (error instanceof TypeError) {
    return new PushSettingsClientError(
      "network_unavailable",
      buildPushSettingsSafeMessage(actionLabel, "network_unavailable"),
    );
  }

  return new PushSettingsClientError(
    "request_failed",
    buildPushSettingsSafeMessage(actionLabel, "request_failed"),
  );
}

export function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function getServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) {
    return existing;
  }
  return navigator.serviceWorker.register("/sw.js");
}

export async function parsePushSettingsJson<
  T extends object = PushSettingsApiResponse,
>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new PushSettingsClientError(
      "request_failed",
      buildPushSettingsSafeMessage("알림 요청 처리", "request_failed"),
    );
  }
  if (!data || typeof data !== "object") {
    throw new PushSettingsClientError(
      "invalid_response",
      buildPushSettingsSafeMessage("알림 요청 처리", "invalid_response"),
    );
  }
  return data as T;
}
