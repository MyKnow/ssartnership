import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PARTNER_COMPANY_PLAN_TIERS,
  canAccessPartnerMetric,
  getPartnerCompanyPlanDefinition,
  getPlanAllowedAdChannels,
  normalizePartnerCompanyPlanTier,
  type PartnerMetricKey,
} from "../src/lib/partner-company-plans.ts";

describe("partner company plans", () => {
  it("exposes only Basic, Partner, and Boost as company plans", () => {
    assert.deepEqual(PARTNER_COMPANY_PLAN_TIERS, ["basic", "partner", "boost"]);
    assert.equal(normalizePartnerCompanyPlanTier("sponsor"), "basic");
    assert.equal(getPartnerCompanyPlanDefinition("basic").label, "Basic");
    assert.equal(getPartnerCompanyPlanDefinition("boost").monthlyPriceKrw, 150_000);
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
