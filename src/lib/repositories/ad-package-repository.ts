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

export type AdCampaignOption = {
  id: string;
  partnerId: string;
  label: string;
};

export type PreparedAdminCampaigns = {
  options: AdCampaignOption[];
  campaigns: Promise<AdCampaignWithStats[]>;
};

export function toAdCampaignOption(
  campaign: Pick<
    AdCampaign,
    "id" | "partnerId" | "partnerName" | "sponsorLabel" | "title"
  >,
): AdCampaignOption {
  const sponsor =
    campaign.sponsorLabel.trim() || campaign.partnerName.trim() || "제휴처";
  return {
    id: campaign.id,
    partnerId: campaign.partnerId,
    label: `${sponsor} · ${campaign.title}`,
  };
}

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

export type DeleteAdCouponResult =
  | { ok: true }
  /** Issue or redemption rows exist; end the coupon instead of deleting it. */
  | { ok: false; reason: "usage_history" }
  /** Still downloadable; pause or end it first (see AD_COUPON_DELETABLE_STATUSES). */
  | { ok: false; reason: "active" }
  /** The coupon changed after it was checked (for example re-activated); nothing was deleted. */
  | { ok: false; reason: "state_changed" };

export type UpdateAdCampaignStatusResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_found" | "invalid_transition" | "state_changed";
      from?: AdCampaignStatus;
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
  /** Shares one base campaign read between eager options and deferred stats. */
  prepareAdminCampaigns(): Promise<PreparedAdminCampaigns>;
  listAdminCampaigns(): Promise<AdCampaignWithStats[]>;
  listAdminCampaignsForPartner(partnerId: string): Promise<AdCampaignWithStats[]>;
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
  /**
   * Applies `AD_CAMPAIGN_STATUS_TRANSITIONS` against the stored status with a
   * compare-and-set write, so a concurrent change reports `state_changed`.
   */
  updateCampaignStatus(
    input: UpdateAdCampaignStatusInput,
  ): Promise<UpdateAdCampaignStatusResult>;
  createCoupon(input: CreateAdCouponInput): Promise<AdCoupon>;
  /**
   * Re-checks `AD_COUPON_STATUS_TRANSITIONS` against the stored status
   * (`AdStatusTransitionError`) and writes only while that status is
   * unchanged; a concurrent change throws `AD_COUPON_STATE_CHANGED_ERROR`.
   */
  updateCoupon(input: UpdateAdCouponInput): Promise<AdCoupon>;
  duplicateCoupon(input: DuplicateAdCouponInput): Promise<AdCoupon>;
  /**
   * Deletes only a non-active coupon without issue or redemption history, and
   * only if the row is unchanged since that check (`state_changed` otherwise).
   */
  deleteCoupon(couponId: string): Promise<DeleteAdCouponResult>;
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
  partnerIds?: string[];
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
        | "usage_limit"
        | "member_limit"
        | "onsite_password_required"
        | "onsite_password_invalid"
        | "invalid";
      message: string;
    };
