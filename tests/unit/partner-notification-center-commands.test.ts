import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PartnerNotificationCenterData, PartnerNotificationEntry } from "@/lib/partner-notification-contract";
import { derivePartnerNotificationUiModel, filterPartnerNotificationUiModels, type PartnerNotificationUiFilters } from "@/lib/partner-notification-ui";
import { createPartnerNotificationCenterCommands } from "@/components/partner/partner-notifications/partner-notification-center-commands";
import { createPartnerNotificationCenterState } from "@/components/partner/partner-notifications/partner-notification-center-state";

function entry(id: string, overrides: Partial<PartnerNotificationEntry> = {}): PartnerNotificationEntry {
  return {
    id: `stored:${id}`, notificationId: id, readAt: null, isUnread: true,
    category: "plan", status: "notified", tone: "primary", badgeLabel: "새 알림",
    title: `알림 ${id}`, body: "테스트 운영 안내", companyId: "company-a", companyName: "테스트 파트너사",
    partnerId: null, partnerName: null, href: null, createdAt: "2026-10-17T00:00:00.000Z",
    ...overrides,
  };
}

const defaultFilters: PartnerNotificationUiFilters = {
  category: "all", type: "all", purpose: "all", priority: "all", status: "all",
  readState: "all", companyId: "all", period: "all", searchQuery: "",
};

function harness(items = [entry("a"), entry("b")], hasMore = true) {
  const data: PartnerNotificationCenterData = {
    items, warningMessage: null,
    summary: { totalCount: items.length, requestCount: 0, pendingRequestCount: 0,
      resolvedRequestCount: 0, reviewCount: 0, operationCount: 0, companyCount: 1, serviceCount: 0 },
    storedPage: { nextOffset: 20, hasMore, unreadCount: 7 },
  };
  let state = createPartnerNotificationCenterState(data);
  let filters = defaultFilters;
  const notify = vi.fn();
  const version = { current: 0 };
  return {
    data, notify, version,
    get state() { return state; },
    filter(value: Partial<PartnerNotificationUiFilters>) { filters = { ...defaultFilters, ...value }; },
    model(id = "a") { return derivePartnerNotificationUiModel(state.items.find((item) => item.notificationId === id)!); },
    // Just as a React render does, commands capture a snapshot while functional
    // updates are applied to the latest state when asynchronous responses settle.
    commands() {
      const visible = filterPartnerNotificationUiModels(state.items.map((item) => derivePartnerNotificationUiModel(item)), filters);
      return createPartnerNotificationCenterCommands({
        state, updateState: (update) => { state = update(state); },
        getUnreadCountSyncVersion: () => version.current,
        advanceUnreadCountSyncVersion: () => { version.current += 1; }, notify,
        visibleUnreadNotificationIds: visible.filter((model) => model.readState === "unread")
          .flatMap((model) => model.item.notificationId ? [model.item.notificationId] : []),
        visibleActionNotificationIds: visible.filter((model) => model.purpose === "action")
          .flatMap((model) => model.item.notificationId ? [model.item.notificationId] : []),
      });
    },
  };
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve: (body: unknown, status = 200) => resolve(Response.json(body, { status })) };
}

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

for (const first of ["read", "page"] as const) {
  test(`individual read and pagination preserve current read state when ${first} response arrives first`, async () => {
    const h = harness();
    const page = deferredResponse();
    const read = deferredResponse();
    fetchMock.mockReturnValueOnce(page.promise).mockReturnValueOnce(read.promise);
    const loading = h.commands().loadMoreStoredNotifications();
    const reading = h.commands().markNotificationAsRead(h.model());
    expect(h.state.loadingMore).toBe(true);
    expect(h.state.items[0].isUnread).toBe(false);
    const pageBody = { items: [entry("a"), entry("older")], nextOffset: 40, hasMore: false, summary: { unreadCount: 7 } };
    if (first === "read") {
      read.resolve({ summary: { unreadCount: 6 } }); await reading;
      page.resolve(pageBody); await loading;
    } else {
      page.resolve(pageBody); await loading;
      read.resolve({ summary: { unreadCount: 6 } }); await reading;
    }
    expect(h.state.storedPage).toEqual({ nextOffset: 40, hasMore: false, unreadCount: 6 });
    expect(h.state.items.filter((item) => item.notificationId === "a")).toHaveLength(1);
    expect(h.state.items.find((item) => item.notificationId === "a")?.isUnread).toBe(false);
    expect(h.state.items.some((item) => item.notificationId === "older")).toBe(true);
    expect(h.state.pendingNotificationId).toBeNull();
    expect(h.state.loadingMore).toBe(false);
    expect(h.version.current).toBe(1);
    expect(h.data.items[0].isUnread).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/partner/notifications?offset=20&limit=20");
  });
}

