import {
  getAdPackageDefinition,
  isAdCouponRedeemable,
  normalizeAdChannelsForTier,
  summarizeAdPackageMetrics,
  type AdPackageMetricEvent,
} from "@/lib/ad-packages";
import type {
  AdCampaign,
  AdCampaignWithStats,
  AdCoupon,
  AdCouponRedemption,
  AdPackageRepository,
  AvailableAdCoupon,
  CreateAdCampaignInput,
  CreateAdCouponInput,
  ListAvailableCouponsForMemberInput,
  RedeemAdCouponInput,
  RedeemAdCouponResult,
  UpdateAdCampaignStatusInput,
} from "@/lib/repositories/ad-package-repository";

const MOCK_PARTNER_NAMES = new Map([
  ["restaurant-001", "역삼 국밥집"],
  ["health-001", "바디라인 피트니스"],
  ["space-001", "협업 스테이션"],
]);

function isoNow() {
  return new Date().toISOString();
}

function cloneCampaign(campaign: AdCampaign): AdCampaign {
  return {
    ...campaign,
    channels: [...campaign.channels],
  };
}

function cloneCoupon(coupon: AdCoupon): AdCoupon {
  return {
    ...coupon,
    terms: [...coupon.terms],
  };
}

function cloneRedemption(redemption: AdCouponRedemption): AdCouponRedemption {
  return { ...redemption };
}

function getTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function toAvailableCoupon(
  coupon: AdCoupon,
  memberUsedCount: number,
): AvailableAdCoupon | null {
  const remainingMemberUses = Math.max(0, coupon.perMemberLimit - memberUsedCount);
  const remainingGlobalUses =
    typeof coupon.usageLimit === "number"
      ? Math.max(0, coupon.usageLimit - coupon.usedCount)
      : null;

  if (remainingMemberUses <= 0 || remainingGlobalUses === 0) {
    return null;
  }

  return {
    coupon: cloneCoupon(coupon),
    memberUsedCount,
    remainingMemberUses,
    remainingGlobalUses,
  };
}

