import type { PushPreferenceState } from "@/lib/push/types";
import type { PolicyDocument } from "@/lib/policy-documents";
import { isUuidFormat } from "@/lib/uuid";

export type NotificationPreferencePatch = Partial<PushPreferenceState> & {
  marketingPolicyId?: string;
  marketingPolicyVersion?: number;
};

const PREFERENCE_KEYS = [
  "enabled", "announcementEnabled", "newPartnerEnabled", "expiringPartnerEnabled",
  "reviewEnabled", "mmEnabled", "marketingEnabled",
] as const satisfies readonly (keyof PushPreferenceState)[];
const PATCH_KEYS = new Set<string>([
  ...PREFERENCE_KEYS, "marketingPolicyId", "marketingPolicyVersion",
]);
const PUSH_ITEM_KEYS = new Set<keyof PushPreferenceState>([
  "announcementEnabled", "newPartnerEnabled", "expiringPartnerEnabled", "reviewEnabled",
]);

export const NOTIFICATION_PREFERENCE_INVALID_MESSAGE = "변경할 알림 설정을 확인해 주세요.";
export const MARKETING_POLICY_REVIEW_MESSAGE =
  "마케팅 동의 내용을 다시 확인할 수 있도록 새로고침한 뒤 다시 시도해 주세요.";

export class NotificationPolicyConflictError extends Error {
  constructor() {
    super(MARKETING_POLICY_REVIEW_MESSAGE);
    this.name = "NotificationPolicyConflictError";
  }
}

export function parseNotificationPreferencePatch(input: unknown):
  | { ok: true; value: NotificationPreferencePatch }
  | { ok: false; message: string } {
  const invalid = { ok: false as const, message: NOTIFICATION_PREFERENCE_INVALID_MESSAGE };
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !PATCH_KEYS.has(key))) return invalid;
  const patch: NotificationPreferencePatch = {};
  for (const key of PREFERENCE_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    if (typeof value[key] !== "boolean") return invalid;
    patch[key] = value[key];
  }
  if (Object.keys(patch).length === 0) return invalid;
  if (patch.marketingEnabled === true) {
    if (!isUuidFormat(value.marketingPolicyId)
      || !Number.isInteger(value.marketingPolicyVersion)
      || Number(value.marketingPolicyVersion) < 1
      || Number(value.marketingPolicyVersion) > 2_147_483_647) {
      return { ok: false, message: MARKETING_POLICY_REVIEW_MESSAGE };
    }
    patch.marketingPolicyId = value.marketingPolicyId;
    patch.marketingPolicyVersion = value.marketingPolicyVersion as number;
  } else if (Object.hasOwn(value, "marketingPolicyId") || Object.hasOwn(value, "marketingPolicyVersion")) {
    return invalid;
  }
  return { ok: true, value: patch };
}

export function buildNotificationPreferencePatch(
  key: keyof PushPreferenceState,
  nextValue: boolean,
  marketingPolicy?: Pick<PolicyDocument, "id" | "version"> | null,
): NotificationPreferencePatch {
  return {
    [key]: nextValue,
    ...(PUSH_ITEM_KEYS.has(key) && nextValue ? { enabled: true } : {}),
    ...(key === "marketingEnabled" && nextValue && marketingPolicy ? {
      marketingPolicyId: marketingPolicy.id,
      marketingPolicyVersion: marketingPolicy.version,
    } : {}),
  };
}
