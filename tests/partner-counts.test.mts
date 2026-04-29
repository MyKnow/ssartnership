import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchPartnerEngagementCounts,
  toAdminDashboardCounts,
  toPartnerCountMap,
} from "@/lib/partner-counts";

test("toPartnerCountMap normalizes string counts and preserves missing ids as zero", () => {
  const counts = toPartnerCountMap(
    ["partner-a", "partner-b", "partner-c"],
    [
      { partner_id: "partner-a", count: "3" },
      { partner_id: "partner-b", count: 2 },
      { partner_id: "unknown", count: 99 },
    ],
  );

  assert.equal(counts.get("partner-a"), 3);
  assert.equal(counts.get("partner-b"), 2);
  assert.equal(counts.get("partner-c"), 0);
});

test("toPartnerCountMap deduplicates and trims requested ids", () => {
  const counts = toPartnerCountMap(
    [" partner-a ", "partner-a", "", "partner-b"],
    [{ partner_id: "partner-a", count: "5" }],
  );

  assert.deepEqual(Array.from(counts.entries()), [
    ["partner-a", 5],
    ["partner-b", 0],
  ]);
});

test("toAdminDashboardCounts normalizes nullable and string RPC values", () => {
  const counts = toAdminDashboardCounts({
    member_count: "12",
    company_count: 5,
    partner_count: null,
    category_count: undefined,
    account_count: "4",
    review_count: "19",
    active_push_subscription_count: 3,
    product_log_count: "88",
    audit_log_count: null,
    security_log_count: "7",
  });

  assert.deepEqual(counts, {
    memberCount: 12,
    companyCount: 5,
    partnerCount: 0,
    categoryCount: 0,
    accountCount: 4,
    reviewCount: 19,
    activePushSubscriptionCount: 3,
    productLogCount: 88,
    auditLogCount: 0,
    securityLogCount: 7,
  });
});

test("fetchPartnerEngagementCounts merges favorite and review maps", async () => {
  const result = await fetchPartnerEngagementCounts(
    {
      rpc: async () => ({
        data: [
          { partner_id: "partner-a", review_count: "4" },
          { partner_id: "partner-b", review_count: 2 },
        ],
        error: null,
      }),
    } as never,
    ["partner-a", "partner-b"],
    async () => new Map([
      ["partner-a", 7],
      ["partner-b", 1],
    ]),
  );

  assert.equal(result.favoriteErrorMessage, null);
  assert.equal(result.reviewErrorMessage, null);
  assert.equal(result.favoriteCounts.get("partner-a"), 7);
  assert.equal(result.favoriteCounts.get("partner-b"), 1);
  assert.equal(result.reviewCounts.get("partner-a"), 4);
  assert.equal(result.reviewCounts.get("partner-b"), 2);
});

test("fetchPartnerEngagementCounts degrades to zero maps on loader failures", async () => {
  const result = await fetchPartnerEngagementCounts(
    {
      rpc: async () => {
        throw new Error("review failed");
      },
    } as never,
    ["partner-a"],
    async () => {
      throw new Error("favorite failed");
    },
  );

  assert.equal(result.favoriteErrorMessage, "favorite failed");
  assert.equal(result.reviewErrorMessage, "review failed");
  assert.equal(result.favoriteCounts.get("partner-a"), 0);
  assert.equal(result.reviewCounts.get("partner-a"), 0);
});
