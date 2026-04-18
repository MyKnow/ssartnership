import { getPolicyDocumentByKind, recordMarketingPolicyConsent } from "@/lib/policy-documents";
import {
  DEFAULT_PUSH_PREFERENCES,
  getMemberPushPreferences,
  upsertMemberPushPreferences,
} from "@/lib/push";
import type { PushPreferenceState, PushSubscriptionDevice } from "@/lib/push";

export type NotificationPreferenceState = PushPreferenceState;

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
  return getMemberNotificationPreferences(params.memberId);
}

export function deactivateAllMockPushDevices(memberId: string) {
  mockPushDeviceStore.set(memberId, []);
  return updateMemberNotificationPreferences(memberId, { enabled: false });
}

export async function getMemberNotificationPreferences(memberId: string) {
  if (useMockPreferences) {
    return getMockPreferences(memberId);
  }
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
  if (useMockPreferences) {
    const next = {
      ...getMockPreferences(memberId),
      ...value,
    };
    mockPreferenceStore.set(memberId, next);
    return next;
  }

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
