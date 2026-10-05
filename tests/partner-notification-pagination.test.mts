import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE = "mock";

const {
  MAX_PARTNER_NOTIFICATION_OFFSET,
  PARTNER_NOTIFICATION_PAGE_SIZE,
  buildPartnerNotificationPageQuery,
  parsePartnerNotificationPageQuery,
} = await import("../src/lib/partner-notification-contract.ts");
const {
  hasUnloadedUnreadPartnerNotifications,
  mergePartnerNotificationEntries,
  shiftPartnerStoredNotificationPageAfterDelete,
} = await import("../src/lib/partner-notification-ui.ts");
const {
  deletePartnerStoredNotifications,
  listPartnerStoredNotifications,
  resetMockPartnerStoredNotificationStore,
} = await import("../src/lib/partner-notification-store.ts");
const { getPartnerNotificationCenter, listPartnerNotificationCenterStoredEntries } =
  await import("../src/lib/partner-notifications.ts");

const CAFE_ACCOUNT_ID = "mock-partner-account-cafe-ssafy";
const CAFE_COMPANY_ID = "mock-partner-company-cafe-ssafy";

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("페이지 쿼리는 서버 해석과 클라이언트 생성이 같은 상한을 쓴다", () => {
  const parse = (query: string) =>
    parsePartnerNotificationPageQuery(new URLSearchParams(query));

  assert.deepEqual(parse(""), { offset: 0, limit: PARTNER_NOTIFICATION_PAGE_SIZE });
  assert.deepEqual(parse("offset=40&limit=50"), { offset: 40, limit: 20 });
  assert.deepEqual(parse("offset=-3&limit=0"), { offset: 0, limit: 1 });
  assert.deepEqual(parse("offset=abc&limit=abc"), { offset: 0, limit: 20 });
  assert.deepEqual(parse("offset=7.9&limit=5.5"), { offset: 7, limit: 5 });
  assert.equal(parse("offset=999999").offset, MAX_PARTNER_NOTIFICATION_OFFSET);

  assert.equal(buildPartnerNotificationPageQuery({ offset: 40 }), "offset=40&limit=20");
  assert.equal(
    buildPartnerNotificationPageQuery({ offset: -1, limit: 99 }),
    "offset=0&limit=20",
  );
});

function entry(id: string, createdAt: string, isUnread = true) {
  return {
    id,
    notificationId: id.replace("stored:", ""),
    readAt: isUnread ? null : createdAt,
    isUnread,
    category: "plan" as const,
    status: "notified" as const,
    tone: "primary" as const,
    badgeLabel: isUnread ? "새 알림" : "확인됨",
    title: id,
    body: "본문",
    companyId: null,
    companyName: "파트너사",
    partnerId: null,
    partnerName: null,
    href: null,
    createdAt,
  };
}

test("더 보기 병합은 중복을 버리고 화면에서 바뀐 읽음 상태를 유지한다", () => {
  const current = [
    entry("stored:b", "2026-09-30T09:00:00.000Z", false),
    entry("request:x", "2026-09-30T10:00:00.000Z"),
  ];
  const merged = mergePartnerNotificationEntries(current, [
    entry("stored:b", "2026-09-30T09:00:00.000Z", true),
    entry("stored:a", "2026-09-29T09:00:00.000Z"),
  ]);

  assert.deepEqual(
    merged.map((item) => item.id),
    ["request:x", "stored:b", "stored:a"],
  );
  assert.equal(merged.find((item) => item.id === "stored:b")?.isUnread, false);
});

test("불러오지 않은 페이지의 미확인 알림이 있을 때만 전체 읽음을 제안한다", () => {
  assert.equal(
    hasUnloadedUnreadPartnerNotifications({
      storedUnreadCount: 25,
      loadedUnreadCount: 20,
      hasMore: true,
    }),
    true,
  );
  assert.equal(
    hasUnloadedUnreadPartnerNotifications({
      storedUnreadCount: 20,
      loadedUnreadCount: 20,
      hasMore: true,
    }),
    false,
  );
  assert.equal(
    hasUnloadedUnreadPartnerNotifications({
      storedUnreadCount: 25,
      loadedUnreadCount: 20,
      hasMore: false,
    }),
    false,
  );
  assert.equal(
    hasUnloadedUnreadPartnerNotifications({
      storedUnreadCount: null,
      loadedUnreadCount: 0,
      hasMore: true,
    }),
    false,
  );
});

