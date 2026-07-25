import {
  buildAdminMemberPolicyOverview,
  normalizeAdminMemberNotificationPreferences,
  type AdminMemberConsentActivityRow,
  type AdminMemberConsentHistoryRow,
  type AdminMemberPushPreferenceRow,
} from "@/lib/admin-member-detail";
import type { AdminMemberSecurityLog } from "@/components/admin/member-detail/AdminMemberSecurityLogExplorer";
import {
  getMemberEmailLoginTransition,
  type MemberEmailLoginTransition,
} from "@/lib/member-email-login-transition";
import {
  getMemberCanonicalProfile,
  type MemberCanonicalProfile,
} from "@/lib/member-profile-view";
import { isMockDataSource } from "@/lib/mock/member";
import {
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
} from "@/lib/policy-documents";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminMemberDetailReadModel = {
  member: MemberCanonicalProfile | null;
  memberLoadError: boolean;
  detailLoadError: boolean;
  activeDeviceCount: number;
  securityLogs: AdminMemberSecurityLog[];
  securityLogTotalCount: number;
  preferences: ReturnType<typeof normalizeAdminMemberNotificationPreferences>;
  policyOverview: ReturnType<typeof buildAdminMemberPolicyOverview>;
  pendingProfilePhotoId: string | null;
  emailLoginTransition: MemberEmailLoginTransition | null;
};

type SafeResult<T> = {
  value: T | null;
  failed: boolean;
};

async function readSafely<T>(promise: Promise<T>): Promise<SafeResult<T>> {
  try {
    return { value: await promise, failed: false };
  } catch {
    return { value: null, failed: true };
  }
}

function toSecurityLogs(rows: Array<{
  id: string;
  event_name: string;
  status: string | null;
  identifier: string | null;
  path: string | null;
  ip_address: string | null;
  properties: unknown;
  created_at: string;
}>): AdminMemberSecurityLog[] {
  return rows.map((log) => ({
    id: log.id,
    eventName: log.event_name,
    status: log.status,
    identifier: log.identifier,
    path: log.path,
    ipAddress: log.ip_address,
    properties:
      log.properties && typeof log.properties === "object" && !Array.isArray(log.properties)
        ? (log.properties as Record<string, unknown>)
        : null,
    createdAt: log.created_at,
  }));
}

function buildPolicyOverview({
  activePolicies,
  activeMarketingPolicy,
  consentHistory,
  consentActivity,
}: {
  activePolicies: Awaited<ReturnType<typeof getActiveRequiredPolicies>> | null;
  activeMarketingPolicy: Awaited<ReturnType<typeof getPolicyDocumentByKind>> | null;
  consentHistory: AdminMemberConsentHistoryRow[];
  consentActivity: AdminMemberConsentActivityRow[];
}) {
  return buildAdminMemberPolicyOverview({
    activeVersions: {
      service: activePolicies?.service.version ?? null,
      privacy: activePolicies?.privacy.version ?? null,
      marketing: activeMarketingPolicy?.version ?? null,
    },
    consentHistory,
    consentActivity,
  });
}

function buildMemberUnavailableReadModel(memberLoadError: boolean): AdminMemberDetailReadModel {
  return {
    member: null,
    memberLoadError,
    detailLoadError: false,
    activeDeviceCount: 0,
    securityLogs: [],
    securityLogTotalCount: 0,
    preferences: normalizeAdminMemberNotificationPreferences(null, 0),
    policyOverview: buildPolicyOverview({
      activePolicies: null,
      activeMarketingPolicy: null,
      consentHistory: [],
      consentActivity: [],
    }),
    pendingProfilePhotoId: null,
    emailLoginTransition: null,
  };
}

/**
 * View-ready server read model for a single admin member detail route.
 *
 * A missing member remains distinct from a temporary read failure. Optional
 * operational panels degrade to their safe defaults while the core member
 * profile stays actionable.
 */
