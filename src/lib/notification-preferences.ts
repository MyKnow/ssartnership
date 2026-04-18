import { getPolicyDocumentByKind, recordMarketingPolicyConsent } from "@/lib/policy-documents";
import {
  getMemberPushPreferences,
  upsertMemberPushPreferences,
} from "@/lib/push";
import type { PushPreferenceState } from "@/lib/push";

export type NotificationPreferenceState = PushPreferenceState;

export async function getMemberNotificationPreferences(memberId: string) {
  return getMemberPushPreferences(memberId);
}

export async function updateMemberNotificationPreferences(
  memberId: string,
  value: Partial<PushPreferenceState>,
  context?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  const preferences = await upsertMemberPushPreferences(memberId, value);
  const activeMarketingPolicy = await getPolicyDocumentByKind("marketing");

  await recordMarketingPolicyConsent({
    memberId,
    activePolicy: activeMarketingPolicy,
    agreed: preferences.marketingEnabled,
    ipAddress: context?.ipAddress ?? null,
    userAgent: context?.userAgent ?? null,
  });

  return preferences;
}
