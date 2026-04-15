"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { trackProductEvent } from "@/lib/product-events";
import { derivePushSettingsStatus } from "./status";
import {
  getServiceWorkerRegistration,
  isIosDevice,
  isStandaloneDisplay,
  parsePushSettingsJson,
  urlBase64ToUint8Array,
} from "./device";
import type { PreferenceKey, PushSettingsCardProps } from "./types";

export function usePushSettingsController({
  configured,
  initialPreferences,
}: PushSettingsCardProps) {
  const { notify } = useToast();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<
    null | "subscribe" | "device-off" | "all-off" | "preference"
  >(null);
  const [supported, setSupported] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [hasSubscription, setHasSubscription] = useState(false);
  const hasTrackedViewRef = useRef(false);

  useEffect(() => {
    if (hasTrackedViewRef.current) {
      return;
    }
    hasTrackedViewRef.current = true;
    trackProductEvent({
      eventName: "push_settings_view",
      targetType: "push_settings",
      properties: {
        configured,
      },
    });
  }, [configured]);

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

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const deviceEnabled = hasSubscription;
  const accountEnabled = preferences.enabled;
  const isReceivingOnThisDevice = accountEnabled && deviceEnabled;
  const canControlPush = configured && supported && !iosNeedsInstall;
  const hasPendingAction = pendingAction !== null;
  const status = useMemo(
    () =>
      derivePushSettingsStatus({
        configured,
        supported,
        iosNeedsInstall,
        isReceivingOnThisDevice,
        accountEnabled,
      }),
    [accountEnabled, configured, iosNeedsInstall, isReceivingOnThisDevice, supported],
  );

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

  async function handleSubscribe() {
    if (!configured) {
      notify("서버 알림 설정이 완료된 뒤 사용할 수 있습니다.");
      return;
    }
    if (!supported) {
      notify("현재 브라우저는 Web Push를 지원하지 않습니다.");
      return;
    }
    if (iosNeedsInstall) {
      notify("iPhone/iPad에서는 홈 화면에 추가한 뒤 설치된 앱에서 알림을 켤 수 있습니다.");
      return;
    }
    if (!vapidPublicKey) {
      notify("알림 공개키가 설정되지 않았습니다.");
      return;
    }

    setPendingAction("subscribe");
    try {
      await requestNotificationPermission();
      const registration = await getServiceWorkerRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const data = await parsePushSettingsJson(response);
      setHasSubscription(true);
      if (data?.preferences) {
        setPreferences(data.preferences);
      } else {
        setPreferences({
          enabled: true,
          announcementEnabled: true,
          newPartnerEnabled: true,
          expiringPartnerEnabled: true,
        });
      }
      notify("기기 알림을 켰습니다.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "알림 구독에 실패했습니다.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUnsubscribeDevice() {
    setPendingAction("device-off");
    try {
      const registration = await getServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope: "device",
          endpoint: subscription?.endpoint ?? null,
        }),
      });
      const data = await parsePushSettingsJson(response);
      if (subscription) {
        await subscription.unsubscribe().catch(() => undefined);
      }
      setHasSubscription(false);
      if (data?.preferences) {
        setPreferences(data.preferences);
      }
      notify("이 기기 알림을 껐습니다.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "알림 해제에 실패했습니다.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUnsubscribeAll() {
    if (typeof window !== "undefined") {
      const ok = window.confirm("모든 기기에서 알림을 끄시겠습니까?");
      if (!ok) {
        return;
      }
    }

    setPendingAction("all-off");
    try {
      const registration = await getServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope: "all",
          endpoint: subscription?.endpoint ?? null,
        }),
      });
      const data = await parsePushSettingsJson(response);
      if (subscription) {
        await subscription.unsubscribe().catch(() => undefined);
      }
      setHasSubscription(false);
      if (data?.preferences) {
        setPreferences(data.preferences);
      } else {
        setPreferences((current) => ({ ...current, enabled: false }));
      }
      notify("모든 기기에서 알림을 껐습니다.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "전체 알림 해제에 실패했습니다.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updatePreference(key: PreferenceKey, nextValue: boolean) {
    const nextPreferences = {
      ...preferences,
      enabled: true,
      [key]: nextValue,
    };

    setPendingAction("preference");
    try {
      const response = await fetch("/api/push/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextPreferences),
      });
      const data = await parsePushSettingsJson(response);
      if (data?.preferences) {
        setPreferences(data.preferences);
      } else {
        setPreferences((current) => ({ ...current, [key]: nextValue }));
      }
      notify("알림 설정을 저장했습니다.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "알림 설정 저장에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return {
    preferences,
    loading,
    pendingAction,
    supported,
    iosNeedsInstall,
    permission,
    hasSubscription,
    vapidPublicKey,
    deviceEnabled,
    accountEnabled,
    isReceivingOnThisDevice,
    canControlPush,
    hasPendingAction,
    status,
    handleSubscribe,
    handleUnsubscribeDevice,
    handleUnsubscribeAll,
    updatePreference,
  };
}
