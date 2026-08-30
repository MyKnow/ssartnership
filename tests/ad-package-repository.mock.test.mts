import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MockAdPackageRepository } from "../src/lib/repositories/mock/ad-package-repository.mock.ts";

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

function activeCouponWindow(reference = new Date()) {
  return {
    startsAt: new Date(reference.getTime() - DAY_IN_MS).toISOString(),
    endsAt: new Date(reference.getTime() + DAY_IN_MS).toISOString(),
  };
}

async function createCodeCoupon(
  repository: MockAdPackageRepository,
  overrides: { perMemberLimit?: number; usageLimit?: number } = {},
) {
  const activeWindow = activeCouponWindow();
  const campaign = await repository.createCampaign({
    partnerId: "restaurant-001",
    packageTier: "boost",
    title: "직접 사용 테스트 캠페인",
    status: "active",
    ...activeWindow,
  });

  return repository.createCoupon({
    campaignId: campaign.id,
    partnerId: "restaurant-001",
    title: "직접 사용 테스트 쿠폰",
    redemptionType: "code",
    status: "active",
    ...activeWindow,
    perMemberLimit: overrides.perMemberLimit ?? 1,
    usageLimit: overrides.usageLimit,
  });
}

describe("mock ad package repository", () => {
  it("keeps blank member periodic limits unlimited without bypassing the total member limit", async () => {
    const repository = new MockAdPackageRepository();
    const now = Date.now();
    const coupon = await repository.createCoupon({
      partnerId: "health-001",
      title: "무제한 회원 발급 쿠폰",
      status: "active",
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 86_400_000).toISOString(),
      downloadStartsAt: new Date(now - 60_000).toISOString(),
      downloadEndsAt: new Date(now + 86_400_000).toISOString(),
      usageStartsAt: new Date(now - 60_000).toISOString(),
      usageEndsAt: new Date(now + 86_400_000).toISOString(),
      perMemberDailyIssueLimit: null,
      perMemberWeeklyIssueLimit: null,
      perMemberMonthlyIssueLimit: null,
      onsitePassword: "2468",
    });

    const first = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-unlimited",
    });
    assert.equal(first.ok, true);
    if (!first.ok || !first.issue.issueId) return;

    const redeemed = await repository.redeemCouponIssue({
      issueId: first.issue.issueId,
      memberId: "member-unlimited",
      onsitePassword: "2468",
    });
    assert.equal(redeemed.ok, true);

    const second = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-unlimited",
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.reason, "member_limit");
    }
  });

  it("allows a member's configured total uses and blocks the next issue", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await createCodeCoupon(repository, { perMemberLimit: 2 });

    const first = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-total-limit",
    });
    assert.equal(first.ok, true);
    if (!first.ok || !first.issue.issueId) return;

    const firstRedemption = await repository.redeemCouponIssue({
      issueId: first.issue.issueId,
      memberId: "member-total-limit",
    });
    assert.equal(firstRedemption.ok, true);

    const second = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-total-limit",
    });
    assert.equal(second.ok, true);
    if (!second.ok || !second.issue.issueId) return;

    const secondRedemption = await repository.redeemCouponIssue({
      issueId: second.issue.issueId,
      memberId: "member-total-limit",
    });
    assert.equal(secondRedemption.ok, true);

    const third = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-total-limit",
    });
    assert.equal(third.ok, false);
    if (!third.ok) {
      assert.equal(third.reason, "member_limit");
    }
  });

  it("enforces a global daily issue limit across members", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await repository.createCoupon({
      partnerId: "health-001",
      title: "전체 일 발급 제한 쿠폰",
      status: "active",
      redemptionType: "code",
      ...activeCouponWindow(),
      dailyIssueLimit: 1,
    });

    const first = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-global-1",
    });
    assert.equal(first.ok, true);

    const second = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-global-2",
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.reason, "usage_limit");
    }
  });

  it("rechecks the global usage limit when redeeming an already issued coupon", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await createCodeCoupon(repository, { usageLimit: 1 });
    const first = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-global-use-1",
    });
    const second = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-global-use-2",
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok || !first.issue.issueId || !second.issue.issueId) return;

    const firstRedemption = await repository.redeemCouponIssue({
      issueId: first.issue.issueId,
      memberId: "member-global-use-1",
    });
    assert.equal(firstRedemption.ok, true);

    const secondRedemption = await repository.redeemCouponIssue({
      issueId: second.issue.issueId,
      memberId: "member-global-use-2",
    });
    assert.equal(secondRedemption.ok, false);
    if (!secondRedemption.ok) {
      assert.equal(secondRedemption.reason, "usage_limit");
    }
  });

  it("assigns partner code pool rows once and reports exhaustion", async () => {
    const repository = new MockAdPackageRepository();
    const now = Date.now();
    const coupon = await repository.createCoupon({
      partnerId: "restaurant-001",
      title: "파트너 코드 쿠폰",
      issuanceType: "partner_code_pool",
      redemptionType: "code",
      status: "active",
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 86_400_000).toISOString(),
      downloadStartsAt: new Date(now - 60_000).toISOString(),
      downloadEndsAt: new Date(now + 86_400_000).toISOString(),
      usageStartsAt: new Date(now - 60_000).toISOString(),
      usageEndsAt: new Date(now + 86_400_000).toISOString(),
    });
    const added = await repository.addCouponCodes({
      couponId: coupon.id,
      codes: [" PARTNER-001 ", "PARTNER-001", "PARTNER-002"],
    });
    assert.deepEqual(added, { addedCount: 2, skippedCount: 0 });

    const first = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-code-1",
    });
    const second = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-code-2",
    });
    const exhausted = await repository.issueCoupon({
      couponId: coupon.id,
      memberId: "member-code-3",
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.issue.assignedCode, "PARTNER-001");
      assert.equal(second.issue.assignedCode, "PARTNER-002");
    }
    assert.equal(exhausted.ok, false);
    if (!exhausted.ok) {
      assert.equal(exhausted.reason, "code_unavailable");
    }
  });

  it("lists every coupon for an admin partner detail page", async () => {
    const repository = new MockAdPackageRepository();
    const standaloneCoupon = await repository.createCoupon({
      partnerId: "restaurant-001",
      title: "캠페인 없는 제휴처 쿠폰",
      status: "draft",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
      onsitePassword: "1234",
    });

    const coupons = await repository.listAdminCouponsForPartner("restaurant-001");

    assert.deepEqual(
      coupons.map((coupon) => coupon.id),
      [standaloneCoupon.id, "coupon-restaurant-lunch"],
    );
    assert.equal(coupons[0]?.status, "draft");
  });

  it("updates a coupon while keeping its existing PIN and duplicates it as a new draft", async () => {
    const repository = new MockAdPackageRepository();
    const source = await repository.createCoupon({
      partnerId: "restaurant-001",
      title: "기존 혜택",
      code: "SOURCE-CODE",
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
      usageLimit: 40,
      perMemberDailyIssueLimit: 1,
      onsitePassword: "0000",
    });

    const updated = await repository.updateCoupon({
      couponId: source.id,
      partnerId: source.partnerId,
      title: "수정한 혜택",
      code: "UPDATED-CODE",
      status: "active",
      startsAt: source.startsAt,
      endsAt: source.endsAt,
      usageLimit: 50,
      perMemberDailyIssueLimit: 2,
      onsitePassword: null,
    });

    assert.equal(updated.title, "수정한 혜택");
    assert.equal(updated.usageLimit, 50);
    assert.equal(updated.hasOnsitePassword, true);

    const duplicated = await repository.duplicateCoupon({ couponId: updated.id });
    assert.notEqual(duplicated.id, updated.id);
    assert.equal(duplicated.status, "draft");
    assert.equal(duplicated.code, "");
    assert.equal(duplicated.usageLimit, 50);
    assert.equal(duplicated.perMemberDailyIssueLimit, 2);
    assert.equal(duplicated.hasOnsitePassword, true);
  });

  it("deletes an unused coupon and returns a safe result for coupons with usage history", async () => {
    const repository = new MockAdPackageRepository();
    const unused = await repository.createCoupon({
      partnerId: "restaurant-001",
      title: "삭제 대상",
      redemptionType: "code",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
    });
    assert.deepEqual(await repository.deleteCoupon(unused.id), { ok: true });
    assert.equal(
      (await repository.listAdminCouponsForPartner("restaurant-001")).some(
        (coupon) => coupon.id === unused.id,
      ),
      false,
    );

    const used = await createCodeCoupon(repository);
    await repository.redeemCoupon({
      couponId: used.id,
      memberId: "member-delete-guard",
      sessionId: "session-delete-guard",
    });
    assert.deepEqual(await repository.deleteCoupon(used.id), {
      ok: false,
      reason: "usage_history",
    });
  });

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
    const campaign = campaigns.find((item) => item.id === coupon.campaignId);

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
    const now = new Date();
    const availableBeforeUse = await repository.listAvailableCouponsForMember({
      memberId: "member-1",
      partnerIds: ["restaurant-001"],
      now,
    });
    assert.equal(
      availableBeforeUse.some((item) => item.coupon.id === coupon.id),
      true,
    );

    await repository.redeemCoupon({
      couponId: coupon.id,
      memberId: "member-1",
      sessionId: "session-1",
    });

    const coupons = await repository.listAvailableCouponsForMember({
      memberId: "member-1",
      partnerIds: ["restaurant-001"],
      now,
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
      endsAt: "2026-12-31T23:59:59.000Z",
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
      ...activeCouponWindow(),
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
      ...activeCouponWindow(),
      onsitePassword: "9876",
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
      onsitePassword: "1234",
    });
    assert.equal(wrong.ok, false);
    assert.equal(wrong.reason, "onsite_password_invalid");

    const valid = await repository.redeemCouponIssue({
      issueId: issued.issue.issueId,
      memberId: "member-2",
      onsitePassword: "9876",
    });
    assert.equal(valid.ok, true);
  });

  it("limits issued coupon reads to the requested partners", async () => {
    const repository = new MockAdPackageRepository();
    const restaurantCoupon = await createCodeCoupon(repository);
    const healthCoupon = await repository.createCoupon({
      partnerId: "health-001",
      title: "헬스 발급 쿠폰",
      status: "active",
      redemptionType: "code",
      ...activeCouponWindow(),
    });
    const memberId = "member-partner-filter";

    assert.equal(
      (await repository.issueCoupon({ couponId: restaurantCoupon.id, memberId })).ok,
      true,
    );
    assert.equal(
      (await repository.issueCoupon({ couponId: healthCoupon.id, memberId })).ok,
      true,
    );

    const issued = await repository.listIssuedCouponsForMember({
      memberId,
      partnerIds: ["health-001"],
    });

    assert.deepEqual(
      issued.map((item) => item.coupon.id),
      [healthCoupon.id],
    );
  });

  it("hides a wallet coupon after a member reaches a periodic issue limit", async () => {
    const repository = new MockAdPackageRepository();
    const coupon = await repository.createCoupon({
      partnerId: "health-001",
      title: "회원별 일 발급 한도 쿠폰",
      status: "active",
      ...activeCouponWindow(),
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
