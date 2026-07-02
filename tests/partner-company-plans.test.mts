import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PARTNER_BRAND_PLAN_DEFINITIONS,
  PARTNER_BRAND_PLAN_TIERS,
  PARTNER_COMPANY_PLAN_TIERS,
  canAccessPartnerMetric,
  getPartnerCompanyPlanDefinition,
  getPlanAllowedAdChannels,
  normalizePartnerCompanyPlanTier,
  resolvePartnerBrandPlanWindow,
  type PartnerMetricKey,
} from "../src/lib/partner-company-plans.ts";

describe("partner company plans", () => {
  it("exposes only Basic, Partner, and Boost as brand plans", () => {
    assert.deepEqual(PARTNER_COMPANY_PLAN_TIERS, ["basic", "partner", "boost"]);
    assert.deepEqual(PARTNER_BRAND_PLAN_TIERS, ["basic", "partner", "boost"]);
    assert.equal(PARTNER_BRAND_PLAN_DEFINITIONS.length, 3);
    assert.equal(normalizePartnerCompanyPlanTier("sponsor"), "basic");
    assert.equal(getPartnerCompanyPlanDefinition("basic").label, "Basic");
    assert.equal(getPartnerCompanyPlanDefinition("boost").monthlyPriceKrw, 150_000);
  });

  it("resolves Basic plan dates from the partnership period", () => {
    assert.deepEqual(
      resolvePartnerBrandPlanWindow({
        planTier: "basic",
        periodStart: "2026-07-01",
        periodEnd: "2026-09-30",
        planStartedAt: "2026-08-01T00:00:00+09:00",
        planExpiresAt: "2026-08-31T23:59:59+09:00",
      }),
      {
        planStartedAt: "2026-07-01T00:00:00+09:00",
        planExpiresAt: "2026-09-30T23:59:59+09:00",
      },
    );

    assert.deepEqual(
      resolvePartnerBrandPlanWindow({
        planTier: "boost",
        periodStart: "2026-07-01",
        periodEnd: "2026-09-30",
        planStartedAt: "2026-08-01T00:00:00+09:00",
        planExpiresAt: "2026-08-31T23:59:59+09:00",
      }),
      {
        planStartedAt: "2026-08-01T00:00:00+09:00",
        planExpiresAt: "2026-08-31T23:59:59+09:00",
      },
    );
  });

  it("maps plan tiers to allowed ad channels", () => {
    assert.deepEqual(getPlanAllowedAdChannels("basic"), ["coupon"]);
    assert.deepEqual(getPlanAllowedAdChannels("partner"), ["coupon"]);
    assert.deepEqual(getPlanAllowedAdChannels("boost"), [
      "coupon",
      "home_banner",
      "push",
      "mm",
      "ad_banner",
    ]);
  });

  it("gates partner portal metrics by plan tier", () => {
    const basicAllowed: PartnerMetricKey[] = [
      "favoriteCount",
      "reviewCount",
      "detailViews",
      "totalClicks",
    ];
    const boostOnly: PartnerMetricKey[] = [
      "detailUv",
      "cardClicks",
      "mapClicks",
      "reservationClicks",
      "inquiryClicks",
      "timeseries",
      "adPerformance",
    ];

    for (const key of basicAllowed) {
      assert.equal(canAccessPartnerMetric("basic", key), true);
    }
    for (const key of boostOnly) {
      assert.equal(canAccessPartnerMetric("basic", key), false);
    }

    assert.equal(canAccessPartnerMetric("partner", "detailUv"), true);
    assert.equal(canAccessPartnerMetric("partner", "timeseries"), false);
    assert.equal(canAccessPartnerMetric("boost", "timeseries"), true);
    assert.equal(canAccessPartnerMetric("boost", "adPerformance"), true);
  });
});
