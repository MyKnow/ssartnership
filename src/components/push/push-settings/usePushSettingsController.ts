"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { trackProductEvent } from "@/lib/product-events";
import {
  fetchPushDevices,
  savePushPreferences,
  subscribePushDevice,
  unsubscribePushDevice,
  unsubscribePushDeviceById,
  unsubscribePushEveryDevice,
} from "./api";
import { derivePushSettingsStatus } from "./status";
import {
  getServiceWorkerRegistration,
  urlBase64ToUint8Array,
} from "./device";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import type {
  ChannelPreferenceKey,
  PreferenceKey,
  PushSettingsCardProps,
} from "./types";
import { usePushDeviceState } from "./usePushDeviceState";

const PUSH_PREFERENCE_KEYS = new Set<PreferenceKey>([
  "announcementEnabled",
  "newPartnerEnabled",
  "expiringPartnerEnabled",
  "reviewEnabled",
]);

export function usePushSettingsController({
  configured,
  initialPreferences,
}: PushSettingsCardProps) {
  const { notify } = useToast();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [pendingAction, setPendingAction] = useState<
    null | "subscribe" | "device-off" | "all-off" | "preference"
  >(null);
  const [devices, setDevices] = useState<
    {
      id: string;
      label: string;
      isCurrent: boolean;
      createdAt: string | null;
      updatedAt: string | null;
      lastSuccessAt: string | null;
    }[]
  >([]);
  const hasTrackedViewRef = useRef(false);
  const deviceState = usePushDeviceState();

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

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const deviceEnabled = deviceState.hasSubscription;
  const accountEnabled = preferences.enabled;
  const isReceivingOnThisDevice = accountEnabled && deviceEnabled;
  const canControlPush =
    configured && deviceState.supported && !deviceState.iosNeedsInstall;
  const hasPendingAction = pendingAction !== null;
  const status = useMemo(
    () =>
      derivePushSettingsStatus({
        configured,
        supported: deviceState.supported,
        iosNeedsInstall: deviceState.iosNeedsInstall,
        isReceivingOnThisDevice,
        accountEnabled,
      }),
    [
      accountEnabled,
      configured,
      deviceState.iosNeedsInstall,
      deviceState.supported,
      isReceivingOnThisDevice,
    ],
  );

  useEffect(() => {
    if (!configured) {
      setDevices([]);
      return;
    }

    let cancelled = false;
    async function loadDevices() {
      try {
        const nextDevices = await fetchPushDevices(deviceState.subscriptionEndpoint);
        if (!cancelled) {
          setDevices(nextDevices);
        }
      } catch {
        if (!cancelled) {
          setDevices([]);
        }
      }
    }

    void loadDevices();
    return () => {
      cancelled = true;
    };
  }, [configured, deviceState.subscriptionEndpoint]);

  async function refreshDevices(endpoint = deviceState.subscriptionEndpoint) {
    try {
      const nextDevices = await fetchPushDevices(endpoint);
      setDevices(nextDevices);
    } catch {
      setDevices([]);
    }
  }

  async function handleSubscribe() {
    if (!configured) {
      notify("서버 알림 설정이 완료된 뒤 사용할 수 있습니다.");
      return;
    }
    if (!deviceState.supported) {
      notify("현재 브라우저는 Web Push를 지원하지 않습니다.");
      return;
    }
    if (deviceState.iosNeedsInstall) {
      notify("iPhone/iPad에서는 홈 화면에 추가한 뒤 설치된 앱에서 알림을 켤 수 있습니다.");
      return;
    }
    if (!vapidPublicKey) {
      notify("알림 공개키가 설정되지 않았습니다.");
      return;
    }

    setPendingAction("subscribe");
    try {
      await deviceState.requestNotificationPermission();
      const registration = await getServiceWorkerRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const data = await subscribePushDevice(subscription.toJSON());
      deviceState.markSubscribed(subscription.endpoint);
      if (data?.preferences) {
        setPreferences(data.preferences);
      } else {
        setPreferences({
          enabled: true,
          announcementEnabled: true,
          newPartnerEnabled: true,
          expiringPartnerEnabled: true,
          reviewEnabled: true,
          mmEnabled: true,
          marketingEnabled: false,
        });
      }
      await refreshDevices(subscription.endpoint);
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
      const data = await unsubscribePushDevice(subscription?.endpoint ?? null);
      if (subscription) {
        await subscription.unsubscribe().catch(() => undefined);
      }
      deviceState.markUnsubscribed();
      if (data?.preferences) {
        setPreferences(data.preferences);
      }
      await refreshDevices(null);
      notify(
        `이 기기 알림 수신을 철회했습니다. (${formatKoreanDateTimeToMinute(new Date())})`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "알림 해제에 실패했습니다.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUnsubscribeAll(options: { confirm?: boolean } = {}) {
    if (options.confirm && typeof window !== "undefined") {
      const ok = window.confirm("모든 기기에서 알림을 끄시겠습니까?");
      if (!ok) {
        return;
      }
    }

    setPendingAction("all-off");
    try {
      const registration = await getServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      const data = await unsubscribePushEveryDevice(subscription?.endpoint ?? null);
      if (subscription) {
        await subscription.unsubscribe().catch(() => undefined);
      }
      deviceState.markUnsubscribed();
      if (data?.preferences) {
        setPreferences(data.preferences);
      } else {
        setPreferences((current) => ({ ...current, enabled: false }));
      }
      await refreshDevices(null);
      notify(
        `모든 기기 알림 수신을 철회했습니다. (${formatKoreanDateTimeToMinute(new Date())})`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "전체 알림 해제에 실패했습니다.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updatePreference(key: PreferenceKey, nextValue: boolean) {
    const nextPreferences = {
      ...preferences,
      [key]: nextValue,
    };
    if (PUSH_PREFERENCE_KEYS.has(key) && nextValue) {
      nextPreferences.enabled = true;
    }

    setPendingAction("preference");
    try {
      const data = await savePushPreferences(nextPreferences);
      if (data?.preferences) {
        setPreferences(data.preferences);
      } else {
        setPreferences((current) => ({ ...current, [key]: nextValue }));
      }
      if (key === "marketingEnabled") {
        const appliedAt = data?.appliedAt ?? new Date().toISOString();
        notify(
          nextValue
            ? `마케팅 정보 수신에 동의했습니다. (${formatKoreanDateTimeToMinute(appliedAt)})`
            : `마케팅 정보 수신 동의를 철회했습니다. (${formatKoreanDateTimeToMinute(appliedAt)})`,
        );
      } else {
        notify("알림 설정을 저장했습니다.");
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "알림 설정 저장에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function updateChannelPreference(
    key: ChannelPreferenceKey,
    nextValue: boolean,
  ) {
    if (key === "enabled" && !nextValue) {
      await handleUnsubscribeAll({ confirm: false });
      return;
    }

    const nextPreferences = {
      ...preferences,
      [key]: nextValue,
    };

    setPendingAction("preference");
    try {
      const data = await savePushPreferences(nextPreferences);
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

  async function handleDisconnectDevice(subscriptionId: string) {
    const target = devices.find((device) => device.id === subscriptionId);
    if (target?.isCurrent) {
      await handleUnsubscribeDevice();
      return;
    }

    setPendingAction("device-off");
    try {
      const data = await unsubscribePushDeviceById(subscriptionId);
      if (data?.preferences) {
        setPreferences(data.preferences);
      }
      await refreshDevices();
      notify("기기 연결을 해제했습니다.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "기기 연결 해제에 실패했습니다.");
    } finally {
      setPendingAction(null);
    }
  }

  return {
    preferences,
    loading: deviceState.loading,
    pendingAction,
    supported: deviceState.supported,
    iosNeedsInstall: deviceState.iosNeedsInstall,
    permission: deviceState.permission,
    hasSubscription: deviceState.hasSubscription,
    subscriptionEndpoint: deviceState.subscriptionEndpoint,
    vapidPublicKey,
    deviceEnabled,
    accountEnabled,
    isReceivingOnThisDevice,
    canControlPush,
    hasPendingAction,
    devices,
    status,
    handleSubscribe,
    handleUnsubscribeDevice,
    handleUnsubscribeAll,
    handleDisconnectDevice,
    updateChannelPreference,
    updatePreference,
  };
}
