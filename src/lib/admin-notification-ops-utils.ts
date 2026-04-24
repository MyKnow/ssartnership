import { getBaseUrl, hasSenderCredentials, listConfiguredSenderYears } from "@/lib/mattermost/config";
import { normalizeNotificationTargetUrl, type NotificationChannel } from "@/lib/notifications/shared";
import { SITE_URL } from "@/lib/site";
import type {
  AdminNotificationChannelPreview,
  AdminNotificationChannelSelection,
  AdminNotificationOperationLog,
  AdminNotificationPreviewReason,
  AdminNotificationPreviewReasonCode,
  AdminNotificationSendResult,
  AdminNotificationSource,
  AdminNotificationType,
} from "@/lib/admin-notification-ops";
import type { PushPreferenceState, ResolvedPushAudience } from "@/lib/push/types";

export const EMPTY_CHANNEL_RESULTS: AdminNotificationSendResult["channelResults"] = {
  in_app: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
  push: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
  mm: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
};

type ParsedLogMetadata = {
  notificationType: AdminNotificationType | null;
  selectedChannels: NotificationChannel[];
  source: AdminNotificationSource;
  audience: ResolvedPushAudience["scope"];
  audienceLabel: string;
  audienceYear: number | null;
  audienceCampus: string | null;
  audienceMemberId: string | null;
  totalAudienceCount: number;
  previewChannels: AdminNotificationChannelPreview[];
  channelResults: AdminNotificationSendResult["channelResults"] | null;
  campaignStatus: AdminNotificationOperationLog["status"] | null;
  completedAt: string | null;
};

type AudienceMemberForMattermost = {
  is_staff: boolean;
  source_years: number[];
  year: number;
};

export function isAdminNotificationType(
  value: string,
  supportedTypes: readonly AdminNotificationType[],
): value is AdminNotificationType {
  return supportedTypes.includes(value as AdminNotificationType);
}

export function getPreviewReasonLabel(code: AdminNotificationPreviewReasonCode) {
  switch (code) {
    case "marketing_not_consented":
      return "마케팅 동의 없음";
    case "push_disabled":
      return "푸시 수신 꺼짐";
    case "no_push_subscription":
      return "푸시 구독 없음";
    case "mm_disabled":
      return "Mattermost 수신 꺼짐";
    case "channel_unavailable":
      return "채널 설정 미완료";
    case "type_disabled":
    default:
      return "항목 수신 꺼짐";
  }
}

export function getNotificationTypeLabel(type: AdminNotificationType) {
  switch (type) {
    case "announcement":
      return "운영 공지";
    case "marketing":
      return "마케팅/이벤트";
    case "new_partner":
      return "신규 제휴";
    case "expiring_partner":
      return "종료 임박";
  }
}

export function getTypePreferenceEnabled(
  type: AdminNotificationType,
  preference: PushPreferenceState,
) {
  switch (type) {
    case "announcement":
      return preference.announcementEnabled;
    case "marketing":
      return preference.marketingEnabled;
    case "new_partner":
      return preference.newPartnerEnabled;
    case "expiring_partner":
      return preference.expiringPartnerEnabled;
  }
}

export function absoluteUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : new URL(url, SITE_URL).toString();
}

export function buildMattermostMessage(input: {
  notificationType: AdminNotificationType;
  title: string;
  body: string;
  url?: string | null;
}) {
  const categoryLabel = input.notificationType === "marketing" ? "광고" : "공지";
  const lines = [
    `### [싸트너십/${categoryLabel}] ${input.title.trim()}`,
    input.body.trim(),
  ];
  if (input.url?.trim()) {
    lines.push(`[바로가기](${absoluteUrl(input.url)})`);
  }
  return lines.join("\n");
}

export function normalizeSelectedChannels(channels: AdminNotificationChannelSelection) {
  return (Object.entries(channels) as Array<[NotificationChannel, boolean]>)
    .filter(([, selected]) => selected)
    .map(([channel]) => channel);
}

export function computeOperationStatus(
  channelResults: AdminNotificationSendResult["channelResults"],
) {
  const entries = Object.values(channelResults);
  const targeted = entries.reduce((sum, item) => sum + item.targeted, 0);
  const sent = entries.reduce((sum, item) => sum + item.sent, 0);
  const failed = entries.reduce((sum, item) => sum + item.failed, 0);

  if (targeted === 0) {
    return "no_target" as const;
  }
  if (sent === 0) {
    return "failed" as const;
  }
  if (failed > 0) {
    return "partial_failed" as const;
  }
  return "sent" as const;
}

