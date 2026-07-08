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

  it("lists available wallet coupons with member and global remaining counts", async () => {
    const repository = new MockAdPackageRepository();
    const coupons = await repository.listAvailableCouponsForMember({
      memberId: "member-1",
      partnerIds: ["health-001", "restaurant-001"],
      now: new Date("2026-07-15T12:00:00.000Z"),
    });

    assert.deepEqual(
      coupons.map((item) => item.coupon.id),
      ["coupon-restaurant-lunch", "coupon-health-trial"],
    );
    assert.equal(coupons[0]?.memberUsedCount, 0);
    assert.equal(coupons[0]?.remainingMemberUses, 1);
    assert.equal(coupons[0]?.remainingGlobalUses, 100);
  });

  it("excludes wallet coupons after the member reaches the per-member limit", async () => {
    const repository = new MockAdPackageRepository();
    await repository.redeemCoupon({
      couponId: "coupon-restaurant-lunch",
      memberId: "member-1",
      sessionId: "session-1",
    });

    const coupons = await repository.listAvailableCouponsForMember({
      memberId: "member-1",
      partnerIds: ["restaurant-001"],
      now: new Date("2026-07-15T12:00:00.000Z"),
    });

    assert.deepEqual(coupons.map((item) => item.coupon.id), []);
  });

  it("excludes wallet coupons after the global usage limit is exhausted", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await repository.createCoupon({
      partnerId: "health-001",
      title: "선착순 체험권",
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-20T23:59:59.000Z",
      usageLimit: 1,
      perMemberLimit: 5,
    });
    await repository.redeemCoupon({
      couponId: coupon.id,
      memberId: "member-2",
      sessionId: "session-1",
    });

    const coupons = await repository.listAvailableCouponsForMember({
      memberId: "member-1",
      partnerIds: ["health-001"],
      now: new Date("2026-07-15T12:00:00.000Z"),
    });

    assert.equal(coupons.some((item) => item.coupon.id === coupon.id), false);
  });

  it("excludes inactive wallet coupons", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await repository.createCoupon({
      partnerId: "health-001",
      title: "준비 중 쿠폰",
      status: "draft",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-20T23:59:59.000Z",
    });

    const coupons = await repository.listAvailableCouponsForMember({
      memberId: "member-1",
      partnerIds: ["health-001"],
      now: new Date("2026-07-15T12:00:00.000Z"),
    });

    assert.equal(coupons.some((item) => item.coupon.id === coupon.id), false);
  });
});
