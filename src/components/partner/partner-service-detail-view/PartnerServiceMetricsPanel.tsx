import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";
import SectionTitle from "@/components/partner/partner-service-detail-view/SectionTitle";
import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";
import type { PartnerReviewSummary } from "@/lib/partner-reviews";

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

export default function PartnerServiceMetricsPanel({
  metrics,
  reviewSummary,
  warningMessage,
}: {
  metrics: PartnerPortalServiceMetrics;
  reviewSummary: PartnerReviewSummary;
  warningMessage?: string | null;
}) {
  const averageRating =
    reviewSummary.totalCount > 0 ? `${reviewSummary.averageRating.toFixed(1)} / 5` : "-";

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <SectionTitle label="Brand Insights" />
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
            브랜드 집계
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            공개 리뷰와 포털 상호작용 기준으로 현재 브랜드 성과를 요약합니다.
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
          {
            label: "즐겨찾기",
            value: formatCount(metrics.favoriteCount),
            hint: "브랜드 즐겨찾기 수",
          },
          {
            label: "PV",
            value: formatCount(metrics.detailViews),
            hint: "브랜드 상세 페이지 총 조회 수",
          },
          {
            label: "UV",
            value: formatCount(metrics.detailUv),
            hint: "브랜드 상세 페이지 고유 방문자 수",
          },
          {
            label: "CTA",
            value: formatCount(metrics.totalClicks),
            hint: "카드 · 지도 · 예약 · 문의 클릭 수 총합",
          },
          {
            label: "예약 클릭 수",
            value: formatCount(metrics.reservationClicks),
            hint: "예약 링크 클릭 수",
          },
          {
            label: "문의 클릭 수",
            value: formatCount(metrics.inquiryClicks),
            hint: "문의 링크 클릭 수",
          },
        ]}
      />
    </Card>
  );
}
