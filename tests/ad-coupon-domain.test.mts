import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareAvailableCoupons,
  getAvailableCouponUsage,
  selectAvailableCouponsForMember,
  type AvailableCouponSource,
  getKstPeriodKey,
  getMemberIssueCountSnapshot,
  getCouponIssueWindow,
  getRemainingIssueCount,
  isMemberIssueLimitReached,
  isCouponDownloadable,
  normalizeCouponCodeRows,
  type CouponQuotaSnapshot,
} from "../src/lib/ad-coupon-domain.ts";
import {
  hashCouponVerificationPassword,
  normalizeCouponVerificationPassword,
  verifyCouponVerificationPassword,
} from "../src/lib/coupon-verification-password.ts";

describe("ad coupon domain", () => {
  it("uses separate download and usage windows", () => {
    const coupon = {
      downloadStartsAt: "2026-07-01T00:00:00.000Z",
      downloadEndsAt: "2026-07-10T23:59:59.000Z",
      usageStartsAt: "2026-07-05T00:00:00.000Z",
      usageEndsAt: "2026-07-31T23:59:59.000Z",
    };

    assert.equal(
      isCouponDownloadable(coupon, new Date("2026-07-03T12:00:00.000Z")),
      true,
    );
    assert.equal(
      isCouponDownloadable(coupon, new Date("2026-07-11T00:00:00.000Z")),
      false,
    );
    assert.deepEqual(getCouponIssueWindow(coupon), {
      startsAt: coupon.usageStartsAt,
      endsAt: coupon.usageEndsAt,
    });
  });

  it("calculates the smallest configured issue quota as the remaining count", () => {
    const quotas: CouponQuotaSnapshot = {
      daily: { limit: 10, issued: 4 },
      weekly: { limit: 30, issued: 12 },
      monthly: { limit: null, issued: 0 },
      codePoolRemaining: null,
    };

    assert.equal(getRemainingIssueCount(quotas), 6);
    assert.equal(
      getRemainingIssueCount({ ...quotas, daily: { limit: null, issued: 0 } }),
      18,
    );
    assert.equal(
      getRemainingIssueCount({ ...quotas, codePoolRemaining: 3 }),
      3,
    );
    assert.equal(
      getRemainingIssueCount({
        daily: { limit: null, issued: 999 },
        weekly: { limit: null, issued: 999 },
        monthly: { limit: null, issued: 999 },
        codePoolRemaining: null,
      }),
      null,
    );
  });

  it("normalizes manually entered and spreadsheet code rows", () => {
    assert.deepEqual(
      normalizeCouponCodeRows([" A-001 ", "", "A-001", "A-002", "A-002"]),
      { codes: ["A-001", "A-002"], skipped: 3 },
    );
  });

  it("counts member issue limits by the Korea Standard Time day, week, and month", () => {
    const now = new Date("2026-07-21T00:30:00.000Z");
    assert.equal(getKstPeriodKey(now, "daily"), "2026-07-21");
    assert.equal(getKstPeriodKey(now, "weekly"), "2026-07-20");
    assert.equal(getKstPeriodKey(now, "monthly"), "2026-07");

    const snapshot = getMemberIssueCountSnapshot({
      couponId: "coupon-1",
      memberId: "member-1",
      limits: { daily: 1, weekly: 2, monthly: 3 },
      now,
      records: [
        { couponId: "coupon-1", memberId: "member-1", issuedAt: "2026-07-20T00:30:00.000Z" },
        { couponId: "coupon-1", memberId: "member-1", issuedAt: "2026-07-19T23:00:00.000Z" },
        { couponId: "coupon-1", memberId: "member-1", issuedAt: "2026-06-30T00:00:00.000Z" },
      ],
    });

    assert.deepEqual(snapshot, {
      daily: { limit: 1, issued: 0 },
      weekly: { limit: 2, issued: 2 },
      monthly: { limit: 3, issued: 2 },
    });
    assert.equal(isMemberIssueLimitReached(snapshot), true);
  });

  it("accepts a four-digit onsite PIN and rejects other values", () => {
    const password = "9876";
    assert.equal(normalizeCouponVerificationPassword(password), password);
    assert.equal(normalizeCouponVerificationPassword(""), null);
    assert.throws(() => normalizeCouponVerificationPassword("12 34"));
    assert.throws(() => normalizeCouponVerificationPassword("12a34"));
  });

  it("stores and verifies only a salted password hash", async () => {
    const stored = await hashCouponVerificationPassword("2020");
    assert.notEqual(stored.hash, "2020");
    assert.notEqual(stored.salt, "");
    assert.equal(
      await verifyCouponVerificationPassword("2020", stored),
      true,
    );
    assert.equal(
      await verifyCouponVerificationPassword("2021", stored),
      false,
    );
  });
});

const SELECTION_NOW = new Date("2026-07-21T03:00:00.000Z");

