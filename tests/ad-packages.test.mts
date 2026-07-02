import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AD_PACKAGE_TIERS,
  createEmptyAdPackageMetrics,
  getAdPackageDefinition,
  isAdCouponRedeemable,
  normalizeAdChannelsForTier,
  summarizeAdPackageMetrics,
  type AdCampaignLike,
  type AdCouponLike,
  type AdPackageMetricEvent,
} from "../src/lib/ad-packages.ts";

describe("ad packages", () => {
  it("defines the initial direct-sold package tiers", () => {
    assert.deepEqual(AD_PACKAGE_TIERS, ["basic", "partner", "boost"]);

    assert.equal(getAdPackageDefinition("basic").monthlyPriceKrw, 0);
    assert.deepEqual(getAdPackageDefinition("basic").includedChannels, ["coupon"]);
    assert.deepEqual(getAdPackageDefinition("boost").includedChannels, [
      "coupon",
      "home_banner",
      "push",
      "mm",
      "ad_banner",
    ]);
    assert.equal(getAdPackageDefinition("boost").priority, 30);
  });

  it("normalizes package channels by tier", () => {
    assert.deepEqual(
      normalizeAdChannelsForTier("boost", [
        "coupon",
        "home_banner",
        "push",
        "mm",
        "ad_banner",
      ]),
      ["coupon", "home_banner", "push", "mm", "ad_banner"],
    );
    assert.deepEqual(
      normalizeAdChannelsForTier("partner", ["coupon", "home_banner", "push"]),
      ["coupon"],
    );
  });

  it("checks coupon redeemability by campaign, dates, status, and limit", () => {
    const activeCampaign = {
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
    } satisfies AdCampaignLike;
    const activeCoupon = {
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
      usageLimit: 10,
      usedCount: 9,
    } satisfies AdCouponLike;

    assert.equal(
      isAdCouponRedeemable({
        coupon: activeCoupon,
        campaign: activeCampaign,
        now: new Date("2026-07-15T12:00:00.000Z"),
      }),
      true,
    );
    assert.equal(
      isAdCouponRedeemable({
        coupon: { ...activeCoupon, usedCount: 10 },
        campaign: activeCampaign,
        now: new Date("2026-07-15T12:00:00.000Z"),
      }),
      false,
    );
    assert.equal(
      isAdCouponRedeemable({
        coupon: activeCoupon,
        campaign: { ...activeCampaign, status: "paused" },
        now: new Date("2026-07-15T12:00:00.000Z"),
      }),
      false,
    );
  });

  it("summarizes campaign metrics from product events and redemptions", () => {
    const events: AdPackageMetricEvent[] = [
      { eventName: "home_banner_click", campaignId: "campaign-1" },
      { eventName: "home_banner_click", campaignId: "campaign-1" },
      { eventName: "coupon_view", campaignId: "campaign-1", couponId: "coupon-1" },
      { eventName: "coupon_copy", campaignId: "campaign-1", couponId: "coupon-1" },
      { eventName: "coupon_redeem", campaignId: "campaign-1", couponId: "coupon-1" },
      { eventName: "coupon_redeem", campaignId: "campaign-2", couponId: "coupon-2" },
    ];

    assert.deepEqual(
      summarizeAdPackageMetrics({
        campaignId: "campaign-1",
        events,
        redemptionCount: 3,
      }),
      {
        ...createEmptyAdPackageMetrics(),
        homeBannerClicks: 2,
        couponViews: 1,
        couponCopies: 1,
        couponIntentCount: 1,
        couponRedemptions: 3,
      },
    );
  });
});
