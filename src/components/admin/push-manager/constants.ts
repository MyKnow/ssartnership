"use client";

import type { PushAudienceScope } from "@/lib/push";
import type { AdminNotificationOperationLog, AdminNotificationType } from "@/lib/admin-notification-ops";
import { getNotificationChannelLabel, type NotificationChannel } from "@/lib/notifications/shared";
import {
  formatOptionalSsafyYearLabel,
  formatSsafyMemberLifecycleLabel,
} from "@/lib/ssafy-year";
import { formatKoreanDateTime } from "@/lib/datetime";
import type { MemberOption } from "./types";

export const audienceLabels: Record<PushAudienceScope, string> = {
  all: "전체",
  year: "기수",
  campus: "캠퍼스",
  member: "개인",
};

export const typeLabels: Record<AdminNotificationType, string> = {
  announcement: "운영 공지",
  marketing: "마케팅/이벤트",
  new_partner: "신규 제휴",
  expiring_partner: "종료 임박",
};

export const sourceLabels: Record<AdminNotificationOperationLog["source"], string> = {
  manual: "수동 발송",
  automatic: "자동 발송",
};

export const statusLabels: Record<AdminNotificationOperationLog["status"], string> = {
  pending: "대기",
  sent: "발송 완료",
  partial_failed: "일부 실패",
  failed: "발송 실패",
  no_target: "대상 없음",
};

export function getPushLogStatusBadgeClass(status: AdminNotificationOperationLog["status"]) {
  switch (status) {
    case "sent":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "partial_failed":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "failed":
      return "bg-danger/15 text-danger";
    case "no_target":
      return "bg-surface-muted text-muted-foreground";
    case "pending":
    default:
      return "bg-surface-muted text-muted-foreground";
  }
}

export function formatPushLogDateTime(value: string) {
  return formatKoreanDateTime(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNotificationChannels(channels: NotificationChannel[]) {
  return channels.map((channel) => getNotificationChannelLabel(channel)).join(" · ");
}

export function extractPartnerIdFromUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? new URL(trimmed)
      : new URL(trimmed, "https://ssartnership.local");
    const match = parsed.pathname.match(/^\/partners\/([^/]+)$/);
    return match?.[1] ?? "";
  } catch {
    const match = trimmed.match(/^\/partners\/([^/]+)$/);
    return match?.[1] ?? "";
  }
}

export function getMemberLabel(member: MemberOption) {
  const name = member.display_name?.trim() || member.mm_username;
  const yearLabel =
    typeof member.year === "number"
      ? formatSsafyMemberLifecycleLabel(member.year)
      : formatOptionalSsafyYearLabel(member.year);
  const campusLabel = member.campus ?? "캠퍼스 미지정";
  return `${name} (@${member.mm_username}) · ${yearLabel} · ${campusLabel}`;
}
