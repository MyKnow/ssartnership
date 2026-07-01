import {
  getAdPackageDefinition,
  isAdCouponRedeemable,
  normalizeAdChannelsForTier,
  normalizeAdPackageTier,
  summarizeAdPackageMetrics,
  type AdPackageMetricEvent,
} from "@/lib/ad-packages";
import type {
  AdCampaign,
  AdCampaignWithStats,
  AdCoupon,
  AdCouponRedemption,
  AdPackageRepository,
  CreateAdCampaignInput,
  CreateAdCouponInput,
  RedeemAdCouponInput,
  RedeemAdCouponResult,
  UpdateAdCampaignStatusInput,
} from "@/lib/repositories/ad-package-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const AD_METRIC_EVENT_NAMES = [
  "home_banner_click",
  "coupon_view",
  "coupon_copy",
  "coupon_redeem",
  "ad_push_send",
] as const;

type PartnerJoin = { name?: string | null } | Array<{ name?: string | null }> | null;

type AdCampaignRow = {
  id: string;
  partner_id: string;
  package_tier: string | null;
  title: string;
  description: string | null;
  sponsor_label: string | null;
  status: string | null;
  starts_at: string;
  ends_at: string;
  channels: unknown;
  monthly_price_krw: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  partners?: PartnerJoin;
};

type AdCouponRow = {
  id: string;
  campaign_id: string | null;
  partner_id: string;
  title: string;
  description: string | null;
  code: string | null;
  redemption_type: string | null;
  discount_label: string | null;
  terms: unknown;
  status: string | null;
  starts_at: string;
  ends_at: string;
  usage_limit: number | null;
  per_member_limit: number | null;
  external_url: string | null;
  created_at: string;
  updated_at: string;
  partners?: PartnerJoin;
};

type RedemptionRow = {
  id: string;
  coupon_id: string;
  campaign_id: string | null;
  partner_id: string;
  member_id: string | null;
  session_id: string | null;
  redemption_code: string | null;
  created_at: string;
};

type EventLogRow = {
  event_name: string;
  target_type: string | null;
  target_id: string | null;
  properties: unknown;
};

function extractPartnerName(join: PartnerJoin | undefined, fallback = "제휴처") {
  const value = Array.isArray(join) ? join[0]?.name : join?.name;
  return value?.trim() || fallback;
}

