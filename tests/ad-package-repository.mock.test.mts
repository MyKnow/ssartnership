import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MockAdPackageRepository } from "../src/lib/repositories/mock/ad-package-repository.mock.ts";

async function createCodeCoupon(
  repository: MockAdPackageRepository,
  overrides: { perMemberLimit?: number; usageLimit?: number } = {},
) {
  return repository.createCoupon({
    campaignId: "campaign-restaurant-boost",
    partnerId: "restaurant-001",
    title: "직접 사용 테스트 쿠폰",
    redemptionType: "code",
    status: "active",
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: "2026-07-31T23:59:59.000Z",
    perMemberLimit: overrides.perMemberLimit ?? 1,
    usageLimit: overrides.usageLimit,
  });
}

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
    const coupon = await createCodeCoupon(repository);
    const first = await repository.redeemCoupon({
      couponId: coupon.id,
      memberId: "member-1",
      sessionId: "session-1",
    });

    assert.equal(first.ok, true);
    assert.equal(first.redemption?.couponId, coupon.id);

    const campaigns = await repository.listAdminCampaigns({
      now: new Date("2026-07-15T12:00:00.000Z"),
    });
    const campaign = campaigns.find((item) => item.id === "campaign-restaurant-boost");

    assert.equal(campaign?.metrics.couponRedemptions, 1);
    assert.equal(campaign?.coupons[0]?.usedCount, 1);
  });

  it("enforces per-member coupon redemption limits", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await createCodeCoupon(repository);
    await repository.redeemCoupon({
      couponId: coupon.id,
      memberId: "member-1",
      sessionId: "session-1",
    });
    const second = await repository.redeemCoupon({
      couponId: coupon.id,
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
    const coupon = await createCodeCoupon(repository);
    await repository.redeemCoupon({
      couponId: coupon.id,
      memberId: "member-1",
      sessionId: "session-1",
    });

    const coupons = await repository.listAvailableCouponsForMember({
      memberId: "member-1",
      partnerIds: ["restaurant-001"],
      now: new Date("2026-07-15T12:00:00.000Z"),
    });

    assert.equal(coupons.some((item) => item.coupon.id === coupon.id), false);
  });

  it("excludes wallet coupons after the global usage limit is exhausted", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await repository.createCoupon({
      partnerId: "health-001",
      title: "선착순 체험권",
      redemptionType: "code",
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
      onsitePassword: "1234",
    });

    const coupons = await repository.listAvailableCouponsForMember({
      memberId: "member-1",
      partnerIds: ["health-001"],
      now: new Date("2026-07-15T12:00:00.000Z"),
    });

    assert.equal(coupons.some((item) => item.coupon.id === coupon.id), false);
  });

  it("enforces per-member daily issuance limits after a previous issue is used", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await repository.createCoupon({
      partnerId: "health-001",
      title: "회원별 발급 제한 쿠폰",
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
      perMemberDailyIssueLimit: 1,
      onsitePassword: "2468",
    });
    const first = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-1",
    });
    assert.equal(first.ok, true);
    if (!first.ok || !first.issue.issueId) {
      return;
    }
    const redeemed = await repository.redeemCouponIssue({
      issueId: first.issue.issueId,
      memberId: "member-1",
      onsitePassword: "2468",
    });
    assert.equal(redeemed.ok, true);

    const second = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-1",
    });
    assert.equal(second.ok, false);
    assert.equal(second.reason, "member_limit");
  });

  it("requires and verifies the onsite partner password before redeeming an issued coupon", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await repository.createCoupon({
      partnerId: "health-001",
      title: "현장 확인 쿠폰",
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
      onsitePassword: "987654",
    });
    const issued = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-2",
    });
    assert.equal(issued.ok, true);
    if (!issued.ok || !issued.issue.issueId) {
      return;
    }

    const missing = await repository.redeemCouponIssue({
      issueId: issued.issue.issueId,
      memberId: "member-2",
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, "onsite_password_required");

    const wrong = await repository.redeemCouponIssue({
      issueId: issued.issue.issueId,
      memberId: "member-2",
      onsitePassword: "123456",
    });
    assert.equal(wrong.ok, false);
    assert.equal(wrong.reason, "onsite_password_invalid");

    const valid = await repository.redeemCouponIssue({
      issueId: issued.issue.issueId,
      memberId: "member-2",
      onsitePassword: "987654",
    });
    assert.equal(valid.ok, true);
  });

  it("hides a wallet coupon after a member reaches a periodic issue limit", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await repository.createCoupon({
      partnerId: "health-001",
      title: "회원별 일 발급 한도 쿠폰",
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
      perMemberDailyIssueLimit: 1,
      onsitePassword: "1357",
    });
    const issued = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-3",
    });
    assert.equal(issued.ok, true);

    const coupons = await repository.listAvailableCouponsForMember({
      memberId: "member-3",
      partnerIds: ["health-001"],
      now: new Date(),
    });

    assert.equal(coupons.some((item) => item.coupon.id === coupon.id), false);
  });

  it("blocks direct coupon-id redemption for onsite coupons", async () => {
    const repository = new MockAdPackageRepository();
    const result = await repository.redeemCoupon({
      couponId: "coupon-restaurant-lunch",
      memberId: "member-1",
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "onsite_verification_required");
  });
});
