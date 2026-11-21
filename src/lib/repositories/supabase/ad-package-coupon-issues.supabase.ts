import { createHash } from "node:crypto";
import {
  assertValidAdCouponCodeBatch,
  getAvailableCouponUsage,
} from "@/lib/ad-coupon-domain";
import { verifyCouponVerificationPassword } from "@/lib/coupon-verification-password";
import type {
  AddAdCouponCodesInput,
  AddAdCouponCodesResult,
  AdPackageRepository,
  AvailableAdCoupon,
  IssueAdCouponInput,
  IssueAdCouponResult,
  ListIssuedCouponsForMemberInput,
  RedeemAdCouponIssueInput,
  RedeemAdCouponIssueResult,
} from "@/lib/repositories/ad-package-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  classifyIssueAdCouponError,
  classifyRedeemAdCouponIssueError,
} from "@/lib/ad-coupon-error-tokens";
import { logServerError } from "@/lib/server-log";
import {
  AD_COUPON_SELECT,
  mapCouponRow,
  type AdCouponRow,
} from "./ad-package-mapping.supabase";

const AD_COUPON_CODE_WRITE_BATCH_SIZE = 1_000;
const ISSUED_COUPON_SELECT =
  `id,coupon_id,member_id,assigned_code,issued_at,used_at,ad_coupons!inner(${AD_COUPON_SELECT})`;

type CouponIssueRow = {
  id: string;
  coupon_id: string;
  member_id: string;
  assigned_code: string | null;
  issued_at: string;
  used_at: string | null;
};

type IssuedCouponJoinRow = CouponIssueRow & {
  ad_coupons?: AdCouponRow | AdCouponRow[] | null;
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


export class SupabaseAdCouponIssueOperations
  implements Pick<
    AdPackageRepository,
    "issueCoupon"
    | "listIssuedCouponsForMember"
    | "addCouponCodes"
    | "redeemCouponIssue"
  >
{
  async issueCoupon(input: IssueAdCouponInput): Promise<IssueAdCouponResult> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("issue_ad_coupon", {
      p_coupon_id: input.couponId,
      p_member_id: input.memberId,
      p_session_id: input.sessionId ?? null,
    });
    if (error) {
      const reason = classifyIssueAdCouponError(error.message);
      if (reason === "invalid") {
        logServerError("[ad-coupon] issue rpc failed with unclassified error", error);
      }
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
    const available = getAvailableCouponUsage(coupon, 0);
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
    const partnerIds = input.partnerIds
      ? [...new Set(input.partnerIds.filter(Boolean))]
      : null;
    if (partnerIds && partnerIds.length === 0) return [];
    const now = input.now ?? new Date();
    const nowIso = now.toISOString();
    let issueQuery = supabase
      .from("ad_coupon_issues")
      .select(ISSUED_COUPON_SELECT)
      .eq("member_id", input.memberId)
      .eq("status", "issued")
      .is("used_at", null)
      .gte("usage_ends_at", nowIso)
      .or(
        `usage_ends_at.gte.${nowIso},and(usage_ends_at.is.null,ends_at.gte.${nowIso})`,
        { referencedTable: "ad_coupons" },
      )
      .order("issued_at", { ascending: false });
    if (partnerIds) {
      issueQuery = issueQuery.in("ad_coupons.partner_id", partnerIds);
    }
    const { data: issueData, error: issueError } = await issueQuery;
    if (issueError) throw new Error(issueError.message);
    return ((issueData ?? []) as IssuedCouponJoinRow[]).flatMap((issue) => {
      const couponRow = Array.isArray(issue.ad_coupons)
        ? issue.ad_coupons[0]
        : issue.ad_coupons;
      if (!couponRow) return [];
      const coupon = mapCouponRow(couponRow);
      const available = getAvailableCouponUsage(coupon, 0);
      return available
        ? [{ ...available, issueId: issue.id, assignedCode: issue.assigned_code, issuedAt: issue.issued_at, usedAt: issue.used_at }]
        : [];
    });
  }

  async addCouponCodes(input: AddAdCouponCodesInput): Promise<AddAdCouponCodesResult> {
    const supabase = getSupabaseAdminClient();
    assertValidAdCouponCodeBatch(input.codes);
    const uniqueCodes = [...new Set(input.codes.map((code) => code.trim()).filter(Boolean))];
    if (uniqueCodes.length === 0) return { addedCount: 0, skippedCount: 0 };

    let addedCount = 0;
    for (
      let offset = 0;
      offset < uniqueCodes.length;
      offset += AD_COUPON_CODE_WRITE_BATCH_SIZE
    ) {
      const rows = uniqueCodes
        .slice(offset, offset + AD_COUPON_CODE_WRITE_BATCH_SIZE)
        .map((code) => ({
          coupon_id: input.couponId,
          code,
          code_hash: createHash("sha256").update(code).digest("hex"),
          status: "available",
        }));
      const { data, error } = await supabase
        .from("ad_coupon_codes")
        .upsert(rows, {
          onConflict: "coupon_id,code_hash",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw new Error(error.message);
      addedCount += data?.length ?? 0;
    }
    return {
      addedCount,
      skippedCount: uniqueCodes.length - addedCount,
    };
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
      const reason = classifyRedeemAdCouponIssueError(error.message);
      if (reason === "invalid") {
        logServerError("[ad-coupon] redeem rpc failed with unclassified error", error);
      }
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
}