export async function getAdminMemberDetailReadModel({
  memberId,
  canUpdateMembers,
  securityLogPage,
  securityLogPageSize,
}: {
  memberId: string;
  canUpdateMembers: boolean;
  securityLogPage: number;
  securityLogPageSize: number;
}): Promise<AdminMemberDetailReadModel> {
  const memberResultPromise = readSafely(getMemberCanonicalProfile(memberId));
  const activePoliciesResultPromise = readSafely(getActiveRequiredPolicies());
  const activeMarketingPolicyResultPromise = readSafely(
    getPolicyDocumentByKind("marketing"),
  );

  if (isMockDataSource()) {
    const [memberResult, activePoliciesResult, activeMarketingPolicyResult] =
      await Promise.all([
        memberResultPromise,
        activePoliciesResultPromise,
        activeMarketingPolicyResultPromise,
      ]);
    if (!memberResult.value) {
      return buildMemberUnavailableReadModel(memberResult.failed);
    }

    return {
      member: memberResult.value,
      memberLoadError: false,
      detailLoadError:
        activePoliciesResult.failed || activeMarketingPolicyResult.failed,
      activeDeviceCount: 0,
      securityLogs: [],
      securityLogTotalCount: 0,
      preferences: normalizeAdminMemberNotificationPreferences(null, 0),
      policyOverview: buildPolicyOverview({
        activePolicies: activePoliciesResult.value,
        activeMarketingPolicy: activeMarketingPolicyResult.value,
        consentHistory: [],
        consentActivity: [],
      }),
      pendingProfilePhotoId: null,
      emailLoginTransition: null,
    };
  }

  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  try {
    supabase = getSupabaseAdminClient();
  } catch {
    const [memberResult] = await Promise.all([
      memberResultPromise,
      activePoliciesResultPromise,
      activeMarketingPolicyResultPromise,
    ]);
    if (!memberResult.value) {
      return buildMemberUnavailableReadModel(memberResult.failed);
    }

    return {
      ...buildMemberUnavailableReadModel(true),
      member: memberResult.value,
      detailLoadError: true,
      memberLoadError: false,
    };
  }

  const securityLogFrom = (securityLogPage - 1) * securityLogPageSize;
  const securityLogTo = securityLogFrom + securityLogPageSize - 1;
  const detailResultsPromise = Promise.all([
    supabase
      .from("push_preferences")
      .select(
        "enabled,announcement_enabled,new_partner_enabled,expiring_partner_enabled,review_enabled,mm_enabled,marketing_enabled",
      )
      .eq("member_id", memberId)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .eq("is_active", true),
    supabase
      .from("member_policy_consents")
      .select("kind,version,agreed_at,policy_documents(title,effective_at)")
      .eq("member_id", memberId)
      .order("agreed_at", { ascending: false }),
    supabase
      .from("auth_security_logs")
      .select("properties,created_at")
      .eq("event_name", "member_policy_consent")
      .eq("status", "success")
      .eq("actor_type", "member")
      .eq("actor_id", memberId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("auth_security_logs")
      .select("id,event_name,status,identifier,path,ip_address,properties,created_at", {
        count: "exact",
      })
      .eq("actor_type", "member")
      .eq("actor_id", memberId)
      .order("created_at", { ascending: false })
      .range(securityLogFrom, securityLogTo),
    supabase
      .from("member_profile_images")
      .select("id")
      .eq("member_id", memberId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    canUpdateMembers
      ? readSafely(getMemberEmailLoginTransition(memberId))
      : Promise.resolve({ value: null, failed: false }),
  ]);
  const [
    memberResult,
    activePoliciesResult,
    activeMarketingPolicyResult,
    [
      preferenceResult,
      subscriptionsResult,
      consentHistoryResult,
      consentActivityResult,
      securityLogsResult,
      pendingProfilePhotoResult,
      emailLoginTransitionResult,
    ],
  ] = await Promise.all([
    memberResultPromise,
    activePoliciesResultPromise,
    activeMarketingPolicyResultPromise,
    detailResultsPromise,
  ]);
  if (!memberResult.value) {
    return buildMemberUnavailableReadModel(memberResult.failed);
  }

  const consentActivity: AdminMemberConsentActivityRow[] = (
    consentActivityResult.data ?? []
  ).map((row) => ({
    properties:
      row.properties && typeof row.properties === "object" && !Array.isArray(row.properties)
        ? (row.properties as Record<string, unknown>)
        : null,
    created_at: row.created_at,
  }));
  const securityLogs = toSecurityLogs(securityLogsResult.data ?? []);

  return {
    member: memberResult.value,
    memberLoadError: false,
    detailLoadError: Boolean(
      preferenceResult.error ||
        subscriptionsResult.error ||
        consentHistoryResult.error ||
        consentActivityResult.error ||
        securityLogsResult.error ||
        pendingProfilePhotoResult.error ||
        emailLoginTransitionResult.failed ||
        activePoliciesResult.failed ||
        activeMarketingPolicyResult.failed,
    ),
    activeDeviceCount: subscriptionsResult.count ?? 0,
    securityLogs,
    securityLogTotalCount: securityLogsResult.count ?? securityLogs.length,
    preferences: normalizeAdminMemberNotificationPreferences(
      (preferenceResult.data ?? null) as AdminMemberPushPreferenceRow | null,
      subscriptionsResult.count,
    ),
    policyOverview: buildPolicyOverview({
      activePolicies: activePoliciesResult.value,
      activeMarketingPolicy: activeMarketingPolicyResult.value,
      consentHistory: (consentHistoryResult.data ?? []) as AdminMemberConsentHistoryRow[],
      consentActivity,
    }),
    pendingProfilePhotoId: pendingProfilePhotoResult.data?.id ?? null,
    emailLoginTransition: emailLoginTransitionResult.value,
  };
}
