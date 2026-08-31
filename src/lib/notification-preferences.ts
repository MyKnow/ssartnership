import {
  getMemberPolicyConsentVersions,
  getPolicyDocumentByKind,
} from "@/lib/policy-documents";
import {
  countActivePushSubscriptions,
  DEFAULT_PUSH_PREFERENCES,
  getMemberPushPreferences,
} from "@/lib/push";
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
  if (current) {
    return current;
  }
  const initial = { ...DEFAULT_PUSH_PREFERENCES };
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
    marketingEnabled: Boolean(
      preferences.marketingEnabled
      && activeMarketingPolicy
      && consentVersions.marketing === activeMarketingPolicy.version,
    ),
  };
}

export async function updateMemberNotificationPreferences(
  memberId: string,
  value: Partial<PushPreferenceState>,
  context?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  assertNotificationPreferenceDataAccessAvailable();
  if (useMockPreferences) {
    const current = getMockPreferences(memberId);
    const hasPushDevice = (mockPushDeviceStore.get(memberId) ?? []).length > 0;
    const next = {
      ...current,
      ...value,
      enabled: (value.enabled ?? current.enabled) && hasPushDevice,
    };
    mockPreferenceStore.set(memberId, next);
    return next;
  }

  const { data, error } = await getSupabaseAdminClient().rpc(
    "update_member_push_preferences_atomic",
    {
      input_member_id: memberId,
      input_enabled: value.enabled ?? null,
      input_announcement_enabled: value.announcementEnabled ?? null,
      input_new_partner_enabled: value.newPartnerEnabled ?? null,
      input_expiring_partner_enabled: value.expiringPartnerEnabled ?? null,
      input_review_enabled: value.reviewEnabled ?? null,
      input_mm_enabled: value.mmEnabled ?? null,
      input_marketing_enabled: value.marketingEnabled ?? null,
      input_ip_address: context?.ipAddress ?? null,
      input_user_agent: context?.userAgent ?? null,
    },
  );

  if (error) {
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
