import AdminMemberAccountManager from "@/components/admin/member-detail/AdminMemberAccountManager";
import AdminMemberCommunicationPanel from "@/components/admin/member-detail/AdminMemberCommunicationPanel";
import AdminMemberSecurityLogExplorer, {
  type AdminMemberSecurityLog,
} from "@/components/admin/member-detail/AdminMemberSecurityLogExplorer";
import AdminMemberProfilePhotoPanel from "@/components/admin/member-detail/AdminMemberProfilePhotoPanel";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import StatsRow from "@/components/ui/StatsRow";
import type {
  AdminMemberNotificationPreferences,
  AdminMemberPolicyEvent,
  AdminMemberPolicyState,
} from "@/lib/admin-member-detail";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import type { MemberProfilePhotoReviewStatus } from "@/lib/member-profile-images";

type FormAction = (formData: FormData) => void | Promise<void>;

export type AdminMemberDetailViewProps = {
  member: {
    id: string;
    displayName: string;
    mmUsername: string;
    mmUserId: string | null;
    manualLoginId: string | null;
    generation: number;
    generationLabel: string;
    campus: string;
    mustChangePassword: boolean;
    createdAt: string | null;
    updatedAt: string | null;
    hasAvatar: boolean;
    avatarUrl: string;
  };
  activeDeviceCount: number;
  securityLogs: AdminMemberSecurityLog[];
  securityLogPagination: {
    totalCount: number;
    page: number;
    pageSize: number;
    pageSizeOptions: readonly number[];
  };
  preferences: AdminMemberNotificationPreferences;
  policyStates: readonly AdminMemberPolicyState[];
  consentTimeline: readonly AdminMemberPolicyEvent[];
  updateAction: FormAction;
  deleteAction: FormAction;
  canUpdate: boolean;
  canDelete: boolean;
  profilePhoto?: {
    reviewStatus: MemberProfilePhotoReviewStatus;
    pendingImageId: string | null;
    canUpdate: boolean;
    approveAction: FormAction;
    rejectReplacementAction: FormAction;
    rejectCurrentAction: FormAction;
  } | null;
};

function formatDate(value: string | null) {
  return value ? formatKoreanDateTimeToMinute(value) : "-";
}

export default function AdminMemberDetailView({
  member,
  activeDeviceCount,
  securityLogs,
  securityLogPagination,
  preferences,
  policyStates,
  consentTimeline,
  updateAction,
  deleteAction,
  canUpdate,
  canDelete,
  profilePhoto = null,
}: AdminMemberDetailViewProps) {
  const loginIdentifier = member.manualLoginId ?? member.mmUsername;
  const avatarLabel = (member.displayName || loginIdentifier || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="grid gap-6">
      <AdminPageHeader
        eyebrow="Member"
        title={member.displayName}
        description="회원 프로필, 약관 상태, 활성 기기, 인증/보안 활동을 한 화면에서 확인합니다."
      />

      <StatsRow
        items={[
          {
            label: "로그인 ID",
            value: member.manualLoginId ?? (member.mmUsername ? `@${member.mmUsername}` : "-"),
            hint: member.manualLoginId ? "관리자 직접 생성 계정" : member.mmUserId ?? "외부 식별자 없음",
          },
          {
            label: "기수/캠퍼스",
            value: `${member.generationLabel} · ${member.campus}`,
            hint: "가입 프로필 기준",
          },
          {
            label: "비밀번호 상태",
            value: member.mustChangePassword ? "변경 필요" : "정상",
            hint: `활성 기기 ${activeDeviceCount}개`,
          },
          {
            label: "최근 갱신",
            value: formatDate(member.updatedAt),
            hint: `가입 ${formatDate(member.createdAt)}`,
          },
        ]}
        minItemWidth="13rem"
      />

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <div className="grid gap-6 xl:sticky xl:top-24">
          <Card tone="elevated" className="grid gap-5">
            <div className="overflow-hidden rounded-[1.5rem] border border-border bg-surface-inset">
              <div className="aspect-square w-full">
                {member.hasAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.avatarUrl}
                    alt={`${member.displayName} 프로필 사진`}
                    loading="eager"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-surface-muted text-6xl font-semibold text-foreground">
                    {avatarLabel || "?"}
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={member.mustChangePassword ? "warning" : "success"}>
                  {member.mustChangePassword
                    ? "비밀번호 변경 필요"
                    : "비밀번호 정상"}
                </Badge>
                <Badge variant="neutral">{member.generationLabel}</Badge>
              </div>
              <h2 className="break-words text-2xl font-semibold tracking-[-0.03em] text-foreground">
                {member.displayName}
              </h2>
              <p className="break-all text-sm text-muted-foreground">
                {member.manualLoginId
                  ? `직접 ID · ${member.manualLoginId}`
                  : `@${member.mmUsername || "mm_username 없음"}`}
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-border bg-surface-inset px-4 py-4 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>캠퍼스</span>
                <span className="font-medium text-foreground">{member.campus}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>{member.manualLoginId ? "직접 로그인 ID" : "MM User ID"}</span>
                <span className="max-w-[13rem] break-all text-right font-medium text-foreground">
                  {member.manualLoginId ?? member.mmUserId ?? "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>활성 푸시 기기</span>
                <span className="font-medium text-foreground">{activeDeviceCount}개</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>보안 로그</span>
                <span className="font-medium text-foreground">
                  {securityLogPagination.totalCount.toLocaleString("ko-KR")}건
                </span>
              </div>
            </div>
          </Card>
          {profilePhoto ? (
            <AdminMemberProfilePhotoPanel
              memberId={member.id}
              reviewStatus={profilePhoto.reviewStatus}
              pendingImageId={profilePhoto.pendingImageId}
              canUpdate={profilePhoto.canUpdate}
              approveAction={profilePhoto.approveAction}
              rejectReplacementAction={profilePhoto.rejectReplacementAction}
              rejectCurrentAction={profilePhoto.rejectCurrentAction}
            />
          ) : null}

          <Card tone="default" className="grid gap-4">
            <AdminSectionHeading
              title="계정 요약"
              description="회원 식별자와 계정 생성·갱신 시각을 확인합니다."
            />
            <div className="grid gap-3 text-sm text-muted-foreground">
              <div className="grid gap-1 rounded-2xl border border-border bg-surface-inset px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">회원 ID</span>
                <span className="break-all font-medium text-foreground">{member.id}</span>
              </div>
              <div className="grid gap-1 rounded-2xl border border-border bg-surface-inset px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">가입 시각</span>
                <span className="font-medium text-foreground">{formatDate(member.createdAt)}</span>
              </div>
              <div className="grid gap-1 rounded-2xl border border-border bg-surface-inset px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">최근 갱신</span>
                <span className="font-medium text-foreground">{formatDate(member.updatedAt)}</span>
              </div>
            </div>
          </Card>

          <AdminMemberAccountManager
            member={{
              id: member.id,
              displayName: member.displayName,
              campus: member.campus,
              generation: member.generation,
              mmUsername: member.mmUsername,
              manualLoginId: member.manualLoginId,
              mustChangePassword: member.mustChangePassword,
            }}
            updateAction={updateAction}
            deleteAction={deleteAction}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </div>

        <div className="grid min-w-0 gap-6">
          <AdminMemberCommunicationPanel
            preferences={preferences}
            policyStates={policyStates}
            consentTimeline={consentTimeline}
          />
          <AdminMemberSecurityLogExplorer
            logs={securityLogs}
            pagination={securityLogPagination}
          />
        </div>
      </div>
    </div>
  );
}
