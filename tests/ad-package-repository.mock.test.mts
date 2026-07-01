import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MockAdPackageRepository } from "../src/lib/repositories/mock/ad-package-repository.mock.ts";

describe("mock ad package repository", () => {
  it("lists active coupons for a partner", async () => {
    const repository = new MockAdPackageRepository();
    const coupons = await repository.listActiveCouponsForPartner("restaurant-001", {
      now: new Date("2026-07-15T12:00:00.000Z"),
    });

    assert.equal(coupons.length, 1);
    assert.equal(coupons[0]?.title, "점심 세트 10% 할인");
  });

  it("redeems a coupon and updates campaign reporting counts", async () => {
    const repository = new MockAdPackageRepository();
    const first = await repository.redeemCoupon({
      couponId: "coupon-restaurant-lunch",
      memberId: "member-1",
      sessionId: "session-1",
    });

    assert.equal(first.ok, true);
    assert.equal(first.redemption?.couponId, "coupon-restaurant-lunch");

    const campaigns = await repository.listAdminCampaigns({
      now: new Date("2026-07-15T12:00:00.000Z"),
    });
    const campaign = campaigns.find((item) => item.id === "campaign-restaurant-boost");

    assert.equal(campaign?.metrics.couponRedemptions, 1);
    assert.equal(campaign?.coupons[0]?.usedCount, 1);
  });

  it("enforces per-member coupon redemption limits", async () => {
    const repository = new MockAdPackageRepository();
    await repository.redeemCoupon({
      couponId: "coupon-restaurant-lunch",
      memberId: "member-1",
      sessionId: "session-1",
    });
    const second = await repository.redeemCoupon({
      couponId: "coupon-restaurant-lunch",
      memberId: "member-1",
      sessionId: "session-2",
    });

    assert.equal(second.ok, false);
    assert.equal(second.reason, "member_limit");
  });
});
