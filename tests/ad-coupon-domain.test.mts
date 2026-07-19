import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCouponIssueWindow,
  getRemainingIssueCount,
  isCouponDownloadable,
  normalizeCouponCodeRows,
  type CouponQuotaSnapshot,
} from "../src/lib/ad-coupon-domain.ts";

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
});
