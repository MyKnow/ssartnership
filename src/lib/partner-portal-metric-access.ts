import {
  canAccessPartnerMetric,
  type PartnerCompanyPlanTier,
  type PartnerMetricKey,
} from "@/lib/partner-company-plans";

export type PartnerPortalMetricAccessItem = {
  key: PartnerMetricKey;
  label: string;
  description: string;
  locked: boolean;
};

const METRIC_ACCESS_ITEMS = [
  {
    key: "favoriteCount",
    label: "즐겨찾기",
    description: "제휴처를 저장한 사용자 수",
  },
  {
    key: "reviewCount",
    label: "리뷰",
    description: "공개 상태 리뷰 수",
  },
  {
    key: "detailViews",
    label: "PV",
    description: "제휴처 상세 페이지 총 조회 수",
  },
  {
    key: "detailUv",
    label: "UV",
    description: "제휴처 상세 페이지 고유 방문자 수",
  },
  {
    key: "cardClicks",
    label: "카드 클릭",
    description: "목록과 카드에서 발생한 클릭 수",
  },
  {
    key: "mapClicks",
    label: "지도 클릭",
    description: "지도 링크 클릭 수",
  },
  {
    key: "reservationClicks",
    label: "혜택 이용 클릭",
    description: "예약 또는 혜택 이용 CTA 클릭 수",
  },
  {
    key: "inquiryClicks",
    label: "문의 클릭",
    description: "문의 링크 클릭 수",
  },
  {
    key: "timeseries",
    label: "시계열 추이",
    description: "일자별 성과 변화",
  },
  {
    key: "adPerformance",
    label: "광고 성과",
    description: "배너와 푸시 광고 성과",
  },
] as const satisfies readonly Omit<PartnerPortalMetricAccessItem, "locked">[];

export function getPartnerPortalMetricAccessItems(
  planTier: PartnerCompanyPlanTier,
): PartnerPortalMetricAccessItem[] {
  return METRIC_ACCESS_ITEMS.map((item) => ({
    ...item,
    locked: !canAccessPartnerMetric(planTier, item.key),
  }));
}
