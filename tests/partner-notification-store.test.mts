import assert from "node:assert/strict";
import test from "node:test";

import { createPartnerStoredNotificationService } from "../src/lib/partner-notification-store.ts";

test("partner stored notification list reuses the same scoped ids for unread count and item fetch", async () => {
  const calls: string[] = [];
  const service = createPartnerStoredNotificationService({
    async listScopedNotificationIds(companyId: string) {
      calls.push(`scope:${companyId}`);
      return ["notification-1", "notification-3"];
    },
    async countUnread({ accountId, notificationIds }) {
      calls.push(`count:${accountId}:${notificationIds?.join(",") ?? "all"}`);
      return 1;
    },
    async list({ accountId, notificationIds, limit }) {
      calls.push(
        `list:${accountId}:${notificationIds?.join(",") ?? "all"}:${limit}`,
      );
      return [
        {
          id: "recipient-1",
          read_at: null,
          created_at: "2026-08-30T09:00:00.000Z",
          notification: {
            id: "notification-1",
            type: "plan",
            title: "새 플랜 알림",
            body: "확인해 주세요.",
            target_url: "/partner/plans",
            company_id: "company-1",
            created_at: "2026-08-30T09:00:00.000Z",
          },
        },
      ];
    },
    async markRead() {
      throw new Error("not expected");
    },
    async softDelete() {
      throw new Error("not expected");
    },
  });

  const result = await service.list({
    accountId: "partner-account-1",
    companyId: "company-1",
    limit: 10,
  });

  assert.equal(result.isEmptyScope, false);
  assert.equal(result.unreadCount, 1);
  assert.equal(result.items.length, 1);
  assert.deepEqual(calls, [
    "scope:company-1",
    "count:partner-account-1:notification-1,notification-3",
    "list:partner-account-1:notification-1,notification-3:10",
  ]);
});

test("partner stored notification list short-circuits when a company has no visible notifications", async () => {
  let countCalled = false;
  let listCalled = false;

  const service = createPartnerStoredNotificationService({
    async listScopedNotificationIds() {
      return [];
    },
    async countUnread() {
      countCalled = true;
      return 99;
    },
    async list() {
      listCalled = true;
      return [];
    },
    async markRead() {
      throw new Error("not expected");
    },
    async softDelete() {
      throw new Error("not expected");
    },
  });

  const result = await service.list({
    accountId: "partner-account-1",
    companyId: "company-2",
  });

  assert.deepEqual(result, { isEmptyScope: true, unreadCount: 0, items: [] });
  assert.equal(countCalled, false);
  assert.equal(listCalled, false);
});

test("partner stored notification list clamps repository limits at the storage boundary", async () => {
  const limits: number[] = [];
  const service = createPartnerStoredNotificationService({
    async listScopedNotificationIds() {
      return ["notification-1"];
    },
    async countUnread() {
      return 0;
    },
    async list({ limit }) {
      limits.push(limit);
      return [];
    },
    async markRead() {
      return 0;
    },
    async softDelete() {
      return 0;
    },
  });

  await service.list({ accountId: "partner-account-1", limit: 10_000 });
  await service.list({ accountId: "partner-account-1", limit: 0 });
  await service.list({ accountId: "partner-account-1", limit: Number.NaN });

  assert.deepEqual(limits, [100, 1, 30]);
});

test("partner stored notification mutations no-op on an empty selection and recalculate unread count after writes", async () => {
  const markCalls: Array<string[] | null | undefined> = [];
  const deleteCalls: Array<string[] | null | undefined> = [];
  const countCalls: Array<string[] | null | undefined> = [];

  const service = createPartnerStoredNotificationService({
    async listScopedNotificationIds() {
      return [];
    },
    async countUnread({ notificationIds }) {
      countCalls.push(notificationIds);
      return countCalls.length === 1 ? 4 : 1;
    },
    async list() {
      return [];
    },
    async markRead({ notificationIds }) {
      markCalls.push(notificationIds);
      return 2;
    },
    async softDelete({ notificationIds }) {
      deleteCalls.push(notificationIds);
      return 1;
    },
  });

  const noSelection = await service.markRead({
    accountId: "partner-account-1",
    notificationIds: [],
  });
  const marked = await service.markRead({
    accountId: "partner-account-1",
    notificationIds: ["notification-1", "notification-2"],
  });
  const removed = await service.remove({
    accountId: "partner-account-1",
    notificationIds: ["notification-3"],
  });

  assert.deepEqual(noSelection, { unreadCount: 4, updatedCount: 0 });
  assert.deepEqual(marked, { unreadCount: 1, updatedCount: 2 });
  assert.deepEqual(removed, { unreadCount: 1, updatedCount: 1 });
  assert.deepEqual(markCalls, [["notification-1", "notification-2"]]);
  assert.deepEqual(deleteCalls, [["notification-3"]]);
  assert.deepEqual(countCalls, [undefined, undefined, undefined]);
});
