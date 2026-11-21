import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.generated";
import {
  AD_COUPON_STATE_CHANGED_ERROR,
  AD_COUPON_STATUSES,
  AdStatusTransitionError,
  canDeleteAdCouponWithStatus,
  canTransitionAdCouponStatus,
  isAdCouponDownloadable,
} from "@/lib/ad-packages";
import {
  selectAvailableCouponsForMember,
  type CouponIssueRecord,
} from "@/lib/ad-coupon-domain";
import { hashCouponVerificationPassword } from "@/lib/coupon-verification-password";
import type {
  AdCoupon,
  AdPackageRepository,
  AvailableAdCoupon,
  CreateAdCouponInput,
  DeleteAdCouponResult,
  DuplicateAdCouponInput,
  ListAvailableCouponsForMemberInput,
  UpdateAdCouponInput,
} from "@/lib/repositories/ad-package-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  AD_COUPON_SELECT,
  countByKey,
  isMissingAdPackageSchemaMessage,
  mapCampaignRow,
  mapCouponRow,
  normalizeStatus,
  normalizeStringArray,
  type AdCampaignRow,
  type AdCouponRow,
} from "./ad-package-mapping.supabase";

export class SupabaseAdCouponCatalogOperations
  implements Pick<
    AdPackageRepository,
    "listAdminCouponsForPartner"
    | "getAdminCouponById"
    | "listActiveCouponsForPartner"
    | "listAvailableCouponsForMember"
    | "createCoupon"
    | "updateCoupon"
    | "duplicateCoupon"
    | "deleteCoupon"
  >
{
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

  async getAdminCouponById(couponId: string): Promise<AdCoupon | null> {
    // Reuse the shared client's authenticated transport/cache policy. This local
    // capability assignment supplies schema metadata; it is not runtime row validation.
    const supabase: Pick<SupabaseClient<Database>, "from"> = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("ad_coupons")
      .select(AD_COUPON_SELECT)
      .eq("id", couponId)
      .maybeSingle();
    if (error) {
      if (isMissingAdPackageSchemaMessage(error.message, "ad_coupons")) {
        return null;
      }
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }
    const { count, error: countError } = await supabase
      .from("ad_coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", couponId)
      .eq("status", "redeemed");
    if (countError) {
      throw new Error(countError.message);
    }
    return mapCouponRow(data, count ?? 0);
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
    const [redemptionResult, campaignResult, memberIssueResult, issueResult] = await Promise.all([
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
      supabase
        .from("ad_coupon_issues")
        .select("coupon_id,issued_at")
        .in("coupon_id", couponIds),
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
    if (issueResult.error) {
      throw new Error(issueResult.error.message);
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
    const toIssueRecords = (data: unknown): CouponIssueRecord[] =>
      ((data ?? []) as Array<{ coupon_id: string; issued_at: string }>).map((row) => ({
        couponId: row.coupon_id,
        issuedAt: row.issued_at,
      }));
    const campaignsById = new Map(
      ((campaignResult.data ?? []) as AdCampaignRow[]).map((row) => [
        row.id,
        mapCampaignRow(row),
      ]),
    );

    return selectAvailableCouponsForMember({
      candidates: rows.map((row) => {
        const coupon = mapCouponRow(row, useCounts.get(row.id) ?? 0);
        return {
          coupon,
          campaign: coupon.campaignId ? campaignsById.get(coupon.campaignId) : null,
          memberUsedCount: memberUseCounts.get(coupon.id) ?? 0,
        };
      }),
      couponIssueRecords: toIssueRecords(issueResult.data),
      memberIssueRecords: toIssueRecords(memberIssueResult.data),
      now,
    });
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

  async updateCoupon(input: UpdateAdCouponInput): Promise<AdCoupon> {
    const supabase = getSupabaseAdminClient();
    const { data: existingData, error: existingError } = await supabase
      .from("ad_coupons")
      .select(AD_COUPON_SELECT)
      .eq("id", input.couponId)
      .eq("partner_id", input.partnerId)
      .maybeSingle();
    if (existingError) {
      throw new Error(existingError.message);
    }
    if (!existingData) {
      throw new Error("쿠폰을 찾을 수 없습니다.");
    }
    const existing = existingData as AdCouponRow;
    // The action validated the transition against its own earlier read. Check
    // it again against this read and write only while the status is still the
    // same, so a concurrent edit (for example ending the coupon) cannot be
    // overwritten into a transition the table forbids.
    const currentStatus = normalizeStatus(existing.status, AD_COUPON_STATUSES, "draft");
    const nextStatus = input.status ?? "draft";
    if (!canTransitionAdCouponStatus(currentStatus, nextStatus)) {
      throw new AdStatusTransitionError("coupon", currentStatus, nextStatus);
    }
    const redemptionType = input.redemptionType ?? "onsite";
    let passwordHash = existing.onsite_password_hash;
    let passwordSalt = existing.onsite_password_salt;
    if (redemptionType === "onsite") {
      if (input.onsitePassword) {
        const password = await hashCouponVerificationPassword(input.onsitePassword);
        passwordHash = password.hash;
        passwordSalt = password.salt;
      } else if (!passwordHash || !passwordSalt) {
        throw new Error("현장 확인형 쿠폰은 제휴처 확인 PIN이 필요합니다.");
      }
    } else {
      if (input.onsitePassword) {
        throw new Error("현장 확인 PIN은 현장 확인형 쿠폰에만 설정할 수 있습니다.");
      }
      passwordHash = null;
      passwordSalt = null;
    }
    const { data, error } = await supabase
      .from("ad_coupons")
      .update({
        campaign_id: input.campaignId ?? null,
        title: input.title,
        description: input.description ?? "",
        code: input.code ?? "",
        issuance_type: input.issuanceType ?? "service",
        redemption_type: redemptionType,
        discount_label: input.discountLabel ?? "",
        terms: input.terms ?? [],
        status: nextStatus,
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
        onsite_password_hash: passwordHash,
        onsite_password_salt: passwordSalt,
        external_url: input.externalUrl ?? "",
      })
      .eq("id", input.couponId)
      .eq("partner_id", input.partnerId)
      // Compare-and-set on the status the transition was checked against.
      .eq("status", currentStatus)
      .select(AD_COUPON_SELECT)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error(AD_COUPON_STATE_CHANGED_ERROR);
    }
    return mapCouponRow(data as AdCouponRow);
  }

  async duplicateCoupon(input: DuplicateAdCouponInput): Promise<AdCoupon> {
    const supabase = getSupabaseAdminClient();
    const { data: sourceData, error: sourceError } = await supabase
      .from("ad_coupons")
      .select(AD_COUPON_SELECT)
      .eq("id", input.couponId)
      .maybeSingle();
    if (sourceError) {
      throw new Error(sourceError.message);
    }
    if (!sourceData) {
      throw new Error("쿠폰을 찾을 수 없습니다.");
    }
    const source = sourceData as AdCouponRow;
    const { data, error } = await supabase
      .from("ad_coupons")
      .insert({
        campaign_id: source.campaign_id,
        partner_id: source.partner_id,
        title: `복제 - ${source.title}`.slice(0, 80),
        description: source.description ?? "",
        code: "",
        issuance_type: source.issuance_type ?? "service",
        redemption_type: source.redemption_type ?? "onsite",
        discount_label: source.discount_label ?? "",
        terms: normalizeStringArray(source.terms),
        status: "draft",
        starts_at: source.starts_at,
        ends_at: source.ends_at,
        download_starts_at: source.download_starts_at ?? source.starts_at,
        download_ends_at: source.download_ends_at ?? source.ends_at,
        usage_starts_at: source.usage_starts_at ?? source.starts_at,
        usage_ends_at: source.usage_ends_at ?? source.ends_at,
        usage_limit: source.usage_limit,
        daily_issue_limit: source.daily_issue_limit,
        weekly_issue_limit: source.weekly_issue_limit,
        monthly_issue_limit: source.monthly_issue_limit,
        per_member_daily_issue_limit: source.per_member_daily_issue_limit,
        per_member_weekly_issue_limit: source.per_member_weekly_issue_limit,
        per_member_monthly_issue_limit: source.per_member_monthly_issue_limit,
        per_member_limit: source.per_member_limit ?? 1,
        onsite_password_hash: source.onsite_password_hash,
        onsite_password_salt: source.onsite_password_salt,
        external_url: source.external_url ?? "",
      })
      .select(AD_COUPON_SELECT)
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapCouponRow(data as AdCouponRow);
  }

  async deleteCoupon(couponId: string): Promise<DeleteAdCouponResult> {
    const supabase = getSupabaseAdminClient();
    // Read the status and row version before counting history: an active
    // coupon can still be issued (the issue RPC locks and re-checks only active
    // coupons), and the issue/redemption foreign keys cascade. Only a
    // non-active coupon with no history is deleted, and the delete is a
    // compare-and-set on `updated_at` (bumped by a trigger on every update),
    // so a "re-activate → issue → pause" between the count and the delete
    // makes the delete match nothing instead of cascading the new issue.
    const { data: couponData, error: couponError } = await supabase
      .from("ad_coupons")
      .select("status,updated_at")
      .eq("id", couponId)
      .maybeSingle();
    if (couponError) {
      throw new Error(couponError.message);
    }
    if (!couponData) {
      throw new Error("쿠폰을 찾을 수 없습니다.");
    }
    const couponRow = couponData as { status: string | null; updated_at: string };
    const status = normalizeStatus(couponRow.status, AD_COUPON_STATUSES, "draft");
    const [issueResult, redemptionResult] = await Promise.all([
      supabase
        .from("ad_coupon_issues")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", couponId),
      supabase
        .from("ad_coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", couponId),
    ]);
    if (issueResult.error) {
      throw new Error(issueResult.error.message);
    }
    if (redemptionResult.error) {
      throw new Error(redemptionResult.error.message);
    }
    if ((issueResult.count ?? 0) > 0 || (redemptionResult.count ?? 0) > 0) {
      return { ok: false, reason: "usage_history" };
    }
    if (!canDeleteAdCouponWithStatus(status)) {
      return { ok: false, reason: "active" };
    }
    const { data: deletedRows, error } = await supabase
      .from("ad_coupons")
      .delete()
      .eq("id", couponId)
      .neq("status", "active")
      .eq("updated_at", couponRow.updated_at)
      .select("id");
    if (error) {
      throw new Error(error.message);
    }
    return (deletedRows ?? []).length > 0
      ? { ok: true }
      : { ok: false, reason: "state_changed" };
  }
}
