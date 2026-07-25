import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import AdminMemberDetailView from "@/components/admin/AdminMemberDetailView";
import AdminMemberDetailStatusMessages from "@/components/admin/member-detail/AdminMemberDetailStatusMessages";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Button from "@/components/ui/Button";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { requireAdminPermission } from "@/lib/admin-access";
import { formatSsafyMemberLifecycleLabel, getCurrentSsafyYear } from "@/lib/ssafy-year";
import { canAdmin } from "@/lib/admin-permissions";
import { getAdminMemberDetailReadModel } from "@/lib/admin-member-detail.server";
import {
  deleteMember,
  issueMemberEmailLoginTransition,
  syncMemberProfile,
  updateMember,
} from "@/app/admin/(protected)/actions";
import { sanitizeAdminReturnTo } from "@/lib/admin-session-bridge";
import {
  approveMemberProfilePhotoAction,
  rejectMemberCurrentProfilePhotoAction,
  rejectMemberProfilePhotoAction,
} from "@/app/admin/(protected)/profile-photos/actions";

export const dynamic = "force-dynamic";

const SECURITY_LOG_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_SECURITY_LOG_PAGE_SIZE = 50;

type AdminMemberDetailSearchParams = {
  logPage?: string;
  logPageSize?: string;
  error?: string;
  emailTransition?: string;
  memberSync?: string;
  returnTo?: string;
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

function buildMemberDetailRetryHref({
  memberId,
  securityLogPage,
  securityLogPageSize,
  backHref,
}: {
  memberId: string;
  securityLogPage: number;
  securityLogPageSize: number;
  backHref: string;
}) {
  const params = new URLSearchParams();
  if (securityLogPage > 1) params.set("logPage", String(securityLogPage));
  if (securityLogPageSize !== DEFAULT_SECURITY_LOG_PAGE_SIZE) {
    params.set("logPageSize", String(securityLogPageSize));
  }
  if (backHref !== "/admin/members") {
    params.set("returnTo", backHref);
  }
  const query = params.toString();
  return query ? `/admin/members/${memberId}?${query}` : `/admin/members/${memberId}`;
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
  const canUpdateMembers = canAdmin(
    adminSession.account.permissions,
    "members",
    "update",
  );
  const { memberId } = await params;
  const query = (await searchParams) ?? {};
  const securityLogPage = parsePositiveInteger(query.logPage, 1);
  const securityLogPageSize = parseSecurityLogPageSize(query.logPageSize);
  const backHref = sanitizeAdminReturnTo(query.returnTo, "/admin/members");
  const backLabel = backHref.startsWith("/admin/search") ? "검색 결과" : "회원 관리";
  const retryHref = buildMemberDetailRetryHref({
    memberId,
    securityLogPage,
    securityLogPageSize,
    backHref,
  });
  const detail = await getAdminMemberDetailReadModel({
    memberId,
    canUpdateMembers,
    securityLogPage,
    securityLogPageSize,
  });

  if (!detail.member) {
    if (detail.memberLoadError) {
      return (
        <AdminShell title="회원 상세" backHref={backHref} backLabel={backLabel}>
          <AdminStatePanel
            kind="error"
            title="회원 정보를 불러오지 못했습니다."
            description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
            action={<Button href={retryHref} variant="secondary">다시 확인</Button>}
          />
        </AdminShell>
      );
    }
    notFound();
  }

  const member = detail.member;
  const profile = parseSsafyProfile(
    member.displayName ?? member.manualLoginId ?? member.mattermostUsername ?? undefined,
  );
  const displayName =
    profile.displayName ??
    member.displayName ??
    member.manualLoginId ??
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
  const canReadProfilePhotos = canAdmin(
    adminSession.account.permissions,
    "profile_images",
    "read",
  );
  const canUpdateProfilePhotos = canAdmin(
    adminSession.account.permissions,
    "profile_images",
    "update",
  );
  return (
    <AdminShell title="회원 상세" backHref={backHref} backLabel={backLabel}>
      <div className="grid gap-4">
        <AdminMemberDetailStatusMessages
          errorCode={query.error}
          emailTransition={query.emailTransition}
          memberSync={query.memberSync}
        />
      {detail.detailLoadError ? (
        <AdminStatePanel
          kind="error"
          title="일부 회원 운영 정보를 불러오지 못했습니다."
          description="기본 프로필은 표시하고 있습니다. 잠시 후 다시 확인해 주세요."
          action={<Button href={retryHref} variant="secondary">다시 확인</Button>}
        />
      ) : null}
      <AdminMemberDetailView
        member={{
          id: member.id,
          displayName,
          mmUsername: member.mattermostUsername ?? "",
          mmUserId: member.mattermostUserId,
          manualLoginId: member.manualLoginId,
          generation,
          generationLabel,
          campus,
          mustChangePassword: member.mustChangePassword,
          hasMattermostAccount: Boolean(member.mattermostAccountId),
          mattermostLoginDisabledAt: member.mattermostLoginDisabledAt,
          mattermostLoginDisabledReason: member.mattermostLoginDisabledReason,
          ...(canUpdateMembers
            ? {
                email: member.email,
                emailVerifiedAt: member.emailVerifiedAt,
                emailLoginTransition: detail.emailLoginTransition,
              }
            : {}),
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
          hasAvatar,
          avatarUrl,
        }}
        activeDeviceCount={detail.activeDeviceCount}
        securityLogs={detail.securityLogs}
        securityLogPagination={{
          totalCount: detail.securityLogTotalCount,
          page: securityLogPage,
          pageSize: securityLogPageSize,
          pageSizeOptions: SECURITY_LOG_PAGE_SIZE_OPTIONS,
        }}
        preferences={detail.preferences}
        policyStates={detail.policyOverview.states}
        consentTimeline={detail.policyOverview.timeline}
        updateAction={updateMember}
        deleteAction={deleteMember}
        emailLoginTransitionAction={issueMemberEmailLoginTransition}
        syncMemberProfileAction={syncMemberProfile}
        canUpdate={canUpdateMembers}
        canDelete={canAdmin(
          adminSession.account.permissions,
          "members",
          "delete",
        )}
        profilePhoto={canReadProfilePhotos ? {
          reviewStatus: member.profilePhotoReviewStatus,
          pendingImageId: detail.pendingProfilePhotoId,
          canUpdate: canUpdateProfilePhotos,
          approveAction: approveMemberProfilePhotoAction,
          rejectReplacementAction: rejectMemberProfilePhotoAction,
          rejectCurrentAction: rejectMemberCurrentProfilePhotoAction,
        } : null}
      />
      </div>
    </AdminShell>
  );
}
