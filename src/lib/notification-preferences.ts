import { getPolicyDocumentByKind, recordMarketingPolicyConsent } from "@/lib/policy-documents";
import {
  DEFAULT_PUSH_PREFERENCES,
  getMemberPushPreferences,
  upsertMemberPushPreferences,
} from "@/lib/push";
import type { PushPreferenceState } from "@/lib/push";

export type NotificationPreferenceState = PushPreferenceState;

const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
const hasSupabaseEnv =
  !!process.env.SUPABASE_URL &&
  (!!process.env.SUPABASE_ANON_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY);
const useMockPreferences = dataSource === "mock" || !hasSupabaseEnv;

const mockPreferenceStore = new Map<string, PushPreferenceState>();

function getMockPreferences(memberId: string) {
  const current = mockPreferenceStore.get(memberId);
  if (current) {
    return current;
  }
  const initial = { ...DEFAULT_PUSH_PREFERENCES };
  mockPreferenceStore.set(memberId, initial);
  return initial;
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
