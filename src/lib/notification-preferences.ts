import { getPolicyDocumentByKind, recordMarketingPolicyConsent } from "@/lib/policy-documents";
import {
  countActivePushSubscriptions,
  DEFAULT_PUSH_PREFERENCES,
  getMemberPushPreferences,
  upsertMemberPushPreferences,
} from "@/lib/push";
import { wrapPushDbError } from "@/lib/push/config";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { PushPreferenceState, PushSubscriptionDevice } from "@/lib/push";

const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
const hasSupabaseEnv =
  !!process.env.SUPABASE_URL &&
  (!!process.env.SUPABASE_ANON_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY);
const useMockPreferences = dataSource === "mock" || !hasSupabaseEnv;

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

function getMockDeviceLabel(userAgent: string | null) {
  const source = userAgent ?? "";
  const browser = source.includes("Chrome")
    ? "Chrome"
    : source.includes("Safari")
      ? "Safari"
      : source.includes("Firefox")
        ? "Firefox"
        : "브라우저";
  const os = source.includes("Mac")
    ? "macOS"
    : source.includes("Windows")
      ? "Windows"
      : source.includes("Android")
        ? "Android"
        : source.includes("iPhone") || source.includes("iPad")
          ? "iOS"
          : "기기";

  return `${browser} · ${os}`;
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
    label: getMockDeviceLabel(params.userAgent ?? null),
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
  if (useMockPreferences) {
    const preferences = getMockPreferences(memberId);
    return {
      ...preferences,
      enabled:
        preferences.enabled && (mockPushDeviceStore.get(memberId) ?? []).length > 0,
    };
  }
  const supabase = getSupabaseAdminClient();
  const [
    preferences,
    activeMarketingPolicy,
    memberResult,
    activePushSubscriptionCount,
  ] = await Promise.all([
    getMemberPushPreferences(memberId),
    getPolicyDocumentByKind("marketing").catch(() => null),
    supabase
      .from("members")
      .select("marketing_policy_version")
      .eq("id", memberId)
      .maybeSingle(),
    countActivePushSubscriptions(memberId),
  ]);

  if (memberResult.error) {
    throw wrapPushDbError(memberResult.error, "Push 설정을 불러오지 못했습니다.");
  }

  return {
    ...preferences,
    enabled: preferences.enabled && activePushSubscriptionCount > 0,
    marketingEnabled: Boolean(
      activeMarketingPolicy &&
        memberResult.data?.marketing_policy_version === activeMarketingPolicy.version,
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

  const activePushSubscriptionCount = await countActivePushSubscriptions(memberId);
  const currentPreferences = await getMemberPushPreferences(memberId);
  const preferences = await upsertMemberPushPreferences(memberId, {
    ...value,
    enabled:
      (value.enabled ?? currentPreferences.enabled) &&
      activePushSubscriptionCount > 0,
  });
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
