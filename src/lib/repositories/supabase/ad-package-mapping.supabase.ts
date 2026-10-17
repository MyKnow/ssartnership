import {
  getAdPackageDefinition,
  normalizeAdChannelsForTier,
  normalizeAdPackageTier,
  type AdPackageMetrics,
  type AdCouponIssuanceType,
} from "@/lib/ad-packages";
import type {
  AdCampaign,
  AdCampaignWithStats,
  AdCoupon,
} from "@/lib/repositories/ad-package-repository";
import type { Database } from "@/lib/supabase/database.generated";

export const AD_COUPON_SELECT =
  "id,campaign_id,partner_id,title,description,code,issuance_type,redemption_type,discount_label,terms,status,starts_at,ends_at,download_starts_at,download_ends_at,usage_starts_at,usage_ends_at,usage_limit,daily_issue_limit,weekly_issue_limit,monthly_issue_limit,per_member_daily_issue_limit,per_member_weekly_issue_limit,per_member_monthly_issue_limit,per_member_limit,onsite_password_hash,onsite_password_salt,external_url,created_at,updated_at,partners(name)";
type PartnerProjection = Pick<Database["public"]["Tables"]["partners"]["Row"], "name">;
type CompatiblePartnerProjection = { name?: PartnerProjection["name"] | null };
export type PartnerJoin = CompatiblePartnerProjection | CompatiblePartnerProjection[] | null;

export type AdCampaignRow = {
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

type CouponTableRow = Database["public"]["Tables"]["ad_coupons"]["Row"];
type LegacyNullableCouponColumn =
  | "description" | "code" | "issuance_type" | "redemption_type" | "discount_label"
  | "status" | "download_starts_at" | "download_ends_at" | "usage_starts_at" | "usage_ends_at"
  | "per_member_limit" | "external_url";

// The generated current schema is the field/type source. Older read paths still
// tolerate nullable window/default fields and sanitize JSON-like terms.
export type AdCouponRow = {
  [Key in keyof CouponTableRow]: Key extends LegacyNullableCouponColumn
    ? CouponTableRow[Key] | null
    : Key extends "terms" ? unknown : CouponTableRow[Key];
} & { partners?: PartnerJoin };

export type AdCampaignMetricRow = {
  campaign_id: string;
  home_banner_clicks: number | string | null;
  coupon_views: number | string | null;
  coupon_copies: number | string | null;
  coupon_intent_count: number | string | null;
  coupon_redemptions: number | string | null;
  ad_push_sends: number | string | null;
  coupon_redemption_counts: unknown;
};

export function extractPartnerName(join: PartnerJoin | undefined, fallback = "제휴처") {
  const value = Array.isArray(join) ? join[0]?.name : join?.name;
  return value?.trim() || fallback;
}

export function normalizeStatus<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function mapCampaignRow(row: AdCampaignRow): AdCampaign {
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

export function mapCouponRow(row: AdCouponRow, usedCount = 0): AdCoupon {
  const downloadStartsAt = row.download_starts_at ?? row.starts_at;
  const downloadEndsAt = row.download_ends_at ?? row.ends_at;
  const usageStartsAt = row.usage_starts_at ?? row.starts_at;
  const usageEndsAt = row.usage_ends_at ?? row.ends_at;
  const issuanceType = normalizeStatus<AdCouponIssuanceType>(
    row.issuance_type,
    ["service", "partner_code_pool"],
    "service",
  );
  return {
    id: row.id,
    campaignId: row.campaign_id,
    partnerId: row.partner_id,
    partnerName: extractPartnerName(row.partners),
    title: row.title,
    description: row.description ?? "",
    code: row.code ?? "",
    issuanceType,
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
    downloadStartsAt,
    downloadEndsAt,
    usageStartsAt,
    usageEndsAt,
    usageLimit: row.usage_limit,
    dailyIssueLimit: row.daily_issue_limit,
    weeklyIssueLimit: row.weekly_issue_limit,
    monthlyIssueLimit: row.monthly_issue_limit,
    perMemberDailyIssueLimit: row.per_member_daily_issue_limit,
    perMemberWeeklyIssueLimit: row.per_member_weekly_issue_limit,
    perMemberMonthlyIssueLimit: row.per_member_monthly_issue_limit,
    issuedCount: 0,
    remainingIssueCount: null,
    perMemberLimit: row.per_member_limit ?? 1,
    hasOnsitePassword: Boolean(row.onsite_password_hash && row.onsite_password_salt),
    usedCount,
    externalUrl: row.external_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function countByKey<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
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

export function normalizeAdMetricCount(value: number | string | null) {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) && count >= 0
    ? Math.min(Math.floor(count), Number.MAX_SAFE_INTEGER)
    : 0;
}

export function mapAdCampaignMetricRow(row: AdCampaignMetricRow): AdPackageMetrics {
  return {
    homeBannerClicks: normalizeAdMetricCount(row.home_banner_clicks),
    couponViews: normalizeAdMetricCount(row.coupon_views),
    couponCopies: normalizeAdMetricCount(row.coupon_copies),
    couponIntentCount: normalizeAdMetricCount(row.coupon_intent_count),
    couponRedemptions: normalizeAdMetricCount(row.coupon_redemptions),
    adPushSends: normalizeAdMetricCount(row.ad_push_sends),
  };
}

export function mapCouponRedemptionCounts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [] as Array<[string, number]>;
  }

  return Object.entries(value).flatMap(([couponId, count]) => {
    if (!couponId) {
      return [];
    }
    return [[couponId, normalizeAdMetricCount(count as number | string | null)]] as Array<
      [string, number]
    >;
  });
}

export function mapAdminCampaignRows(
  campaignRows: AdCampaignRow[],
  couponRows: AdCouponRow[],
  metricRows: AdCampaignMetricRow[],
): AdCampaignWithStats[] {
  const metricsByCampaignId = new Map<string, AdPackageMetrics>();
  const couponUseCounts = new Map<string, number>();
  for (const row of metricRows) {
    metricsByCampaignId.set(row.campaign_id, mapAdCampaignMetricRow(row));
    for (const [couponId, count] of mapCouponRedemptionCounts(
      row.coupon_redemption_counts,
    )) {
      couponUseCounts.set(couponId, count);
    }
  }

  const couponsByCampaignId = new Map<string, AdCoupon[]>();
  for (const row of couponRows) {
    const coupon = mapCouponRow(row, couponUseCounts.get(row.id) ?? 0);
    if (!coupon.campaignId) {
      continue;
    }
    const campaignCoupons = couponsByCampaignId.get(coupon.campaignId) ?? [];
    campaignCoupons.push(coupon);
    couponsByCampaignId.set(coupon.campaignId, campaignCoupons);
  }

  return campaignRows.map((row) => {
    const campaign = mapCampaignRow(row);
    return {
      ...campaign,
      coupons: couponsByCampaignId.get(campaign.id) ?? [],
      metrics: metricsByCampaignId.get(campaign.id) ?? {
        homeBannerClicks: 0,
        couponViews: 0,
        couponCopies: 0,
        couponIntentCount: 0,
        couponRedemptions: 0,
        adPushSends: 0,
      },
    };
  });
}

export function isMissingAdPackageSchemaMessage(message: string, tableName: string) {
  return (
    message.includes(tableName) &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}
