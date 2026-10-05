import { NotificationRequestError } from "@/lib/notifications/safe-error";
import { isUuidFormat } from "@/lib/uuid";

export const MAX_PARTNER_NOTIFICATION_MUTATION_IDS = 100;
export const MAX_PARTNER_NOTIFICATION_BODY_BYTES = 16 * 1024;

export function isValidPartnerNotificationId(value: string) {
  return isUuidFormat(value);
}

export function normalizePartnerNotificationIds(value: unknown): string[] | null {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    throw new NotificationRequestError("알림 선택값을 확인해 주세요.");
  }

  if (value.length > MAX_PARTNER_NOTIFICATION_MUTATION_IDS) {
    throw new NotificationRequestError(
      `알림은 한 번에 ${MAX_PARTNER_NOTIFICATION_MUTATION_IDS}개까지 처리할 수 있습니다.`,
    );
  }

  const normalized = [
    ...new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  ];

  if (normalized.some((id) => !isValidPartnerNotificationId(id))) {
    throw new NotificationRequestError("알림 ID 형식을 확인해 주세요.");
  }

  return normalized;
}
