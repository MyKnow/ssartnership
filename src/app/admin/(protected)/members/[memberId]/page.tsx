import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import AdminMemberDetailView from "@/components/admin/AdminMemberDetailView";
import {
  type AdminMemberSecurityLog,
} from "@/components/admin/member-detail/AdminMemberSecurityLogExplorer";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { requireAdminPermission } from "@/lib/admin-access";
import { formatSsafyMemberLifecycleLabel, getCurrentSsafyYear } from "@/lib/ssafy-year";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { canAdmin } from "@/lib/admin-permissions";
import {
  buildAdminMemberPolicyOverview,
  normalizeAdminMemberNotificationPreferences,
  type AdminMemberConsentActivityRow,
  type AdminMemberConsentHistoryRow,
  type AdminMemberPushPreferenceRow,
} from "@/lib/admin-member-detail";
import {
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
} from "@/lib/policy-documents";
import { getMemberCanonicalProfile } from "@/lib/member-profile-view";
import {
  deleteMember,
  updateMember,
} from "@/app/admin/(protected)/actions";

export const dynamic = "force-dynamic";

const SECURITY_LOG_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_SECURITY_LOG_PAGE_SIZE = 50;

type AdminMemberDetailSearchParams = {
  logPage?: string;
  logPageSize?: string;
};

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSecurityLogPageSize(value: string | undefined) {
  const parsed = parsePositiveInteger(value, DEFAULT_SECURITY_LOG_PAGE_SIZE);
  return SECURITY_LOG_PAGE_SIZE_OPTIONS.includes(
    parsed as (typeof SECURITY_LOG_PAGE_SIZE_OPTIONS)[number],
  )
    ? parsed
    : DEFAULT_SECURITY_LOG_PAGE_SIZE;
}

export default async function AdminMemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams?: Promise<AdminMemberDetailSearchParams>;
}) {
  const adminSession = await requireAdminPermission("members", "read", {
    path: "/admin/members",
  });
  const { memberId } = await params;
  const query = (await searchParams) ?? {};
  const securityLogPage = parsePositiveInteger(query.logPage, 1);
  const securityLogPageSize = parseSecurityLogPageSize(query.logPageSize);
  const securityLogFrom = (securityLogPage - 1) * securityLogPageSize;
  const securityLogTo = securityLogFrom + securityLogPageSize - 1;
  const supabase = getSupabaseAdminClient();

  const [
    member,
    preferenceResult,
    subscriptionsResult,
    consentHistoryResult,
    consentActivityResult,
    securityLogsResult,
    activePolicies,
    activeMarketingPolicy,
  ] = await Promise.all([
    getMemberCanonicalProfile(memberId),
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
      .select(
        "kind,version,agreed_at,policy_documents(title,effective_at)",
      )
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
    getActiveRequiredPolicies(),
    getPolicyDocumentByKind("marketing").catch(() => null),
  ]);

  if (!member) {
    notFound();
  }

  const securityLogs: AdminMemberSecurityLog[] = (securityLogsResult.data ?? []).map((log) => ({
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
  const securityLogTotalCount = securityLogsResult.count ?? securityLogs.length;
  const profile = parseSsafyProfile(
    member.displayName ?? member.mattermostUsername ?? undefined,
  );
  const displayName =
    profile.displayName ??
    member.displayName ??
    member.mattermostUsername ??
    "회원 상세";
  const generation = member.generation ?? getCurrentSsafyYear();
  const generationLabel = formatSsafyMemberLifecycleLabel(generation);
  const campus = member.campus ?? profile.campus ?? "-";
  const hasAvatar = Boolean(
    member.activeProfileImageId &&
      member.profilePhotoReviewStatus === "approved",
  );
  const avatarUrl = `/api/admin/members/${member.id}/avatar${member.updatedAt ? `?v=${encodeURIComponent(member.updatedAt)}` : ""}`;
  const notificationPreferences = normalizeAdminMemberNotificationPreferences(
    (preferenceResult.data ?? null) as AdminMemberPushPreferenceRow | null,
    subscriptionsResult.count,
  );
  const consentActivity: AdminMemberConsentActivityRow[] = (
    consentActivityResult.data ?? []
  ).map((row) => ({
    properties:
      row.properties &&
      typeof row.properties === "object" &&
      !Array.isArray(row.properties)
        ? (row.properties as Record<string, unknown>)
        : null,
    created_at: row.created_at,
  }));
  const policyOverview = buildAdminMemberPolicyOverview({
    activeVersions: {
      service: activePolicies.service.version,
      privacy: activePolicies.privacy.version,
      marketing: activeMarketingPolicy?.version ?? null,
    },
    consentHistory: (consentHistoryResult.data ?? []) as AdminMemberConsentHistoryRow[],
    consentActivity,
  });

  return (
    <AdminShell title="회원 상세" backHref="/admin/members" backLabel="회원 관리">
      <AdminMemberDetailView
        member={{
          id: member.id,
          displayName,
          mmUsername: member.mattermostUsername ?? "",
          mmUserId: member.mattermostUserId,
          generation,
          generationLabel,
          campus,
          mustChangePassword: member.mustChangePassword,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
          hasAvatar,
          avatarUrl,
        }}
        activeDeviceCount={subscriptionsResult.count ?? 0}
        securityLogs={securityLogs}
        securityLogPagination={{
          totalCount: securityLogTotalCount,
          page: securityLogPage,
          pageSize: securityLogPageSize,
          pageSizeOptions: SECURITY_LOG_PAGE_SIZE_OPTIONS,
        }}
        preferences={notificationPreferences}
        policyStates={policyOverview.states}
        consentTimeline={policyOverview.timeline}
        updateAction={updateMember}
        deleteAction={deleteMember}
        canUpdate={canAdmin(
          adminSession.account.permissions,
          "members",
          "update",
        )}
        canDelete={canAdmin(
          adminSession.account.permissions,
          "members",
          "delete",
        )}
      />
    </AdminShell>
  );
}