function createAvailabilityCoupon(overrides: Partial<AvailableCouponSource> = {}): AvailableCouponSource {
  return {
    id: "coupon-1",
    status: "active",
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: "2026-07-31T14:59:59.000Z",
    downloadStartsAt: "2026-07-01T00:00:00.000Z",
    downloadEndsAt: "2026-07-31T14:59:59.000Z",
    usageLimit: null,
    usedCount: 0,
    perMemberLimit: 1,
    dailyIssueLimit: null,
    weeklyIssueLimit: null,
    monthlyIssueLimit: null,
    perMemberDailyIssueLimit: null,
    perMemberWeeklyIssueLimit: null,
    perMemberMonthlyIssueLimit: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("member coupon availability selection", () => {
  it("returns remaining uses and drops coupons whose member or global uses are exhausted", () => {
    assert.deepEqual(
      getAvailableCouponUsage(createAvailabilityCoupon({ perMemberLimit: 3, usageLimit: 10, usedCount: 4 }), 1),
      {
        coupon: createAvailabilityCoupon({ perMemberLimit: 3, usageLimit: 10, usedCount: 4 }),
        memberUsedCount: 1,
        remainingMemberUses: 2,
        remainingGlobalUses: 6,
      },
    );
    assert.equal(getAvailableCouponUsage(createAvailabilityCoupon({ perMemberLimit: 1 }), 1), null);
    assert.equal(
      getAvailableCouponUsage(createAvailabilityCoupon({ usageLimit: 5, usedCount: 5 }), 0),
      null,
    );
    assert.equal(
      getAvailableCouponUsage(createAvailabilityCoupon(), 0)?.remainingGlobalUses,
      null,
    );
  });

  it("filters by download window, coupon status, and campaign state", () => {
    const selected = selectAvailableCouponsForMember({
      candidates: [
        { coupon: createAvailabilityCoupon({ id: "open" }), memberUsedCount: 0 },
        {
          coupon: createAvailabilityCoupon({ id: "not-yet", downloadStartsAt: "2026-07-22T00:00:00.000Z" }),
          memberUsedCount: 0,
        },
        {
          coupon: createAvailabilityCoupon({ id: "closed", downloadEndsAt: "2026-07-20T00:00:00.000Z" }),
          memberUsedCount: 0,
        },
        { coupon: createAvailabilityCoupon({ id: "paused", status: "paused" }), memberUsedCount: 0 },
        {
          coupon: createAvailabilityCoupon({ id: "campaign-ended" }),
          campaign: { status: "ended", startsAt: null, endsAt: null },
          memberUsedCount: 0,
        },
        {
          coupon: createAvailabilityCoupon({ id: "campaign-active" }),
          campaign: { status: "active", startsAt: "2026-07-01T00:00:00.000Z", endsAt: "2026-08-01T00:00:00.000Z" },
          memberUsedCount: 0,
        },
      ],
      couponIssueRecords: [],
      memberIssueRecords: [],
      now: SELECTION_NOW,
    });

    assert.deepEqual(
      selected.map((item) => item.coupon.id).sort(),
      ["campaign-active", "open"],
    );
  });

  it("applies coupon-wide and member issue limits by KST period", () => {
    const coupon = createAvailabilityCoupon({
      id: "limited",
      dailyIssueLimit: 2,
      perMemberWeeklyIssueLimit: 1,
      perMemberLimit: 5,
    });
    const otherCoupon = createAvailabilityCoupon({ id: "other", perMemberLimit: 5 });
    const todayIssues = [
      { couponId: "limited", issuedAt: "2026-07-21T00:10:00.000Z" },
      { couponId: "limited", issuedAt: "2026-07-21T01:10:00.000Z" },
    ];

    const dailyReached = selectAvailableCouponsForMember({
      candidates: [
        { coupon, memberUsedCount: 0 },
        { coupon: otherCoupon, memberUsedCount: 0 },
      ],
      couponIssueRecords: todayIssues,
      memberIssueRecords: [],
      now: SELECTION_NOW,
    });
    assert.deepEqual(dailyReached.map((item) => item.coupon.id), ["other"]);

    const yesterdayIssues = [
      { couponId: "limited", issuedAt: "2026-07-20T00:10:00.000Z" },
    ];
    const memberWeeklyReached = selectAvailableCouponsForMember({
      candidates: [{ coupon, memberUsedCount: 0 }],
      couponIssueRecords: yesterdayIssues,
      memberIssueRecords: yesterdayIssues,
      now: SELECTION_NOW,
    });
    assert.deepEqual(memberWeeklyReached, []);

    const anotherMemberIssued = selectAvailableCouponsForMember({
      candidates: [{ coupon, memberUsedCount: 0 }],
      couponIssueRecords: yesterdayIssues,
      memberIssueRecords: [],
      now: SELECTION_NOW,
    });
    assert.deepEqual(anotherMemberIssued.map((item) => item.coupon.id), ["limited"]);
  });

  it("sorts by earliest end time, keeps invalid end dates last, and breaks ties by newest", () => {
    const selected = selectAvailableCouponsForMember({
      candidates: [
        {
          coupon: createAvailabilityCoupon({ id: "invalid-end", endsAt: "not-a-date" }),
          memberUsedCount: 0,
        },
        {
          coupon: createAvailabilityCoupon({ id: "late", endsAt: "2026-08-31T00:00:00.000Z" }),
          memberUsedCount: 0,
        },
        {
          coupon: createAvailabilityCoupon({
            id: "soon-old",
            endsAt: "2026-07-25T00:00:00.000Z",
            createdAt: "2026-07-01T00:00:00.000Z",
          }),
          memberUsedCount: 0,
        },
        {
          coupon: createAvailabilityCoupon({
            id: "soon-new",
            endsAt: "2026-07-25T00:00:00.000Z",
            createdAt: "2026-07-10T00:00:00.000Z",
          }),
          memberUsedCount: 0,
        },
      ],
      couponIssueRecords: [],
      memberIssueRecords: [],
      now: SELECTION_NOW,
    });

    assert.deepEqual(
      selected.map((item) => item.coupon.id),
      ["soon-new", "soon-old", "late", "invalid-end"],
    );
    assert.equal(
      compareAvailableCoupons(
        { coupon: { endsAt: "x", createdAt: "a" } },
        { coupon: { endsAt: "2026-01-01T00:00:00.000Z", createdAt: "a" } },
      ) > 0,
      true,
    );
  });
});
