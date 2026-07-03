import type { AdChannel } from "@/lib/ad-packages";
import {
  PARTNER_COMPANY_PLAN_DEFINITIONS,
  getPartnerCompanyPlanDefinition,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";

export const PARTNER_PLAN_RANK: Record<PartnerCompanyPlanTier, number> = {
  basic: 10,
  partner: 20,
  boost: 30,
};

export const PARTNER_PLAN_FILTERS = [
  "all",
  "pending",
  "expiring",
  "basic",
  "partner",
  "boost",
] as const;

export type PartnerPlanFilter = (typeof PARTNER_PLAN_FILTERS)[number];

const PLAN_PROGRESS: Record<PartnerCompanyPlanTier, string> = {
  basic: "1/3 단계",
  partner: "2/3 단계",
  boost: "3/3 단계",
};

const AD_CHANNEL_LABELS = {
  coupon: "쿠폰",
  home_banner: "홈 배너",
  push: "앱 푸시",
  mm: "MM",
  ad_banner: "일반 애드배너",
} as const satisfies Record<AdChannel, string>;

const FILTER_LABELS = {
  all: "전체",
  pending: "대기 요청",
  expiring: "만료 임박",
  basic: "Basic",
  partner: "Partner",
  boost: "Boost",
} as const satisfies Record<PartnerPlanFilter, string>;

export function getPartnerPlanUpgradeOptions(currentTier: PartnerCompanyPlanTier) {
  const currentRank = PARTNER_PLAN_RANK[currentTier];
  return PARTNER_COMPANY_PLAN_DEFINITIONS.filter(
    (definition) => PARTNER_PLAN_RANK[definition.tier] > currentRank,
  );
}

export function getPartnerPlanProgressLabel(tier: PartnerCompanyPlanTier) {
  return PLAN_PROGRESS[tier];
}

export function getPartnerPlanChannelLabel(channel: AdChannel) {
  return AD_CHANNEL_LABELS[channel];
}

export function getPartnerPlanFilterLabel(filter: PartnerPlanFilter) {
  return FILTER_LABELS[filter];
}

export function matchesPartnerPlanFilter(
  brand: {
    planTier: PartnerCompanyPlanTier;
    hasPendingRequest: boolean;
    daysUntil: number | null;
  },
  filter: PartnerPlanFilter,
) {
  switch (filter) {
    case "all":
      return true;
    case "pending":
      return brand.hasPendingRequest;
    case "expiring":
      return brand.daysUntil !== null && brand.daysUntil >= 0 && brand.daysUntil <= 30;
    default:
      return brand.planTier === filter;
  }
}

export function getPartnerPlanExpiryStatus(
  tier: PartnerCompanyPlanTier,
  daysUntil: number | null,
) {
  const prefix = tier === "basic" ? "제휴 종료" : "플랜 만료";
  if (daysUntil === null) {
    return {
      label: tier === "basic" ? "제휴 기간 없음" : "플랜 기간 없음",
      tone: "neutral" as const,
    };
  }
  if (daysUntil < 0) {
    return {
      label: prefix,
      tone: "warning" as const,
    };
  }
  return {
    label: `${prefix} D-${daysUntil}`,
    tone: daysUntil <= 30 ? ("warning" as const) : ("neutral" as const),
  };
}

export function formatPartnerPlanCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function formatPartnerPlanMonthlyPrice(tier: PartnerCompanyPlanTier) {
  const definition = getPartnerCompanyPlanDefinition(tier);
  return definition.monthlyPriceKrw === 0
    ? "무료"
    : `월 ${formatPartnerPlanCurrency(definition.monthlyPriceKrw)}`;
}
