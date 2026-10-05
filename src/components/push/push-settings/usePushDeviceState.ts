"use client";

import { useEffect, useState } from "react";
import {
  assertPushNotificationPermissionGranted,
  getServiceWorkerRegistration,
  isIosDevice,
  isStandaloneDisplay,
  requestPushNotificationPermission,
} from "./device";

export function usePushDeviceState() {
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [hasSubscription, setHasSubscription] = useState(false);
  const [subscriptionEndpoint, setSubscriptionEndpoint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      const iosDevice =
        typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        isIosDevice();
      const needsInstall =
        iosDevice &&
        typeof window !== "undefined" &&
        !isStandaloneDisplay();

      if (needsInstall) {
        await Promise.resolve();
        if (!cancelled) {
          setSupported(true);
          setIosNeedsInstall(true);
          setPermission("Notification" in window ? Notification.permission : "default");
          setHasSubscription(false);
          setSubscriptionEndpoint(null);
          setLoading(false);
        }
        return;
      }

      const canUsePush =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!canUsePush) {
        await Promise.resolve();
        if (!cancelled) {
          setSupported(false);
          setPermission("unsupported");
          setLoading(false);
        }
        return;
      }

      await Promise.resolve();
      if (!cancelled) {
        setSupported(true);
        setIosNeedsInstall(false);
        setPermission(Notification.permission);
      }

      try {
        const registration = await getServiceWorkerRegistration();
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setHasSubscription(Boolean(subscription));
          setSubscriptionEndpoint(subscription?.endpoint ?? null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadState();
    return () => {
      cancelled = true;
    };
  }, []);

  async function requestNotificationPermission() {
    const nextPermission = await requestPushNotificationPermission();
    setPermission(nextPermission);
    assertPushNotificationPermissionGranted(nextPermission);
  }

  return {
    loading,
    supported,
    iosNeedsInstall,
    permission,
    hasSubscription,
    subscriptionEndpoint,
    requestNotificationPermission,
    markSubscribed(endpoint?: string | null) {
      setHasSubscription(true);
      setSubscriptionEndpoint(endpoint ?? null);
    },
    markUnsubscribed() {
      setHasSubscription(false);
      setSubscriptionEndpoint(null);
    },
  };
}
