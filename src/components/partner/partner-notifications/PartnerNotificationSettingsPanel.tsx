"use client";

import { useState, useTransition } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import type { PartnerNotificationPreferenceState } from "@/lib/partner-notification-routing";

type PartnerNotificationSettingsPanelProps = {
  pushConfigured: boolean;
  publicKey: string;
  preferences: PartnerNotificationPreferenceState;
  deviceCount: number;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "요청을 처리하지 못했습니다.");
  }
  return data;
}

export default function PartnerNotificationSettingsPanel({
  pushConfigured,
  publicKey,
  preferences,
  deviceCount,
}: PartnerNotificationSettingsPanelProps) {
  const [state, setState] = useState(preferences);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canUsePush =
    pushConfigured &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  function updatePreference(next: Partial<PartnerNotificationPreferenceState>) {
    const previousState = state;
    const optimistic = { ...state, ...next };
    setState(optimistic);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const data = await postJson("/api/partner/notifications/preferences", next);
        if (data.preferences) {
          setState(data.preferences);
        }
        setMessage("알림 설정을 저장했습니다.");
      } catch (caught) {
        setState(previousState);
        setError(caught instanceof Error ? caught.message : "알림 설정 저장에 실패했습니다.");
      }
    });
  }

  function subscribePush() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        if (!canUsePush || !publicKey) {
          throw new Error("이 브라우저에서는 푸시 알림을 사용할 수 없습니다.");
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error("브라우저 알림 권한이 필요합니다.");
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const data = await postJson("/api/partner/push/subscribe", {
          subscription: subscription.toJSON(),
        });
        if (data.preferences) {
          setState(data.preferences);
        }
        setMessage("이 기기에서 푸시 알림을 받습니다.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "푸시 구독에 실패했습니다.");
      }
    });
  }

  const channelToggles: Array<{
    key: keyof PartnerNotificationPreferenceState;
    label: string;
  }> = [
    { key: "portalEnabled", label: "포털 알림" },
    { key: "emailEnabled", label: "이메일" },
    { key: "pushEnabled", label: "웹푸시" },
  ];

  const typeToggles: Array<{
    key: keyof PartnerNotificationPreferenceState;
    label: string;
  }> = [
    { key: "planEnabled", label: "플랜 변경" },
    { key: "expiringPartnerEnabled", label: "제휴 종료 임박" },
    { key: "metricsEnabled", label: "지표 알림" },
  ];

  function renderToggle(toggle: {
    key: keyof PartnerNotificationPreferenceState;
    label: string;
  }) {
    return (
      <label
        key={toggle.key}
        className="flex items-center justify-between gap-3 rounded-[1rem] border border-border bg-surface-inset px-4 py-3 text-sm font-medium text-foreground"
      >
        {toggle.label}
        <input
          type="checkbox"
          checked={Boolean(state[toggle.key])}
          disabled={isPending || !state.enabled}
          onChange={(event) =>
            updatePreference({
              [toggle.key]: event.target.checked,
            } as Partial<PartnerNotificationPreferenceState>)
          }
          className="h-4 w-4 accent-primary"
        />
      </label>
    );
  }

  return (
    <Card tone="default" padding="md" className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="ui-kicker">Notification Settings</p>
          <h2 className="text-lg font-semibold text-foreground">알림 수신 설정</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={state.enabled ? "success" : "neutral"}>
            {state.enabled ? "수신 가능" : "전체 꺼짐"}
          </Badge>
          <Badge variant="neutral">푸시 기기 {deviceCount}개</Badge>
        </div>
      </div>

      {message ? <FormMessage variant="info">{message}</FormMessage> : null}
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="flex items-center justify-between gap-3 rounded-[1rem] border border-border bg-surface-inset px-4 py-3 text-sm font-medium text-foreground">
          전체 알림
          <input
            type="checkbox"
            checked={state.enabled}
            disabled={isPending}
            onChange={(event) => updatePreference({ enabled: event.target.checked })}
            className="h-4 w-4 accent-primary"
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid gap-3">
          <p className="text-sm font-semibold text-foreground">알림 채널</p>
          <div className="grid gap-3">{channelToggles.map(renderToggle)}</div>
        </section>

        <section className="grid gap-3">
          <p className="text-sm font-semibold text-foreground">알림 종류</p>
          <div className="grid gap-3">{typeToggles.map(renderToggle)}</div>
        </section>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={isPending || !pushConfigured}
          onClick={subscribePush}
        >
          이 기기에서 푸시 받기
        </Button>
      </div>
    </Card>
  );
}
