import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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

  it("accepts an unlimited-length numeric onsite password and rejects non-numeric values", () => {
    const password = "9".repeat(300);
    assert.equal(normalizeCouponVerificationPassword(password), password);
    assert.equal(normalizeCouponVerificationPassword(""), null);
    assert.throws(() => normalizeCouponVerificationPassword("12 34"));
    assert.throws(() => normalizeCouponVerificationPassword("12a34"));
  });

  it("stores and verifies only a salted password hash", async () => {
    const stored = await hashCouponVerificationPassword("20260720");
    assert.notEqual(stored.hash, "20260720");
    assert.notEqual(stored.salt, "");
    assert.equal(
      await verifyCouponVerificationPassword("20260720", stored),
      true,
    );
    assert.equal(
      await verifyCouponVerificationPassword("20260721", stored),
      false,
    );
  });
});
