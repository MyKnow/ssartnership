import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getSafeAdminMessage } from "../src/lib/admin-safe-messages";

type AdminNotificationInboxModule =
  typeof import("../src/lib/admin-notification-inbox.ts");

const modulePromise = import(
  new URL("../src/lib/admin-notification-inbox.ts", import.meta.url).href
) as Promise<AdminNotificationInboxModule>;
const adminNavigationModulePromise = import(
  new URL("../src/components/admin/admin-navigation.ts", import.meta.url).href
) as Promise<typeof import("../src/components/admin/admin-navigation.ts")>;

test("admin notification inbox maps recipient rows into client records", async () => {
  const { buildAdminNotificationListResult, getAdminNotificationTypeLabel } =
    await modulePromise;

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
  assert.equal(
    getAdminNotificationTypeLabel("partner_change_request"),
    "변경 요청",
  );
  assert.equal(
    getAdminNotificationTypeLabel("partner_immediate_update"),
    "즉시 수정",
  );
  assert.equal(getAdminNotificationTypeLabel("expiring_partner"), "종료 임박");
  assert.equal(getAdminNotificationTypeLabel("security_alert"), "보안");
});

test("admin notification list result clamps pagination values", async () => {
  const { buildAdminNotificationListResult, parseAdminNotificationPaging } =
    await modulePromise;

  assert.deepEqual(
    parseAdminNotificationPaging({ offset: "-1", limit: "999" }),
    {
      offset: 0,
      limit: 20,
    },
  );
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
  assert.equal(operationsItem?.label, "발송 관리");
  assert.equal(operationsItem?.href, "/admin/push");
});

