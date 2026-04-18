import assert from "node:assert/strict";
import test from "node:test";

type NotificationRepositoryModule = typeof import("../src/lib/repositories/mock/notification-repository.mock.ts");
type NotificationSharedModule = typeof import("../src/lib/notifications/shared.ts");

const repositoryPromise = import(
  new URL("../src/lib/repositories/mock/notification-repository.mock.ts", import.meta.url).href,
) as Promise<NotificationRepositoryModule>;

const sharedPromise = import(
  new URL("../src/lib/notifications/shared.ts", import.meta.url).href,
) as Promise<NotificationSharedModule>;

function resetMockNotificationStore() {
  const scope = globalThis as typeof globalThis & {
    __mockNotificationStore?: unknown;
  };
  delete scope.__mockNotificationStore;
}

test("notification target URLs stay internal", async () => {
  const { normalizeNotificationTargetUrl } = await sharedPromise;

  assert.equal(normalizeNotificationTargetUrl("/notifications"), "/notifications");
  assert.equal(normalizeNotificationTargetUrl("//example.com"), null);
  assert.equal(normalizeNotificationTargetUrl("https://example.com"), null);
});

test("mock notification repository keeps inbox unread count and soft delete isolated", async () => {
  resetMockNotificationStore();
  const { MockNotificationRepository } = await repositoryPromise;
  const repository = new MockNotificationRepository();

  const created = await repository.createNotification({
    type: "announcement",
    title: "알림 제목",
    body: "알림 본문",
    targetUrl: "/partners/demo",
    recipientMemberIds: ["member-a", "member-b"],
  });

  assert.equal(created.recipientMemberIds.length, 2);
  assert.equal(await repository.getUnreadNotificationCount("member-a"), 1);
  assert.equal(await repository.getUnreadNotificationCount("member-b"), 1);

  const listBefore = await repository.listMemberNotifications({
    memberId: "member-a",
    offset: 0,
    limit: 10,
  });
  assert.equal(listBefore.unreadCount, 1);
  assert.equal(listBefore.items.length, 1);
  assert.equal(listBefore.items[0]?.isUnread, true);

  const readChanged = await repository.markMemberNotificationRead(
    "member-a",
    created.notification.id,
  );
  assert.equal(readChanged, true);
  assert.equal(await repository.getUnreadNotificationCount("member-a"), 0);

  const deletedChanged = await repository.softDeleteMemberNotification(
    "member-b",
    created.notification.id,
  );
  assert.equal(deletedChanged, true);
  assert.equal(await repository.getUnreadNotificationCount("member-b"), 0);
});
