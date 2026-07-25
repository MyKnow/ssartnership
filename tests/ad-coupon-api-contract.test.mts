import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    assert.match(repositorySource, /error\.message\.includes\("usage_limit"\)/);
    assert.match(repositorySource, /: "usage_limit"/);
  });

  it("returns conflict status for member and global quota exhaustion", () => {
    assert.match(issueRouteSource, /"member_limit" \|\| reason === "usage_limit"/);
    assert.match(redeemIssueRouteSource, /case "member_limit":/);
    assert.match(redeemIssueRouteSource, /case "usage_limit":/);
  });
});
