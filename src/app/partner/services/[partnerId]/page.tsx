import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PartnerServiceDetailView from "@/components/partner/PartnerServiceDetailView";
import {
  getPartnerChangeRequestContext,
  getPartnerChangeRequestErrorMessage,
} from "@/lib/partner-change-requests";
import type { PartnerChangeRequestErrorCode } from "@/lib/partner-change-request-errors";
import { getPartnerSession } from "@/lib/partner-session";
import { getPartnerMetricTimeseriesSnapshot } from "@/lib/partner-metric-timeseries";
import { getPartnerServiceMetrics } from "@/lib/partner-service-metrics";
import { partnerReviewRepository } from "@/lib/repositories";
import { SITE_NAME } from "@/lib/site";
import {
  cancelPartnerChangeRequestAction,
  savePartnerImmediateChanges,
  submitPartnerChangeRequest,
} from "./request/actions";

type PartnerServiceDetailPageSearchParams = {
  mode?: string | string[];
  error?: string | string[];
  success?: string | string[];
};

function readSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function isPartnerChangeRequestErrorCode(
  value: string,
): value is PartnerChangeRequestErrorCode {
  return (
    value === "not_found" ||
    value === "forbidden" ||
    value === "pending_exists" ||
    value === "already_resolved" ||
    value === "no_changes" ||
    value === "invalid_request"
  );
}

export const metadata: Metadata = {
  title: `브랜드 상세 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams?: Promise<PartnerServiceDetailPageSearchParams>;
}) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const { partnerId } = await params;
  const context = await getPartnerChangeRequestContext(
    session.companyIds,
    partnerId,
  );
  if (!context) {
    notFound();
  }

  const [reviewData, publicReviewSummary, serviceMetricsSnapshot, metricTimeseries] =
    await Promise.all([
      partnerReviewRepository.listPartnerReviews({
        partnerId,
        sort: "latest",
        offset: 0,
        limit: 10,
        includeHidden: true,
      }),
      partnerReviewRepository.getPartnerReviewSummary(partnerId),
      getPartnerServiceMetrics(partnerId),
      getPartnerMetricTimeseriesSnapshot(partnerId, context.partnerCreatedAt),
    ]);

  const paramsData = (await searchParams) ?? {};
  const mode = readSearchParam(paramsData.mode) === "edit" ? "edit" : "view";
  const errorCode = readSearchParam(paramsData.error);
  const successCode = readSearchParam(paramsData.success);
  const errorMessage = isPartnerChangeRequestErrorCode(errorCode)
    ? getPartnerChangeRequestErrorMessage(errorCode)
    : null;
  const successMessage =
    successCode === "saved"
      ? "메인 썸네일, 추가 이미지, 혜택 이용/문의 링크, 태그가 즉시 반영되었습니다."
      : successCode === "submitted"
      ? "변경 요청이 접수되었습니다. 관리자 승인 후 반영됩니다."
      : successCode === "cancelled"
        ? "변경 요청이 취소되었습니다."
        : null;

  return (
    <PartnerServiceDetailView
      session={session}
      context={context}
      mode={mode}
      errorMessage={errorMessage}
      successMessage={successMessage}
      saveImmediateAction={savePartnerImmediateChanges}
      createAction={submitPartnerChangeRequest}
      cancelAction={cancelPartnerChangeRequestAction}
      reviewSummary={publicReviewSummary}
      serviceMetrics={serviceMetricsSnapshot.metrics}
      metricTimeseries={metricTimeseries}
      serviceMetricsWarningMessage={serviceMetricsSnapshot.warningMessage}
      initialReviews={reviewData.items}
      initialReviewSort="latest"
      initialReviewOffset={reviewData.nextOffset}
      initialReviewHasMore={reviewData.hasMore}
    />
  );
}
