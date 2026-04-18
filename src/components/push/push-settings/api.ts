"use client";

import type { PushPreferenceState } from "@/lib/push";
import { parsePushSettingsJson } from "./device";

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
