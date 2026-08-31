import { Suspense } from "react";
import AdminMemberSignupApprovalQueue, {
  getSignupApprovalStatusMessage,
} from "@/components/admin/AdminMemberSignupApprovalQueue";
import AdminShell from "@/components/admin/AdminShell";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminMemberSignupRequestsSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import { requireMemberSignupRequestAdmin } from "@/lib/admin-access";
import { parseAdminReviewQueuePagination } from "@/lib/admin-ia";
import {
  listMattermostSignupApprovalRequestPage,
} from "@/lib/mm-signup-approval/repository";
import type { MattermostSignupApprovalRequestSummary } from "@/lib/mm-signup-approval";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { readFirstSearchParam } from "@/lib/search-params";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type MemberSignupRequestsSearchParams = {
  status?: string | string[];
  error?: string | string[];
  success?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
};

function buildMemberSignupQueueHref(page: number, pageSize: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 12) params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query
    ? "/admin/member-signup-requests?" + query
    : "/admin/member-signup-requests";
}

async function AdminMemberSignupRequestsContent({
  params,
}: {
  params: MemberSignupRequestsSearchParams;
}) {
  const pagination = parseAdminReviewQueuePagination({
    page: readFirstSearchParam(params.page),
    pageSize: readFirstSearchParam(params.pageSize),
  });
  let requestPage: {
    requests: MattermostSignupApprovalRequestSummary[];
    totalCount: number;
    page: number;
    pageSize: number;
  } = {
    requests: [],
    totalCount: 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  let queueLoadError = false;

  try {
    requestPage = await listMattermostSignupApprovalRequestPage({
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch {
    queueLoadError = true;
  }

  const totalPages = Math.max(
    1,
    Math.ceil(requestPage.totalCount / requestPage.pageSize),
  );
  if (
    !queueLoadError &&
    requestPage.totalCount > 0 &&
    pagination.page > totalPages
  ) {
    redirect(buildMemberSignupQueueHref(totalPages, pagination.pageSize));
  }
  const returnTo = buildMemberSignupQueueHref(
    pagination.page,
    pagination.pageSize,
  );

  return (
    <AdminMemberSignupApprovalQueue
        requests={requestPage.requests}
        statusMessage={getSignupApprovalStatusMessage(readFirstSearchParam(params.status))}
        returnTo={returnTo}
        feedback={getAdminReviewQueueFeedback({
          error: readFirstSearchParam(params.error),
          success: readFirstSearchParam(params.success) ?? readFirstSearchParam(params.status),
        })}
        pagination={requestPage}
        loadError={queueLoadError}
    />
  );
}

export default async function AdminMemberSignupRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<MemberSignupRequestsSearchParams>;
}) {
  await requireMemberSignupRequestAdmin("read", {
    path: "/admin/member-signup-requests",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="가입 승인">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="작업함"
          title="가입 승인 요청"
          description="Mattermost 닉네임을 자동으로 해석하지 못한 가입 요청을 확인하고, 부족한 회원 정보를 직접 입력해 승인합니다."
        />
        <Suspense fallback={<AdminMemberSignupRequestsSkeletonContent showHeader={false} />}>
          <AdminMemberSignupRequestsContent params={params} />
        </Suspense>
      </div>
    </AdminShell>
  );
}
