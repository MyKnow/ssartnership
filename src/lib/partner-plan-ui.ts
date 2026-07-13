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

export type PartnerPlanRequestProgressTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger";

export type PartnerPlanRequestProgressStep = {
  key: "requested" | "payment" | "review" | "applied";
  label: string;
  state: "complete" | "current" | "pending";
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

export function getPartnerPlanRequestProgress(input: {
  requestStatus: string;
  invoiceStatus?: string | null;
  paymentStatus?: string | null;
}) {
  const requestStatus = input.requestStatus;
  const invoiceStatus = input.invoiceStatus ?? null;
  const paymentStatus = input.paymentStatus ?? null;
  const paymentConfirmed = invoiceStatus === "paid" || paymentStatus === "confirmed";
  const paymentOverdue = invoiceStatus === "overdue";

  if (requestStatus === "approved") {
    return {
      label: "플랜 적용 완료",
      tone: "success" as const satisfies PartnerPlanRequestProgressTone,
      headline: "승인 완료 후 플랜이 적용되었습니다.",
      nextStep: "제휴처 상세와 대시보드에서 확장 지표를 확인할 수 있습니다.",
      steps: buildPlanRequestSteps("applied"),
    };
  }

  if (requestStatus === "rejected") {
    return {
      label: "요청 반려",
      tone: "danger" as const satisfies PartnerPlanRequestProgressTone,
      headline: "관리자 검토에서 반려된 요청입니다.",
      nextStep: "반려 사유를 확인한 뒤 필요한 정보를 보완해 다시 요청해 주세요.",
      steps: buildPlanRequestSteps("review"),
    };
  }

  if (requestStatus === "cancelled") {
    return {
      label: "요청 취소",
      tone: "neutral" as const satisfies PartnerPlanRequestProgressTone,
      headline: "파트너가 취소한 업그레이드 요청입니다.",
      nextStep: "필요하면 제휴처 카드에서 새 업그레이드 요청을 만들 수 있습니다.",
      steps: buildPlanRequestSteps("requested"),
    };
  }

  if (paymentConfirmed) {
    return {
      label: "승인 대기",
      tone: "success" as const satisfies PartnerPlanRequestProgressTone,
      headline: "입금 확인이 완료되어 관리자 승인만 남았습니다.",
      nextStep: "관리자가 승인하면 플랜 권한과 지표 접근 범위가 자동으로 반영됩니다.",
      steps: buildPlanRequestSteps("review"),
    };
  }

  if (paymentOverdue) {
    return {
      label: "납부기한 경과",
      tone: "danger" as const satisfies PartnerPlanRequestProgressTone,
      headline: "입금 확인 기한이 지났습니다.",
      nextStep: "입금을 완료했다면 기술 지원으로 확인을 요청하거나 요청을 취소해 주세요.",
      steps: buildPlanRequestSteps("payment"),
    };
  }

  return {
    label: "입금 확인 대기",
    tone: "warning" as const satisfies PartnerPlanRequestProgressTone,
    headline: "안내 계좌 입금 후 관리자 확인을 기다립니다.",
    nextStep: "입금 확인과 관리자 승인이 끝나면 플랜이 자동으로 적용됩니다.",
    steps: buildPlanRequestSteps("payment"),
  };
}

function buildPlanRequestSteps(
  current: PartnerPlanRequestProgressStep["key"],
): PartnerPlanRequestProgressStep[] {
  const order: PartnerPlanRequestProgressStep["key"][] = [
    "requested",
    "payment",
    "review",
    "applied",
  ];
  const labels = {
    requested: "요청 접수",
    payment: "입금 확인",
    review: "관리자 승인",
    applied: "플랜 적용",
  } as const satisfies Record<PartnerPlanRequestProgressStep["key"], string>;
  const currentIndex = order.indexOf(current);

  return order.map((key, index) => ({
    key,
    label: labels[key],
    state:
      index < currentIndex
        ? "complete"
        : index === currentIndex
          ? "current"
          : "pending",
  }));
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
