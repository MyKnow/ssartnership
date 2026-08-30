"use client";

import type { PushSettingsApiResponse } from "./types";

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
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
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
  const message =
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
      ? data.message
      : null;
  if (!response.ok) {
    throw new Error(message ?? "요청에 실패했습니다.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("서버 응답을 확인하지 못했습니다. 다시 시도해 주세요.");
  }
  return data as T;
}
