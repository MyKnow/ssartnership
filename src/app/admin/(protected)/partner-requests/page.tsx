import { redirect } from "next/navigation";
import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";
import AdminReviewQueueHeader from "@/components/admin/AdminReviewQueueHeader";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import PartnerChangeRequestQueue from "@/components/admin/PartnerChangeRequestQueue";
import Button from "@/components/ui/Button";
import {
  approvePartnerChangeRequest,
  rejectPartnerChangeRequest,
} from "@/app/admin/(protected)/actions";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { parseAdminReviewQueuePagination } from "@/lib/admin-ia";
import { getAdminPartnerChangeRequestQueueReadModel } from "@/lib/admin-partner-change-request-queue.server";
import { AdminPartnerRequestsSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import { readFirstSearchParam } from "@/lib/search-params";

export const dynamic = "force-dynamic";

type PartnerRequestsSearchParams = {
  error?: string | string[];
  success?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
};

function buildPartnerRequestQueueHref(page: number, pageSize: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 12) params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query ? `/admin/partner-requests?${query}` : "/admin/partner-requests";
}

async function AdminPartnerRequestsContent({
  adminSession,
  params,
}: {
  adminSession: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: PartnerRequestsSearchParams;
}) {
  const pagination = parseAdminReviewQueuePagination({
    page: readFirstSearchParam(params.page),
    pageSize: readFirstSearchParam(params.pageSize),
  });
  const { requestPage, queueLoadError } =
    await getAdminPartnerChangeRequestQueueReadModel({
      managedCampusSlugs: getManagedCampusFilterValues(adminSession.account),
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  const totalPages = Math.max(1, Math.ceil(requestPage.totalCount / requestPage.pageSize));
  if (!queueLoadError && requestPage.totalCount > 0 && pagination.page > totalPages) {
    redirect(buildPartnerRequestQueueHref(totalPages, pagination.pageSize));
  }
  const scopedRequests = requestPage.requests;

  const partnerCount = new Set(
    scopedRequests.map((request) => request.partnerId),
  ).size;
  const oldestCreatedAt = scopedRequests.reduce<string | null>(
    (oldest, request) =>
      !oldest || new Date(request.createdAt).getTime() < new Date(oldest).getTime()
        ? request.createdAt
        : oldest,
    null,
  );
  const feedback = getAdminReviewQueueFeedback({
    error: readFirstSearchParam(params.error),
    success: readFirstSearchParam(params.success),
  });
  const returnTo = buildPartnerRequestQueueHref(pagination.page, pagination.pageSize);

  return (
    <div className="grid min-w-0 gap-6">
        <AdminReviewQueueHeader
          eyebrow="작업함"
          title="제휴처 변경 요청"
          description="파트너사 담당자가 요청한 변경 항목을 현재 값과 비교해 승인하거나 거절합니다."
          actions={
            <Button href="/admin/partners" variant="secondary">
              제휴처 목록
            </Button>
          }
          metrics={[
            { label: "승인 대기", value: `${requestPage.totalCount.toLocaleString("ko-KR")}건`, hint: "현재 처리할 요청" },
            { label: "현재 표시", value: `${scopedRequests.length.toLocaleString("ko-KR")}건`, hint: `${Math.min(pagination.page, totalPages)} / ${totalPages} 페이지` },
            { label: "제휴처", value: `${partnerCount.toLocaleString("ko-KR")}개`, hint: "현재 페이지 기준" },
            { label: "가장 오래된 요청", value: oldestCreatedAt ? formatKoreanDateTimeToMinute(oldestCreatedAt) : "-", hint: "오래된 요청부터 검토" },
          ]}
          feedback={feedback}
          nextAction={{
            title: "변경된 항목만 비교한 뒤 승인 또는 거절하세요.",
            description: "오래된 요청부터 처리하면 파트너사 화면에 반영되지 않은 변경 사항이 쌓이는 일을 줄일 수 있습니다.",
          }}
          showPageHeader={false}
        />
        <PartnerChangeRequestQueue
          requests={scopedRequests}
          approveAction={approvePartnerChangeRequest}
          rejectAction={rejectPartnerChangeRequest}
          canReview={canAdmin(adminSession.account.permissions, "brands", "update")}
          returnTo={returnTo}
          pagination={{
            totalCount: requestPage.totalCount,
            page: pagination.page,
            pageSize: pagination.pageSize,
          }}
          loadError={queueLoadError}
        />
    </div>
  );
}

export default async function AdminPartnerRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<PartnerRequestsSearchParams>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/partner-requests",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="변경 요청" backHref="/admin/partners" backLabel="제휴처">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="작업함"
          title="제휴처 변경 요청"
          description="파트너사 담당자가 요청한 변경 항목을 현재 값과 비교해 승인하거나 거절합니다."
          actions={
            <Button href="/admin/partners" variant="secondary">
              제휴처 목록
            </Button>
          }
        />
        <Suspense fallback={<AdminPartnerRequestsSkeletonContent showHeader={false} />}>
          <AdminPartnerRequestsContent adminSession={adminSession} params={params} />
        </Suspense>
      </div>
    </AdminShell>
  );
}
