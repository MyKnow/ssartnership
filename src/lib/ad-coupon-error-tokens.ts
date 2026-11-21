import { hasAnyRpcErrorToken, hasRpcErrorToken } from "./rpc-error-tokens.ts";

/**
 * RPC `raise exception` tokens raised by `issue_ad_coupon`. Classify by the
 * whole token: a bare "not_found" also matches provider messages and other
 * tokens, which used to turn unrelated failures into "쿠폰 없음".
 */
export const AD_COUPON_ISSUE_ERROR_TOKENS = Object.freeze({
  notFound: "ad_coupon_not_found",
  notDownloadable: "ad_coupon_not_downloadable",
  memberLimit: "ad_coupon_member_limit",
  memberDailyLimit: "ad_coupon_member_daily_limit",
  memberWeeklyLimit: "ad_coupon_member_weekly_limit",
  memberMonthlyLimit: "ad_coupon_member_monthly_limit",
  usageLimit: "ad_coupon_usage_limit",
  dailyLimit: "ad_coupon_daily_limit",
  weeklyLimit: "ad_coupon_weekly_limit",
  monthlyLimit: "ad_coupon_monthly_limit",
  codeUnavailable: "ad_coupon_code_unavailable",
} as const);

/** RPC `raise exception` tokens raised by `redeem_ad_coupon_issue`. */
export const AD_COUPON_REDEEM_ERROR_TOKENS = Object.freeze({
  issueNotFound: "ad_coupon_issue_not_found",
  issueInactive: "ad_coupon_issue_inactive",
  issueExpired: "ad_coupon_issue_expired",
  couponInactive: "ad_coupon_inactive",
  onsitePasswordInvalid: "ad_coupon_onsite_password_invalid",
  memberLimit: "ad_coupon_member_limit",
  usageLimit: "ad_coupon_usage_limit",
} as const);

export type IssueAdCouponErrorReason =
  | "not_found"
  | "inactive"
  | "member_limit"
  | "usage_limit"
  | "code_unavailable"
  | "invalid";

export type RedeemAdCouponIssueErrorReason =
  | "not_found"
  | "inactive"
  | "expired"
  | "member_limit"
  | "usage_limit"
  | "onsite_password_invalid"
  | "invalid";

const ISSUE = AD_COUPON_ISSUE_ERROR_TOKENS;
const REDEEM = AD_COUPON_REDEEM_ERROR_TOKENS;

export function classifyIssueAdCouponError(message: string): IssueAdCouponErrorReason {
  if (hasRpcErrorToken(message, ISSUE.notFound)) return "not_found";
  if (hasRpcErrorToken(message, ISSUE.notDownloadable)) return "inactive";
  if (
    hasAnyRpcErrorToken(message, [
      ISSUE.memberLimit,
      ISSUE.memberDailyLimit,
      ISSUE.memberWeeklyLimit,
      ISSUE.memberMonthlyLimit,
    ])
  ) {
    return "member_limit";
  }
  if (hasRpcErrorToken(message, ISSUE.codeUnavailable)) return "code_unavailable";
  if (
    hasAnyRpcErrorToken(message, [
      ISSUE.usageLimit,
      ISSUE.dailyLimit,
      ISSUE.weeklyLimit,
      ISSUE.monthlyLimit,
    ])
  ) {
    return "usage_limit";
  }
  return "invalid";
}

export function classifyRedeemAdCouponIssueError(message: string): RedeemAdCouponIssueErrorReason {
  if (hasRpcErrorToken(message, REDEEM.issueExpired)) return "expired";
  if (hasRpcErrorToken(message, REDEEM.memberLimit)) return "member_limit";
  if (hasRpcErrorToken(message, REDEEM.usageLimit)) return "usage_limit";
  if (hasAnyRpcErrorToken(message, [REDEEM.issueInactive, REDEEM.couponInactive])) return "inactive";
  if (hasRpcErrorToken(message, REDEEM.issueNotFound)) return "not_found";
  if (hasRpcErrorToken(message, REDEEM.onsitePasswordInvalid)) return "onsite_password_invalid";
  return "invalid";
}