test("admin notification API never returns storage errors to the browser", async () => {
  const [listSource, itemSource] = await Promise.all([
    readFile(
      new URL("../src/app/api/admin/notifications/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/api/admin/notifications/[id]/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.equal(
    getSafeAdminMessage(
      new Error("relation admin_notification_recipients does not exist"),
      "알림을 불러오지 못했습니다.",
    ),
    "알림을 불러오지 못했습니다.",
  );
  assert.match(listSource, /알림을 불러오지 못했습니다\./);
  assert.match(listSource, /getSafeAdminMessage/);
  assert.match(listSource, /includeSummary/);
  assert.match(listSource, /includeUnreadCount: includeSummary/);
  assert.match(listSource, /includeSummary[\s\S]*\? \{ summary:/);
  assert.match(listSource, /getCachedAdminNotificationInboxReadModel/);
  assert.match(listSource, /invalidateAdminNotificationReadCache/);
  assert.match(itemSource, /getSafeAdminMessage/);
  assert.doesNotMatch(listSource, /message:\s*unreadResult\.error\.message/);
  assert.doesNotMatch(listSource, /message:\s*inboxResult\.error\.message/);
  assert.doesNotMatch(listSource, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(itemSource, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(itemSource, /throw new Error\(error\.message\)/);
  assert.match(itemSource, /withServerTiming/);
  assert.match(itemSource, /timing\.measure\("auth"/);
  assert.match(itemSource, /timing\.measure\("query"/);
});

test("관리자 알림 설정 API는 실패 원문을 숨기고 응답 시간을 계측한다", async () => {
  const source = await readFile(
    new URL(
      "../src/app/api/admin/notifications/preferences/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /withServerTiming/);
  assert.match(source, /timing\.measure\("auth"/);
  assert.match(source, /timing\.measure\("query"/);
  assert.match(source, /알림 설정을 불러오지 못했습니다\./);
  assert.match(source, /알림 설정을 저장하지 못했습니다\./);
  assert.doesNotMatch(source, /message:\s*error\.message/);
  assert.doesNotMatch(
    source,
    /return NextResponse\.json\(\{\s*preferences:\s*await/,
  );
});

test("관리자 개인 알림 API는 모두 알림 조회 권한을 요구한다", async () => {
  const routePaths = [
    "src/app/api/admin/notifications/route.ts",
    "src/app/api/admin/notifications/[id]/route.ts",
    "src/app/api/admin/notifications/preferences/route.ts",
    "src/app/api/admin/push/subscribe/route.ts",
    "src/app/api/admin/push/unsubscribe/route.ts",
  ];
  const [accessSource, ...sources] = await Promise.all([
    readFile(new URL("../src/lib/admin-access.ts", import.meta.url), "utf8"),
    ...routePaths.map((path) =>
      readFile(new URL(`../${path}`, import.meta.url), "utf8"),
    ),
  ]);

  assert.match(
    accessSource,
    /getAdminPersonalNotificationApiSession[\s\S]*getAdminApiPermissionSession\(request, "notifications", "read"\)/,
  );
  for (const [index, source] of sources.entries()) {
    assert.match(
      source,
      /getAdminPersonalNotificationApiSession\(request\)/,
      `${routePaths[index]} should require personal notification access`,
    );
    assert.doesNotMatch(source, /getAdminSession/);
  }
});

test("관리자 역할별 알림 조회 권한은 개인 알림 API 정책과 일치한다", async () => {
  const { canAdmin, findAdminPermissionTemplate } =
    await import("../src/lib/admin-permissions.ts");
  const canReadNotifications = (
    key: Parameters<typeof findAdminPermissionTemplate>[0],
  ) =>
    canAdmin(
      findAdminPermissionTemplate(key)?.permissions,
      "notifications",
      "read",
    );

  assert.equal(canReadNotifications("regional_partner_manager"), false);
  assert.equal(canReadNotifications("content_manager"), false);
  assert.equal(canReadNotifications("support"), true);
  assert.equal(canReadNotifications("readonly"), true);
  assert.equal(canReadNotifications("operations_manager"), true);
});

test("발송 로그는 완료 메타데이터가 있으면 delivery 재조회 없이 표시한다", async () => {
  const source = await readFile(
    new URL("../src/lib/admin-notification-ops.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /hasCompleteChannelResults/);
  assert.match(source, /rowsNeedingDeliveryLookup/);
  assert.match(source, /if \(rowsNeedingDeliveryLookup\.length > 0\)/);
});

test("관리자 발송 API는 요청 재시도 키와 안전한 오류 매핑을 사용한다", async () => {
  const [
    broadcastSource,
    previewSource,
    repositorySource,
    migrationSource,
    bodyHelperSource,
  ] = await Promise.all([
    readFile(
      new URL("../src/app/api/push/admin/broadcast/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/api/push/admin/preview/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/lib/repositories/supabase/notification-repository.supabase.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260727144656_add_notification_idempotency_key.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin-notification-route-body.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(broadcastSource, /idempotencyKey/);
  assert.match(broadcastSource, /withServerTiming/);
  assert.match(broadcastSource, /readAdminNotificationJsonBody/);
  assert.match(
    broadcastSource,
    /알림 발송에 실패했습니다\. 잠시 후 다시 시도해 주세요\./,
  );
  assert.doesNotMatch(
    broadcastSource,
    /error instanceof Error \? error\.message/,
  );
  assert.match(previewSource, /withServerTiming/);
  assert.match(previewSource, /readAdminNotificationJsonBody/);
  assert.match(
    previewSource,
    /알림 검토 정보를 불러오지 못했습니다\. 잠시 후 다시 시도해 주세요\./,
  );
  assert.doesNotMatch(
    previewSource,
    /error instanceof Error \? error\.message/,
  );
  assert.match(repositorySource, /onConflict: "idempotency_key"/);
  assert.match(repositorySource, /alreadyExists: true/);
  assert.match(migrationSource, /notifications_idempotency_key_unique/);
  assert.match(migrationSource, /unique \(idempotency_key\)/);
  assert.match(bodyHelperSource, /MAX_ADMIN_NOTIFICATION_JSON_BODY_BYTES/);
  assert.match(bodyHelperSource, /알림 요청 본문이 너무 큽니다\./);
});

test("알림 발송 후처리 경고는 provider 오류 원문을 UI 계약에 저장하지 않는다", async () => {
  const [deliverySource, operationSource] = await Promise.all([
    readFile(
      new URL("../src/lib/admin-notification-ops-delivery.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin-notification-ops.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(deliverySource, /푸시 알림 전송에 실패했습니다\./);
  assert.match(
    deliverySource,
    /console\.error\("\[admin-notification-ops\] push delivery failed"/,
  );
  assert.doesNotMatch(
    deliverySource,
    /errorMessage\s*=\s*error instanceof Error \? error\.message/,
  );
  assert.match(operationSource, /발송 결과 기록을 저장하지 못했습니다\./);
  assert.doesNotMatch(
    operationSource,
    /final metadata update failed for notification \$\{created\.notification\.id\}[^\n]*error\.message/,
  );
});
