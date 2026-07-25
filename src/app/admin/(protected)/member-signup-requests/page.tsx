import AdminMemberSignupApprovalQueue, {
  getSignupApprovalStatusMessage,
} from "@/components/admin/AdminMemberSignupApprovalQueue";
import AdminShell from "@/components/admin/AdminShell";
import { requireMemberSignupRequestAdmin } from "@/lib/admin-access";
import { parseAdminReviewQueuePagination } from "@/lib/admin-ia";
import {
  listMattermostSignupApprovalRequestPage,
} from "@/lib/mm-signup-approval/repository";
import type { MattermostSignupApprovalRequestSummary } from "@/lib/mm-signup-approval";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type MemberSignupRequestsSearchParams = {
  status?: string | string[];
  error?: string | string[];
  success?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
};

function getOneSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildMemberSignupQueueHref(page: number, pageSize: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 12) params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query
    ? "/admin/member-signup-requests?" + query
    : "/admin/member-signup-requests";
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
  const pagination = parseAdminReviewQueuePagination({
    page: getOneSearchParam(params.page),
    pageSize: getOneSearchParam(params.pageSize),
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
    <AdminShell title="가입 승인">
      <AdminMemberSignupApprovalQueue
        requests={requestPage.requests}
        statusMessage={getSignupApprovalStatusMessage(getOneSearchParam(params.status))}
        returnTo={returnTo}
        feedback={getAdminReviewQueueFeedback({
          error: getOneSearchParam(params.error),
          success: getOneSearchParam(params.success) ?? getOneSearchParam(params.status),
        })}
        pagination={requestPage}
        loadError={queueLoadError}
      />
    </AdminShell>
  );
}
