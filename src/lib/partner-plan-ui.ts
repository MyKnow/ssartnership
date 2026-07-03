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

export function formatPartnerPlanCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function formatPartnerPlanMonthlyPrice(tier: PartnerCompanyPlanTier) {
  const definition = getPartnerCompanyPlanDefinition(tier);
  return definition.monthlyPriceKrw === 0
    ? "무료"
    : `월 ${formatPartnerPlanCurrency(definition.monthlyPriceKrw)}`;
}