type MockState = {
  notifications: Map<string, Record<string, unknown>>;
  recipients: Array<Record<string, unknown>>;
};

function seedExtraCompanyNotifications(count: number) {
  const state = (globalThis as { __mockPartnerStoredNotificationState?: MockState })
    .__mockPartnerStoredNotificationState;
  assert.ok(state, "mock store must be initialized");
  for (let index = 0; index < count; index += 1) {
    const id = `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const createdAt = new Date(Date.parse("2026-08-01T00:00:00.000Z") - index * 60_000).toISOString();
    state.notifications.set(id, {
      id,
      type: "plan",
      title: `이전 알림 ${index + 1}`,
      body: "이전 운영 알림",
      target_url: "/partner",
      metadata: { source: "mock" },
      company_id: CAFE_COMPANY_ID,
      created_at: createdAt,
    });
    state.recipients.push({
      id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      accountId: CAFE_ACCOUNT_ID,
      notificationId: id,
      readAt: null,
      deletedAt: null,
      createdAt,
    });
  }
}

test("알림 센터 첫 화면과 더 보기 API는 저장 알림을 겹치지 않게 이어서 보여 준다", async () => {
  resetMockPartnerStoredNotificationStore();
  await listPartnerStoredNotifications({ accountId: CAFE_ACCOUNT_ID });
  seedExtraCompanyNotifications(30);
  const storedRows = (
    await listPartnerStoredNotifications({ accountId: CAFE_ACCOUNT_ID, limit: 100 })
  ).items;
  const total = storedRows.length;
  // 센터는 세션이 고른 파트너사(와 전역) 알림만 보여 준다.
  const visibleInScope = storedRows.filter((row) => {
    const notification = Array.isArray(row.notification)
      ? row.notification[0]
      : row.notification;
    return notification?.company_id == null || notification.company_id === CAFE_COMPANY_ID;
  }).length;
  assert.ok(total > PARTNER_NOTIFICATION_PAGE_SIZE);

  const center = await getPartnerNotificationCenter([CAFE_COMPANY_ID], CAFE_ACCOUNT_ID);
  const firstStored = center.items.filter((item) => item.id.startsWith("stored:"));
  assert.equal(center.storedPage?.hasMore, true);
  assert.equal(center.storedPage?.nextOffset, PARTNER_NOTIFICATION_PAGE_SIZE);
  assert.equal(center.storedPage?.unreadCount, total);

  const collected = [...firstStored.map((item) => item.id)];
  let nextOffset: number = center.storedPage?.nextOffset ?? 0;
  let hasMore: boolean = center.storedPage?.hasMore ?? false;
  while (hasMore) {
    const page = await listPartnerNotificationCenterStoredEntries({
      accountId: CAFE_ACCOUNT_ID,
      companyIds: [CAFE_COMPANY_ID],
      offset: nextOffset,
      limit: PARTNER_NOTIFICATION_PAGE_SIZE,
    });
    assert.equal(page.unreadCount, total);
    collected.push(...page.items.map((item) => item.id));
    nextOffset = page.nextOffset;
    hasMore = page.hasMore;
  }

  assert.equal(collected.length, visibleInScope);
  assert.equal(new Set(collected).size, visibleInScope, "페이지 사이에 중복이 없다");
  resetMockPartnerStoredNotificationStore();
});

test("불러온 저장 알림을 삭제하면 다음 페이지 offset을 삭제 수만큼 당긴다", () => {
  const page = { nextOffset: 20, hasMore: true, unreadCount: 5 };
  assert.deepEqual(shiftPartnerStoredNotificationPageAfterDelete(page, 3), {
    nextOffset: 17,
    hasMore: true,
    unreadCount: 5,
  });
  assert.equal(shiftPartnerStoredNotificationPageAfterDelete(page, 0), page);
  assert.equal(shiftPartnerStoredNotificationPageAfterDelete(page, -2), page);
  assert.equal(shiftPartnerStoredNotificationPageAfterDelete(page, Number.NaN), page);
  assert.equal(
    shiftPartnerStoredNotificationPageAfterDelete({ ...page, nextOffset: 2 }, 5).nextOffset,
    0,
  );
});

test("첫 페이지 알림을 삭제한 뒤 더 보기는 이전 알림을 건너뛰지 않는다", async () => {
  resetMockPartnerStoredNotificationStore();
  await listPartnerStoredNotifications({ accountId: CAFE_ACCOUNT_ID });
  seedExtraCompanyNotifications(30);

  const everyRow = (
    await listPartnerStoredNotifications({ accountId: CAFE_ACCOUNT_ID, limit: 100 })
  ).items;
  const firstPage = await listPartnerStoredNotifications({ accountId: CAFE_ACCOUNT_ID });
  assert.equal(firstPage.hasMore, true);

  const deletedRows = firstPage.items.slice(0, 3);
  const deletedNotificationIds = deletedRows.map((row) => {
    const notification = Array.isArray(row.notification)
      ? row.notification[0]
      : row.notification;
    assert.ok(notification?.id);
    return notification.id;
  });
  await deletePartnerStoredNotifications({
    accountId: CAFE_ACCOUNT_ID,
    notificationIds: deletedNotificationIds,
  });

  let page = shiftPartnerStoredNotificationPageAfterDelete(
    { nextOffset: firstPage.nextOffset, hasMore: firstPage.hasMore, unreadCount: null },
    deletedRows.length,
  );
  const collected = new Set(
    firstPage.items.slice(deletedRows.length).map((row) => row.id),
  );
  while (page.hasMore) {
    const next = await listPartnerStoredNotifications({
      accountId: CAFE_ACCOUNT_ID,
      offset: page.nextOffset,
    });
    next.items.forEach((row) => collected.add(row.id));
    page = { nextOffset: next.nextOffset, hasMore: next.hasMore, unreadCount: null };
  }

  const deletedIds = new Set(deletedRows.map((row) => row.id));
  const expected = everyRow.filter((row) => !deletedIds.has(row.id)).map((row) => row.id);
  assert.deepEqual([...collected].sort(), [...expected].sort());
  resetMockPartnerStoredNotificationStore();
});

test("파트너 알림 GET·센터 UI는 같은 페이지 규칙과 더 보기를 사용한다", () => {
  const route = readSource("src/app/api/partner/notifications/route.ts");
  assert.match(route, /parsePartnerNotificationPageQuery\(\s*request\.nextUrl\.searchParams/);
  assert.match(route, /listPartnerNotificationCenterStoredEntries\(/);
  assert.match(route, /nextOffset: result\.nextOffset,\s*hasMore: result\.hasMore/);
  assert.doesNotMatch(route, /limit: 30/);

  const center = readSource(
    "src/components/partner/partner-notifications/PartnerNotificationCenter.tsx",
  );
  assert.match(center, /buildPartnerNotificationPageQuery\(/);
  assert.match(center, /mergePartnerNotificationEntries\(/);
  assert.match(center, /PARTNER_NOTIFICATION_PARTIAL_FILTER_NOTICE/);
  assert.match(center, /이전 알림 더 보기/);
  assert.match(center, /syncStoredUnreadCount\(response\)/);
  assert.match(
    center,
    /shiftPartnerStoredNotificationPageAfterDelete\(current, deletedStoredCount\)/,
  );

  const store = readSource("src/lib/partner-notification-store.ts");
  assert.match(
    store,
    /\.order\("created_at", \{ ascending: false \}\)\s*\.order\("id", \{ ascending: false \}\)\s*\.range\(offset, offset \+ limit - 1\)/,
  );
});
