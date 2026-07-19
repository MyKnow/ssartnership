import {
  getAdPackageDefinition,
  isAdCouponDownloadable,
  isAdCouponRedeemable,
  normalizeAdChannelsForTier,
  normalizeAdPackageTier,
  summarizeAdPackageMetrics,
  type AdPackageMetricEvent,
  type AdCouponIssuanceType,
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
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const AD_METRIC_EVENT_NAMES = [
  "home_banner_click",
  "coupon_view",
  "coupon_copy",
  "coupon_redeem",
  "ad_push_send",
] as const;

const AD_COUPON_SELECT =
  "id,campaign_id,partner_id,title,description,code,issuance_type,redemption_type,discount_label,terms,status,starts_at,ends_at,download_starts_at,download_ends_at,usage_starts_at,usage_ends_at,usage_limit,daily_issue_limit,weekly_issue_limit,monthly_issue_limit,per_member_daily_issue_limit,per_member_weekly_issue_limit,per_member_monthly_issue_limit,per_member_limit,onsite_password_hash,onsite_password_salt,external_url,created_at,updated_at,partners(name)";

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
  issuance_type: string | null;
  redemption_type: string | null;
  discount_label: string | null;
  terms: unknown;
  status: string | null;
  starts_at: string;
  ends_at: string;
  download_starts_at: string | null;
  download_ends_at: string | null;
  usage_starts_at: string | null;
  usage_ends_at: string | null;
  usage_limit: number | null;
  daily_issue_limit: number | null;
  weekly_issue_limit: number | null;
  monthly_issue_limit: number | null;
  per_member_daily_issue_limit: number | null;
  per_member_weekly_issue_limit: number | null;
  per_member_monthly_issue_limit: number | null;
  per_member_limit: number | null;
  onsite_password_hash: string | null;
  onsite_password_salt: string | null;
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

type CouponIssueRow = {
  id: string;
  coupon_id: string;
  member_id: string;
  assigned_code: string | null;
  issued_at: string;
  used_at: string | null;
};

type CouponIssueVerificationRow = {
  id: string;
  coupon_id: string;
  member_id: string;
  assigned_code: string | null;
  redemption_type_snapshot: string;
  onsite_password_hash_snapshot: string | null;
  onsite_password_salt_snapshot: string | null;
  status: string;
  usage_starts_at: string;
  usage_ends_at: string;
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
    coupon,
    memberUsedCount,
    remainingMemberUses,
    remainingGlobalUses,
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
        .select(AD_COUPON_SELECT)
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

  async listAdminCouponsForPartner(partnerId: string): Promise<AdCoupon[]> {
    if (!partnerId) {
      return [];
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_coupons")
      .select(AD_COUPON_SELECT)
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingAdPackageSchemaMessage(error.message, "ad_coupons")) {
        return [];
      }
      throw new Error(error.message);
    }

    const rows = (data ?? []) as AdCouponRow[];
    const couponIds = rows.map((row) => row.id);
    if (couponIds.length === 0) {
      return [];
    }

    const { data: redemptionData, error: redemptionError } = await supabase
      .from("ad_coupon_redemptions")
      .select("coupon_id")
      .in("coupon_id", couponIds)
      .eq("status", "redeemed");
    if (redemptionError) {
      throw new Error(redemptionError.message);
    }

    const redemptionCounts = countByKey(
      (redemptionData ?? []) as Array<{ coupon_id: string | null }>,
      "coupon_id",
    );
    return rows.map((row) =>
      mapCouponRow(row, redemptionCounts.get(row.id) ?? 0),
    );
  }

  async listActiveCouponsForPartner(
    partnerId: string,
    options?: { now?: Date },
  ): Promise<AdCoupon[]> {
    const now = options?.now ?? new Date();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_coupons")
      .select(AD_COUPON_SELECT)
      .eq("partner_id", partnerId)
      .eq("status", "active")
      .lte("download_starts_at", now.toISOString())
      .gte("download_ends_at", now.toISOString())
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
        isAdCouponDownloadable({
          coupon,
          campaign: coupon.campaignId ? campaignsById.get(coupon.campaignId) : null,
          now,
        }),
      );
  }

  async listAvailableCouponsForMember(
    input: ListAvailableCouponsForMemberInput,
  ): Promise<AvailableAdCoupon[]> {
    const partnerIds = [...new Set(input.partnerIds.filter(Boolean))];
    if (!input.memberId || partnerIds.length === 0) {
      return [];
    }

    const now = input.now ?? new Date();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_coupons")
      .select(AD_COUPON_SELECT)
      .in("partner_id", partnerIds)
      .eq("status", "active")
      .lte("download_starts_at", now.toISOString())
      .gte("download_ends_at", now.toISOString())
      .order("download_ends_at", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingAdPackageSchemaMessage(error.message, "ad_coupons")) {
        return [];
      }
      throw new Error(error.message);
    }

    const rows = (data ?? []) as AdCouponRow[];
    const couponIds = rows.map((row) => row.id);
    if (couponIds.length === 0) {
      return [];
    }

    const campaignIds = rows
      .map((row) => row.campaign_id)
      .filter((id): id is string => Boolean(id));
    const [redemptionResult, campaignResult, memberIssueResult] = await Promise.all([
      supabase
        .from("ad_coupon_redemptions")
        .select("coupon_id,member_id")
        .in("coupon_id", couponIds)
        .eq("status", "redeemed"),
      campaignIds.length > 0
        ? supabase
            .from("ad_campaigns")
            .select(
              "id,partner_id,package_tier,title,description,sponsor_label,status,starts_at,ends_at,channels,monthly_price_krw,notes,created_at,updated_at,partners(name)",
            )
            .in("id", campaignIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("ad_coupon_issues")
        .select("coupon_id,issued_at")
        .in("coupon_id", couponIds)
        .eq("member_id", input.memberId),
    ]);
    if (redemptionResult.error) {
      throw new Error(redemptionResult.error.message);
    }
    if (campaignResult.error) {
      throw new Error(campaignResult.error.message);
    }
    if (memberIssueResult.error) {
      throw new Error(memberIssueResult.error.message);
    }

    const redemptionRows = (redemptionResult.data ?? []) as Array<{
      coupon_id: string | null;
      member_id: string | null;
    }>;
    const useCounts = countByKey(redemptionRows, "coupon_id");
    const memberUseCounts = countByKey(
      redemptionRows.filter((row) => row.member_id === input.memberId),
      "coupon_id",
    );
    const memberIssueRows = (memberIssueResult.data ?? []) as Array<{
      coupon_id: string;
      issued_at: string;
    }>;
    const memberIssueRecordsByCoupon = new Map<string, Array<{
      couponId: string;
      memberId: string;
      issuedAt: string;
    }>>();
    for (const row of memberIssueRows) {
      memberIssueRecordsByCoupon.set(row.coupon_id, [
        ...(memberIssueRecordsByCoupon.get(row.coupon_id) ?? []),
        {
          couponId: row.coupon_id,
          memberId: input.memberId,
          issuedAt: row.issued_at,
        },
      ]);
    }
    const campaignsById = new Map(
      ((campaignResult.data ?? []) as AdCampaignRow[]).map((row) => [
        row.id,
        mapCampaignRow(row),
      ]),
    );

    return rows
      .map((row) => {
        const coupon = mapCouponRow(row, useCounts.get(row.id) ?? 0);
        return {
          coupon,
          campaign: coupon.campaignId ? campaignsById.get(coupon.campaignId) : null,
          memberUsedCount: memberUseCounts.get(coupon.id) ?? 0,
        };
      })
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
            records: memberIssueRecordsByCoupon.get(coupon.id) ?? [],
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
    const { data, error } = await supabase
      .from("ad_coupons")
      .insert({
        campaign_id: input.campaignId ?? null,
        partner_id: input.partnerId,
        title: input.title,
        description: input.description ?? "",
        code: input.code ?? "",
        issuance_type: input.issuanceType ?? "service",
        redemption_type: redemptionType,
        discount_label: input.discountLabel ?? "",
        terms: input.terms ?? [],
        status: input.status ?? "draft",
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        download_starts_at: input.downloadStartsAt ?? input.startsAt,
        download_ends_at: input.downloadEndsAt ?? input.endsAt,
        usage_starts_at: input.usageStartsAt ?? input.startsAt,
        usage_ends_at: input.usageEndsAt ?? input.endsAt,
        usage_limit: input.usageLimit ?? null,
        daily_issue_limit: input.dailyIssueLimit ?? null,
        weekly_issue_limit: input.weeklyIssueLimit ?? null,
        monthly_issue_limit: input.monthlyIssueLimit ?? null,
        per_member_daily_issue_limit: input.perMemberDailyIssueLimit ?? null,
        per_member_weekly_issue_limit: input.perMemberWeeklyIssueLimit ?? null,
        per_member_monthly_issue_limit: input.perMemberMonthlyIssueLimit ?? null,
        per_member_limit: input.perMemberLimit ?? 1,
        onsite_password_hash: passwordHash?.hash ?? null,
        onsite_password_salt: passwordHash?.salt ?? null,
        external_url: input.externalUrl ?? "",
      })
      .select(AD_COUPON_SELECT)
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapCouponRow(data as AdCouponRow);
  }

  async issueCoupon(input: IssueAdCouponInput): Promise<IssueAdCouponResult> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("issue_ad_coupon", {
      p_coupon_id: input.couponId,
      p_member_id: input.memberId,
      p_session_id: input.sessionId ?? null,
    });
    if (error) {
      const reason = error.message.includes("not_found")
        ? "not_found"
        : error.message.includes("not_downloadable")
          ? "inactive"
          : error.message.includes("member_limit")
            ? "member_limit"
            : error.message.includes("member_daily_limit") || error.message.includes("member_weekly_limit") || error.message.includes("member_monthly_limit")
              ? "member_limit"
              : error.message.includes("code_unavailable") || error.message.includes("daily_limit") || error.message.includes("weekly_limit") || error.message.includes("monthly_limit")
              ? error.message.includes("code_unavailable") ? "code_unavailable" : "usage_limit"
              : "invalid";
      return { ok: false, reason, message: "현재 쿠폰을 다운로드할 수 없습니다." };
    }
    const issueRow = (Array.isArray(data) ? data[0] : data) as {
      issue_id?: string;
      coupon_id?: string;
      assigned_code?: string | null;
      issued_at?: string;
    } | null;
    if (!issueRow?.issue_id || !issueRow.coupon_id) {
      return { ok: false, reason: "invalid", message: "쿠폰 다운로드 결과를 확인할 수 없습니다." };
    }
    const { data: couponData, error: couponError } = await supabase
      .from("ad_coupons")
      .select(AD_COUPON_SELECT)
      .eq("id", issueRow.coupon_id)
      .single();
    if (couponError) {
      throw new Error(couponError.message);
    }
    const coupon = mapCouponRow(couponData as AdCouponRow);
    const available = toAvailableCoupon(coupon, 0);
    if (!available) {
      return { ok: false, reason: "usage_limit", message: "현재 쿠폰을 사용할 수 없습니다." };
    }
    return {
      ok: true,
      issue: {
        ...available,
        issueId: issueRow.issue_id,
        assignedCode: issueRow.assigned_code ?? null,
        issuedAt: issueRow.issued_at ?? new Date().toISOString(),
      },
    };
  }

  async listIssuedCouponsForMember(
    input: ListIssuedCouponsForMemberInput,
  ): Promise<AvailableAdCoupon[]> {
    if (!input.memberId) return [];
    const supabase = getSupabaseAdminClient();
    const { data: issueData, error: issueError } = await supabase
      .from("ad_coupon_issues")
      .select("id,coupon_id,member_id,assigned_code,issued_at,used_at")
      .eq("member_id", input.memberId)
      .eq("status", "issued")
      .order("issued_at", { ascending: false });
    if (issueError) throw new Error(issueError.message);
    const issues = (issueData ?? []) as CouponIssueRow[];
    if (issues.length === 0) return [];
    const couponIds = [...new Set(issues.map((issue) => issue.coupon_id))];
    const { data: couponData, error: couponError } = await supabase
      .from("ad_coupons")
      .select(AD_COUPON_SELECT)
      .in("id", couponIds);
    if (couponError) throw new Error(couponError.message);
    const coupons = new Map(
      ((couponData ?? []) as AdCouponRow[]).map((row) => [row.id, mapCouponRow(row)]),
    );
    const now = input.now ?? new Date();
    return issues.flatMap((issue) => {
      const coupon = coupons.get(issue.coupon_id);
      if (!coupon || new Date(coupon.usageEndsAt).getTime() < now.getTime()) return [];
      const available = toAvailableCoupon(coupon, 0);
      return available
        ? [{ ...available, issueId: issue.id, assignedCode: issue.assigned_code, issuedAt: issue.issued_at, usedAt: issue.used_at }]
        : [];
    });
  }

  async addCouponCodes(input: AddAdCouponCodesInput): Promise<AddAdCouponCodesResult> {
    const supabase = getSupabaseAdminClient();
    const uniqueCodes = [...new Set(input.codes.map((code) => code.trim()).filter(Boolean))];
    if (uniqueCodes.length === 0) return { addedCount: 0, skippedCount: 0 };
    const { data: existing, error: existingError } = await supabase
      .from("ad_coupon_codes")
      .select("code")
      .eq("coupon_id", input.couponId)
      .in("code", uniqueCodes);
    if (existingError) throw new Error(existingError.message);
    const existingCodes = new Set((existing ?? []).map((row) => String((row as { code: string }).code)));
    const rows = await Promise.all(uniqueCodes
      .filter((code) => !existingCodes.has(code))
      .map(async (code) => ({
        coupon_id: input.couponId,
        code,
        code_hash: Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))))
          .map((value) => value.toString(16).padStart(2, "0")).join(""),
        status: "available",
      })));
    if (rows.length > 0) {
      const { error } = await supabase.from("ad_coupon_codes").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { addedCount: rows.length, skippedCount: uniqueCodes.length - rows.length };
  }

  async redeemCouponIssue(
    input: RedeemAdCouponIssueInput,
  ): Promise<RedeemAdCouponIssueResult> {
    const supabase = getSupabaseAdminClient();
    const { data: issueData, error: issueError } = await supabase
      .from("ad_coupon_issues")
      .select(
        "id,coupon_id,member_id,assigned_code,redemption_type_snapshot,onsite_password_hash_snapshot,onsite_password_salt_snapshot,status,usage_starts_at,usage_ends_at",
      )
      .eq("id", input.issueId)
      .eq("member_id", input.memberId)
      .maybeSingle();
    if (issueError) {
      throw new Error(issueError.message);
    }
    if (!issueData) {
      return {
        ok: false,
        reason: "not_found",
        message: "쿠폰을 찾을 수 없습니다.",
      };
    }

    const issue = issueData as CouponIssueVerificationRow;
    if (issue.status !== "issued") {
      return {
        ok: false,
        reason: "inactive",
        message: "이미 사용했거나 사용할 수 없는 쿠폰입니다.",
      };
    }
    const now = Date.now();
    if (
      now < new Date(issue.usage_starts_at).getTime() ||
      now > new Date(issue.usage_ends_at).getTime()
    ) {
      return {
        ok: false,
        reason: "expired",
        message: "쿠폰 사용 기간이 아닙니다.",
      };
    }

    let verifiedPasswordHash: string | null = null;
    if (
      issue.redemption_type_snapshot === "onsite" &&
      issue.onsite_password_hash_snapshot &&
      issue.onsite_password_salt_snapshot
    ) {
      if (!input.onsitePassword) {
        return {
          ok: false,
          reason: "onsite_password_required",
          message: "제휴처 확인 비밀번호를 입력해 주세요.",
        };
      }
      const isValid = await verifyCouponVerificationPassword(input.onsitePassword, {
        hash: issue.onsite_password_hash_snapshot,
        salt: issue.onsite_password_salt_snapshot,
      });
      if (!isValid) {
        return {
          ok: false,
          reason: "onsite_password_invalid",
          message: "제휴처 확인 비밀번호가 올바르지 않습니다.",
        };
      }
      verifiedPasswordHash = issue.onsite_password_hash_snapshot;
    }

    const { data, error } = await supabase.rpc("redeem_ad_coupon_issue", {
      p_issue_id: input.issueId,
      p_member_id: input.memberId,
      p_session_id: input.sessionId ?? null,
      p_metadata: input.metadata ?? {},
      p_verified_onsite_password_hash: verifiedPasswordHash,
    });
    if (error) {
      const reason = error.message.includes("expired")
        ? "expired"
        : error.message.includes("inactive")
          ? "inactive"
          : error.message.includes("not_found")
            ? "not_found"
            : error.message.includes("onsite_password")
              ? "onsite_password_invalid"
              : "invalid";
      return {
        ok: false,
        reason,
        message:
          reason === "onsite_password_invalid"
            ? "제휴처 확인 비밀번호가 올바르지 않습니다."
            : "쿠폰 사용 확인에 실패했습니다.",
      };
    }
    const row = (Array.isArray(data) ? data[0] : data) as {
      coupon_id?: string;
      issue_id?: string;
      assigned_code?: string | null;
    } | null;
    if (!row?.coupon_id || !row.issue_id) {
      return {
        ok: false,
        reason: "invalid",
        message: "쿠폰 사용 확인 결과를 확인할 수 없습니다.",
      };
    }
    return {
      ok: true,
      couponId: row.coupon_id,
      issueId: row.issue_id,
      assignedCode: row.assigned_code ?? null,
    };
  }

  async redeemCoupon(input: RedeemAdCouponInput): Promise<RedeemAdCouponResult> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_coupons")
      .select(AD_COUPON_SELECT)
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
    if (coupon.redemptionType === "onsite") {
      return {
        ok: false,
        reason: "onsite_verification_required",
        message: "현장형 쿠폰은 쿠폰함의 제휴처 확인 화면에서 사용해 주세요.",
        coupon,
      };
    }
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
