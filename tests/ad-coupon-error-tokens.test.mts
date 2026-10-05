import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  AD_COUPON_ISSUE_ERROR_TOKENS,
  AD_COUPON_REDEEM_ERROR_TOKENS,
  classifyIssueAdCouponError,
  classifyRedeemAdCouponIssueError,
} from "../src/lib/ad-coupon-error-tokens.ts";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

function readFunctionBody(schema: string, name: string) {
  const start = schema.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} must exist in schema.sql`);
  const bodyStart = schema.indexOf("as $$", start);
  const bodyEnd = schema.indexOf("$$;", bodyStart);
  assert.ok(bodyStart > start && bodyEnd > bodyStart, `${name} body must be readable`);
  return schema.slice(bodyStart, bodyEnd);
}

function raisedTokens(body: string) {
  return new Set([...body.matchAll(/raise exception '([a-z0-9_]+)'/gu)].map((match) => match[1]));
}

test("coupon RPC tokens match the current schema exactly", () => {
  const schema = read("supabase/schema.sql");
  const migrations = readdirSync(new URL("supabase/migrations/", root))
    .map((file) => read(`supabase/migrations/${file}`))
    .join("\n");

  const issueRaised = raisedTokens(readFunctionBody(schema, "issue_ad_coupon"));
  const redeemRaised = raisedTokens(readFunctionBody(schema, "redeem_ad_coupon_issue"));

  assert.deepEqual(
    [...issueRaised].sort(),
    [...new Set(Object.values(AD_COUPON_ISSUE_ERROR_TOKENS))].sort(),
    "every issue_ad_coupon token is classified and every classified token is raised",
  );
  assert.deepEqual(
    [...redeemRaised].sort(),
    [...new Set(Object.values(AD_COUPON_REDEEM_ERROR_TOKENS))].sort(),
    "every redeem_ad_coupon_issue token is classified and every classified token is raised",
  );
  for (const token of [
    ...Object.values(AD_COUPON_ISSUE_ERROR_TOKENS),
    ...Object.values(AD_COUPON_REDEEM_ERROR_TOKENS),
  ]) {
    assert.ok(migrations.includes(`raise exception '${token}'`), `${token} must be raised by a migration`);
  }
});

test("issue_ad_coupon errors are classified by whole tokens", () => {
  const cases: Array<[string, ReturnType<typeof classifyIssueAdCouponError>]> = [
    ["ad_coupon_not_found", "not_found"],
    ["ad_coupon_not_downloadable", "inactive"],
    ["ad_coupon_member_limit", "member_limit"],
    ["ad_coupon_member_daily_limit", "member_limit"],
    ["ad_coupon_member_weekly_limit", "member_limit"],
    ["ad_coupon_member_monthly_limit", "member_limit"],
    ["ad_coupon_code_unavailable", "code_unavailable"],
    ["ad_coupon_usage_limit", "usage_limit"],
    ["ad_coupon_daily_limit", "usage_limit"],
    ["ad_coupon_weekly_limit", "usage_limit"],
    ["ad_coupon_monthly_limit", "usage_limit"],
  ];
  for (const [message, reason] of cases) {
    assert.equal(classifyIssueAdCouponError(message), reason, message);
  }
  for (const ambiguous of [
    "relation \"public.partner_not_found\" does not exist",
    "Could not find the function public.issue_ad_coupon in the schema cache",
    "ad_coupon_issue_not_found",
    "ad_coupon_not_found_extra",
    "member_limit",
    "",
  ]) {
    assert.equal(classifyIssueAdCouponError(ambiguous), "invalid", ambiguous);
  }
});

test("redeem_ad_coupon_issue errors are classified by whole tokens", () => {
  const cases: Array<[string, ReturnType<typeof classifyRedeemAdCouponIssueError>]> = [
    ["ad_coupon_issue_not_found", "not_found"],
    ["ad_coupon_issue_inactive", "inactive"],
    ["ad_coupon_inactive", "inactive"],
    ["ad_coupon_issue_expired", "expired"],
    ["ad_coupon_onsite_password_invalid", "onsite_password_invalid"],
    ["ad_coupon_member_limit", "member_limit"],
    ["ad_coupon_usage_limit", "usage_limit"],
  ];
  for (const [message, reason] of cases) {
    assert.equal(classifyRedeemAdCouponIssueError(message), reason, message);
  }
  for (const ambiguous of [
    "JWT expired",
    "role \"inactive_reader\" does not exist",
    "storage object not_found",
    "ad_coupon_not_found",
    "ad_coupon_issue_expired_at_column",
  ]) {
    assert.equal(classifyRedeemAdCouponIssueError(ambiguous), "invalid", ambiguous);
  }
});

test("coupon repository no longer branches on bare RPC message fragments", () => {
  const repository = read("src/lib/repositories/supabase/ad-package-repository.supabase.ts");
  assert.doesNotMatch(
    repository,
    /error\.message\.includes\("(?:not_found|inactive|expired|not_downloadable|member_limit|usage_limit|code_unavailable|onsite_password)"\)/u,
  );
  assert.match(repository, /classifyIssueAdCouponError\(error\.message\)/u);
  assert.match(repository, /classifyRedeemAdCouponIssueError\(error\.message\)/u);
  assert.match(repository, /\[ad-coupon\] issue rpc failed with unclassified error/u);
  assert.match(repository, /\[ad-coupon\] redeem rpc failed with unclassified error/u);
});
