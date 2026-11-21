import type {
  AdminNotificationPreviewReasonCode,
  AdminNotificationType,
} from "@/lib/admin-notification-ops-types";
import { hasEffectiveMarketingConsent } from "@/lib/notifications/marketing-consent";
import type { NotificationChannel } from "@/lib/notifications/shared";
import type { PushPreferenceState } from "@/lib/push/types";

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

export type AdminNotificationMemberEligibilityInput = {
  notificationType: AdminNotificationType;
  /** 저장된 수신 설정(행이 없으면 활성 구독 기본값을 적용한 값) */
  preference: PushPreferenceState;
  hasActiveMarketingPolicy: boolean;
  /** 활성 마케팅 정책에 대한 동의 기록 존재 여부 */
  hasCurrentMarketingPolicyConsent: boolean;
  activePushSubscriptionCount: number;
  hasMattermostUser: boolean;
};

export type AdminNotificationMemberChannelReasons = Partial<
  Record<NotificationChannel, AdminNotificationPreviewReasonCode>
>;

/**
 * 회원 한 명에 대해 채널별 제외 사유를 계산한다. 사유가 없는 채널은 발송 대상이다.
 * 마케팅 알림은 동의 기록과 현재 수신 설정을 함께 확인하므로, 수신을 철회한
 * 회원은 동의 기록이 남아 있어도 모든 채널에서 제외된다.
 */
export function resolveAdminNotificationMemberChannelReasons(
  input: AdminNotificationMemberEligibilityInput,
): AdminNotificationMemberChannelReasons {
  const reasons: AdminNotificationMemberChannelReasons = {};
  const marketingAllowed =
    input.notificationType !== "marketing" ||
    hasEffectiveMarketingConsent({
      hasActiveMarketingPolicy: input.hasActiveMarketingPolicy,
      hasCurrentPolicyConsent: input.hasCurrentMarketingPolicyConsent,
      marketingEnabled: input.preference.marketingEnabled,
    });

  if (!marketingAllowed) {
    reasons.in_app = "marketing_not_consented";
    reasons.push = "marketing_not_consented";
    reasons.mm = "marketing_not_consented";
    return reasons;
  }

  if (!getTypePreferenceEnabled(input.notificationType, input.preference)) {
    reasons.in_app = "type_disabled";
    reasons.push = "type_disabled";
    reasons.mm = "type_disabled";
    return reasons;
  }

  if (!input.preference.enabled) {
    reasons.push = "push_disabled";
  } else if (input.activePushSubscriptionCount === 0) {
    reasons.push = "no_push_subscription";
  }

  if (!input.preference.mmEnabled) {
    reasons.mm = "mm_disabled";
  } else if (!input.hasMattermostUser) {
    reasons.mm = "channel_unavailable";
  }

  return reasons;
}
