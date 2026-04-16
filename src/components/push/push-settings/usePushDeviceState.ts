"use client";

import { useEffect, useState } from "react";
import {
  getServiceWorkerRegistration,
  isIosDevice,
  isStandaloneDisplay,
} from "./device";

export function usePushDeviceState() {
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [hasSubscription, setHasSubscription] = useState(false);

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
    if (!("Notification" in window)) {
      throw new Error("이 브라우저에서는 알림 권한을 사용할 수 없습니다.");
    }

    const nextPermission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission !== "granted") {
      throw new Error("브라우저에서 알림 권한을 허용해 주세요.");
    }
  }

  return {
    loading,
    supported,
    iosNeedsInstall,
    permission,
    hasSubscription,
    requestNotificationPermission,
    markSubscribed() {
      setHasSubscription(true);
    },
    markUnsubscribed() {
      setHasSubscription(false);
    },
  };
}
