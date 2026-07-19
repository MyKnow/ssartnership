import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCreateAdCouponForm } from "../src/lib/ad-package-validation.ts";

function buildForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const values = {
    partnerId: "partner-1",
    title: "현장 확인 쿠폰",
    startsAt: "2026-07-01T00:00",
    endsAt: "2026-07-31T23:59",
    downloadStartsAt: "2026-07-01T00:00",
    downloadEndsAt: "2026-07-31T23:59",
    usageStartsAt: "2026-07-01T00:00",
    usageEndsAt: "2026-07-31T23:59",
    redemptionType: "onsite",
    issuanceType: "service",
    status: "active",
    onsitePassword: "1234",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    form.set(key, value);
  }
  return form;
}

describe("ad coupon validation", () => {
  it("parses member daily, weekly, and monthly issue limits", () => {
    const input = parseCreateAdCouponForm(
      buildForm({
        perMemberDailyIssueLimit: "1",
        perMemberWeeklyIssueLimit: "3",
        perMemberMonthlyIssueLimit: "7",
      }),
    );

    assert.deepEqual(
      {
        daily: input.perMemberDailyIssueLimit,
        weekly: input.perMemberWeeklyIssueLimit,
        monthly: input.perMemberMonthlyIssueLimit,
      },
      { daily: 1, weekly: 3, monthly: 7 },
    );
  });

  it("allows an unlimited-length numeric password but rejects invalid types", () => {
    const password = "8".repeat(256);
    const input = parseCreateAdCouponForm(buildForm({ onsitePassword: password }));
    assert.equal(input.onsitePassword, password);
    assert.throws(() => parseCreateAdCouponForm(buildForm({ onsitePassword: "12-34" })));
    assert.throws(() =>
      parseCreateAdCouponForm(
        buildForm({ redemptionType: "code", onsitePassword: "1234" }),
      ),
    );
  });
});
