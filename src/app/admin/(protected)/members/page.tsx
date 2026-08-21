import AdminShell from "@/components/admin/AdminShell";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AdminMemberManualAddPanel from "@/components/admin/AdminMemberManualAddPanel";
import AdminMemberManager from "@/components/admin/AdminMemberManager";
import AdminMemberOperationsPanel from "@/components/admin/AdminMemberOperationsPanel";
import AdminMemberSummarySection from "@/components/admin/AdminMemberSummarySection";
import AdminMemberTrendSection from "@/components/admin/AdminMemberTrendSection";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import InlineMessage from "@/components/ui/InlineMessage";
import Skeleton from "@/components/ui/Skeleton";
import Surface from "@/components/ui/Surface";
import { AdminMembersSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import {
  backfillMemberProfiles,
  disableGenerationMattermostLogin,
} from "@/app/admin/(protected)/actions";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  getAdminMemberListReadModel,
  getAdminMemberSearchParam,
  parseAdminMemberListFilters,
  parseAdminMemberPage,
  type AdminMemberSearchParams,
} from "@/lib/admin-member-list.server";
import { canAdmin } from "@/lib/admin-permissions";
import { parseAdminMemberPageSize } from "@/lib/admin-ia";
import {
  DEFAULT_MEMBER_SYNC_BATCH_SIZE,
  MAX_MEMBER_SYNC_BATCH_SIZE,
  parseMemberSyncBatchOptions,
} from "@/lib/mm-member-sync";
import {
  getConfiguredCurrentSsafyYear,
  getSsafyCycleSettings,
  normalizeSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";

export const dynamic = "force-dynamic";

const adminMembersErrorMessages: Record<string, string> = {
  ...adminActionErrorMessages,
};

function AdminMemberTrendFallback() {
  return (
    <Surface
      level="elevated"
      padding="lg"
      aria-busy="true"
      aria-label="회원 유입 추이를 불러오는 중"
      className="grid gap-3"
    >
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-48 w-full" />
    </Surface>
  );
}

function AdminMemberSummaryFallback() {
  return (
    <Surface
      level="elevated"
      padding="lg"
      aria-busy="true"
      aria-label="회원 운영 요약을 불러오는 중"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    </Surface>
  );
}

function AdminMemberManualAddFallback() {
  return (
    <section className="grid min-w-0 gap-4">
      <AdminSectionHeading
        title="수동 추가"
        description="행을 직접 추가하거나 XLSX로 입력 행을 만든 뒤, 사진 ZIP 검증과 계정 초대를 진행합니다."
      />
      <Card tone="elevated" aria-busy="true" aria-label="수동 추가 기능을 불러오는 중">
        <div className="grid gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-11 w-full max-w-sm" />
        </div>
      </Card>
    </section>
  );
}

async function AdminMemberManualAddSection({
  canReissueManualSetup,
}: {
  canReissueManualSetup: boolean;
}) {
  const cycleSettings = await getSsafyCycleSettings().catch(() =>
    normalizeSsafyCycleSettings(),
  );

  return (
    <section className="grid min-w-0 gap-4">
      <AdminSectionHeading
        title="수동 추가"
        description="행을 직접 추가하거나 XLSX로 입력 행을 만든 뒤, 사진 ZIP 검증과 계정 초대를 진행합니다."
      />
      <Card tone="elevated">
        <AdminMemberManualAddPanel
          currentGeneration={getConfiguredCurrentSsafyYear(cycleSettings)}
          canReissueManualSetup={canReissueManualSetup}
        />
      </Card>
    </section>
  );
}

async function AdminMembersContent({
  adminSession,
  params,
}: {
  adminSession: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: AdminMemberSearchParams;
}) {
  const memberError = params.error ? adminMembersErrorMessages[params.error] : null;
  const hasMoreBackfill =
    getAdminMemberSearchParam(params, "hasMore") === "1"
    && Boolean(getAdminMemberSearchParam(params, "nextCursor"));
  const backfillCursor = hasMoreBackfill
    ? getAdminMemberSearchParam(params, "nextCursor") ?? ""
    : "";
  const backfillBatchSize = parseMemberSyncBatchOptions({
    batchSize: getAdminMemberSearchParam(params, "batchSize"),
  })?.limit ?? DEFAULT_MEMBER_SYNC_BATCH_SIZE;
  const page = parseAdminMemberPage(getAdminMemberSearchParam(params, "page"));
  const pageSize = parseAdminMemberPageSize(
    getAdminMemberSearchParam(params, "pageSize"),
  );
  const filters = parseAdminMemberListFilters(params);
  const selectedGeneration =
    filters.yearFilter === "all" ? null : Number(filters.yearFilter);
  const canUpdateMembers = canAdmin(
    adminSession.account.permissions,
    "members",
    "update",
  );
  const {
    members,
    totalCount,
    shouldRedirectToLastPage,
    totalPages,
    memberTrend,
    memberSummary,
    options,
    mustChangePasswordCount,
    generationMattermostLoginTargetCount,
    hasMemberLoadError,
    hasMemberMetadataError,
  } = await getAdminMemberListReadModel({
    filters,
    page,
    pageSize,
  });
  if (shouldRedirectToLastPage) {
    const canonicalSearchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        canonicalSearchParams.set(key, value);
      }
    }
    canonicalSearchParams.set("page", String(totalPages));
    redirect(`/admin/members?${canonicalSearchParams.toString()}`);
  }

  return (
    <div className="grid gap-6">
        {hasMemberLoadError ? (
          <InlineMessage
            tone="danger"
            title="회원 목록을 불러오지 못했습니다."
            description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요."
            actionHref="/admin/members"
            actionLabel="다시 확인"
          />
        ) : null}
        {!hasMemberLoadError && hasMemberMetadataError ? (
          <InlineMessage
            tone="warning"
            title="회원 목록은 표시했지만 일부 운영 정보가 늦게 반영될 수 있습니다."
            description="약관·필터 선택지 또는 요약 정보를 불러오지 못했습니다. 목록은 확인할 수 있으며 잠시 후 다시 확인해 주세요."
            actionHref="/admin/members"
            actionLabel="다시 확인"
          />
        ) : null}
        {memberError ? (
          <FormMessage variant="error">{memberError}</FormMessage>
        ) : null}
        {params.backfill ? (
          <InlineMessage
            tone={
              params.backfill === "partial"
                ? "warning"
                : params.backfill === "error"
                  ? "danger"
                  : "success"
            }
            title={
              params.backfill === "partial"
                ? "백필이 일부만 완료되었습니다."
                : params.backfill === "error"
                  ? "백필 중 오류가 발생했습니다."
                  : "백필이 완료되었습니다."
            }
            description={`${params.checked ? `대상 ${params.checked}명 · ` : ""}${params.updated ? `변경 ${params.updated}명 · ` : ""}${params.photoSkipped ? `사진 미처리 ${params.photoSkipped}명 · ` : ""}${params.skipped ? `변경 없음 ${params.skipped}명 · ` : ""}${params.mattermostUnavailable ? `MM 이용 중단 ${params.mattermostUnavailable}명 · ` : ""}${params.failures ? `실패 ${params.failures}명` : ""}${hasMoreBackfill ? " 다음 배치를 실행하면 이어서 처리합니다." : ""}`}
          />
        ) : null}
        {params.batchError === "invalid" ? (
          <InlineMessage
            tone="danger"
            title="백필 배치 입력을 확인해 주세요."
            description="배치 크기는 1~100명이어야 하며, 이어하기 cursor는 유효한 회원 ID여야 합니다."
          />
        ) : null}
        {params.mmLoginTransition === "generation" ? (
          <InlineMessage
            tone="success"
            title="기수 전체의 MM 로그인을 중단했습니다."
            description={`${params.generation ?? "선택한"}기 ${params.disabled ?? "0"}명의 기존 MM 연결 이력은 유지됩니다. 이메일이 이미 인증된 회원은 이메일로 로그인할 수 있고, 나머지는 회원 상세에서 설정 링크를 발송해 주세요.`}
          />
        ) : null}

        <section className="grid min-w-0 gap-4" aria-label="회원 운영 요약">
          <AdminSectionHeading
            title="운영 요약"
            description="현재 권한 범위와 회원 상태를 먼저 요약해서 확인합니다."
          />
          <Suspense fallback={<AdminMemberSummaryFallback />}>
            <AdminMemberSummarySection
              summary={memberSummary}
              totalCount={totalCount}
              currentPageCount={members.length}
              page={page}
              totalPages={totalPages}
              mustChangePasswordCount={mustChangePasswordCount}
            />
          </Suspense>
          <Suspense fallback={<AdminMemberTrendFallback />}>
            <AdminMemberTrendSection trend={memberTrend} />
          </Suspense>
        </section>

        {canUpdateMembers ? (
          <AdminMemberOperationsPanel
            backfillAction={backfillMemberProfiles}
            disableGenerationAction={disableGenerationMattermostLogin}
            hasMoreBackfill={hasMoreBackfill}
            backfillCursor={backfillCursor}
            backfillBatchSize={backfillBatchSize}
            defaultBatchSize={DEFAULT_MEMBER_SYNC_BATCH_SIZE}
            maxBatchSize={MAX_MEMBER_SYNC_BATCH_SIZE}
            selectedGeneration={selectedGeneration}
            generationMattermostLoginTargetCount={generationMattermostLoginTargetCount}
          />
        ) : null}

        <Suspense fallback={<AdminMemberManualAddFallback />}>
          <AdminMemberManualAddSection canReissueManualSetup={canUpdateMembers} />
        </Suspense>

        <Card tone="elevated">
          <AdminSectionHeading
            title="운영 메모"
            description="활성 Sender와 사진 검토 상태를 확인합니다."
          />
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
            <p>MM·이메일 알림 전송 결과가 불명확하면 자동 대체 발송하지 않습니다. 수신 여부 확인 뒤에만 새 링크를 발급합니다.</p>
            <p>인증 카드 색상과 목업은 기수 관리 화면에서 확인합니다.</p>
          </div>
        </Card>

        <section className="grid min-w-0 gap-4">
          <AdminSectionHeading
            title="회원 목록"
            description="검색, 필터, 페이지네이션을 유지한 채 현재 결과를 조정합니다."
          />
          <div>
            <AdminMemberManager
              key={[
                page,
                pageSize,
                filters.searchValue,
                filters.sortValue,
                filters.filterValue,
                filters.mattermostLifecycleFilter,
                filters.yearFilter,
                filters.campusFilter,
                filters.serviceConsentFilter,
                filters.privacyConsentFilter,
                filters.marketingConsentFilter,
                filters.pushEnabledFilter,
                filters.announcementEnabledFilter,
                filters.newPartnerEnabledFilter,
                filters.expiringPartnerEnabledFilter,
                filters.reviewEnabledFilter,
                filters.mmEnabledFilter,
                filters.marketingEnabledFilter,
              ].join(":")}
              members={members}
              pagination={{
                totalCount,
                page,
                pageSize,
              }}
              filters={filters}
              options={options}
            />
          </div>
        </section>
    </div>
  );
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams?: Promise<AdminMemberSearchParams>;
}) {
  const adminSession = await requireAdminPermission("members", "read", {
    path: "/admin/members",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="회원 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="회원"
          title="회원 계정 관리"
          description="운영 요약과 도구를 먼저 확인한 뒤, 필요한 회원을 목록에서 검색하고 조정합니다."
        />
        <Suspense fallback={<AdminMembersSkeletonContent showHeader={false} />}>
          <AdminMembersContent adminSession={adminSession} params={params} />
        </Suspense>
      </div>
    </AdminShell>
  );
}
