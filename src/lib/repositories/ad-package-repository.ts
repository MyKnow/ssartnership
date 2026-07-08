import type {
  AdCampaignStatus,
  AdChannel,
  AdCouponRedemptionType,
  AdCouponStatus,
  AdPackageMetrics,
  AdPackageTier,
  InitialAdChannel,
} from "@/lib/ad-packages";

export type AdCampaign = {
  id: string;
  partnerId: string;
  partnerName: string;
  packageTier: AdPackageTier;
  title: string;
  description: string;
  sponsorLabel: string;
  status: AdCampaignStatus;
  startsAt: string;
  endsAt: string;
  channels: InitialAdChannel[];
  monthlyPriceKrw: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AdCoupon = {
  id: string;
  campaignId: string | null;
  partnerId: string;
  partnerName: string;
  title: string;
  description: string;
  code: string;
  redemptionType: AdCouponRedemptionType;
  discountLabel: string;
  terms: string[];
  status: AdCouponStatus;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  perMemberLimit: number;
  usedCount: number;
  externalUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type AdCampaignWithStats = AdCampaign & {
  coupons: AdCoupon[];
  metrics: AdPackageMetrics;
};

export type AdCouponRedemption = {
  id: string;
  couponId: string;
  campaignId: string | null;
  partnerId: string;
  memberId: string | null;
  sessionId: string | null;
  redemptionCode: string;
  createdAt: string;
};

export type CreateAdCampaignInput = {
  partnerId: string;
  packageTier: AdPackageTier;
  title: string;
  description?: string;
  sponsorLabel?: string;
  status?: AdCampaignStatus;
  startsAt: string;
  endsAt: string;
  channels?: AdChannel[];
  monthlyPriceKrw?: number;
  notes?: string;
  createdByAdminId?: string | null;
};

export type CreateAdCouponInput = {
  campaignId?: string | null;
  partnerId: string;
  title: string;
  description?: string;
  code?: string;
  redemptionType?: AdCouponRedemptionType;
  discountLabel?: string;
  terms?: string[];
  status?: AdCouponStatus;
  startsAt: string;
  endsAt: string;
  usageLimit?: number | null;
  perMemberLimit?: number;
  externalUrl?: string;
};

export type UpdateAdCampaignStatusInput = {
  campaignId: string;
  status: AdCampaignStatus;
};

export type RedeemAdCouponInput = {
  couponId: string;
  memberId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ListAvailableCouponsForMemberInput = {
  memberId: string;
  partnerIds: string[];
  now?: Date;
};

export type AvailableAdCoupon = {
  coupon: AdCoupon;
  memberUsedCount: number;
  remainingMemberUses: number;
  remainingGlobalUses: number | null;
};

export type RedeemAdCouponResult =
  | {
      ok: true;
      coupon: AdCoupon;
      redemption: AdCouponRedemption;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "inactive"
        | "usage_limit"
        | "member_limit"
        | "invalid";
      message: string;
      coupon?: AdCoupon | null;
    };

export interface AdPackageRepository {
  listAdminCampaigns(options?: { now?: Date }): Promise<AdCampaignWithStats[]>;
  listActiveCouponsForPartner(
    partnerId: string,
    options?: { now?: Date },
  ): Promise<AdCoupon[]>;
  listAvailableCouponsForMember(
    input: ListAvailableCouponsForMemberInput,
  ): Promise<AvailableAdCoupon[]>;
  createCampaign(input: CreateAdCampaignInput): Promise<AdCampaign>;
  updateCampaignStatus(input: UpdateAdCampaignStatusInput): Promise<void>;
  createCoupon(input: CreateAdCouponInput): Promise<AdCoupon>;
  redeemCoupon(input: RedeemAdCouponInput): Promise<RedeemAdCouponResult>;
}
