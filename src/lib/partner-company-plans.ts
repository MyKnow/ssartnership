import type { AdChannel } from "@/lib/ad-packages";

export const PARTNER_COMPANY_PLAN_TIERS = ["basic", "partner", "boost"] as const;

export type PartnerCompanyPlanTier = (typeof PARTNER_COMPANY_PLAN_TIERS)[number];
export const PARTNER_BRAND_PLAN_TIERS = PARTNER_COMPANY_PLAN_TIERS;
export type PartnerBrandPlanTier = PartnerCompanyPlanTier;

export type PartnerMetricKey =
  | "favoriteCount"
  | "reviewCount"
  | "detailViews"
  | "detailUv"
  | "cardClicks"
  | "mapClicks"
  | "reservationClicks"
  | "inquiryClicks"
  | "benefitUsageCount"
  | "totalClicks"
  | "timeseries"
  | "adPerformance";

export type PartnerCompanyPlanDefinition = {
  tier: PartnerCompanyPlanTier;
  label: string;
  description: string;
  monthlyPriceKrw: number;
  allowedAdChannels: AdChannel[];
  accessibleMetrics: PartnerMetricKey[];
  notificationFeatures: Array<"expiry" | "plan" | "metrics">;
};

const BASIC_METRICS = [
  "favoriteCount",
  "reviewCount",
  "benefitUsageCount",
  "detailViews",
  "totalClicks",
] as const satisfies readonly PartnerMetricKey[];

const PARTNER_METRICS = [
  ...BASIC_METRICS,
  "detailUv",
  "cardClicks",
  "mapClicks",
] as const satisfies readonly PartnerMetricKey[];

const BOOST_METRICS = [
  ...PARTNER_METRICS,
  "reservationClicks",
  "inquiryClicks",
  "timeseries",
  "adPerformance",
] as const satisfies readonly PartnerMetricKey[];

const PARTNER_COMPANY_PLAN_DEFINITION_MAP = {
  basic: {
    tier: "basic",
    label: "Basic",
    description: "무료 입점, 쿠폰 운영, 핵심 요약 지표를 제공합니다.",
    monthlyPriceKrw: 0,
    allowedAdChannels: ["coupon"],
    accessibleMetrics: [...BASIC_METRICS],
    notificationFeatures: ["expiry", "plan"],
  },
  partner: {
    tier: "partner",
    label: "Partner",
    description: "쿠폰 운영과 집계형 성과 리포트를 제공합니다.",
    monthlyPriceKrw: 50_000,
    allowedAdChannels: ["coupon"],
    accessibleMetrics: [...PARTNER_METRICS],
    notificationFeatures: ["expiry", "plan", "metrics"],
  },
  boost: {
    tier: "boost",
    label: "Boost",
    description: "홈 배너, 광고성 푸시/MM, 애드배너, 상세 성과 지표를 제공합니다.",
    monthlyPriceKrw: 150_000,
    allowedAdChannels: ["coupon", "home_banner", "push", "mm", "ad_banner"],
    accessibleMetrics: [...BOOST_METRICS],
    notificationFeatures: ["expiry", "plan", "metrics"],
  },
} as const satisfies Record<PartnerCompanyPlanTier, PartnerCompanyPlanDefinition>;

const PLAN_TIER_SET = new Set<string>(PARTNER_COMPANY_PLAN_TIERS);

export const PARTNER_COMPANY_PLAN_DEFINITIONS = PARTNER_COMPANY_PLAN_TIERS.map(
  (tier) => PARTNER_COMPANY_PLAN_DEFINITION_MAP[tier],
);
export const PARTNER_BRAND_PLAN_DEFINITIONS = PARTNER_COMPANY_PLAN_DEFINITIONS;

export function isPartnerCompanyPlanTier(
  value: string,
): value is PartnerCompanyPlanTier {
  return PLAN_TIER_SET.has(value);
}

export function normalizePartnerCompanyPlanTier(
  value?: string | null,
  fallback: PartnerCompanyPlanTier = "basic",
): PartnerCompanyPlanTier {
  const normalized = value?.trim().toLowerCase();
  return normalized && isPartnerCompanyPlanTier(normalized) ? normalized : fallback;
}

export function getPartnerCompanyPlanDefinition(tier: PartnerCompanyPlanTier) {
  return PARTNER_COMPANY_PLAN_DEFINITION_MAP[tier];
}

export function getPartnerBrandPlanDefinition(tier: PartnerBrandPlanTier) {
  return getPartnerCompanyPlanDefinition(tier);
}

export function getPlanAllowedAdChannels(tier: PartnerCompanyPlanTier): AdChannel[] {
  return [...getPartnerCompanyPlanDefinition(tier).allowedAdChannels];
}

export function canAccessPartnerMetric(
  tier: PartnerCompanyPlanTier,
  metricKey: PartnerMetricKey,
) {
  const accessibleMetrics: readonly PartnerMetricKey[] =
    getPartnerCompanyPlanDefinition(tier).accessibleMetrics;
  return accessibleMetrics.includes(metricKey);
}

