import {
  getMemberPolicyConsentVersions,
  getPolicyDocumentByKind,
} from "@/lib/policy-documents.server";
import {
  countActivePushSubscriptions,
  DEFAULT_PUSH_PREFERENCES,
  getMemberPushPreferences,
} from "@/lib/push";
import { hasEffectiveMarketingConsent } from "@/lib/notifications/marketing-consent";
import { PushError } from "@/lib/push/types";
import {
  NotificationPolicyConflictError,
  parseNotificationPreferencePatch,
  type NotificationPreferencePatch,
} from "@/lib/notifications/preference-patch";
import { getMockMemberPolicyState, recordMockMarketingPolicyConsent } from "@/lib/mock/member";
import { wrapPushDbError } from "@/lib/push/config";
import { getPushDeviceLabel } from "@/lib/push/device-label";
import type { PushPreferenceState, PushSubscriptionDevice } from "@/lib/push";
import {
  assertRuntimeDataAccessAvailable,
  selectRuntimeDataAccess,
} from "@/lib/runtime-data-access";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const notificationPreferenceDataAccess = selectRuntimeDataAccess({
  capability: "admin",
});
const useMockPreferences = notificationPreferenceDataAccess.source === "mock";

function assertNotificationPreferenceDataAccessAvailable() {
  assertRuntimeDataAccessAvailable(
    notificationPreferenceDataAccess,
    "알림 설정 저장소를 사용할 수 없습니다.",
  );
}

const mockPreferenceStore = new Map<string, PushPreferenceState>();
const mockPushDeviceStore = new Map<string, PushSubscriptionDevice[]>();

function getMockPreferences(memberId: string) {
  const current = mockPreferenceStore.get(memberId);
  const policyState = getMockMemberPolicyState(memberId);
  if (current) {
    return { ...current, marketingEnabled: policyState?.marketingEnabled ?? current.marketingEnabled };
  }
  const initial = { ...DEFAULT_PUSH_PREFERENCES, marketingEnabled: policyState?.marketingEnabled ?? false };
  mockPreferenceStore.set(memberId, initial);
  return initial;
}

export function isMockNotificationPreferenceMode() {
  return useMockPreferences;
}

export function listMockPushDevices(
  memberId: string,
  currentEndpoint?: string | null,
) {
  return (mockPushDeviceStore.get(memberId) ?? []).map((device) => ({
    ...device,
    isCurrent: Boolean(currentEndpoint && device.id === currentEndpoint),
  }));
}

export function upsertMockPushDevice(params: {
  memberId: string;
  endpoint: string;
  userAgent?: string | null;
}) {
  const now = new Date().toISOString();
  const devices = mockPushDeviceStore.get(params.memberId) ?? [];
  const nextDevice: PushSubscriptionDevice = {
    id: params.endpoint,
    label: getPushDeviceLabel(params.userAgent ?? null),
    userAgent: params.userAgent ?? null,
    isCurrent: true,
    createdAt:
      devices.find((device) => device.id === params.endpoint)?.createdAt ?? now,
    updatedAt: now,
    lastSuccessAt: null,
  };
  mockPushDeviceStore.set(params.memberId, [
    nextDevice,
    ...devices.filter((device) => device.id !== params.endpoint),
  ]);
  return updateMemberNotificationPreferences(params.memberId, { enabled: true });
}

export function deactivateMockPushDevice(params: {
  memberId: string;
  endpoint?: string | null;
  subscriptionId?: string | null;
}) {
  const targetId = params.subscriptionId ?? params.endpoint;
  if (targetId) {
    mockPushDeviceStore.set(
      params.memberId,
      (mockPushDeviceStore.get(params.memberId) ?? []).filter(
        (device) => device.id !== targetId,
      ),
    );
  }
  if ((mockPushDeviceStore.get(params.memberId) ?? []).length === 0) {
    return updateMemberNotificationPreferences(params.memberId, { enabled: false });
  }
  return getMemberNotificationPreferences(params.memberId);
}

export function deactivateAllMockPushDevices(memberId: string) {
  mockPushDeviceStore.set(memberId, []);
  return updateMemberNotificationPreferences(memberId, { enabled: false });
}