function createMockCampaigns(): AdCampaign[] {
  return [
    {
      id: "campaign-health-partner",
      partnerId: "health-001",
      partnerName: "바디라인 피트니스",
      packageTier: "partner",
      title: "바디라인 피트니스 체험 쿠폰",
      description: "SSAFY 구성원에게 체험권 쿠폰을 제공하는 기본 패키지입니다.",
      sponsorLabel: "바디라인 피트니스 제공",
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-08-31T23:59:59.000Z",
      channels: ["coupon"],
      monthlyPriceKrw: getAdPackageDefinition("partner").monthlyPriceKrw,
      notes: "",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "campaign-restaurant-boost",
      partnerId: "restaurant-001",
      partnerName: "역삼 국밥집",
      packageTier: "boost",
      title: "역삼 국밥집 점심 부스트",
      description: "점심 시간대 SSAFY 구성원 방문을 늘리는 홈 배너+쿠폰 패키지입니다.",
      sponsorLabel: "역삼 국밥집 제공",
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
      channels: ["coupon", "home_banner", "push"],
      monthlyPriceKrw: getAdPackageDefinition("boost").monthlyPriceKrw,
      notes: "",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ];
}

function createMockCoupons(): AdCoupon[] {
  return [
    {
      id: "coupon-health-trial",
      campaignId: "campaign-health-partner",
      partnerId: "health-001",
      partnerName: "바디라인 피트니스",
      title: "1일 체험권 무료",
      description: "SSAFY 인증 후 평일 운영 시간에 1회 체험할 수 있습니다.",
      code: "SSAFY-TRIAL",
      redemptionType: "onsite",
      discountLabel: "1일 무료",
      terms: ["평일 한정", "운동복 대여 별도", "첫 방문 1회 사용"],
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-08-31T23:59:59.000Z",
      usageLimit: 50,
      perMemberLimit: 1,
      usedCount: 0,
      externalUrl: "",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "coupon-restaurant-lunch",
      campaignId: "campaign-restaurant-boost",
      partnerId: "restaurant-001",
      partnerName: "역삼 국밥집",
      title: "점심 세트 10% 할인",
      description: "평일 11:30-13:30 SSAFY 인증 후 점심 세트에 적용됩니다.",
      code: "SSAFY-LUNCH",
      redemptionType: "onsite",
      discountLabel: "10% 할인",
      terms: ["평일 점심 한정", "1일 1회 사용", "타 쿠폰 중복 불가"],
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
      usageLimit: 100,
      perMemberLimit: 1,
      usedCount: 0,
      externalUrl: "",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ];
}

export class MockAdPackageRepository implements AdPackageRepository {
  private campaigns: AdCampaign[];
  private coupons: AdCoupon[];
  private redemptions: AdCouponRedemption[];
  private events: AdPackageMetricEvent[];

  constructor() {
    this.campaigns = createMockCampaigns();
    this.coupons = createMockCoupons();
    this.redemptions = [];
    this.events = [];
  }

  async listAdminCampaigns(options?: { now?: Date }): Promise<AdCampaignWithStats[]> {
    void options;
    return this.campaigns.map((campaign) => {
      const redemptions = this.redemptions.filter(
        (redemption) => redemption.campaignId === campaign.id,
      );
      return {
        ...cloneCampaign(campaign),
        coupons: this.coupons
          .filter((coupon) => coupon.campaignId === campaign.id)
          .map((coupon) => ({
            ...cloneCoupon(coupon),
            usedCount: this.countCouponRedemptions(coupon.id),
          })),
        metrics: summarizeAdPackageMetrics({
          campaignId: campaign.id,
          events: this.events,
          redemptionCount: redemptions.length,
        }),
      };
    });
  }

  async listActiveCouponsForPartner(
    partnerId: string,
    options?: { now?: Date },
  ): Promise<AdCoupon[]> {
    const now = options?.now ?? new Date();
    return this.coupons
      .filter((coupon) => coupon.partnerId === partnerId)
      .filter((coupon) =>
        isAdCouponRedeemable({
          coupon: {
            ...coupon,
            usedCount: this.countCouponRedemptions(coupon.id),
          },
          campaign: this.campaigns.find((campaign) => campaign.id === coupon.campaignId),
          now,
        }),
      )
      .map((coupon) => ({
        ...cloneCoupon(coupon),
        usedCount: this.countCouponRedemptions(coupon.id),
      }));
  }

  async listAvailableCouponsForMember(
    input: ListAvailableCouponsForMemberInput,
  ): Promise<AvailableAdCoupon[]> {
    const now = input.now ?? new Date();
    const partnerIds = new Set(input.partnerIds.filter(Boolean));
    if (!input.memberId || partnerIds.size === 0) {
      return [];
    }

    return this.coupons
      .filter((coupon) => partnerIds.has(coupon.partnerId))
      .map((coupon) => ({
        coupon: {
          ...coupon,
          usedCount: this.countCouponRedemptions(coupon.id),
        },
        campaign: this.campaigns.find((campaign) => campaign.id === coupon.campaignId),
        memberUsedCount: this.countCouponRedemptions(coupon.id, input.memberId),
      }))
      .filter(({ coupon, campaign }) =>
        isAdCouponRedeemable({
          coupon,
          campaign,
          now,
        }),
      )
      .map(({ coupon, memberUsedCount }) =>
        toAvailableCoupon(coupon, memberUsedCount),
      )
      .filter((item): item is AvailableAdCoupon => Boolean(item))
      .sort((left, right) => {
        const endDiff = getTime(left.coupon.endsAt) - getTime(right.coupon.endsAt);
        if (endDiff !== 0) {
          return endDiff;
        }
        return right.coupon.createdAt.localeCompare(left.coupon.createdAt);
      });
  }

  async createCampaign(input: CreateAdCampaignInput): Promise<AdCampaign> {
    const now = isoNow();
    const packageTier = input.packageTier;
    const campaign: AdCampaign = {
      id: `campaign-${crypto.randomUUID()}`,
      partnerId: input.partnerId,
      partnerName: MOCK_PARTNER_NAMES.get(input.partnerId) ?? "제휴처",
      packageTier,
      title: input.title,
      description: input.description ?? "",
      sponsorLabel: input.sponsorLabel ?? "",
      status: input.status ?? "draft",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      channels: normalizeAdChannelsForTier(packageTier, input.channels),
      monthlyPriceKrw:
        input.monthlyPriceKrw ?? getAdPackageDefinition(packageTier).monthlyPriceKrw,
      notes: input.notes ?? "",
      createdAt: now,
      updatedAt: now,
    };
    this.campaigns = [campaign, ...this.campaigns];
    return cloneCampaign(campaign);
  }

  async updateCampaignStatus(input: UpdateAdCampaignStatusInput): Promise<void> {
    const now = isoNow();
    this.campaigns = this.campaigns.map((campaign) =>
      campaign.id === input.campaignId
        ? { ...campaign, status: input.status, updatedAt: now }
        : campaign,
    );
  }

  async createCoupon(input: CreateAdCouponInput): Promise<AdCoupon> {
    const now = isoNow();
    const partnerName = MOCK_PARTNER_NAMES.get(input.partnerId) ?? "제휴처";
    const coupon: AdCoupon = {
      id: `coupon-${crypto.randomUUID()}`,
      campaignId: input.campaignId ?? null,
      partnerId: input.partnerId,
      partnerName,
      title: input.title,
      description: input.description ?? "",
      code: input.code ?? "",
      redemptionType: input.redemptionType ?? "onsite",
      discountLabel: input.discountLabel ?? "",
      terms: [...(input.terms ?? [])],
      status: input.status ?? "draft",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      usageLimit: input.usageLimit ?? null,
      perMemberLimit: input.perMemberLimit ?? 1,
      usedCount: 0,
      externalUrl: input.externalUrl ?? "",
      createdAt: now,
      updatedAt: now,
    };
    this.coupons = [coupon, ...this.coupons];
    return cloneCoupon(coupon);
  }

  async redeemCoupon(input: RedeemAdCouponInput): Promise<RedeemAdCouponResult> {
    const coupon = this.coupons.find((item) => item.id === input.couponId);
    if (!coupon) {
      return {
        ok: false,
        reason: "not_found",
        message: "쿠폰을 찾을 수 없습니다.",
      };
    }

    const usedCount = this.countCouponRedemptions(coupon.id);
    const campaign = this.campaigns.find((item) => item.id === coupon.campaignId);
    const couponWithCount = { ...coupon, usedCount };
    if (!isAdCouponRedeemable({ coupon: couponWithCount, campaign })) {
      return {
        ok: false,
        reason: usedCount >= (coupon.usageLimit ?? Number.POSITIVE_INFINITY)
          ? "usage_limit"
          : "inactive",
        message: "현재 사용할 수 없는 쿠폰입니다.",
        coupon: cloneCoupon(couponWithCount),
      };
    }

    if (
      input.memberId &&
      this.redemptions.filter(
        (redemption) =>
          redemption.couponId === coupon.id &&
          redemption.memberId === input.memberId,
      ).length >= coupon.perMemberLimit
    ) {
      return {
        ok: false,
        reason: "member_limit",
        message: "이미 사용할 수 있는 횟수를 모두 사용했습니다.",
        coupon: cloneCoupon(couponWithCount),
      };
    }

    const redemption: AdCouponRedemption = {
      id: `redemption-${crypto.randomUUID()}`,
      couponId: coupon.id,
      campaignId: coupon.campaignId,
      partnerId: coupon.partnerId,
      memberId: input.memberId ?? null,
      sessionId: input.sessionId ?? null,
      redemptionCode: coupon.code,
      createdAt: isoNow(),
    };
    this.redemptions = [redemption, ...this.redemptions];
    this.events = [
      {
        eventName: "coupon_redeem",
        campaignId: coupon.campaignId,
        couponId: coupon.id,
      },
      ...this.events,
    ];

    return {
      ok: true,
      coupon: {
        ...cloneCoupon(coupon),
        usedCount: usedCount + 1,
      },
      redemption: cloneRedemption(redemption),
    };
  }

  private countCouponRedemptions(couponId: string, memberId?: string | null) {
    return this.redemptions.filter(
      (redemption) =>
        redemption.couponId === couponId &&
        (!memberId || redemption.memberId === memberId),
    ).length;
  }
}
