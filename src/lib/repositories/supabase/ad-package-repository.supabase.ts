import type {
  AdCampaign,
  AdCampaignWithStats,
  AdCoupon,
  AddAdCouponCodesInput,
  AddAdCouponCodesResult,
  AdPackageRepository,
  AvailableAdCoupon,
  CreateAdCampaignInput,
  CreateAdCouponInput,
  DeleteAdCouponResult,
  DuplicateAdCouponInput,
  IssueAdCouponInput,
  IssueAdCouponResult,
  ListAvailableCouponsForMemberInput,
  ListIssuedCouponsForMemberInput,
  PreparedAdminCampaigns,
  RedeemAdCouponIssueInput,
  RedeemAdCouponIssueResult,
  UpdateAdCampaignStatusInput,
  UpdateAdCampaignStatusResult,
  UpdateAdCouponInput,
} from "@/lib/repositories/ad-package-repository";
import { SupabaseAdCampaignOperations } from "./ad-package-campaigns.supabase";
import { SupabaseAdCouponCatalogOperations } from "./ad-package-coupon-catalog.supabase";
import { SupabaseAdCouponIssueOperations } from "./ad-package-coupon-issues.supabase";

export class SupabaseAdPackageRepository implements AdPackageRepository {
  private readonly campaigns = new SupabaseAdCampaignOperations();
  private readonly coupons = new SupabaseAdCouponCatalogOperations();
  private readonly issues = new SupabaseAdCouponIssueOperations();

  async prepareAdminCampaigns(): Promise<PreparedAdminCampaigns> {
    return this.campaigns.prepareAdminCampaigns();
  }

  async listAdminCampaigns(): Promise<AdCampaignWithStats[]> {
    return this.campaigns.listAdminCampaigns();
  }

  async listAdminCampaignsForPartner(
    partnerId: string,
  ): Promise<AdCampaignWithStats[]> {
    return this.campaigns.listAdminCampaignsForPartner(partnerId);
  }

  async listAdminCouponsForPartner(partnerId: string): Promise<AdCoupon[]> {
    return this.coupons.listAdminCouponsForPartner(partnerId);
  }

  async getAdminCouponById(couponId: string): Promise<AdCoupon | null> {
    return this.coupons.getAdminCouponById(couponId);
  }

  async listActiveCouponsForPartner(
    partnerId: string,
    options?: { now?: Date },
  ): Promise<AdCoupon[]> {
    return this.coupons.listActiveCouponsForPartner(partnerId, options);
  }

  async listAvailableCouponsForMember(
    input: ListAvailableCouponsForMemberInput,
  ): Promise<AvailableAdCoupon[]> {
    return this.coupons.listAvailableCouponsForMember(input);
  }

  async createCampaign(input: CreateAdCampaignInput): Promise<AdCampaign> {
    return this.campaigns.createCampaign(input);
  }

  async updateCampaignStatus(
    input: UpdateAdCampaignStatusInput,
  ): Promise<UpdateAdCampaignStatusResult> {
    return this.campaigns.updateCampaignStatus(input);
  }

  async createCoupon(input: CreateAdCouponInput): Promise<AdCoupon> {
    return this.coupons.createCoupon(input);
  }

  async updateCoupon(input: UpdateAdCouponInput): Promise<AdCoupon> {
    return this.coupons.updateCoupon(input);
  }

  async duplicateCoupon(input: DuplicateAdCouponInput): Promise<AdCoupon> {
    return this.coupons.duplicateCoupon(input);
  }

  async deleteCoupon(couponId: string): Promise<DeleteAdCouponResult> {
    return this.coupons.deleteCoupon(couponId);
  }

  async issueCoupon(input: IssueAdCouponInput): Promise<IssueAdCouponResult> {
    return this.issues.issueCoupon(input);
  }

  async listIssuedCouponsForMember(
    input: ListIssuedCouponsForMemberInput,
  ): Promise<AvailableAdCoupon[]> {
    return this.issues.listIssuedCouponsForMember(input);
  }

  async addCouponCodes(input: AddAdCouponCodesInput): Promise<AddAdCouponCodesResult> {
    return this.issues.addCouponCodes(input);
  }

  async redeemCouponIssue(
    input: RedeemAdCouponIssueInput,
  ): Promise<RedeemAdCouponIssueResult> {
    return this.issues.redeemCouponIssue(input);
  }
}
