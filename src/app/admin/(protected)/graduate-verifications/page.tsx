import { Suspense } from "react";
import AdminGraduateVerificationQueue from "@/components/admin/AdminGraduateVerificationQueue";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import { AdminGraduateVerificationsSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import {
  getAdminGraduateSetupEmailRetryQueueReadModel,
  getAdminGraduateVerificationRequestQueueReadModel,
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

async function AdminGraduateVerificationsContent({
  session,
  params,
}: {
  session: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: GraduateVerificationSearchParams;
}) {
  const requestPagination = parseAdminReviewQueuePagination({
    page: getOneSearchParam(params.requestPage),
  });
  const setupEmailRetryPagination = parseAdminReviewQueuePagination({
    page: getOneSearchParam(params.setupEmailRetryPage),
  });
  const requestQueuePromise = getAdminGraduateVerificationRequestQueueReadModel(
    {
      requestPage: requestPagination.page,
      requestPageSize: requestPagination.pageSize,
    },
  );
  const setupEmailRetryQueuePromise =
    getAdminGraduateSetupEmailRetryQueueReadModel({
      setupEmailRetryPage: setupEmailRetryPagination.page,
      setupEmailRetryPageSize: setupEmailRetryPagination.pageSize,
    });
  const requestQueue = await requestQueuePromise;
  const { queueLoadError } = requestQueue;
  const resolvedRequestPagination = requestQueue.requestPagination;
  const requestTotalPages = getTotalPages(resolvedRequestPagination);

  if (!queueLoadError && requestPagination.page > requestTotalPages) {
    redirect(
      buildGraduateQueueHref({
        requestPage: Math.min(requestPagination.page, requestTotalPages),
        setupEmailRetryPage: setupEmailRetryPagination.page,
      }),
    );
  }

  const returnTo = buildGraduateQueueHref({
    requestPage: requestPagination.page,
    setupEmailRetryPage: setupEmailRetryPagination.page,
  });

  return (
    <AdminGraduateVerificationQueue
        requests={requestQueue.requests}
        setupEmailRetryQueue={setupEmailRetryQueuePromise}
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
        loadError={queueLoadError}
        canUpdate={canAdmin(
          session.account.permissions,
          "graduate_verifications",
          "update",
        )}
        showPageHeader={false}
    />
  );
}

export default async function AdminGraduateVerificationsPage({
  searchParams,
}: {
  searchParams?: Promise<GraduateVerificationSearchParams>;
}) {
  const session = await requireAdminPermission(
    "graduate_verifications",
    "read",
    {
      path: "/admin/graduate-verifications",
    },
  );
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="수료생 인증">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="작업함"
          title="수료생 인증 검토"
          description="신규 수료생과 기존 회원 복구 요청의 증빙을 확인하고 다음 상태로 안전하게 전환합니다."
        />
        <Suspense fallback={<AdminGraduateVerificationsSkeletonContent showHeader={false} />}>
          <AdminGraduateVerificationsContent session={session} params={params} />
        </Suspense>
      </div>
    </AdminShell>
  );
}
