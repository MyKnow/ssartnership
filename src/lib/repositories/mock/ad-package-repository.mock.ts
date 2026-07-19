import {
  getAdPackageDefinition,
  isAdCouponDownloadable,
  isAdCouponRedeemable,
  normalizeAdChannelsForTier,
  summarizeAdPackageMetrics,
  type AdPackageMetricEvent,
} from "@/lib/ad-packages";
import {
  getMemberIssueCountSnapshot,
  isMemberIssueLimitReached,
} from "@/lib/ad-coupon-domain";
import {
  hashCouponVerificationPassword,
  verifyCouponVerificationPassword,
} from "@/lib/coupon-verification-password";
import type {
  AdCampaign,
  AdCampaignWithStats,
  AdCoupon,
  AdCouponRedemption,
  AddAdCouponCodesInput,
  AddAdCouponCodesResult,
  AdPackageRepository,
  AvailableAdCoupon,
  CreateAdCampaignInput,
  CreateAdCouponInput,
  IssueAdCouponInput,
  IssueAdCouponResult,
  ListAvailableCouponsForMemberInput,
  ListIssuedCouponsForMemberInput,
  RedeemAdCouponInput,
  RedeemAdCouponIssueInput,
  RedeemAdCouponIssueResult,
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
      issuanceType: "service",
      redemptionType: "onsite",
      discountLabel: "1일 무료",
      terms: ["평일 한정", "운동복 대여 별도", "첫 방문 1회 사용"],
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-08-31T23:59:59.000Z",
      downloadStartsAt: "2026-07-01T00:00:00.000Z",
      downloadEndsAt: "2026-08-31T23:59:59.000Z",
      usageStartsAt: "2026-07-01T00:00:00.000Z",
      usageEndsAt: "2026-08-31T23:59:59.000Z",
      usageLimit: 50,
      dailyIssueLimit: null,
      weeklyIssueLimit: null,
      monthlyIssueLimit: null,
      perMemberDailyIssueLimit: null,
      perMemberWeeklyIssueLimit: null,
      perMemberMonthlyIssueLimit: null,
      issuedCount: 0,
      remainingIssueCount: null,
      perMemberLimit: 1,
      hasOnsitePassword: false,
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
      issuanceType: "service",
      redemptionType: "onsite",
      discountLabel: "10% 할인",
      terms: ["평일 점심 한정", "1일 1회 사용", "타 쿠폰 중복 불가"],
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
      downloadStartsAt: "2026-07-01T00:00:00.000Z",
      downloadEndsAt: "2026-07-31T23:59:59.000Z",
      usageStartsAt: "2026-07-01T00:00:00.000Z",
      usageEndsAt: "2026-07-31T23:59:59.000Z",
      usageLimit: 100,
      dailyIssueLimit: null,
      weeklyIssueLimit: null,
      monthlyIssueLimit: null,
      perMemberDailyIssueLimit: null,
      perMemberWeeklyIssueLimit: null,
      perMemberMonthlyIssueLimit: null,
      issuedCount: 0,
      remainingIssueCount: null,
      perMemberLimit: 1,
      hasOnsitePassword: false,
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
  private issues: Array<{
    id: string;
    couponId: string;
    memberId: string;
    assignedCode: string | null;
    issuedAt: string;
    usedAt: string | null;
    onsitePasswordHash: string | null;
    onsitePasswordSalt: string | null;
  }>;
  private couponCodes: Map<string, Set<string>>;
  private couponPasswords: Map<string, { hash: string; salt: string }>;
  private events: AdPackageMetricEvent[];

  constructor() {
    this.campaigns = createMockCampaigns();
    this.coupons = createMockCoupons();
    this.redemptions = [];
    this.issues = [];
    this.couponCodes = new Map();
    this.couponPasswords = new Map();
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

  async listAdminCouponsForPartner(partnerId: string): Promise<AdCoupon[]> {
    return this.coupons
      .filter((coupon) => coupon.partnerId === partnerId)
      .map((coupon) => ({
        ...cloneCoupon(coupon),
        usedCount: this.countCouponRedemptions(coupon.id),
      }));
  }

  async listActiveCouponsForPartner(
    partnerId: string,
    options?: { now?: Date },
  ): Promise<AdCoupon[]> {
    const now = options?.now ?? new Date();
    return this.coupons
      .filter((coupon) => coupon.partnerId === partnerId)
      .filter((coupon) =>
        isAdCouponDownloadable({
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
        isAdCouponDownloadable({
          coupon,
          campaign,
          now,
        }),
      )
      .filter(({ coupon }) =>
        !isMemberIssueLimitReached(
          getMemberIssueCountSnapshot({
            couponId: coupon.id,
            memberId: input.memberId,
            limits: {
              daily: coupon.perMemberDailyIssueLimit,
              weekly: coupon.perMemberWeeklyIssueLimit,
              monthly: coupon.perMemberMonthlyIssueLimit,
            },
            records: this.issues,
            now,
          }),
        ),
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
    const redemptionType = input.redemptionType ?? "onsite";
    if (redemptionType === "onsite" && !input.onsitePassword) {
      throw new Error("현장 확인형 쿠폰은 제휴처 확인 비밀번호가 필요합니다.");
    }
    if (redemptionType !== "onsite" && input.onsitePassword) {
      throw new Error("현장 확인 비밀번호는 현장 확인형 쿠폰에만 설정할 수 있습니다.");
    }
    const passwordHash = input.onsitePassword
      ? await hashCouponVerificationPassword(input.onsitePassword)
      : null;
    const coupon: AdCoupon = {
      id: `coupon-${crypto.randomUUID()}`,
      campaignId: input.campaignId ?? null,
      partnerId: input.partnerId,
      partnerName,
      title: input.title,
      description: input.description ?? "",
      code: input.code ?? "",
      issuanceType: input.issuanceType ?? "service",
      redemptionType,
      discountLabel: input.discountLabel ?? "",
      terms: [...(input.terms ?? [])],
      status: input.status ?? "draft",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      downloadStartsAt: input.downloadStartsAt ?? input.startsAt,
      downloadEndsAt: input.downloadEndsAt ?? input.endsAt,
      usageStartsAt: input.usageStartsAt ?? input.startsAt,
      usageEndsAt: input.usageEndsAt ?? input.endsAt,
      usageLimit: input.usageLimit ?? null,
      dailyIssueLimit: input.dailyIssueLimit ?? null,
      weeklyIssueLimit: input.weeklyIssueLimit ?? null,
      monthlyIssueLimit: input.monthlyIssueLimit ?? null,
      perMemberDailyIssueLimit: input.perMemberDailyIssueLimit ?? null,
      perMemberWeeklyIssueLimit: input.perMemberWeeklyIssueLimit ?? null,
      perMemberMonthlyIssueLimit: input.perMemberMonthlyIssueLimit ?? null,
      issuedCount: 0,
      remainingIssueCount: null,
      perMemberLimit: input.perMemberLimit ?? 1,
      hasOnsitePassword: Boolean(passwordHash),
      usedCount: 0,
      externalUrl: input.externalUrl ?? "",
      createdAt: now,
      updatedAt: now,
    };
    this.coupons = [coupon, ...this.coupons];
    if (passwordHash) {
      this.couponPasswords.set(coupon.id, passwordHash);
    }
    return cloneCoupon(coupon);
  }

  async issueCoupon(input: IssueAdCouponInput): Promise<IssueAdCouponResult> {
    const coupon = this.coupons.find((item) => item.id === input.couponId);
    if (!coupon) {
      return { ok: false, reason: "not_found", message: "쿠폰을 찾을 수 없습니다." };
    }
    const now = new Date();
    if (coupon.status !== "active" || now < new Date(coupon.downloadStartsAt) || now > new Date(coupon.downloadEndsAt)) {
      return { ok: false, reason: "inactive", message: "지금 다운로드할 수 없는 쿠폰입니다." };
    }
    if (this.issues.some((issue) => issue.couponId === coupon.id && issue.memberId === input.memberId && !issue.usedAt)) {
      return { ok: false, reason: "member_limit", message: "이미 보유한 쿠폰입니다." };
    }
    const memberIssueLimits = getMemberIssueCountSnapshot({
      couponId: coupon.id,
      memberId: input.memberId,
      limits: {
        daily: coupon.perMemberDailyIssueLimit,
        weekly: coupon.perMemberWeeklyIssueLimit,
        monthly: coupon.perMemberMonthlyIssueLimit,
      },
      records: this.issues,
      now,
    });
    if (isMemberIssueLimitReached(memberIssueLimits)) {
      return { ok: false, reason: "member_limit", message: "회원별 발급 한도에 도달했습니다." };
    }
    const pool = this.couponCodes.get(coupon.id);
    const pooledCode = pool ? [...pool][0] ?? null : null;
    if (pooledCode) pool?.delete(pooledCode);
    const assignedCode = coupon.issuanceType === "partner_code_pool"
      ? pooledCode
      : coupon.redemptionType === "code"
        ? `SSAFY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
        : null;
    if (coupon.issuanceType === "partner_code_pool" && !assignedCode) {
      return { ok: false, reason: "code_unavailable", message: "남은 쿠폰 코드가 없습니다." };
    }
    const issue = {
      id: `issue-${crypto.randomUUID()}`,
      couponId: coupon.id,
      memberId: input.memberId,
      assignedCode,
      issuedAt: isoNow(),
      usedAt: null,
      onsitePasswordHash: this.couponPasswords.get(coupon.id)?.hash ?? null,
      onsitePasswordSalt: this.couponPasswords.get(coupon.id)?.salt ?? null,
    };
    const available = toAvailableCoupon(coupon, 0);
    if (!available) {
      return { ok: false, reason: "usage_limit", message: "현재 발급할 수 없는 쿠폰입니다." };
    }
    this.issues = [issue, ...this.issues];
    return {
      ok: true,
      issue: {
        ...available,
        issueId: issue.id,
        assignedCode,
        issuedAt: issue.issuedAt,
      },
    };
  }

  async listIssuedCouponsForMember(
    input: ListIssuedCouponsForMemberInput,
  ): Promise<AvailableAdCoupon[]> {
    const now = input.now ?? new Date();
    const items: AvailableAdCoupon[] = [];
    for (const issue of this.issues) {
      if (issue.memberId !== input.memberId || issue.usedAt) {
        continue;
      }
      const coupon = this.coupons.find((item) => item.id === issue.couponId);
      if (!coupon || new Date(coupon.usageEndsAt).getTime() < now.getTime()) {
        continue;
      }
      const available = toAvailableCoupon(coupon, 0);
      if (!available) {
        continue;
      }
      items.push({
        ...available,
        issueId: issue.id,
        assignedCode: issue.assignedCode,
        issuedAt: issue.issuedAt,
        usedAt: issue.usedAt,
      });
    }
    return items;
  }

  async addCouponCodes(input: AddAdCouponCodesInput): Promise<AddAdCouponCodesResult> {
    const existing = this.couponCodes.get(input.couponId) ?? new Set<string>();
    const normalized = input.codes.map((code) => code.trim()).filter(Boolean);
    const addedCount = normalized.filter((code) => !existing.has(code)).length;
    normalized.forEach((code) => existing.add(code));
    this.couponCodes.set(input.couponId, existing);
    return { addedCount, skippedCount: normalized.length - addedCount };
  }

  async redeemCouponIssue(
    input: RedeemAdCouponIssueInput,
  ): Promise<RedeemAdCouponIssueResult> {
    const issue = this.issues.find(
      (item) => item.id === input.issueId && item.memberId === input.memberId,
    );
    if (!issue) {
      return { ok: false, reason: "not_found", message: "쿠폰을 찾을 수 없습니다." };
    }
    if (issue.usedAt) {
      return {
        ok: false,
        reason: "inactive",
        message: "이미 사용했거나 사용할 수 없는 쿠폰입니다.",
      };
    }
    const coupon = this.coupons.find((item) => item.id === issue.couponId);
    if (!coupon) {
      return { ok: false, reason: "not_found", message: "쿠폰을 찾을 수 없습니다." };
    }
    const now = Date.now();
    if (
      now < new Date(coupon.usageStartsAt).getTime() ||
      now > new Date(coupon.usageEndsAt).getTime()
    ) {
      return { ok: false, reason: "expired", message: "쿠폰 사용 기간이 아닙니다." };
    }
    if (coupon.status !== "active") {
      return { ok: false, reason: "inactive", message: "현재 사용할 수 없는 쿠폰입니다." };
    }
    if (issue.onsitePasswordHash && issue.onsitePasswordSalt) {
      if (!input.onsitePassword) {
        return {
          ok: false,
          reason: "onsite_password_required",
          message: "제휴처 확인 비밀번호를 입력해 주세요.",
        };
      }
      const isValid = await verifyCouponVerificationPassword(input.onsitePassword, {
        hash: issue.onsitePasswordHash,
        salt: issue.onsitePasswordSalt,
      });
      if (!isValid) {
        return {
          ok: false,
          reason: "onsite_password_invalid",
          message: "제휴처 확인 비밀번호가 올바르지 않습니다.",
        };
      }
    }

    const usedAt = isoNow();
    this.issues = this.issues.map((item) =>
      item.id === issue.id ? { ...item, usedAt } : item,
    );
    const redemption: AdCouponRedemption = {
      id: `redemption-${crypto.randomUUID()}`,
      couponId: coupon.id,
      campaignId: coupon.campaignId,
      partnerId: coupon.partnerId,
      memberId: input.memberId,
      sessionId: input.sessionId ?? null,
      redemptionCode: issue.assignedCode ?? "",
      createdAt: usedAt,
    };
    this.redemptions = [redemption, ...this.redemptions];
    this.events = [
      { eventName: "coupon_redeem", campaignId: coupon.campaignId, couponId: coupon.id },
      ...this.events,
    ];
    return {
      ok: true,
      couponId: coupon.id,
      issueId: issue.id,
      assignedCode: issue.assignedCode,
    };
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
    if (coupon.redemptionType === "onsite") {
      return {
        ok: false,
        reason: "onsite_verification_required",
        message: "현장형 쿠폰은 쿠폰함의 제휴처 확인 화면에서 사용해 주세요.",
        coupon: cloneCoupon(couponWithCount),
      };
    }
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
