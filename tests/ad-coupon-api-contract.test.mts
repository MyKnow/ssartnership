import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const repositorySource = readFileSync(
  new URL(
    "../src/lib/repositories/supabase/ad-package-repository.supabase.ts",
    import.meta.url,
  ),
  "utf8",
);
const issueRouteSource = readFileSync(
  new URL("../src/app/api/coupons/[couponId]/issue/route.ts", import.meta.url),
  "utf8",
);
const redeemIssueRouteSource = readFileSync(
  new URL(
    "../src/app/api/coupon-issues/[issueId]/redeem/route.ts",
    import.meta.url,
  ),
  "utf8",
);

describe("coupon API result contract", () => {
  it("maps the total global limit RPC error to usage_limit", () => {
    assert.match(repositorySource, /classifyIssueAdCouponError\(error\.message\)/);
    assert.match(repositorySource, /classifyRedeemAdCouponIssueError\(error\.message\)/);
  });

  it("keeps the legacy coupon-id redeem route deleted so redemption stays issue-based", () => {
    assert.equal(
      existsSync(
        new URL("../src/app/api/coupons/[couponId]/redeem/route.ts", import.meta.url),
      ),
      false,
    );
    // The repository no longer offers the count→check→insert coupon-id path
    // either; every redemption goes through the locking issue RPC.
    assert.doesNotMatch(repositorySource, /async redeemCoupon\(/);
    assert.match(repositorySource, /supabase\.rpc\("redeem_ad_coupon_issue"/);
  });

  it("returns conflict status for member and global quota exhaustion", () => {
    assert.match(issueRouteSource, /"member_limit" \|\| reason === "usage_limit"/);
    assert.match(redeemIssueRouteSource, /case "member_limit":/);
    assert.match(redeemIssueRouteSource, /case "usage_limit":/);
  });
});
