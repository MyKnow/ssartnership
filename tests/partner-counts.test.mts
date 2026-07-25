import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchAdminDashboardHomeSnapshot,
  toAdminDashboardHomeSnapshot,
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
    category_count: null,
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

test("toAdminDashboardHomeSnapshot keeps dashboard counts and queue counts in one safe contract", () => {
  const snapshot = toAdminDashboardHomeSnapshot({
    member_count: "12",
    company_count: 5,
    partner_count: "8",
    category_count: 2,
    account_count: 4,
    review_count: 19,
    active_push_subscription_count: 3,
    product_log_count: "88",
    audit_log_count: 9,
    security_log_count: 7,
    registration_pending_count: "4",
    change_request_pending_count: 3,
    plan_request_pending_count: null,
    unread_notification_count: "2",
  });

  assert.deepEqual(snapshot, {
    counts: {
      memberCount: 12,
      companyCount: 5,
      partnerCount: 8,
      categoryCount: 2,
      accountCount: 4,
      reviewCount: 19,
      activePushSubscriptionCount: 3,
      productLogCount: 88,
      auditLogCount: 9,
      securityLogCount: 7,
    },
    queueCounts: {
      registrationPendingCount: 4,
      changeRequestPendingCount: 3,
      planRequestPendingCount: 0,
      unreadNotificationCount: 2,
    },
  });
});

test("fetchAdminDashboardHomeSnapshot sends only the admin id and validated campus scope to one RPC", async () => {
  const calls: Array<{ name: string; input: unknown }> = [];
  const result = await fetchAdminDashboardHomeSnapshot(
    {
      rpc: async (name: string, input: unknown) => {
        calls.push({ name, input });
        return {
          data: [{ partner_count: 3, registration_pending_count: 2 }],
          error: null,
        };
      },
    } as never,
    { adminId: "admin-1", managedCampusSlugs: ["seoul"] },
  );

  assert.deepEqual(calls, [{
    name: "get_admin_dashboard_home_snapshot",
    input: {
      input_admin_id: "admin-1",
      input_managed_campus_slugs: ["seoul"],
    },
  }]);
  assert.equal(result.hasError, false);
  assert.equal(result.snapshot.counts.partnerCount, 3);
  assert.equal(result.snapshot.queueCounts.registrationPendingCount, 2);
});

test("fetchAdminDashboardHomeSnapshot marks a failed aggregate as unavailable without returning the raw error", async () => {
  const result = await fetchAdminDashboardHomeSnapshot(
    {
      rpc: async () => ({ data: null, error: { message: "database details" } }),
    } as never,
    { adminId: "admin-1", managedCampusSlugs: null },
  );

  assert.equal(result.snapshot.queueCounts.changeRequestPendingCount, 0);
  assert.equal(result.hasError, true);
  assert.doesNotMatch(JSON.stringify(result), /database details/);
});

test("fetchPartnerEngagementCounts reads favorite and review counts in one RPC", async () => {
  const rpcCalls: string[] = [];
  const result = await fetchPartnerEngagementCounts(
    {
      rpc: async (name: string) => {
        rpcCalls.push(name);
        return {
        data: [
            { partner_id: "partner-a", favorite_count: 7, review_count: "4" },
            { partner_id: "partner-b", favorite_count: "1", review_count: 2 },
        ],
        error: null,
        };
      },
    } as never,
    ["partner-a", "partner-b"],
  );

  assert.deepEqual(rpcCalls, ["get_partner_engagement_counts"]);
  assert.equal(result.engagementErrorMessage, null);
  assert.equal(result.favoriteCounts.get("partner-a"), 7);
  assert.equal(result.favoriteCounts.get("partner-b"), 1);
  assert.equal(result.reviewCounts.get("partner-a"), 4);
  assert.equal(result.reviewCounts.get("partner-b"), 2);
});

test("fetchPartnerEngagementCounts degrades both maps to zero on RPC failures", async () => {
  const result = await fetchPartnerEngagementCounts(
    {
      rpc: async () => {
        throw new Error("review failed");
      },
    } as never,
    ["partner-a"],
  );

  assert.equal(result.engagementErrorMessage, "review failed");
  assert.equal(result.favoriteCounts.get("partner-a"), 0);
  assert.equal(result.reviewCounts.get("partner-a"), 0);
});
