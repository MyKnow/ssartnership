import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE = "mock";

const {
  deletePartnerStoredNotifications,
  listPartnerStoredNotifications,
  markPartnerStoredNotificationsRead,
  resetMockPartnerStoredNotificationStore,
} = await import("../src/lib/partner-notification-store.ts");
const { getPartnerNotificationCenter } =
  await import("../src/lib/partner-notifications.ts");

const CAFE_ACCOUNT_ID = "mock-partner-account-cafe-ssafy";
const CAFE_COMPANY_ID = "mock-partner-company-cafe-ssafy";
const URBAN_GYM_ACCOUNT_ID = "mock-partner-account-urban-gym";
const URBAN_GYM_COMPANY_ID = "mock-partner-company-urban-gym";

function getStoredNotification(row: {
  notification?:
    | { id: string; company_id: string | null }
    | { id: string; company_id: string | null }[]
    | null;
}) {
  return Array.isArray(row.notification)
    ? (row.notification[0] ?? null)
    : (row.notification ?? null);
}

function getStoredNotificationIds(
  rows: Awaited<ReturnType<typeof listPartnerStoredNotifications>>["items"],
) {
  return rows
    .map((row) => getStoredNotification(row)?.id ?? null)
    .filter((id): id is string => Boolean(id));
}

function getCenterStoredItems(
  center: Awaited<ReturnType<typeof getPartnerNotificationCenter>>,
) {
  return center.items.filter((item) => typeof item.notificationId === "string");
}

test("partner notification center and storage API share account/company-scoped mock items", async () => {
  resetMockPartnerStoredNotificationStore();

  for (const companyId of [CAFE_COMPANY_ID, URBAN_GYM_COMPANY_ID]) {
    const stored = await listPartnerStoredNotifications({
      accountId: CAFE_ACCOUNT_ID,
      companyId,
    });
    const center = await getPartnerNotificationCenter(
      [companyId],
      CAFE_ACCOUNT_ID,
    );
    const storedIds = getStoredNotificationIds(stored.items);
    const centerItems = getCenterStoredItems(center);

    assert.deepEqual(
      centerItems.map((item) => item.notificationId),
      storedIds,
    );
    assert.equal(stored.unreadCount, storedIds.length);
    assert.ok(centerItems.every((item) => item.isUnread === true));
  }
});

test("partner notification mock read/delete mutations update the center without leaking across accounts", async () => {
  resetMockPartnerStoredNotificationStore();

  const initial = await listPartnerStoredNotifications({
    accountId: CAFE_ACCOUNT_ID,
    companyId: CAFE_COMPANY_ID,
  });
  const globalNotificationId = initial.items
    .map((row) => getStoredNotification(row))
    .find((notification) => notification?.company_id == null)?.id;
  const companyNotificationId = initial.items
    .map((row) => getStoredNotification(row))
    .find((notification) => notification?.company_id === CAFE_COMPANY_ID)?.id;

  assert.ok(globalNotificationId);
  assert.ok(companyNotificationId);

  const readAt = "2026-08-31T00:00:00.000Z";
  const marked = await markPartnerStoredNotificationsRead({
    accountId: CAFE_ACCOUNT_ID,
    notificationIds: [companyNotificationId],
    now: readAt,
  });
  assert.deepEqual(marked, { unreadCount: 2, updatedCount: 1 });

  const centerAfterRead = await getPartnerNotificationCenter(
    [CAFE_COMPANY_ID],
    CAFE_ACCOUNT_ID,
  );
  const readCenterItem = getCenterStoredItems(centerAfterRead).find(
    (item) => item.notificationId === companyNotificationId,
  );
  assert.equal(readCenterItem?.readAt, readAt);
  assert.equal(readCenterItem?.isUnread, false);

  const removed = await deletePartnerStoredNotifications({
    accountId: CAFE_ACCOUNT_ID,
    notificationIds: [globalNotificationId],
    now: "2026-08-31T01:00:00.000Z",
  });
  assert.deepEqual(removed, { unreadCount: 1, updatedCount: 1 });

  const cafeAfterDelete = await listPartnerStoredNotifications({
    accountId: CAFE_ACCOUNT_ID,
    companyId: CAFE_COMPANY_ID,
  });
  const cafeCenterAfterDelete = await getPartnerNotificationCenter(
    [CAFE_COMPANY_ID],
    CAFE_ACCOUNT_ID,
  );
  assert.equal(
    getStoredNotificationIds(cafeAfterDelete.items).includes(
      globalNotificationId,
    ),
    false,
  );
  assert.equal(
    getCenterStoredItems(cafeCenterAfterDelete).some(
      (item) => item.notificationId === globalNotificationId,
    ),
    false,
  );

  const otherAccount = await listPartnerStoredNotifications({
    accountId: URBAN_GYM_ACCOUNT_ID,
    companyId: URBAN_GYM_COMPANY_ID,
  });
  assert.equal(
    getStoredNotificationIds(otherAccount.items).includes(globalNotificationId),
    true,
  );
  assert.equal(otherAccount.unreadCount, otherAccount.items.length);
});
