import AdminStatePanel from "@/components/admin/AdminStatePanel";
import AdminMemberAccountManager from "@/components/admin/member-detail/AdminMemberAccountManager";
import AdminMemberCommunicationPanel from "@/components/admin/member-detail/AdminMemberCommunicationPanel";
import AdminMemberProfilePhotoPanel from "@/components/admin/member-detail/AdminMemberProfilePhotoPanel";
import AdminMemberSecurityLogExplorer from "@/components/admin/member-detail/AdminMemberSecurityLogExplorer";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import type { AdminMemberDetailOperationalReadModel } from "@/lib/admin-member-detail.server";
import type { MemberEmailLoginTransition } from "@/lib/member-email-login-transition";
import type { MemberProfilePhotoReviewStatus } from "@/lib/member-profile-images";

type FormAction = (formData: FormData) => void | Promise<void>;

export type AdminMemberAccountManagerMember = {
  id: string;
  displayName: string;
  campus: string;
  generation: number;
  mmUsername: string;
  manualLoginId: string | null;
  mustChangePassword: boolean;
  email?: string | null;
  emailVerifiedAt?: string | null;
  hasMattermostAccount: boolean;
  mattermostLoginDisabledAt: string | null;
  mattermostLoginDisabledReason: string | null;
  emailLoginTransition?: MemberEmailLoginTransition | null;
};

export function AdminMemberDetailDeferredFallback({
  label,
}: {
  label: string;
}) {
  return (
    <Surface
      level="inset"
      padding="md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm leading-6 text-muted-foreground">{label}</p>
    </Surface>
  );
}

export async function AdminMemberProfilePhotoBoundary({
  operational,
  memberId,
  reviewStatus,
  canUpdate,
  approveAction,
  rejectReplacementAction,
  rejectCurrentAction,
}: {
  operational: Promise<AdminMemberDetailOperationalReadModel>;
  memberId: string;
  reviewStatus: MemberProfilePhotoReviewStatus;
  canUpdate: boolean;
  approveAction: FormAction;
  rejectReplacementAction: FormAction;
  rejectCurrentAction: FormAction;
}) {
  const detail = await operational;

  return (
    <AdminMemberProfilePhotoPanel
      memberId={memberId}
      reviewStatus={reviewStatus}
      pendingImageId={detail.pendingProfilePhotoId}
      canUpdate={canUpdate}
      approveAction={approveAction}
      rejectReplacementAction={rejectReplacementAction}
      rejectCurrentAction={rejectCurrentAction}
    />
  );
}

export async function AdminMemberAccountBoundary({
  operational,
  member,
  updateAction,
  deleteAction,
  emailLoginTransitionAction,
  syncMemberProfileAction,
  canUpdate,
  canDelete,
}: {
  operational: Promise<AdminMemberDetailOperationalReadModel>;
  member: AdminMemberAccountManagerMember;
  updateAction: FormAction;
  deleteAction: FormAction;
  emailLoginTransitionAction: FormAction;
  syncMemberProfileAction: FormAction;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const detail = await operational;
  const accountMember = {
    ...member,
    ...(canUpdate ? { emailLoginTransition: detail.emailLoginTransition } : {}),
  };

  return (
    <AdminMemberAccountManager
      member={accountMember}
      updateAction={updateAction}
      deleteAction={deleteAction}
      emailLoginTransitionAction={emailLoginTransitionAction}
      syncMemberProfileAction={syncMemberProfileAction}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}

export async function AdminMemberOperationalBoundary({
  operational,
  retryHref,
  securityLogPage,
  securityLogPageSize,
  securityLogPageSizeOptions,
}: {
  operational: Promise<AdminMemberDetailOperationalReadModel>;
  retryHref: string;
  securityLogPage: number;
  securityLogPageSize: number;
  securityLogPageSizeOptions: readonly number[];
}) {
  const detail = await operational;

  return (
    <>
      {detail.detailLoadError ? (
        <AdminStatePanel
          kind="error"
          title="일부 회원 운영 정보를 불러오지 못했습니다."
          description="기본 프로필은 표시하고 있습니다. 잠시 후 다시 확인해 주세요."
          action={<Button href={retryHref} variant="secondary">다시 확인</Button>}
        />
      ) : null}
      <AdminMemberCommunicationPanel
        preferences={detail.preferences}
        policyStates={detail.policyOverview.states}
        consentTimeline={detail.policyOverview.timeline}
      />
      <AdminMemberSecurityLogExplorer
        logs={detail.securityLogs}
        pagination={{
          totalCount: detail.securityLogTotalCount,
          page: securityLogPage,
          pageSize: securityLogPageSize,
          pageSizeOptions: securityLogPageSizeOptions,
        }}
      />
    </>
  );
}
