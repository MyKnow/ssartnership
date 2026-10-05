import type { NotificationTemplateChannel } from "@/lib/notification-templates/catalog";
import type { PartnerNotificationChannel } from "@/lib/partner-notification-routing";
import type { NotificationChannel } from "./shared";

/**
 * 알림 채널 어휘는 저장소마다 다르다(supabase/schema.sql 기준).
 *
 * | 저장 위치 | 값 |
 * | --- | --- |
 * | `notification_deliveries.channel`(회원) | `in_app`, `push`, `mm` |
 * | `admin_notification_deliveries.channel` | `portal`, `push` |
 * | `partner_notification_deliveries.channel` | `portal`, `push`, `email` |
 * | `notification_templates.channel` | `email`, `mattermost`, `push`, `in_app` |
 *
 * DB 값은 바꾸지 않고, 템플릿 키를 만들 때만 이 모듈의 변환을 거친다.
 */

export const MEMBER_DELIVERY_TEMPLATE_CHANNELS = {
  in_app: "in_app",
  push: "push",
  mm: "mattermost",
} as const satisfies Record<NotificationChannel, NotificationTemplateChannel>;

/** 관리자(`portal`·`push`)와 파트너(`portal`·`push`·`email`) 운영 알림 공통 */
export const OPERATIONAL_DELIVERY_TEMPLATE_CHANNELS = {
  portal: "in_app",
  push: "push",
  email: "email",
} as const satisfies Record<PartnerNotificationChannel, NotificationTemplateChannel>;

export type MemberTemplateChannel =
  (typeof MEMBER_DELIVERY_TEMPLATE_CHANNELS)[NotificationChannel];

export function toMemberTemplateChannel<Channel extends NotificationChannel>(
  channel: Channel,
) {
  return MEMBER_DELIVERY_TEMPLATE_CHANNELS[channel];
}

export function toOperationalTemplateChannel<
  Channel extends PartnerNotificationChannel,
>(channel: Channel) {
  return OPERATIONAL_DELIVERY_TEMPLATE_CHANNELS[channel];
}

/** 템플릿 채널 값을 회원 delivery 저장값으로 되돌린다. 회원 경로에 없는 email은 null. */
export function toMemberDeliveryChannel(
  channel: NotificationTemplateChannel,
): NotificationChannel | null {
  switch (channel) {
    case "in_app":
      return "in_app";
    case "push":
      return "push";
    case "mattermost":
      return "mm";
    case "email":
      return null;
  }
}