function normalizeStatus<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function mapCampaignRow(row: AdCampaignRow): AdCampaign {
  const packageTier = normalizeAdPackageTier(row.package_tier);
  return {
    id: row.id,
    partnerId: row.partner_id,
    partnerName: extractPartnerName(row.partners),
    packageTier,
    title: row.title,
    description: row.description ?? "",
    sponsorLabel: row.sponsor_label ?? "",
    status: normalizeStatus(row.status, ["draft", "active", "paused", "ended"] as const, "draft"),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    channels: normalizeAdChannelsForTier(packageTier, normalizeStringArray(row.channels)),
    monthlyPriceKrw:
      typeof row.monthly_price_krw === "number"
        ? row.monthly_price_krw
        : getAdPackageDefinition(packageTier).monthlyPriceKrw,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCouponRow(row: AdCouponRow, usedCount = 0): AdCoupon {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    partnerId: row.partner_id,
    partnerName: extractPartnerName(row.partners),
    title: row.title,
    description: row.description ?? "",
    code: row.code ?? "",
    redemptionType: normalizeStatus(
      row.redemption_type,
      ["onsite", "code", "external"] as const,
      "onsite",
    ),
    discountLabel: row.discount_label ?? "",
    terms: normalizeStringArray(row.terms),
    status: normalizeStatus(row.status, ["draft", "active", "paused", "ended"] as const, "draft"),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    usageLimit: row.usage_limit,
    perMemberLimit: row.per_member_limit ?? 1,
    usedCount,
    externalUrl: row.external_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRedemptionRow(row: RedemptionRow): AdCouponRedemption {
  return {
    id: row.id,
    couponId: row.coupon_id,
    campaignId: row.campaign_id,
    partnerId: row.partner_id,
    memberId: row.member_id,
    sessionId: row.session_id,
    redemptionCode: row.redemption_code ?? "",
    createdAt: row.created_at,
  };
}

function eventLogToMetricEvent(row: EventLogRow): AdPackageMetricEvent | null {
  if (
    !AD_METRIC_EVENT_NAMES.includes(
      row.event_name as (typeof AD_METRIC_EVENT_NAMES)[number],
    )
  ) {
    return null;
  }
  const properties =
    row.properties && typeof row.properties === "object" && !Array.isArray(row.properties)
      ? (row.properties as Record<string, unknown>)
      : {};
  const campaignId =
    typeof properties.campaignId === "string"
      ? properties.campaignId
      : row.target_type === "ad_campaign"
        ? row.target_id
        : null;
  const couponId =
    typeof properties.couponId === "string"
      ? properties.couponId
      : row.target_type === "ad_coupon"
        ? row.target_id
        : null;
  return {
    eventName: row.event_name,
    campaignId,
    couponId,
  };
}

function countByKey<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "string" || !value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function isMissingAdPackageSchemaMessage(message: string, tableName: string) {
  return (
    message.includes(tableName) &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

export class SupabaseAdPackageRepository implements AdPackageRepository {
  async listAdminCampaigns(): Promise<AdCampaignWithStats[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_campaigns")
      .select(
        "id,partner_id,package_tier,title,description,sponsor_label,status,starts_at,ends_at,channels,monthly_price_krw,notes,created_at,updated_at,partners(name)",
      )
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

    const [couponResult, redemptionResult, eventResult] = await Promise.all([
      supabase
        .from("ad_coupons")
        .select(
          "id,campaign_id,partner_id,title,description,code,redemption_type,discount_label,terms,status,starts_at,ends_at,usage_limit,per_member_limit,external_url,created_at,updated_at,partners(name)",
        )
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("ad_coupon_redemptions")
        .select("coupon_id,campaign_id")
        .in("campaign_id", campaignIds)
        .eq("status", "redeemed"),
      supabase
        .from("event_logs")
        .select("event_name,target_type,target_id,properties")
        .in("event_name", [...AD_METRIC_EVENT_NAMES])
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    if (couponResult.error) {
      throw new Error(couponResult.error.message);
    }
    if (redemptionResult.error) {
      throw new Error(redemptionResult.error.message);
    }
    if (eventResult.error) {
      throw new Error(eventResult.error.message);
    }

    const redemptionRows = (redemptionResult.data ?? []) as Array<{
      coupon_id: string | null;
      campaign_id: string | null;
    }>;
    const couponUseCounts = countByKey(redemptionRows, "coupon_id");
    const campaignUseCounts = countByKey(redemptionRows, "campaign_id");
    const coupons = ((couponResult.data ?? []) as AdCouponRow[]).map((row) =>
      mapCouponRow(row, couponUseCounts.get(row.id) ?? 0),
    );
    const couponsByCampaignId = new Map<string, AdCoupon[]>();
    for (const coupon of coupons) {
      if (!coupon.campaignId) {
        continue;
      }
      couponsByCampaignId.set(coupon.campaignId, [
        ...(couponsByCampaignId.get(coupon.campaignId) ?? []),
        coupon,
      ]);
    }
    const events = ((eventResult.data ?? []) as EventLogRow[])
      .map((row) => eventLogToMetricEvent(row))
      .filter((event): event is AdPackageMetricEvent => Boolean(event))
      .filter((event) => event.campaignId && campaignIds.includes(event.campaignId));

    return campaignRows.map((row) => {
      const campaign = mapCampaignRow(row);
      return {
        ...campaign,
        coupons: couponsByCampaignId.get(campaign.id) ?? [],
        metrics: summarizeAdPackageMetrics({
          campaignId: campaign.id,
          events,
          redemptionCount: campaignUseCounts.get(campaign.id) ?? 0,
        }),
      };
    });
  }

  async listActiveCouponsForPartner(
    partnerId: string,
    options?: { now?: Date },
  ): Promise<AdCoupon[]> {
    const now = options?.now ?? new Date();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_coupons")
      .select(
        "id,campaign_id,partner_id,title,description,code,redemption_type,discount_label,terms,status,starts_at,ends_at,usage_limit,per_member_limit,external_url,created_at,updated_at,partners(name)",
      )
      .eq("partner_id", partnerId)
      .eq("status", "active")
      .lte("starts_at", now.toISOString())
      .gte("ends_at", now.toISOString())
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingAdPackageSchemaMessage(error.message, "ad_coupons")) {
        return [];
      }
      throw new Error(error.message);
    }

    const rows = (data ?? []) as AdCouponRow[];
    const couponIds = rows.map((row) => row.id);
    const campaignIds = rows
      .map((row) => row.campaign_id)
      .filter((id): id is string => Boolean(id));

    const [redemptionResult, campaignResult] = await Promise.all([
      couponIds.length > 0
        ? supabase
            .from("ad_coupon_redemptions")
            .select("coupon_id")
            .in("coupon_id", couponIds)
            .eq("status", "redeemed")
        : Promise.resolve({ data: [], error: null }),
      campaignIds.length > 0
        ? supabase
            .from("ad_campaigns")
            .select(
              "id,partner_id,package_tier,title,description,sponsor_label,status,starts_at,ends_at,channels,monthly_price_krw,notes,created_at,updated_at,partners(name)",
            )
            .in("id", campaignIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (redemptionResult.error) {
      throw new Error(redemptionResult.error.message);
    }
    if (campaignResult.error) {
      throw new Error(campaignResult.error.message);
    }

    const useCounts = countByKey(
      (redemptionResult.data ?? []) as Array<{ coupon_id: string | null }>,
      "coupon_id",
    );
    const campaignsById = new Map(
      ((campaignResult.data ?? []) as AdCampaignRow[]).map((row) => [
        row.id,
        mapCampaignRow(row),
      ]),
    );

    return rows
      .map((row) => mapCouponRow(row, useCounts.get(row.id) ?? 0))
      .filter((coupon) =>
        isAdCouponRedeemable({
          coupon,
          campaign: coupon.campaignId ? campaignsById.get(coupon.campaignId) : null,
          now,
        }),
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

  async updateCampaignStatus(input: UpdateAdCampaignStatusInput): Promise<void> {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("ad_campaigns")
      .update({ status: input.status })
      .eq("id", input.campaignId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async createCoupon(input: CreateAdCouponInput): Promise<AdCoupon> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_coupons")
      .insert({
        campaign_id: input.campaignId ?? null,
        partner_id: input.partnerId,
        title: input.title,
        description: input.description ?? "",
        code: input.code ?? "",
        redemption_type: input.redemptionType ?? "onsite",
        discount_label: input.discountLabel ?? "",
        terms: input.terms ?? [],
        status: input.status ?? "draft",
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        usage_limit: input.usageLimit ?? null,
        per_member_limit: input.perMemberLimit ?? 1,
        external_url: input.externalUrl ?? "",
      })
      .select(
        "id,campaign_id,partner_id,title,description,code,redemption_type,discount_label,terms,status,starts_at,ends_at,usage_limit,per_member_limit,external_url,created_at,updated_at,partners(name)",
      )
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapCouponRow(data as AdCouponRow);
  }

  async redeemCoupon(input: RedeemAdCouponInput): Promise<RedeemAdCouponResult> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_coupons")
      .select(
        "id,campaign_id,partner_id,title,description,code,redemption_type,discount_label,terms,status,starts_at,ends_at,usage_limit,per_member_limit,external_url,created_at,updated_at,partners(name)",
      )
      .eq("id", input.couponId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return {
        ok: false,
        reason: "not_found",
        message: "쿠폰을 찾을 수 없습니다.",
      };
    }

    const row = data as AdCouponRow;
    const [redemptionResult, campaignResult, memberResult] = await Promise.all([
      supabase
        .from("ad_coupon_redemptions")
        .select("id,member_id")
        .eq("coupon_id", row.id)
        .eq("status", "redeemed"),
      row.campaign_id
        ? supabase
            .from("ad_campaigns")
            .select(
              "id,partner_id,package_tier,title,description,sponsor_label,status,starts_at,ends_at,channels,monthly_price_krw,notes,created_at,updated_at,partners(name)",
            )
            .eq("id", row.campaign_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      input.memberId
        ? supabase.from("members").select("id").eq("id", input.memberId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (redemptionResult.error) {
      throw new Error(redemptionResult.error.message);
    }
    if (campaignResult.error) {
      throw new Error(campaignResult.error.message);
    }
    if (memberResult.error) {
      throw new Error(memberResult.error.message);
    }
    if (input.memberId && !memberResult.data) {
      return {
        ok: false,
        reason: "invalid",
        message: "회원 정보를 확인할 수 없습니다.",
      };
    }

    const redeemedRows = (redemptionResult.data ?? []) as Array<{
      id: string;
      member_id: string | null;
    }>;
    const coupon = mapCouponRow(row, redeemedRows.length);
    const campaign = campaignResult.data
      ? mapCampaignRow(campaignResult.data as AdCampaignRow)
      : null;
    if (!isAdCouponRedeemable({ coupon, campaign })) {
      return {
        ok: false,
        reason:
          coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit
            ? "usage_limit"
            : "inactive",
        message: "현재 사용할 수 없는 쿠폰입니다.",
        coupon,
      };
    }

    if (
      input.memberId &&
      redeemedRows.filter((item) => item.member_id === input.memberId).length >=
        coupon.perMemberLimit
    ) {
      return {
        ok: false,
        reason: "member_limit",
        message: "이미 사용할 수 있는 횟수를 모두 사용했습니다.",
        coupon,
      };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("ad_coupon_redemptions")
      .insert({
        coupon_id: coupon.id,
        campaign_id: coupon.campaignId,
        partner_id: coupon.partnerId,
        member_id: input.memberId ?? null,
        session_id: input.sessionId ?? null,
        redemption_code: coupon.code,
        metadata: input.metadata ?? {},
      })
      .select(
        "id,coupon_id,campaign_id,partner_id,member_id,session_id,redemption_code,created_at",
      )
      .single();
    if (insertError) {
      throw new Error(insertError.message);
    }

    return {
      ok: true,
      coupon: {
        ...coupon,
        usedCount: coupon.usedCount + 1,
      },
      redemption: mapRedemptionRow(inserted as RedemptionRow),
    };
  }
}
