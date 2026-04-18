"use client";

import type { PushPreferenceState } from "@/lib/push";
import { parsePushSettingsJson } from "./device";
import type { PushDeviceSummary } from "./types";

export async function subscribePushDevice(subscription: PushSubscriptionJSON) {
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ subscription }),
  });
  return parsePushSettingsJson(response);
}

export async function unsubscribePushDevice(endpoint: string | null) {
  const response = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scope: "device",
      endpoint,
    }),
  });
  return parsePushSettingsJson(response);
}

export async function unsubscribePushDeviceById(subscriptionId: string) {
  const response = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scope: "device",
      subscriptionId,
    }),
  });
  return parsePushSettingsJson(response);
}

export async function unsubscribePushEveryDevice(endpoint: string | null) {
  const response = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scope: "all",
      endpoint,
    }),
  });
  return parsePushSettingsJson(response);
}

export async function savePushPreferences(preferences: PushPreferenceState) {
  const response = await fetch("/api/notifications/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferences),
  });
  return parsePushSettingsJson(response);
}

export async function fetchPushDevices(currentEndpoint: string | null) {
  const params = new URLSearchParams();
  if (currentEndpoint) {
    params.set("currentEndpoint", currentEndpoint);
  }
  const response = await fetch(`/api/push/subscriptions?${params.toString()}`, {
    method: "GET",
  });
  const data = (await response.json().catch(() => null)) as {
    message?: string;
    devices?: PushDeviceSummary[];
  } | null;
  if (!response.ok) {
    throw new Error(data?.message ?? "Push 기기 목록을 불러오지 못했습니다.");
  }
  return data?.devices ?? [];
}
