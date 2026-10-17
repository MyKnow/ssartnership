import {
  AD_CAMPAIGN_STATUSES,
  canTransitionAdCampaignStatus,
  getAdPackageDefinition,
  normalizeAdChannelsForTier,
} from "@/lib/ad-packages";
import {
  toAdCampaignOption,
  type AdCampaign,
  type AdCampaignWithStats,
  type AdPackageRepository,
  type CreateAdCampaignInput,
  type PreparedAdminCampaigns,
  type UpdateAdCampaignStatusInput,
  type UpdateAdCampaignStatusResult,
} from "@/lib/repositories/ad-package-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  AD_COUPON_SELECT,
  isMissingAdPackageSchemaMessage,
  mapAdminCampaignRows,
  mapCampaignRow,
  normalizeStatus,
  type AdCampaignRow,
  type AdCampaignMetricRow,
  type AdCouponRow,
} from "./ad-package-mapping.supabase";

export class SupabaseAdCampaignOperations
  implements Pick<
    AdPackageRepository,
    "prepareAdminCampaigns"
    | "listAdminCampaigns"
    | "listAdminCampaignsForPartner"
    | "createCampaign"
    | "updateCampaignStatus"
  >
{
  async prepareAdminCampaigns(): Promise<PreparedAdminCampaigns> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_campaigns")
      .select(
        "id,partner_id,package_tier,title,description,sponsor_label,status,starts_at,ends_at,channels,monthly_price_krw,notes,created_at,updated_at,partners(name)",
      )
      .order("updated_at", { ascending: false });
    if (error) {
      if (isMissingAdPackageSchemaMessage(error.message, "ad_campaigns")) {
        return { options: [], campaigns: Promise.resolve([]) };
      }
      throw new Error(error.message);
    }

    const campaignRows = (data ?? []) as AdCampaignRow[];
    const campaignIds = campaignRows.map((row) => row.id);
    if (campaignIds.length === 0) {
      return { options: [], campaigns: Promise.resolve([]) };
    }

    const campaigns = Promise.all([
      supabase
        .from("ad_coupons")
        .select(AD_COUPON_SELECT)
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false }),
      supabase.rpc("get_admin_ad_campaign_rollups", {
        input_partner_id: null,
      }),
    ]).then(([couponResult, metricsResult]) => {
      if (couponResult.error) {
        throw new Error(couponResult.error.message);
      }
      if (metricsResult.error) {
        throw new Error(metricsResult.error.message);
      }
      return mapAdminCampaignRows(
        campaignRows,
        (couponResult.data ?? []) as AdCouponRow[],
        (metricsResult.data ?? []) as AdCampaignMetricRow[],
      );
    });

    return {
      options: campaignRows.map(mapCampaignRow).map(toAdCampaignOption),
      campaigns,
    };
  }

  async listAdminCampaigns(): Promise<AdCampaignWithStats[]> {
    const prepared = await this.prepareAdminCampaigns();
    return prepared.campaigns;
  }

  async listAdminCampaignsForPartner(
    partnerId: string,
  ): Promise<AdCampaignWithStats[]> {
    if (!partnerId) {
      return [];
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_campaigns")
      .select(
        "id,partner_id,package_tier,title,description,sponsor_label,status,starts_at,ends_at,channels,monthly_price_krw,notes,created_at,updated_at,partners(name)",
      )
      .eq("partner_id", partnerId)
      .order("updated_at", { ascending: false });
    if (error) {
      if (isMissingAdPackageSchemaMessage(error.message, "ad_campaigns")) {
        return [];
      }
      throw new Error(error.message);
    }

    const campaignRows = (data ?? []) as AdCampaignRow[];
    const campaignIds = campaignRows.map((row) => row.id);
    if (campaignIds.length === 0) {
      return [];
    }

    const [couponResult, metricsResult] = await Promise.all([
      supabase
        .from("ad_coupons")
        .select(AD_COUPON_SELECT)
        .eq("partner_id", partnerId)
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false }),
      supabase.rpc("get_admin_ad_campaign_rollups", {
        input_partner_id: partnerId,
      }),
    ]);
    if (couponResult.error) {
      throw new Error(couponResult.error.message);
    }
    if (metricsResult.error) {
      throw new Error(metricsResult.error.message);
    }

    return mapAdminCampaignRows(
      campaignRows,
      (couponResult.data ?? []) as AdCouponRow[],
      (metricsResult.data ?? []) as AdCampaignMetricRow[],
    );
  }

  async createCampaign(input: CreateAdCampaignInput): Promise<AdCampaign> {
    const supabase = getSupabaseAdminClient();
    const channels = normalizeAdChannelsForTier(input.packageTier, input.channels);
    const definition = getAdPackageDefinition(input.packageTier);
    const { data, error } = await supabase
      .from("ad_campaigns")
      .insert({
        partner_id: input.partnerId,
        package_tier: input.packageTier,
        title: input.title,
        description: input.description ?? "",
        sponsor_label: input.sponsorLabel ?? "",
        status: input.status ?? "draft",
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        channels,
        monthly_price_krw: input.monthlyPriceKrw ?? definition.monthlyPriceKrw,
        notes: input.notes ?? "",
        created_by_admin_id: input.createdByAdminId ?? null,
      })
      .select(
        "id,partner_id,package_tier,title,description,sponsor_label,status,starts_at,ends_at,channels,monthly_price_krw,notes,created_at,updated_at,partners(name)",
      )
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapCampaignRow(data as AdCampaignRow);
  }

  async updateCampaignStatus(
    input: UpdateAdCampaignStatusInput,
  ): Promise<UpdateAdCampaignStatusResult> {
    const supabase = getSupabaseAdminClient();
    const { data: currentRow, error: currentError } = await supabase
      .from("ad_campaigns")
      .select("status")
      .eq("id", input.campaignId)
      .maybeSingle();
    if (currentError) {
      throw new Error(currentError.message);
    }
    if (!currentRow) {
      return { ok: false, reason: "not_found" };
    }
    const from = normalizeStatus(
      (currentRow as { status: string | null }).status,
      AD_CAMPAIGN_STATUSES,
      "draft",
    );
    if (!canTransitionAdCampaignStatus(from, input.status)) {
      return { ok: false, reason: "invalid_transition", from };
    }
    if (from === input.status) {
      return { ok: true };
    }
    // Compare-and-set on the status that was validated above.
    const { data, error } = await supabase
      .from("ad_campaigns")
      .update({ status: input.status })
      .eq("id", input.campaignId)
      .eq("status", from)
      .select("id");
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).length > 0
      ? { ok: true }
      : { ok: false, reason: "state_changed", from };
  }
}
