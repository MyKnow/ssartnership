import assert from "node:assert/strict";
import test from "node:test";

import { createAdminStoredNotificationService } from "../src/lib/admin-notification-store.ts";

function createRepository() {
  const calls: Array<Record<string, unknown>> = [];
  let unreadCount = 3;

  return {
    calls,
    repository: {
      async countUnread(params: { adminId: string }) {
        calls.push({ operation: "countUnread", ...params });
        return unreadCount;
      },
      async markRead(params: {
        adminId: string;
        notificationIds?: string[] | null;
        now: string;
      }) {
        calls.push({ operation: "markRead", ...params });
        const updatedCount = params.notificationIds?.length ?? unreadCount;
        unreadCount = Math.max(0, unreadCount - updatedCount);
        return updatedCount;
      },
      async softDelete(params: {
        adminId: string;
        notificationIds?: string[] | null;
        now: string;
      }) {
        calls.push({ operation: "softDelete", ...params });
        const updatedCount = params.notificationIds?.length ?? 2;
        unreadCount = Math.max(0, unreadCount - updatedCount);
        return updatedCount;
      },
    },
  };
}

test("관리자 알림 저장 서비스는 전체 읽음 처리와 남은 미읽음 수를 한 계약으로 반환한다", async () => {
  const { calls, repository } = createRepository();
  const service = createAdminStoredNotificationService(repository);

  const result = await service.markRead({
    adminId: "admin-1",
    now: "2026-08-31T01:00:00.000Z",
  });

  assert.deepEqual(result, { unreadCount: 0, updatedCount: 3 });
  assert.deepEqual(calls, [
    {
      operation: "markRead",
      adminId: "admin-1",
      notificationIds: undefined,
      now: "2026-08-31T01:00:00.000Z",
    },
    { operation: "countUnread", adminId: "admin-1" },
  ]);
});

test("관리자 알림 저장 서비스는 단건 삭제 범위를 유지하고 남은 미읽음 수를 반환한다", async () => {
  const { calls, repository } = createRepository();
  const service = createAdminStoredNotificationService(repository);

  const result = await service.remove({
    adminId: "admin-1",
    notificationIds: ["notification-1"],
    now: "2026-08-31T02:00:00.000Z",
  });

  assert.deepEqual(result, { unreadCount: 2, updatedCount: 1 });
  assert.deepEqual(calls, [
    {
      operation: "softDelete",
      adminId: "admin-1",
      notificationIds: ["notification-1"],
      now: "2026-08-31T02:00:00.000Z",
    },
    { operation: "countUnread", adminId: "admin-1" },
  ]);
});

test("빈 관리자 알림 선택은 저장 변경 없이 현재 미읽음 수만 조회한다", async () => {
  const { calls, repository } = createRepository();
  const service = createAdminStoredNotificationService(repository);

  const result = await service.markRead({
    adminId: "admin-1",
    notificationIds: [],
  });

  assert.deepEqual(result, { unreadCount: 3, updatedCount: 0 });
  assert.deepEqual(calls, [
    { operation: "countUnread", adminId: "admin-1" },
  ]);
});