export async function getMemberNotificationPreferences(memberId: string) {
  assertNotificationPreferenceDataAccessAvailable();
  if (useMockPreferences) {
    const preferences = getMockPreferences(memberId);
    return {
      ...preferences,
      enabled:
        preferences.enabled && (mockPushDeviceStore.get(memberId) ?? []).length > 0,
    };
  }
  const [
    preferences,
    activeMarketingPolicy,
    consentVersions,
    activePushSubscriptionCount,
  ] = await Promise.all([
    getMemberPushPreferences(memberId),
    getPolicyDocumentByKind("marketing").catch(() => null),
    getMemberPolicyConsentVersions(memberId),
    countActivePushSubscriptions(memberId),
  ]);

  return {
    ...preferences,
    enabled: preferences.enabled && activePushSubscriptionCount > 0,
    marketingEnabled: hasEffectiveMarketingConsent({
      hasActiveMarketingPolicy: Boolean(activeMarketingPolicy),
      hasCurrentPolicyConsent: Boolean(
        activeMarketingPolicy &&
          consentVersions.marketing === activeMarketingPolicy.version,
      ),
      marketingEnabled: preferences.marketingEnabled,
    }),
  };
}

export async function updateMemberNotificationPreferences(
  memberId: string,
  value: NotificationPreferencePatch,
  context?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  assertNotificationPreferenceDataAccessAvailable();
  const parsed = parseNotificationPreferencePatch(value);
  if (!parsed.ok) throw new PushError("invalid_request", parsed.message);
  const { marketingPolicyId, marketingPolicyVersion, ...patch } = parsed.value;
  if (useMockPreferences) {
    if (patch.marketingEnabled === true) {
      const activePolicy = await getPolicyDocumentByKind("marketing");
      if (!activePolicy || activePolicy.id !== marketingPolicyId || activePolicy.version !== marketingPolicyVersion) {
        throw new NotificationPolicyConflictError();
      }
    }
    const current = getMockPreferences(memberId);
    const hasPushDevice = (mockPushDeviceStore.get(memberId) ?? []).length > 0;
    const next = {
      ...current,
      ...patch,
      enabled: (patch.enabled ?? current.enabled) && hasPushDevice,
    };
    if (patch.marketingEnabled !== undefined) {
      recordMockMarketingPolicyConsent(memberId, marketingPolicyVersion ?? null, patch.marketingEnabled);
    }
    mockPreferenceStore.set(memberId, next);
    return next;
  }

  const { data, error } = await getSupabaseAdminClient().rpc(
    "patch_member_notification_preferences_atomic",
    {
      input_member_id: memberId,
      input_enabled: patch.enabled ?? null,
      input_announcement_enabled: patch.announcementEnabled ?? null,
      input_new_partner_enabled: patch.newPartnerEnabled ?? null,
      input_expiring_partner_enabled: patch.expiringPartnerEnabled ?? null,
      input_review_enabled: patch.reviewEnabled ?? null,
      input_mm_enabled: patch.mmEnabled ?? null,
      input_marketing_enabled: patch.marketingEnabled ?? null,
      input_marketing_policy_id: marketingPolicyId ?? null,
      input_marketing_policy_version: marketingPolicyVersion ?? null,
      input_ip_address: context?.ipAddress ?? null,
      input_user_agent: context?.userAgent ?? null,
    },
  );

  if (error) {
    if (error.code === "P0001" && error.message === "marketing_policy_changed") {
      throw new NotificationPolicyConflictError();
    }
    throw wrapPushDbError(error, "알림 설정을 저장하지 못했습니다.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw wrapPushDbError(null, "알림 설정을 저장하지 못했습니다.");
  }

  return {
    enabled: Boolean(row.enabled),
    announcementEnabled: Boolean(row.announcement_enabled),
    newPartnerEnabled: Boolean(row.new_partner_enabled),
    expiringPartnerEnabled: Boolean(row.expiring_partner_enabled),
    reviewEnabled: Boolean(row.review_enabled),
    mmEnabled: Boolean(row.mm_enabled),
    marketingEnabled: Boolean(row.marketing_enabled),
  };
}
