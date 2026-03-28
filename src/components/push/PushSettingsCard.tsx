"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { PushPreferenceState } from "@/lib/push";

type Props = {
  initialPreferences: PushPreferenceState;
  configured: boolean;
};

type PreferenceKey = Exclude<keyof PushPreferenceState, "enabled">;

const preferenceLabels: Record<PreferenceKey, string> = {
  announcementEnabled: "운영 공지",
  newPartnerEnabled: "신규 제휴",
  expiringPartnerEnabled: "종료 7일 전",
};

function StatusMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) {
    return existing;
  }
  return navigator.serviceWorker.register("/sw.js");
}

async function parseJson(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { message?: string; preferences?: PushPreferenceState }
    | null;
  if (!response.ok) {
    throw new Error(data?.message ?? "요청에 실패했습니다.");
  }
  return data;
}

function PreferenceToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="flex items-center gap-3">
        <span
          className={checked
            ? "min-w-10 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-300"
            : "min-w-10 text-right text-xs font-semibold text-muted-foreground"}
        >
          {checked ? "켜짐" : "꺼짐"}
        </span>
        <span className="relative inline-flex items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span className="h-7 w-12 rounded-full border border-border bg-slate-300 transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-disabled:opacity-50 dark:bg-slate-700 dark:peer-checked:border-emerald-400 dark:peer-checked:bg-emerald-400" />
          <span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-disabled:opacity-70 dark:bg-slate-950" />
        </span>
      </span>
    </label>
  );
}

export default function PushSettingsCard({ initialPreferences, configured }: Props) {
  const { notify } = useToast();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [supported, setSupported] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
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

      const needsInstall = isIosDevice() && !isStandaloneDisplay();
      await Promise.resolve();
      if (!cancelled) {
        setSupported(true);
        setIosNeedsInstall(needsInstall);
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
  const masterEnabled = preferences.enabled && hasSubscription;

  const status = useMemo(() => {
    if (!configured) {
      return { label: "서버 설정 필요", tone: "warn" as const };
    }
    if (!supported) {
      return { label: "이 브라우저 미지원", tone: "muted" as const };
    }
    if (iosNeedsInstall) {
      return { label: "홈 화면 설치 필요", tone: "warn" as const };
    }
    if (masterEnabled) {
      return { label: "알림 수신 중", tone: "success" as const };
    }
    return { label: "알림 꺼짐", tone: "muted" as const };
  }, [configured, iosNeedsInstall, masterEnabled, supported]);

  const statusClassName =
    status.tone === "success"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status.tone === "warn"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-surface-muted text-muted-foreground";

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
      notify("iPhone/iPad에서는 홈 화면에 추가한 뒤 알림을 켤 수 있습니다.");
      return;
    }
    if (!vapidPublicKey) {
      notify("알림 공개키가 설정되지 않았습니다.");
      return;
    }

    setPending(true);
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
      const data = await parseJson(response);
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
      setPending(false);
    }
  }

  async function handleUnsubscribe() {
    setPending(true);
    try {
      const registration = await getServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint: subscription?.endpoint ?? null }),
      });
      const data = await parseJson(response);
      if (subscription) {
        await subscription.unsubscribe().catch(() => undefined);
      }
      setHasSubscription(false);
      if (data?.preferences) {
        setPreferences(data.preferences);
      } else {
        setPreferences((current) => ({ ...current, enabled: false }));
      }
      notify("기기 알림을 껐습니다.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "알림 해제에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function updatePreference(key: PreferenceKey, nextValue: boolean) {
    const nextPreferences = {
      ...preferences,
      enabled: true,
      [key]: nextValue,
    };

    setPending(true);
    try {
      const response = await fetch("/api/push/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextPreferences),
      });
      const data = await parseJson(response);
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
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto mt-6 max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">푸시 알림 설정</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            새 제휴 등록, 종료 7일 전 안내, 운영 공지를 이 기기의 앱 알림으로
            받아볼 수 있습니다.
          </p>
        </div>
        <Badge className={statusClassName}>{status.label}</Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <StatusMetric
          label="권한 상태"
          value={permission === "unsupported" ? "미지원" : permission}
        />
        <StatusMetric
          label="기기 구독"
          value={hasSubscription ? "구독됨" : "미구독"}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
        {!configured
          ? "서버에 VAPID 키와 CRON 시크릿이 설정되면 알림 기능을 바로 사용할 수 있습니다."
          : !supported
            ? "이 브라우저는 Web Push를 지원하지 않습니다. 최신 Chrome, Edge, Safari 설치형 앱에서 확인해 주세요."
            : iosNeedsInstall
              ? "iPhone/iPad에서는 Safari에서 홈 화면에 추가한 뒤 알림을 켤 수 있습니다."
              : permission === "denied"
                ? "브라우저 설정에서 알림 권한을 다시 허용한 뒤 재시도해 주세요."
                : "기기 알림을 켜면 공지와 제휴 소식을 앱처럼 받을 수 있습니다."}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-surface px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">기기 알림 제어</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {masterEnabled
                ? "이 기기에서 제휴 알림을 받고 있습니다."
                : "이 기기에서 제휴 알림이 꺼져 있습니다."}
            </p>
          </div>
          <Button
            onClick={masterEnabled ? handleUnsubscribe : handleSubscribe}
            disabled={pending || loading}
          >
            <span className="inline-flex items-center gap-2">
              {pending || loading ? <Spinner /> : null}
              {masterEnabled ? "알림 끄기" : "알림 켜기"}
            </span>
          </Button>
        </div>
      </div>

      {masterEnabled ? (
        <div className="mt-6">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">세부 알림 항목</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              받고 싶은 알림만 개별적으로 켜고 끌 수 있습니다.
            </p>
          </div>
          <div className="grid gap-3">
          {(Object.keys(preferenceLabels) as PreferenceKey[]).map((key) => (
            <PreferenceToggle
              key={key}
              label={preferenceLabels[key]}
              checked={preferences[key]}
              disabled={pending}
              onChange={(next) => {
                void updatePreference(key, next);
              }}
            />
          ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
