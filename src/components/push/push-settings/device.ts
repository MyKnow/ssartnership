"use client";

import {
  ClientSafeRequestError,
  getClientSafeRequestError,
  type ClientSafeRequestErrorCode,
} from "@/lib/client-safe-request-error";
import type { PushSettingsApiResponse } from "./types";

export type PushSettingsClientErrorCode = ClientSafeRequestErrorCode;

export class PushSettingsClientError extends ClientSafeRequestError {
  constructor(code: PushSettingsClientErrorCode, message: string) {
    super(code, message);
    this.name = "PushSettingsClientError";
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

export type PushDeviceSetupErrorCode = "push_unsupported" | "permission_denied";

const PUSH_DEVICE_SETUP_MESSAGES: Record<PushDeviceSetupErrorCode, string> = {
  push_unsupported: "이 브라우저에서는 푸시 알림을 사용할 수 없습니다.",
  permission_denied: "브라우저에서 알림 권한을 허용해 주세요.",
};

/**
 * 기기 준비 단계(지원 여부·권한)의 실패. 메시지는 고정 문구라 그대로 보여 줘도 안전하다.
 */
export class PushDeviceSetupError extends Error {
  readonly code: PushDeviceSetupErrorCode;

  constructor(code: PushDeviceSetupErrorCode) {
    super(PUSH_DEVICE_SETUP_MESSAGES[code]);
    this.name = "PushDeviceSetupError";
    this.code = code;
  }
}

/**
 * 알림 설정 화면(회원·관리자·파트너)이 보여 줄 오류. 브라우저·서버 원문은
 * 노출하지 않고 동작 이름이 들어간 안전 문구로 바꾼다.
 */
export function getPushSettingsClientError(
  error: unknown,
  actionLabel: string,
): PushSettingsClientError | PushDeviceSetupError {
  if (error instanceof PushDeviceSetupError) {
    return error;
  }
  if (error instanceof PushSettingsClientError) {
    return new PushSettingsClientError(
      error.code,
      buildPushSettingsSafeMessage(actionLabel, error.code),
    );
  }

  const safeError = getClientSafeRequestError(error, {
    requestFailed: buildPushSettingsSafeMessage(actionLabel, "request_failed"),
    networkUnavailable: buildPushSettingsSafeMessage(
      actionLabel,
      "network_unavailable",
    ),
  });
  return new PushSettingsClientError(
    safeError.code,
    buildPushSettingsSafeMessage(actionLabel, safeError.code),
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

export function isPushSubscriptionSupported() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** 이미 허용된 권한은 다시 묻지 않고 현재 권한 상태를 돌려준다. */
export async function requestPushNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new PushDeviceSetupError("push_unsupported");
  }
  return Notification.permission === "granted"
    ? "granted"
    : Notification.requestPermission();
}

export function assertPushNotificationPermissionGranted(
  permission: NotificationPermission,
) {
  if (permission !== "granted") {
    throw new PushDeviceSetupError("permission_denied");
  }
}

function hasSameApplicationServerKey(
  subscription: PushSubscription,
  applicationServerKey: Uint8Array,
) {
  const currentKey = subscription.options?.applicationServerKey;
  if (!currentKey) {
    return true;
  }
  const currentBytes = new Uint8Array(currentKey);
  return (
    currentBytes.length === applicationServerKey.length &&
    currentBytes.every((value, index) => value === applicationServerKey[index])
  );
}

/**
 * 이 브라우저의 기존 구독을 재사용하고, 없거나 VAPID 공개키가 바뀐 경우에만
 * 새로 구독한다. 같은 기기를 다시 켤 때 endpoint가 바뀌어 서버에 중복 구독이
 * 쌓이지 않게 한다.
 */
export async function getOrCreatePushSubscription(vapidPublicKey: string) {
  if (!vapidPublicKey || !isPushSubscriptionSupported()) {
    throw new PushDeviceSetupError("push_unsupported");
  }
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  const registration = await getServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing && hasSameApplicationServerKey(existing, applicationServerKey)) {
    return existing;
  }
  if (existing) {
    await existing.unsubscribe().catch(() => undefined);
  }
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

/** 관리자·파트너 알림 패널용: 권한 확인 후 이 브라우저 구독을 확보한다. */
export async function subscribeCurrentBrowserPush(vapidPublicKey: string) {
  assertPushNotificationPermissionGranted(
    await requestPushNotificationPermission(),
  );
  return getOrCreatePushSubscription(vapidPublicKey);
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