test("page unread count is accepted when an overlapping read response has no summary", async () => {
  const h = harness();
  const page = deferredResponse();
  fetchMock.mockReturnValueOnce(page.promise).mockResolvedValueOnce(Response.json({ ok: true }));
  const loading = h.commands().loadMoreStoredNotifications();
  await h.commands().markNotificationAsRead(h.model());
  page.resolve({ summary: { unreadCount: 4 }, nextOffset: 40, hasMore: false });
  await loading;
  expect(h.state.storedPage.unreadCount).toBe(4);
  expect(h.version.current).toBe(0);
});

test("loading excludes deletion and all-stored read, but permits visible read", async () => {
  const h = harness([entry("a", { category: "request", status: "pending" })]);
  const page = deferredResponse();
  fetchMock.mockReturnValueOnce(page.promise).mockResolvedValueOnce(Response.json({ summary: { unreadCount: 6 } }));
  const loading = h.commands().loadMoreStoredNotifications();
  const commands = h.commands();
  await commands.loadMoreStoredNotifications();
  await commands.deleteNotification(h.model());
  await commands.deleteVisibleActionNotifications();
  await commands.markAllStoredNotificationsAsRead();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await commands.markVisibleNotificationsAsRead();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ notificationIds: ["a"] });
  page.resolve({ summary: { unreadCount: 7 } }); await loading;
  expect(h.state.storedPage.unreadCount).toBe(6);
});

test("a pending mutation excludes every other mutation and load-more", async () => {
  const h = harness([entry("a", { category: "request", status: "pending" }), entry("b")]);
  const response = deferredResponse();
  fetchMock.mockReturnValueOnce(response.promise);
  const deleting = h.commands().deleteNotification(h.model());
  const commands = h.commands();
  await commands.loadMoreStoredNotifications();
  await commands.markNotificationAsRead(h.model("b"));
  await commands.deleteNotification(h.model("b"));
  await commands.markVisibleNotificationsAsRead();
  await commands.deleteVisibleActionNotifications();
  await commands.markAllStoredNotificationsAsRead();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(h.state.storedPage.nextOffset).toBe(20);
  response.resolve({ summary: { unreadCount: 6 } }); await deleting;
  expect(h.state.storedPage).toEqual({ nextOffset: 19, hasMore: true, unreadCount: 6 });
  expect(h.state.pendingNotificationId).toBeNull();
});

test("filtered visible read sends only stored unread IDs and keeps synthetic/other-company entries", async () => {
  const h = harness([entry("a"), entry("b", { companyId: "company-b" }),
    entry("read", { isUnread: false, readAt: "2026-10-16T00:00:00Z" }),
    entry("synthetic", { notificationId: null })]);
  h.filter({ companyId: "company-a" });
  fetchMock.mockResolvedValueOnce(Response.json({ summary: { unreadCount: 5 } }));
  await h.commands().markVisibleNotificationsAsRead();
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ notificationIds: ["a"] });
  expect(h.state.items.find((item) => item.notificationId === "b")?.isUnread).toBe(true);
  expect(h.state.items.find((item) => item.id === "stored:synthetic")?.isUnread).toBe(true);
  expect(h.state.items[0]).toMatchObject({ isUnread: false, tone: "neutral", badgeLabel: "확인됨" });
  expect(h.state.storedPage.unreadCount).toBe(5);
});

test("all-stored read uses an unscoped PATCH and rolls back both optimistic snapshots on failure", async () => {
  const h = harness([entry("a"), entry("b", { companyId: "company-b" }), entry("synthetic", { notificationId: null })]);
  h.filter({ companyId: "company-a" });
  const before = h.state;
  const response = deferredResponse();
  fetchMock.mockReturnValueOnce(response.promise);
  const reading = h.commands().markAllStoredNotificationsAsRead();
  expect(h.state.pendingBulkAction).toBe("read-all-stored");
  expect(h.state.storedPage.unreadCount).toBe(0);
  expect(h.state.items.filter((item) => item.notificationId).every((item) => !item.isUnread)).toBe(true);
  expect(h.state.items[2].isUnread).toBe(true);
  expect(fetchMock.mock.calls[0]).toEqual(["/api/partner/notifications", { method: "PATCH" }]);
  response.resolve({ message: "잠시 후 다시 시도해 주세요." }, 503); await reading;
  expect(h.state.items).toBe(before.items);
  expect(h.state.storedPage).toBe(before.storedPage);
  expect(h.state.pendingBulkAction).toBeNull();
  expect(h.notify).toHaveBeenLastCalledWith("잠시 후 다시 시도해 주세요.", { tone: "error" });
});

