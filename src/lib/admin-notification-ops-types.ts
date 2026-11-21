import type { NotificationChannel } from "@/lib/notifications/shared";
import type { NotificationTemplateContext } from "@/lib/notification-templates/context";
import type { PushAudience, ResolvedPushAudience } from "@/lib/push/types";

/**
 * 관리자 알림 운영(캠페인 발송·미리보기·운영 로그)의 공개 타입.
 * 서버 모듈 그래프를 끌어오지 않도록 컴포넌트는 이 파일에서만 타입을 가져온다.
 */

export const ADMIN_NOTIFICATION_TYPES = [
  "announcement",
  "marketing",
  "new_partner",
  "expiring_partner",
] as const;

export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPES)[number];

export type AdminNotificationSource = "manual" | "automatic";

export type AdminNotificationChannelSelection = Record<NotificationChannel, boolean>;

export type AdminNotificationComposerInput = {
  notificationType: AdminNotificationType;
  title: string;
  body: string;
  url?: string | null;
  audience: PushAudience;
  channels: AdminNotificationChannelSelection;
  confirmationText?: string | null;
  idempotencyKey?: string | null;
  templateContext?: NotificationTemplateContext;
};

export type AdminNotificationPreviewReasonCode =
  | "type_disabled"
  | "marketing_not_consented"
  | "push_disabled"
  | "no_push_subscription"
  | "mm_disabled"
  | "channel_unavailable";

export type AdminNotificationPreviewReason = {
  code: AdminNotificationPreviewReasonCode;
  label: string;
  count: number;
};

export type AdminNotificationEligibleMember = {
  id: string;
  name: string;
  mmUsername: string;
  year: number;
  campus: string | null;
  channels: NotificationChannel[];
};

export type AdminNotificationChannelPreview = {
  channel: NotificationChannel;
  label: string;
  eligibleCount: number;
  excludedCount: number;
  reasons: AdminNotificationPreviewReason[];
};

export type AdminNotificationPreview = {
  notificationType: AdminNotificationType;
  selectedChannels: NotificationChannel[];
  audienceScope: ResolvedPushAudience["scope"];
  audienceLabel: string;
  totalAudienceCount: number;
  eligibleMemberCount: number;
  eligibleMembers: AdminNotificationEligibleMember[];
  destinationLabel: string;
  channels: AdminNotificationChannelPreview[];
  canSend: boolean;
  highRisk: boolean;
  requiresConfirmation: boolean;
  confirmationPhrase: string;
  validationMessage: string | null;
};

export type AdminNotificationSendResult = {
  notificationId: string;
  preview: AdminNotificationPreview;
  channelResults: Record<
    NotificationChannel,
    {
      targeted: number;
      sent: number;
      failed: number;
      skipped: number;
    }
  >;
  warnings: string[];
  alreadyExists?: boolean;
  campaignDisposition?: "claimed" | "resumed" | "in_progress" | "completed";
};

export type AdminNotificationOperationLog = {
  id: string;
  notificationType: AdminNotificationType;
  source: AdminNotificationSource;
  selectedChannels: NotificationChannel[];
  targetScope: ResolvedPushAudience["scope"];
  targetLabel: string;
  targetYear: number | null;
  targetCampus: string | null;
  targetMemberId: string | null;
  title: string;
  body: string;
  url: string | null;
  status: "pending" | "sent" | "partial_failed" | "failed" | "no_target";
  totalAudienceCount: number;
  marketing: boolean;
  channelResults: Record<
    NotificationChannel,
    {
      targeted: number;
      sent: number;
      failed: number;
      skipped: number;
    }
  >;
  exclusionReasons: AdminNotificationPreviewReason[];
  createdAt: string;
  completedAt: string | null;
};

export type AutomaticNotificationRuleSummary = {
  notificationType: Extract<AdminNotificationType, "new_partner" | "expiring_partner">;
  label: string;
  lastRunAt: string | null;
  recentCount: number;
  failedCount: number;
  failureSamples: string[];
};
