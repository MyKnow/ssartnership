import AdminGraduateVerificationQueue from "@/components/admin/AdminGraduateVerificationQueue";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  getAdminGraduateVerificationQueueReadModel,
  type AdminGraduateQueuePagination,
} from "@/lib/admin-graduate-verification-queue.server";
import { parseAdminReviewQueuePagination } from "@/lib/admin-ia";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { redirect } from "next/navigation";
import {
  approveGraduateVerificationAction,
  rejectGraduateVerificationAction,
  resendGraduateAccountSetupEmailAction,
  requestGraduateVerificationResubmissionAction,
  startGraduateVerificationReviewAction,
} from "./actions";

export const dynamic = "force-dynamic";

type GraduateVerificationSearchParams = {
  error?: string | string[];
  success?: string | string[];
  requestPage?: string | string[];
  setupEmailRetryPage?: string | string[];
};

function getOneSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildGraduateQueueHref({
  requestPage,
  setupEmailRetryPage,
}: {
  requestPage: number;
  setupEmailRetryPage: number;
}) {
  const params = new URLSearchParams();
  if (requestPage > 1) params.set("requestPage", String(requestPage));
  if (setupEmailRetryPage > 1) {
    params.set("setupEmailRetryPage", String(setupEmailRetryPage));
  }
  const query = params.toString();
  return query
    ? "/admin/graduate-verifications?" + query
    : "/admin/graduate-verifications";
}

function getTotalPages(pagination: AdminGraduateQueuePagination) {
  return Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize));
}

export default async function AdminGraduateVerificationsPage({
  searchParams,
}: {
  searchParams?: Promise<GraduateVerificationSearchParams>;
}) {
  await requireAdminPermission("graduate_verifications", "read", {
    path: "/admin/graduate-verifications",
  });
  const params = (await searchParams) ?? {};
  const requestPagination = parseAdminReviewQueuePagination({
    page: getOneSearchParam(params.requestPage),
  });
  const setupEmailRetryPagination = parseAdminReviewQueuePagination({
    page: getOneSearchParam(params.setupEmailRetryPage),
  });
  const queue = await getAdminGraduateVerificationQueueReadModel({
    requestPage: requestPagination.page,
    requestPageSize: requestPagination.pageSize,
    setupEmailRetryPage: setupEmailRetryPagination.page,
    setupEmailRetryPageSize: setupEmailRetryPagination.pageSize,
  });
  const { queueLoadError } = queue;
  const resolvedRequestPagination = queue.requestPagination;
  const resolvedSetupEmailRetryPagination = queue.setupEmailRetryPagination;
  const requestTotalPages = getTotalPages(resolvedRequestPagination);
  const setupEmailRetryTotalPages = getTotalPages(
    resolvedSetupEmailRetryPagination,
  );

  if (
    !queueLoadError &&
    (requestPagination.page > requestTotalPages ||
      setupEmailRetryPagination.page > setupEmailRetryTotalPages)
  ) {
    redirect(
      buildGraduateQueueHref({
        requestPage: Math.min(requestPagination.page, requestTotalPages),
        setupEmailRetryPage: Math.min(
          setupEmailRetryPagination.page,
          setupEmailRetryTotalPages,
        ),
      }),
    );
  }

  const returnTo = buildGraduateQueueHref({
    requestPage: requestPagination.page,
    setupEmailRetryPage: setupEmailRetryPagination.page,
  });

  return (
    <AdminShell title="수료생 인증">
      <AdminGraduateVerificationQueue
        requests={queue.requests}
        setupEmailRetries={queue.setupEmailRetries}
        actions={{
          startReview: startGraduateVerificationReviewAction,
          requestResubmission: requestGraduateVerificationResubmissionAction,
          approveRequest: approveGraduateVerificationAction,
          rejectRequest: rejectGraduateVerificationAction,
          resendSetupEmail: resendGraduateAccountSetupEmailAction,
        }}
        feedback={getAdminReviewQueueFeedback({
          error: getOneSearchParam(params.error),
          success: getOneSearchParam(params.success),
        })}
        returnTo={returnTo}
        requestPagination={resolvedRequestPagination}
        setupEmailRetryPagination={resolvedSetupEmailRetryPagination}
        loadError={queueLoadError}
      />
    </AdminShell>
  );
}