test("all-stored success updates the global unread count despite an active filter", async () => {
  const h = harness(); h.filter({ searchQuery: "no-match" });
  fetchMock.mockResolvedValueOnce(Response.json({ summary: { unreadCount: 0 } }));
  await h.commands().markAllStoredNotificationsAsRead();
  expect(h.state.items.every((item) => !item.isUnread)).toBe(true);
  expect(h.state.storedPage.unreadCount).toBe(0);
  expect(h.notify).toHaveBeenLastCalledWith("불러오지 않은 이전 알림까지 모두 읽음 처리했습니다.");
});

test("visible action delete excludes information, synthetic and filtered-out entries; next load starts at shifted offset", async () => {
  const h = harness([entry("a", { category: "request", status: "pending" }),
    entry("b", { category: "request", status: "pending", companyId: "company-b" }),
    entry("information"), entry("synthetic", { notificationId: null, category: "request", status: "pending" })]);
  h.filter({ companyId: "company-a" });
  fetchMock.mockResolvedValueOnce(Response.json({ summary: { unreadCount: 6 } }))
    .mockResolvedValueOnce(Response.json({ items: [entry("older")], nextOffset: 39, hasMore: false }));
  await h.commands().deleteVisibleActionNotifications();
  expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ notificationIds: ["a"] });
  expect(h.state.items.map((item) => item.id)).toEqual(["stored:b", "stored:information", "stored:synthetic"]);
  expect(h.state.storedPage.nextOffset).toBe(19);
  await h.commands().loadMoreStoredNotifications();
  expect(fetchMock.mock.calls[1][0]).toBe("/api/partner/notifications?offset=19&limit=20");
  expect(h.state.storedPage.unreadCount).toBe(6);
});

describe.each(["markNotificationAsRead", "deleteNotification", "markVisibleNotificationsAsRead", "deleteVisibleActionNotifications"] as const)("%s failure", (command) => {
  test("restores the items, keeps pagination and clears pending without leaking network details", async () => {
    const h = harness([entry("a", { category: "request", status: "pending" })]);
    const before = h.state;
    fetchMock.mockRejectedValueOnce(new TypeError("private-host.invalid bearer-secret"));
    await h.commands()[command](h.model());
    expect(h.state.items).toBe(before.items);
    expect(h.state.storedPage).toBe(before.storedPage);
    expect(h.state.pendingNotificationId).toBeNull();
    expect(h.state.pendingBulkAction).toBeNull();
    const [message, options] = h.notify.mock.calls[0];
    expect(message).toContain("네트워크 연결을 확인");
    expect(message).not.toContain("private-host");
    expect(message).not.toContain("bearer-secret");
    expect(options).toEqual({ tone: "error" });
  });
});

test("load failure keeps items and pagination available for retry", async () => {
  const h = harness(); const before = h.state;
  fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(Response.json({ items: [entry("older")], nextOffset: 40, hasMore: false, summary: { unreadCount: 8 } }));
  await h.commands().loadMoreStoredNotifications();
  expect(h.state.items).toBe(before.items); expect(h.state.storedPage).toBe(before.storedPage);
  expect(h.state.loadingMore).toBe(false);
  expect(h.notify).toHaveBeenCalledWith(expect.stringContaining("다시 시도"), { tone: "error" });
  await h.commands().loadMoreStoredNotifications();
  expect(h.state.storedPage).toEqual({ nextOffset: 40, hasMore: false, unreadCount: 8 });
});

test("terminal pages, synthetic items, read items and empty visible selections do not send requests", async () => {
  const h = harness([entry("read", { isUnread: false }), entry("synthetic", { notificationId: null })], false);
  await h.commands().loadMoreStoredNotifications();
  await h.commands().markNotificationAsRead(h.model("read"));
  await h.commands().markNotificationAsRead(derivePartnerNotificationUiModel(h.state.items[1]));
  await h.commands().deleteNotification(derivePartnerNotificationUiModel(h.state.items[1]));
  h.filter({ searchQuery: "no-match" });
  await h.commands().markVisibleNotificationsAsRead();
  await h.commands().deleteVisibleActionNotifications();
  expect(fetchMock).not.toHaveBeenCalled();
});
