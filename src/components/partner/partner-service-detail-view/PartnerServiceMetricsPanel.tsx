import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";
import PartnerPendingButtonLink from "@/components/partner/PartnerPendingButtonLink";
import SectionTitle from "@/components/partner/partner-service-detail-view/SectionTitle";
import { getPartnerPortalMetricAccessItems } from "@/lib/partner-portal-metric-access";
import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";
import {
  canAccessPartnerMetric,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import type { PartnerReviewSummary } from "@/lib/partner-reviews";

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

export default function PartnerServiceMetricsPanel({
  metrics,
  planTier,
  reviewSummary,
  warningMessage,
  planHref,
}: {
  metrics: PartnerPortalServiceMetrics;
  planTier: PartnerCompanyPlanTier;
  reviewSummary: PartnerReviewSummary;
  warningMessage?: string | null;
  planHref?: string | null;
}) {
  const averageRating =
    reviewSummary.totalCount > 0 ? `${reviewSummary.averageRating.toFixed(1)} / 5` : "-";
  const planMetricItems = [
    {
      key: "favoriteCount",
      label: "즐겨찾기",
      value: formatCount(metrics.favoriteCount),
      hint: "제휴처 즐겨찾기 수",
    },
    {
      key: "detailViews",
      label: "PV",
      value: formatCount(metrics.detailViews),
      hint: "제휴처 상세 페이지 총 조회 수",
    },
    {
      key: "detailUv",
      label: "UV",
      value: formatCount(metrics.detailUv),
      hint: "제휴처 상세 페이지 고유 방문자 수",
    },
    {
      key: "totalClicks",
      label: "CTA",
      value: formatCount(metrics.totalClicks),
      hint: "카드 · 지도 · 예약 · 문의 클릭 수 총합",
    },
    {
      key: "reservationClicks",
      label: "예약 클릭 수",
      value: formatCount(metrics.reservationClicks),
      hint: "혜택 이용 클릭 수",
    },
    {
      key: "inquiryClicks",
      label: "문의 클릭 수",
      value: formatCount(metrics.inquiryClicks),
      hint: "문의 링크 클릭 수",
    },
  ] as const;
  const lockedMetricItems = getPartnerPortalMetricAccessItems(planTier)
    .filter((item) => item.locked)
    .slice(0, 4);

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <SectionTitle label="Brand Insights" />
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
            제휴처 집계
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            공개 리뷰와 포털 상호작용 기준으로 현재 제휴처 성과를 요약합니다.
          </p>
        </div>
      </div>

      {warningMessage ? <FormMessage variant="info">{warningMessage}</FormMessage> : null}

      <StatsRow
        minItemWidth="11rem"
        items={[
          {
            label: "평균 별점",
            value: averageRating,
            hint: "비공개 · 삭제 리뷰 제외",
          },
          {
            label: "공개 리뷰",
            value: formatCount(reviewSummary.totalCount),
            hint: "공개 상태 리뷰 수",
          },
          ...planMetricItems.filter((item) =>
            canAccessPartnerMetric(planTier, item.key),
          ),
        ]}
      />

      {lockedMetricItems.length > 0 ? (
        <div className="rounded-[1rem] border border-border/70 bg-surface-inset p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">플랜 제한</Badge>
                <span className="text-sm font-semibold text-foreground">
                  상위 플랜에서 상세 지표를 확인할 수 있습니다.
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lockedMetricItems.map((item) => (
                  <Badge key={item.key} variant="neutral">
                    {item.label}
                  </Badge>
                ))}
              </div>
            </div>
            {planHref ? (
              <PartnerPendingButtonLink href={planHref} variant="secondary" size="sm">
                플랜 보기
              </PartnerPendingButtonLink>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