export function canUsePartnerPlanNotificationFeature(
  tier: PartnerCompanyPlanTier,
  feature: PartnerCompanyPlanDefinition["notificationFeatures"][number],
) {
  const notificationFeatures: readonly PartnerCompanyPlanDefinition["notificationFeatures"][number][] =
    getPartnerCompanyPlanDefinition(tier).notificationFeatures;
  return notificationFeatures.includes(feature);
}

function dateToKstTimestamp(value: string | null | undefined, endOfDay = false) {
  const date = value?.trim();
  if (!date) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date}T${endOfDay ? "23:59:59" : "00:00:00"}+09:00`;
  }
  return date;
}

export function resolvePartnerBrandPlanWindow(input: {
  planTier: PartnerBrandPlanTier;
  periodStart?: string | null;
  periodEnd?: string | null;
  planStartedAt?: string | null;
  planExpiresAt?: string | null;
}) {
  if (input.planTier === "basic") {
    return {
      planStartedAt: dateToKstTimestamp(input.periodStart),
      planExpiresAt: dateToKstTimestamp(input.periodEnd, true),
    };
  }

  return {
    planStartedAt: input.planStartedAt ?? null,
    planExpiresAt: input.planExpiresAt ?? null,
  };
}

export function isPartnerPlanWindowOrderValid(input: {
  planStartedAt?: string | null;
  planExpiresAt?: string | null;
}) {
  const planStartedAt = input.planStartedAt?.trim();
  const planExpiresAt = input.planExpiresAt?.trim();
  if (!planStartedAt || !planExpiresAt) {
    return true;
  }

  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (
    dateOnlyPattern.test(planStartedAt) &&
    dateOnlyPattern.test(planExpiresAt)
  ) {
    return planExpiresAt >= planStartedAt;
  }

  const startedAtMs = Date.parse(planStartedAt);
  const expiresAtMs = Date.parse(planExpiresAt);
  return (
    Number.isFinite(startedAtMs) &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs > startedAtMs
  );
}

/**
 * Plan expiry policy (refactor default decision 12): a paid plan
 * (Partner/Boost) is never demoted automatically when `plan_expires_at`
 * passes. The stored tier stays effective as a manual grace period until an
 * admin reviews the contract and changes the plan, so expiry is read-only
 * state for display and follow-up.
 */
export const PARTNER_PLAN_EXPIRY_POLICY = "manual_grace" as const;
export const PARTNER_PLAN_EXPIRING_SOON_DAYS = 14;

const DAY_MS = 86_400_000;

export type PartnerPlanExpiryStatus =
  | "not_applicable"
  | "no_expiry"
  | "active"
  | "expiring_soon"
  | "expired";

export type PartnerPlanExpiryState = {
  status: PartnerPlanExpiryStatus;
  /** Whole days until expiry, rounded up; negative once expired. */
  daysUntilExpiry: number | null;
  /** True for an expired paid plan that is kept only by the manual grace. */
  requiresManualReview: boolean;
};

export function getDaysUntilPartnerPlanDate(
  value?: string | null,
  referenceTime: string | number | Date = Date.now(),
) {
  if (!value) {
    return null;
  }

  const targetMs = new Date(value).getTime();
  const referenceMs = new Date(referenceTime).getTime();
  if (Number.isNaN(targetMs) || Number.isNaN(referenceMs)) {
    return null;
  }

  return Math.ceil((targetMs - referenceMs) / DAY_MS);
}

/**
 * Basic follows the partnership period, so only paid tiers report plan
 * expiry. The tier itself is not changed here (see PARTNER_PLAN_EXPIRY_POLICY).
 */
export function getPartnerPlanExpiryState(input: {
  planTier: PartnerCompanyPlanTier;
  planExpiresAt?: string | null;
  now?: string | number | Date;
}): PartnerPlanExpiryState {
  if (input.planTier === "basic") {
    return {
      status: "not_applicable",
      daysUntilExpiry: null,
      requiresManualReview: false,
    };
  }

  const now = input.now ?? Date.now();
  const expiresMs = input.planExpiresAt
    ? new Date(input.planExpiresAt).getTime()
    : Number.NaN;
  const nowMs = new Date(now).getTime();
  if (Number.isNaN(expiresMs) || Number.isNaN(nowMs)) {
    return { status: "no_expiry", daysUntilExpiry: null, requiresManualReview: false };
  }

  const daysUntilExpiry = getDaysUntilPartnerPlanDate(input.planExpiresAt, nowMs);
  if (expiresMs <= nowMs) {
    const elapsedDays = daysUntilExpiry ?? 0;
    return {
      status: "expired",
      // Avoid -0 for plans that expired less than a day ago.
      daysUntilExpiry: elapsedDays < 0 ? elapsedDays : 0,
      requiresManualReview: true,
    };
  }

  return {
    status:
      daysUntilExpiry !== null && daysUntilExpiry <= PARTNER_PLAN_EXPIRING_SOON_DAYS
        ? "expiring_soon"
        : "active",
    daysUntilExpiry,
    requiresManualReview: false,
  };
}
