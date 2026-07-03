import assert from "node:assert/strict";
import test from "node:test";

type AdminNotificationInboxModule = typeof import("../src/lib/admin-notification-inbox.ts");

const modulePromise = import(
  new URL("../src/lib/admin-notification-inbox.ts", import.meta.url).href
) as Promise<AdminNotificationInboxModule>;
const adminNavigationModulePromise = import(
  new URL("../src/components/admin/admin-navigation.ts", import.meta.url).href
) as Promise<typeof import("../src/components/admin/admin-navigation.ts")>;

test("admin notification inbox maps recipient rows into client records", async () => {
  const {
    buildAdminNotificationListResult,
    getAdminNotificationTypeLabel,
  } = await modulePromise;

  const result = buildAdminNotificationListResult({
    unreadCount: 3,
    rows: [
      {
        id: "recipient-1",
        read_at: null,
        deleted_at: null,
        created_at: "2026-07-03T01:00:00.000Z",
        notification: {
          id: "notification-1",
          type: "partner_change_request",
          title: "변경 요청",
          body: "브랜드 정보 수정 요청이 접수되었습니다.",
          target_url: "/admin/partners/partner-1",
          metadata: { source: "partner" },
          created_at: "2026-07-03T02:00:00.000Z",
        },
      },
      {
        id: "recipient-2",
        read_at: "2026-07-03T03:00:00.000Z",
        deleted_at: null,
        created_at: "2026-07-03T01:30:00.000Z",
        notification: [
          {
            id: "notification-2",
            type: "security_alert",
            title: null,
            body: null,
            target_url: "https://example.com",
            metadata: null,
            created_at: null,
          },
        ],
      },
      {
        id: null,
        notification: {
          id: "ignored",
          type: "expiring_partner",
        },
      },
    ],
    offset: 10,
    limit: 2,
    hasMore: true,
  });

  assert.equal(result.unreadCount, 3);
  assert.equal(result.nextOffset, 12);
  assert.equal(result.hasMore, true);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items[0], {
    id: "notification-1",
    adminNotificationRecipientId: "recipient-1",
    notificationId: "notification-1",
    type: "partner_change_request",
    title: "변경 요청",
    body: "브랜드 정보 수정 요청이 접수되었습니다.",
    targetUrl: "/admin/partners/partner-1",
    metadata: { source: "partner" },
    readAt: null,
    deletedAt: null,
    createdAt: "2026-07-03T02:00:00.000Z",
    updatedAt: "2026-07-03T01:00:00.000Z",
    isUnread: true,
  });
  assert.equal(result.items[1]?.title, "관리자 알림");
  assert.equal(result.items[1]?.body, "");
  assert.equal(result.items[1]?.targetUrl, "/admin");
  assert.equal(result.items[1]?.isUnread, false);
  assert.equal(getAdminNotificationTypeLabel("partner_change_request"), "변경 요청");
  assert.equal(getAdminNotificationTypeLabel("partner_immediate_update"), "즉시 수정");
  assert.equal(getAdminNotificationTypeLabel("expiring_partner"), "종료 임박");
  assert.equal(getAdminNotificationTypeLabel("security_alert"), "보안");
});

test("admin notification list result clamps pagination values", async () => {
  const { buildAdminNotificationListResult, parseAdminNotificationPaging } =
    await modulePromise;

  assert.deepEqual(parseAdminNotificationPaging({ offset: "-1", limit: "999" }), {
    offset: 0,
    limit: 20,
  });
  assert.deepEqual(parseAdminNotificationPaging({ offset: "12", limit: "5" }), {
    offset: 12,
    limit: 5,
  });

  const result = buildAdminNotificationListResult({
    unreadCount: 0,
    rows: [],
    offset: 4,
    limit: 10,
    hasMore: false,
  });

  assert.deepEqual(result, {
    unreadCount: 0,
    items: [],
    nextOffset: 4,
    hasMore: false,
  });
});

test("admin navigation separates personal inbox from notification operations", async () => {
  const { findAdminNavItem } = await adminNavigationModulePromise;

  const inboxItem = findAdminNavItem("/admin/notifications");
  const operationsItem = findAdminNavItem("/admin/push");

  assert.equal(inboxItem?.label, "내 알림");
  assert.equal(inboxItem?.href, "/admin/notifications");
  assert.equal(operationsItem?.label, "알림 운영");
  assert.equal(operationsItem?.href, "/admin/push");
});
