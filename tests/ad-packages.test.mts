import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AD_PACKAGE_TIERS,
  createEmptyAdPackageMetrics,
  getAdPackageDefinition,
  isAdCouponDownloadable,
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

  it("checks coupon downloadability by campaign, download window, and status", () => {
    const activeCampaign = {
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
    } satisfies AdCampaignLike;
    const activeCoupon = {
      status: "active",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-07-31T23:59:59.000Z",
      downloadStartsAt: "2026-07-10T00:00:00.000Z",
      downloadEndsAt: "2026-07-20T23:59:59.000Z",
    } satisfies AdCouponLike & { downloadStartsAt: string; downloadEndsAt: string };
    const now = new Date("2026-07-15T12:00:00.000Z");

    assert.equal(
      isAdCouponDownloadable({ coupon: activeCoupon, campaign: activeCampaign, now }),
      true,
    );
    // The download window, not the usage period, bounds downloads.
    assert.equal(
      isAdCouponDownloadable({
        coupon: activeCoupon,
        campaign: activeCampaign,
        now: new Date("2026-07-25T12:00:00.000Z"),
      }),
      false,
    );
    assert.equal(
      isAdCouponDownloadable({
        coupon: { ...activeCoupon, status: "paused" },
        campaign: activeCampaign,
        now,
      }),
      false,
    );
    assert.equal(
      isAdCouponDownloadable({
        coupon: activeCoupon,
        campaign: { ...activeCampaign, status: "paused" },
        now,
      }),
      false,
    );
    // A coupon without a campaign follows only its own status and window.
    assert.equal(
      isAdCouponDownloadable({ coupon: activeCoupon, campaign: null, now }),
      true,
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

describe("ad campaign and coupon status transitions", () => {
  it("keeps ended terminal and allows only the documented transitions", async () => {
    const {
      AD_CAMPAIGN_STATUSES,
      AD_CAMPAIGN_STATUS_TRANSITIONS,
      AD_COUPON_STATUS_TRANSITIONS,
      canDeleteAdCouponWithStatus,
      canTransitionAdCampaignStatus,
      canTransitionAdCouponStatus,
      listAdCampaignStatusTransitions,
      listAdCouponStatusOptions,
    } = await import("../src/lib/ad-packages.ts");

    assert.deepEqual(AD_CAMPAIGN_STATUS_TRANSITIONS, AD_COUPON_STATUS_TRANSITIONS);
    const allowed = new Set([
      "draft>active",
      "draft>ended",
      "active>paused",
      "active>ended",
      "paused>active",
      "paused>ended",
    ]);
    for (const from of AD_CAMPAIGN_STATUSES) {
      for (const to of AD_CAMPAIGN_STATUSES) {
        const expected = from === to || allowed.has(`${from}>${to}`);
        assert.equal(canTransitionAdCampaignStatus(from, to), expected, `${from}>${to}`);
        assert.equal(canTransitionAdCouponStatus(from, to), expected, `${from}>${to}`);
      }
    }

    assert.deepEqual(listAdCampaignStatusTransitions("ended"), []);
    assert.deepEqual(listAdCampaignStatusTransitions("paused"), ["active", "ended"]);
    assert.deepEqual(listAdCouponStatusOptions("active"), ["active", "paused", "ended"]);
    assert.deepEqual(listAdCouponStatusOptions("ended"), ["ended"]);
    assert.equal(canDeleteAdCouponWithStatus("active"), false);
    assert.equal(canDeleteAdCouponWithStatus("draft"), true);
    assert.equal(canDeleteAdCouponWithStatus("paused"), true);
    assert.equal(canDeleteAdCouponWithStatus("ended"), true);
  });
});
