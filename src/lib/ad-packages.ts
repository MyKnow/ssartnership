export const AD_PACKAGE_TIERS = [
  "basic",
  "partner",
  "boost",
  "sponsor",
] as const;

export type AdPackageTier = (typeof AD_PACKAGE_TIERS)[number];

export const AD_CHANNELS = [
  "coupon",
  "home_banner",
  "push",
  "mm",
  "ad_banner",
] as const;

export type AdChannel = (typeof AD_CHANNELS)[number];

export const INITIAL_AD_CHANNELS = [
  "coupon",
  "home_banner",
  "push",
] as const satisfies readonly AdChannel[];

export type InitialAdChannel = (typeof INITIAL_AD_CHANNELS)[number];

export const AD_CAMPAIGN_STATUSES = [
  "draft",
  "active",
  "paused",
  "ended",
] as const;

export type AdCampaignStatus = (typeof AD_CAMPAIGN_STATUSES)[number];

export const AD_COUPON_STATUSES = [
  "draft",
  "active",
  "paused",
  "ended",
] as const;

export type AdCouponStatus = (typeof AD_COUPON_STATUSES)[number];

export const AD_COUPON_REDEMPTION_TYPES = [
  "onsite",
  "code",
  "external",
] as const;

export type AdCouponRedemptionType =
  (typeof AD_COUPON_REDEMPTION_TYPES)[number];

export type AdPackageDefinition = {
  tier: AdPackageTier;
  label: string;
  description: string;
  monthlyPriceKrw: number;
  includedChannels: InitialAdChannel[];
  priority: number;
};

const AD_PACKAGE_DEFINITIONS = {
  basic: {
    tier: "basic",
    label: "Basic",
    description: "무료 입점과 쿠폰 등록으로 제휴 성과 측정을 시작합니다.",
    monthlyPriceKrw: 0,
    includedChannels: ["coupon"],
    priority: 10,
  },
  partner: {
    tier: "partner",
    label: "Partner",
    description: "쿠폰 운영과 월간 성과 리포트를 제공하는 기본 유료 패키지입니다.",
    monthlyPriceKrw: 50_000,
    includedChannels: ["coupon"],
    priority: 20,
  },
  boost: {
    tier: "boost",
    label: "Boost",
    description: "홈 스폰서 배너와 광고성 푸시를 묶어 단기 방문 전환을 만듭니다.",
    monthlyPriceKrw: 150_000,
    includedChannels: ["coupon", "home_banner", "push"],
    priority: 30,
  },
  sponsor: {
    tier: "sponsor",
    label: "Sponsor",
    description: "스폰서십 캠페인에 홈 배너, 쿠폰, 광고성 푸시를 통합합니다.",
    monthlyPriceKrw: 500_000,
    includedChannels: ["coupon", "home_banner", "push"],
    priority: 40,
  },
} as const satisfies Record<AdPackageTier, AdPackageDefinition>;

export type AdCampaignLike = {
  status?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type AdCouponLike = {
  status?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  usedCount?: number | null;
};

export type AdPackageMetricEventName =
  | "home_banner_click"
  | "coupon_view"
  | "coupon_copy"
  | "coupon_redeem"
  | "ad_push_send";

export type AdPackageMetricEvent = {
  eventName: AdPackageMetricEventName | string;
  campaignId?: string | null;
  couponId?: string | null;
};

export type AdPackageMetrics = {
  homeBannerClicks: number;
  couponViews: number;
  couponCopies: number;
  couponIntentCount: number;
  couponRedemptions: number;
  adPushSends: number;
};

const INITIAL_AD_CHANNEL_SET = new Set<string>(INITIAL_AD_CHANNELS);

export function isAdPackageTier(value: string): value is AdPackageTier {
  return AD_PACKAGE_TIERS.includes(value as AdPackageTier);
}

export function normalizeAdPackageTier(
  value?: string | null,
  fallback: AdPackageTier = "basic",
): AdPackageTier {
  const normalized = value?.trim();
  return normalized && isAdPackageTier(normalized) ? normalized : fallback;
}

export function isInitialAdChannel(value: string): value is InitialAdChannel {
  return INITIAL_AD_CHANNEL_SET.has(value);
}

export function getAdPackageDefinition(tier: AdPackageTier) {
  return AD_PACKAGE_DEFINITIONS[tier];
}

export function listAdPackageDefinitions() {
  return AD_PACKAGE_TIERS.map((tier) => getAdPackageDefinition(tier));
}

export function normalizeAdChannelsForTier(
  tier: AdPackageTier,
  requestedChannels?: readonly string[] | null,
): InitialAdChannel[] {
  const definition = getAdPackageDefinition(tier);
  const allowed = new Set<InitialAdChannel>(definition.includedChannels);
  const normalized = (requestedChannels ?? [])
    .map((channel) => channel.trim())
    .filter((channel): channel is InitialAdChannel => isInitialAdChannel(channel))
    .filter((channel) => allowed.has(channel));

  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : [...definition.includedChannels];
}

function getTime(value?: string | null) {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function isActiveWindow(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: Date,
) {
  const nowTime = now.getTime();
  const startTime = getTime(startsAt);
  const endTime = getTime(endsAt);
  if (startTime !== null && nowTime < startTime) {
    return false;
  }
  if (endTime !== null && nowTime > endTime) {
    return false;
  }
  return true;
}

export function isAdCampaignActive(
  campaign: AdCampaignLike | null | undefined,
  now: Date = new Date(),
) {
  if (!campaign) {
    return true;
  }
  if (campaign.status !== "active") {
    return false;
  }
  return isActiveWindow(campaign.startsAt, campaign.endsAt, now);
}

export function isAdCouponRedeemable({
  coupon,
  campaign,
  now = new Date(),
}: {
  coupon: AdCouponLike;
  campaign?: AdCampaignLike | null;
  now?: Date;
}) {
  if (coupon.status !== "active") {
    return false;
  }
  if (!isActiveWindow(coupon.startsAt, coupon.endsAt, now)) {
    return false;
  }
  if (!isAdCampaignActive(campaign, now)) {
    return false;
  }
  if (
    typeof coupon.usageLimit === "number" &&
    coupon.usageLimit >= 0 &&
    (coupon.usedCount ?? 0) >= coupon.usageLimit
  ) {
    return false;
  }
  return true;
}

export function createEmptyAdPackageMetrics(): AdPackageMetrics {
  return {
    homeBannerClicks: 0,
    couponViews: 0,
    couponCopies: 0,
    couponIntentCount: 0,
    couponRedemptions: 0,
    adPushSends: 0,
  };
}

export function summarizeAdPackageMetrics({
  campaignId,
  events,
  redemptionCount = 0,
}: {
  campaignId: string;
  events: readonly AdPackageMetricEvent[];
  redemptionCount?: number;
}): AdPackageMetrics {
  const metrics = createEmptyAdPackageMetrics();

  for (const event of events) {
    if (event.campaignId !== campaignId) {
      continue;
    }

    switch (event.eventName) {
      case "home_banner_click":
        metrics.homeBannerClicks += 1;
        break;
      case "coupon_view":
        metrics.couponViews += 1;
        break;
      case "coupon_copy":
        metrics.couponCopies += 1;
        break;
      case "coupon_redeem":
        metrics.couponIntentCount += 1;
        break;
      case "ad_push_send":
        metrics.adPushSends += 1;
        break;
    }
  }

  metrics.couponRedemptions = Math.max(0, Math.floor(redemptionCount));
  return metrics;
}
