import type { PushSettingsStatus } from "./types";

export function derivePushSettingsStatus(params: {
  configured: boolean;
  supported: boolean;
  iosNeedsInstall: boolean;
  isReceivingOnThisDevice: boolean;
  accountEnabled: boolean;
}): PushSettingsStatus | null {
  const {
    accountEnabled,
    configured,
    iosNeedsInstall,
    isReceivingOnThisDevice,
    supported,
  } = params;
  if (!configured) {
    return { label: "서버 설정 필요", tone: "warn" };
  }
  if (!supported) {
    return { label: "이 브라우저 미지원", tone: "muted" };
  }
  if (iosNeedsInstall) {
    return { label: "앱 설치 필요", tone: "warn" };
  }
  if (isReceivingOnThisDevice) {
    return { label: "알림 수신 중", tone: "success" };
  }
  if (accountEnabled) {
    return { label: "다른 기기에서만 수신 중", tone: "muted" };
  }
  return null;
}

export function getPushSettingsStatusClassName(status: PushSettingsStatus) {
  return status.tone === "success"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : status.tone === "warn"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : "bg-surface-muted text-muted-foreground";
}
