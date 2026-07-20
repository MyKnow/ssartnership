import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AvailableAdCoupon } from "../src/lib/repositories/ad-package-repository.ts";
import { indexIssuedCouponsByCouponId } from "../src/app/(site)/partners/[id]/_page/issued-coupon-map.ts";

describe("partner detail issued coupon map", () => {
  it("indexes only issued coupons by their coupon id for initial download state", () => {
    const first = {
      coupon: { id: "coupon-1" },
      issueId: "issue-1",
    } as AvailableAdCoupon;
    const withoutIssue = {
      coupon: { id: "coupon-2" },
      issueId: null,
    } as AvailableAdCoupon;

    assert.deepEqual(indexIssuedCouponsByCouponId([first, withoutIssue]), {
      "coupon-1": first,
    });
  });
});
