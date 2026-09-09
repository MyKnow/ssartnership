import { NotificationRequestError } from "@/lib/notifications/safe-error";

export const MAX_PARTNER_NOTIFICATION_MUTATION_IDS = 100;
export const MAX_PARTNER_NOTIFICATION_BODY_BYTES = 16 * 1024;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPartnerNotificationId(value: string) {
  return uuidPattern.test(value);
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
