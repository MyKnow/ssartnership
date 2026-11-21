import { isUuid } from "../uuid.ts";

/**
 * 푸시 구독 이벤트 로그(`event_logs.target_id`)에는 `push_subscriptions.id`
 * UUID만 남긴다. endpoint URL은 push 서비스의 구독 식별자이자 발송 자격이라
 * 1년 보존되는 관리자 로그에 원문으로 남기지 않는다.
 */
export function getPushSubscriptionLogTargetId(
  value: string | null | undefined,
) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed && isUuid(trimmed) ? trimmed.toLowerCase() : null;
}