export function assertMattermostConfigured() {
  getBaseUrl();
  if (listConfiguredSenderYears().length === 0) {
    throw new Error("Mattermost 발송용 sender 계정이 설정되지 않았습니다.");
  }
}

export function isMattermostConfigured() {
  try {
    assertMattermostConfigured();
    return true;
  } catch {
    return false;
  }
}

export function normalizeSourceYears(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((year) => {
          if (typeof year === "number") {
            return year;
          }
          if (typeof year === "string") {
            const normalized = Number(year.trim());
            return Number.isFinite(normalized) ? normalized : null;
          }
          return null;
        })
        .filter((year): year is number => Number.isFinite(year)),
    ),
  );
}

export function getMattermostSenderCandidateYears(member: AudienceMemberForMattermost) {
  if (!member.is_staff) {
    return member.year > 0 ? [member.year] : [];
  }

  const years = member.source_years
    .filter((year) => Number.isFinite(year) && year > 0)
    .sort((a, b) => b - a);

  return Array.from(new Set(years));
}

export function hasMattermostSenderForMember(member: AudienceMemberForMattermost) {
  return getMattermostSenderCandidateYears(member).some((year) =>
    hasSenderCredentials(year, { allowDefaultFallback: false }),
  );
}

export function parseLogMetadata(
  metadata: Record<string, unknown> | null | undefined,
  supportedTypes: readonly AdminNotificationType[],
): ParsedLogMetadata {
  const raw = metadata ?? {};
  const selectedChannels = Array.isArray(raw.selectedChannels)
    ? raw.selectedChannels.filter(
        (value): value is NotificationChannel =>
          value === "in_app" || value === "push" || value === "mm",
      )
    : ["in_app", "push"];
  const notificationType =
    typeof raw.notificationType === "string" &&
    isAdminNotificationType(raw.notificationType, supportedTypes)
      ? raw.notificationType
      : null;

  return {
    notificationType,
    selectedChannels: selectedChannels as NotificationChannel[],
    source:
      raw.source === "manual" || raw.source === "automatic"
        ? raw.source
        : ("automatic" as AdminNotificationSource),
    audience:
      raw.audience === "all" ||
      raw.audience === "year" ||
      raw.audience === "campus" ||
      raw.audience === "member"
        ? raw.audience
        : "all",
    audienceLabel:
      typeof raw.audienceLabel === "string" && raw.audienceLabel.trim()
        ? raw.audienceLabel
        : "전체",
    audienceYear: typeof raw.audienceYear === "number" ? raw.audienceYear : null,
    audienceCampus:
      typeof raw.audienceCampus === "string" ? raw.audienceCampus : null,
    audienceMemberId:
      typeof raw.audienceMemberId === "string" ? raw.audienceMemberId : null,
    totalAudienceCount:
      typeof raw.totalAudienceCount === "number" ? raw.totalAudienceCount : 0,
    previewChannels: Array.isArray((raw.previewSummary as { channels?: unknown[] } | undefined)?.channels)
      ? (((raw.previewSummary as { channels?: unknown[] }).channels ?? []) as AdminNotificationChannelPreview[])
      : [],
    channelResults:
      typeof raw.channelResults === "object" && raw.channelResults
        ? (raw.channelResults as AdminNotificationSendResult["channelResults"])
        : null,
    campaignStatus:
      raw.campaignStatus === "pending" ||
      raw.campaignStatus === "sent" ||
      raw.campaignStatus === "partial_failed" ||
      raw.campaignStatus === "failed" ||
      raw.campaignStatus === "no_target"
        ? (raw.campaignStatus as AdminNotificationOperationLog["status"])
        : null,
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
  };
}

export function mergeExclusionReasons(
  previewChannels: AdminNotificationChannelPreview[],
): AdminNotificationPreviewReason[] {
  return previewChannels
    .flatMap((channel) => channel.reasons)
    .reduce<AdminNotificationPreviewReason[]>((accumulator, reason) => {
      const existing = accumulator.find((item) => item.code === reason.code);
      if (existing) {
        existing.count += reason.count;
        return accumulator;
      }
      accumulator.push({ ...reason });
      return accumulator;
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

export function normalizeDestinationUrl(url: string | null | undefined) {
  return normalizeNotificationTargetUrl(url) ?? "/notifications";
}
