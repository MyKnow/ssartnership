import type {
  AdCampaignStatus,
  AdChannel,
  AdCouponRedemptionType,
  AdCouponIssuanceType,
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
  issuanceType: AdCouponIssuanceType;
  redemptionType: AdCouponRedemptionType;
  discountLabel: string;
  terms: string[];
  status: AdCouponStatus;
  startsAt: string;
  endsAt: string;
  downloadStartsAt: string;
  downloadEndsAt: string;
  usageStartsAt: string;
  usageEndsAt: string;
  usageLimit: number | null;
  dailyIssueLimit: number | null;
  weeklyIssueLimit: number | null;
  monthlyIssueLimit: number | null;
  perMemberDailyIssueLimit: number | null;
  perMemberWeeklyIssueLimit: number | null;
  perMemberMonthlyIssueLimit: number | null;
  issuedCount: number;
  remainingIssueCount: number | null;
  perMemberLimit: number;
  hasOnsitePassword: boolean;
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
  issuanceType?: AdCouponIssuanceType;
  redemptionType?: AdCouponRedemptionType;
  discountLabel?: string;
  terms?: string[];
  status?: AdCouponStatus;
  startsAt: string;
  endsAt: string;
  downloadStartsAt?: string;
  downloadEndsAt?: string;
  usageStartsAt?: string;
  usageEndsAt?: string;
  usageLimit?: number | null;
  dailyIssueLimit?: number | null;
  weeklyIssueLimit?: number | null;
  monthlyIssueLimit?: number | null;
  perMemberDailyIssueLimit?: number | null;
  perMemberWeeklyIssueLimit?: number | null;
  perMemberMonthlyIssueLimit?: number | null;
  perMemberLimit?: number;
  /** Plaintext is accepted only transiently at the server-action boundary. */
  onsitePassword?: string | null;
  externalUrl?: string;
};

export type UpdateAdCouponInput = CreateAdCouponInput & {
  couponId: string;
};

export type DuplicateAdCouponInput = {
  couponId: string;
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
  issueId?: string | null;
  assignedCode?: string | null;
  issuedAt?: string | null;
  usedAt?: string | null;
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
        | "onsite_verification_required"
        | "invalid";
      message: string;
      coupon?: AdCoupon | null;
    };

export interface AdPackageRepository {
  listAdminCampaigns(options?: { now?: Date }): Promise<AdCampaignWithStats[]>;
  listAdminCouponsForPartner(partnerId: string): Promise<AdCoupon[]>;
  getAdminCouponById(couponId: string): Promise<AdCoupon | null>;
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
  updateCoupon(input: UpdateAdCouponInput): Promise<AdCoupon>;
  duplicateCoupon(input: DuplicateAdCouponInput): Promise<AdCoupon>;
  deleteCoupon(couponId: string): Promise<void>;
  issueCoupon(input: IssueAdCouponInput): Promise<IssueAdCouponResult>;
  listIssuedCouponsForMember(input: ListIssuedCouponsForMemberInput): Promise<AvailableAdCoupon[]>;
  addCouponCodes(input: AddAdCouponCodesInput): Promise<AddAdCouponCodesResult>;
  redeemCoupon(input: RedeemAdCouponInput): Promise<RedeemAdCouponResult>;
  redeemCouponIssue(input: RedeemAdCouponIssueInput): Promise<RedeemAdCouponIssueResult>;
}

export type IssueAdCouponInput = {
  couponId: string;
  memberId: string;
  sessionId?: string | null;
};

export type IssueAdCouponResult =
  | {
      ok: true;
      issue: AvailableAdCoupon;
    }
  | {
      ok: false;
      reason: "not_found" | "inactive" | "member_limit" | "usage_limit" | "code_unavailable" | "invalid";
      message: string;
    };

export type ListIssuedCouponsForMemberInput = {
  memberId: string;
  now?: Date;
};

export type AddAdCouponCodesInput = {
  couponId: string;
  codes: string[];
};

export type AddAdCouponCodesResult = {
  addedCount: number;
  skippedCount: number;
};

export type RedeemAdCouponIssueInput = {
  issueId: string;
  memberId: string;
  sessionId?: string | null;
  onsitePassword?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RedeemAdCouponIssueResult =
  | {
      ok: true;
      couponId: string;
      issueId: string;
      assignedCode: string | null;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "inactive"
        | "expired"
        | "onsite_password_required"
        | "onsite_password_invalid"
        | "invalid";
      message: string;
    };
