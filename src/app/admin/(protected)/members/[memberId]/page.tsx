import { notFound } from "next/navigation";
import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";
import AdminMemberDetailView from "@/components/admin/AdminMemberDetailView";
import {
  AdminMemberAccountBoundary,
  AdminMemberDetailDeferredFallback,
  AdminMemberOperationalBoundary,
  AdminMemberProfilePhotoBoundary,
} from "@/components/admin/AdminMemberDetailDeferredPanels";
import AdminMemberDetailStatusMessages from "@/components/admin/member-detail/AdminMemberDetailStatusMessages";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import { AdminMemberDetailSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import Button from "@/components/ui/Button";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { requireAdminPermission } from "@/lib/admin-access";
import { formatSsafyMemberLifecycleLabel, getCurrentSsafyYear } from "@/lib/ssafy-year";
import { canAdmin } from "@/lib/admin-permissions";
import { normalizeAdminMemberNotificationPreferences } from "@/lib/admin-member-detail";
import {
  getAdminMemberDetailCoreReadModel,
  getAdminMemberDetailOperationalReadModel,
} from "@/lib/admin-member-detail.server";
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

async function AdminMemberDetailContent({
  adminSession,
  memberId,
  query,
  backHref,
}: {
  adminSession: Awaited<ReturnType<typeof requireAdminPermission>>;
  memberId: string;
  query: AdminMemberDetailSearchParams;
  backHref: string;
}) {
  const canUpdateMembers = canAdmin(
    adminSession.account.permissions,
    "members",
    "update",
  );
  const securityLogPage = parsePositiveInteger(query.logPage, 1);
  const securityLogPageSize = parseSecurityLogPageSize(query.logPageSize);
  const retryHref = buildMemberDetailRetryHref({
    memberId,
    securityLogPage,
    securityLogPageSize,
    backHref,
  });
  const operationalPromise = getAdminMemberDetailOperationalReadModel({
    memberId,
    canUpdateMembers,
    securityLogPage,
    securityLogPageSize,
  });
  const detail = await getAdminMemberDetailCoreReadModel({ memberId });

  if (!detail.member) {
    if (detail.memberLoadError) {
      return (
        <AdminStatePanel
          kind="error"
          title="회원 정보를 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
          action={<Button href={retryHref} variant="secondary">다시 확인</Button>}
        />
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
  const canDeleteMembers = canAdmin(
    adminSession.account.permissions,
    "members",
    "delete",
  );
  const accountManagerMember = {
    id: member.id,
    displayName,
    campus,
    generation,
    mmUsername: member.mattermostUsername ?? "",
    manualLoginId: member.manualLoginId,
    mustChangePassword: member.mustChangePassword,
    hasMattermostAccount: Boolean(member.mattermostAccountId),
    mattermostLoginDisabledAt: member.mattermostLoginDisabledAt,
    mattermostLoginDisabledReason: member.mattermostLoginDisabledReason,
    ...(canUpdateMembers
      ? {
          email: member.email,
          emailVerifiedAt: member.emailVerifiedAt,
        }
      : {}),
  };
  return (
    <div className="grid gap-4">
        <AdminMemberDetailStatusMessages
          errorCode={query.error}
          emailTransition={query.emailTransition}
          memberSync={query.memberSync}
        />
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
              }
            : {}),
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
          hasAvatar,
          avatarUrl,
        }}
        activeDeviceCount={null}
        securityLogs={[]}
        securityLogPagination={{
          totalCount: 0,
          page: securityLogPage,
          pageSize: securityLogPageSize,
          pageSizeOptions: SECURITY_LOG_PAGE_SIZE_OPTIONS,
        }}
        preferences={normalizeAdminMemberNotificationPreferences(null, 0)}
        policyStates={[]}
        consentTimeline={[]}
        updateAction={updateMember}
        deleteAction={deleteMember}
        emailLoginTransitionAction={issueMemberEmailLoginTransition}
        syncMemberProfileAction={syncMemberProfile}
        canUpdate={canUpdateMembers}
        canDelete={canDeleteMembers}
        profilePhoto={null}
        deferredProfilePhoto={canReadProfilePhotos ? (
          <Suspense
            fallback={
              <AdminMemberDetailDeferredFallback label="프로필 사진 운영 정보를 불러오는 중입니다." />
            }
          >
            <AdminMemberProfilePhotoBoundary
              operational={operationalPromise}
              memberId={member.id}
              reviewStatus={member.profilePhotoReviewStatus}
              canUpdate={canUpdateProfilePhotos}
              approveAction={approveMemberProfilePhotoAction}
              rejectReplacementAction={rejectMemberProfilePhotoAction}
              rejectCurrentAction={rejectMemberCurrentProfilePhotoAction}
            />
          </Suspense>
        ) : null}
        deferredAccountManager={canUpdateMembers || canDeleteMembers ? (
          <Suspense
            fallback={
              <AdminMemberDetailDeferredFallback label="계정 운영 도구를 불러오는 중입니다." />
            }
          >
            <AdminMemberAccountBoundary
              operational={operationalPromise}
              member={accountManagerMember}
              updateAction={updateMember}
              deleteAction={deleteMember}
              emailLoginTransitionAction={issueMemberEmailLoginTransition}
              syncMemberProfileAction={syncMemberProfile}
              canUpdate={canUpdateMembers}
              canDelete={canDeleteMembers}
            />
          </Suspense>
        ) : null}
        deferredOperationalPanels={
          <Suspense
            fallback={
              <AdminMemberDetailDeferredFallback label="알림·약관·보안 정보를 불러오는 중입니다." />
            }
          >
            <AdminMemberOperationalBoundary
              operational={operationalPromise}
              retryHref={retryHref}
              securityLogPage={securityLogPage}
              securityLogPageSize={securityLogPageSize}
              securityLogPageSizeOptions={SECURITY_LOG_PAGE_SIZE_OPTIONS}
            />
          </Suspense>
        }
      />
    </div>
  );
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
  const backHref = sanitizeAdminReturnTo(query.returnTo, "/admin/members");
  const backLabel = backHref.startsWith("/admin/search")
    ? "검색 결과"
    : "회원 관리";

  return (
    <AdminShell title="회원 상세" backHref={backHref} backLabel={backLabel}>
      <Suspense fallback={<AdminMemberDetailSkeletonContent />}>
        <AdminMemberDetailContent
          adminSession={adminSession}
          memberId={memberId}
          query={query}
          backHref={backHref}
        />
      </Suspense>
    </AdminShell>
  );
}
