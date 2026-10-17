import type { ToastOptions } from "@/components/ui/toast-options";
import {
  buildPartnerNotificationPageQuery,
  type PartnerNotificationListResponse,
} from "@/lib/partner-notification-contract";
import {
  applyPartnerStoredNotificationPageResponse,
  mergePartnerNotificationEntries,
  shiftPartnerStoredNotificationPageAfterDelete,
  type PartnerNotificationUiModel,
} from "@/lib/partner-notification-ui";
import {
  getNotificationClientError,
  requestNotificationJson,
} from "@/lib/notifications/client-request";
import {
  markAllStoredNotificationsRead,
  removeNotifications,
  updateNotificationReadState,
  type PartnerNotificationCenterState,
} from "./partner-notification-center-state";

type PartnerNotificationMutationResponse = {
  ok?: boolean;
  message?: string;
  summary?: { unreadCount?: number };
};
type PartnerNotificationPageResponse = Partial<PartnerNotificationListResponse> & {
  message?: string;
};

type CommandContext = {
  state: PartnerNotificationCenterState;
  updateState: (
    update: (current: PartnerNotificationCenterState) => PartnerNotificationCenterState,
  ) => void;
  getUnreadCountSyncVersion: () => number;
  advanceUnreadCountSyncVersion: () => void;
  notify: (message: string, options?: ToastOptions) => void;
  visibleUnreadNotificationIds: string[];
  visibleActionNotificationIds: string[];
};

// Each render supplies its snapshot; functional updates merge concurrent page/read responses.
export function createPartnerNotificationCenterCommands({
  state,
  updateState,
  getUnreadCountSyncVersion,
  advanceUnreadCountSyncVersion,
  notify,
  visibleUnreadNotificationIds,
  visibleActionNotificationIds,
}: CommandContext) {
  const { items, storedPage, pendingNotificationId, pendingBulkAction, loadingMore } = state;
  const isMutationPending = Boolean(pendingNotificationId || pendingBulkAction);
  const patch = (changes: Partial<PartnerNotificationCenterState>) =>
    updateState((current) => ({ ...current, ...changes }));

  function syncStoredUnreadCount(response: PartnerNotificationMutationResponse) {
    const unreadCount = response.summary?.unreadCount;
    if (typeof unreadCount === "number") {
      advanceUnreadCountSyncVersion();
      updateState((current) => ({
        ...current,
        storedPage: { ...current.storedPage, unreadCount },
      }));
    }
  }

  async function loadMoreStoredNotifications() {
    // 삭제가 진행 중이면 서버 목록의 위치가 바뀌는 중이라 다음 페이지를 읽지 않는다.
    if (loadingMore || isMutationPending || !storedPage.hasMore) {
      return;
    }

    const unreadCountSyncVersion = getUnreadCountSyncVersion();
    patch({ loadingMore: true });
    try {
      const response = await requestNotificationJson<PartnerNotificationPageResponse>(
        `/api/partner/notifications?${buildPartnerNotificationPageQuery({
          offset: storedPage.nextOffset,
        })}`,
        undefined,
        { requestFailureMessage: "이전 알림을 더 불러오지 못했습니다." },
      );
      const unreadCountSyncedDuringLoad =
        getUnreadCountSyncVersion() !== unreadCountSyncVersion;
      updateState((current) => ({
        ...current,
        items: mergePartnerNotificationEntries(current.items, response.items ?? []),
      }));
      updateState((current) => ({
        ...current,
        storedPage: applyPartnerStoredNotificationPageResponse(
          current.storedPage,
          {
            nextOffset: response.nextOffset,
            hasMore: response.hasMore,
            unreadCount: response.summary?.unreadCount,
          },
          { unreadCountSyncedDuringLoad },
        ),
      }));
    } catch (error) {
      notify(
        getNotificationClientError(error, "이전 알림을 더 불러오지 못했습니다.").message,
        { tone: "error" },
      );
    } finally {
      patch({ loadingMore: false });
    }
  }

  async function markAllStoredNotificationsAsRead() {
    // 더 보기 응답이 읽음 처리 전 상태로 미확인 알림을 다시 붙이지 않도록 로딩 중에는 막는다.
    if (pendingNotificationId || pendingBulkAction || loadingMore) {
      return;
    }

    const snapshot = items;
    const snapshotPage = storedPage;
    patch({ pendingBulkAction: "read-all-stored" });
    updateState((current) => ({
      ...current,
      items: markAllStoredNotificationsRead(current.items, new Date().toISOString()),
    }));
    updateState((current) => ({
      ...current,
      storedPage: { ...current.storedPage, unreadCount: 0 },
    }));

    try {
      const response = await requestNotificationJson<PartnerNotificationMutationResponse>(
        "/api/partner/notifications",
        { method: "PATCH" },
        { requestFailureMessage: "전체 읽음 처리에 실패했습니다." },
      );
      syncStoredUnreadCount(response);
      notify("불러오지 않은 이전 알림까지 모두 읽음 처리했습니다.");
    } catch (error) {
      patch({ items: snapshot });
      patch({ storedPage: snapshotPage });
      notify(getNotificationClientError(error, "전체 읽음 처리에 실패했습니다.").message, { tone: "error" });
    } finally {
      patch({ pendingBulkAction: null });
    }
  }

  async function markNotificationAsRead(model: PartnerNotificationUiModel) {
    const notificationId = model.item.notificationId;
    if (!notificationId || pendingNotificationId || pendingBulkAction || model.readState !== "unread") {
      return;
    }

    const snapshot = items;
    const now = new Date().toISOString();
    patch({ pendingNotificationId: notificationId });
    updateState((current) => ({
      ...current,
      items: updateNotificationReadState(current.items, [notificationId], now),
    }));

    try {
      const response = await requestNotificationJson<PartnerNotificationMutationResponse>(
        `/api/partner/notifications/${notificationId}`,
        {
          method: "PATCH",
        },
        { requestFailureMessage: "읽음 처리에 실패했습니다." },
      );
      syncStoredUnreadCount(response);
      notify("알림을 읽음 처리했습니다.");
    } catch (error) {
      patch({ items: snapshot });
      notify(getNotificationClientError(error, "읽음 처리에 실패했습니다.").message, { tone: "error" });
    } finally {
      patch({ pendingNotificationId: null });
    }
  }

  async function deleteNotification(model: PartnerNotificationUiModel) {
    const notificationId = model.item.notificationId;
    if (!notificationId || pendingNotificationId || pendingBulkAction || loadingMore) {
      return;
    }

    const snapshot = items;
    const deletedStoredCount =
      snapshot.length - removeNotifications(snapshot, [notificationId]).length;
    patch({ pendingNotificationId: notificationId });
    updateState((current) => ({
      ...current,
      items: removeNotifications(current.items, [notificationId]),
    }));

    try {
      const response = await requestNotificationJson<PartnerNotificationMutationResponse>(
        `/api/partner/notifications/${notificationId}`,
        {
          method: "DELETE",
        },
        { requestFailureMessage: "알림 삭제에 실패했습니다." },
      );
      updateState((current) => ({
        ...current,
        storedPage: shiftPartnerStoredNotificationPageAfterDelete(current.storedPage, deletedStoredCount),
      }));
      syncStoredUnreadCount(response);
      notify("처리 필요 알림을 삭제했습니다.");
    } catch (error) {
      patch({ items: snapshot });
      notify(getNotificationClientError(error, "알림 삭제에 실패했습니다.").message, { tone: "error" });
    } finally {
      patch({ pendingNotificationId: null });
    }
  }

  async function markVisibleNotificationsAsRead() {
    if (
      pendingNotificationId ||
      pendingBulkAction ||
      visibleUnreadNotificationIds.length === 0
    ) {
      return;
    }

    const snapshot = items;
    const now = new Date().toISOString();
    patch({ pendingBulkAction: "read-visible" });
    updateState((current) => ({
      ...current,
      items: updateNotificationReadState(current.items, visibleUnreadNotificationIds, now),
    }));

    try {
      const response = await requestNotificationJson<PartnerNotificationMutationResponse>(
        "/api/partner/notifications",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds: visibleUnreadNotificationIds }),
        },
        { requestFailureMessage: "전체 읽음 처리에 실패했습니다." },
      );
      syncStoredUnreadCount(response);
      notify("표시된 미확인 알림을 읽음 처리했습니다.");
    } catch (error) {
      patch({ items: snapshot });
      notify(getNotificationClientError(error, "전체 읽음 처리에 실패했습니다.").message, { tone: "error" });
    } finally {
      patch({ pendingBulkAction: null });
    }
  }

  async function deleteVisibleActionNotifications() {
    if (
      pendingNotificationId ||
      pendingBulkAction ||
      loadingMore ||
      visibleActionNotificationIds.length === 0
    ) {
      return;
    }

    const snapshot = items;
    const deletedStoredCount =
      snapshot.length - removeNotifications(snapshot, visibleActionNotificationIds).length;
    patch({ pendingBulkAction: "delete-action" });
    updateState((current) => ({
      ...current,
      items: removeNotifications(current.items, visibleActionNotificationIds),
    }));

    try {
      const response = await requestNotificationJson<PartnerNotificationMutationResponse>(
        "/api/partner/notifications",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds: visibleActionNotificationIds }),
        },
        { requestFailureMessage: "처리 필요 알림 삭제에 실패했습니다." },
      );
      updateState((current) => ({
        ...current,
        storedPage: shiftPartnerStoredNotificationPageAfterDelete(current.storedPage, deletedStoredCount),
      }));
      syncStoredUnreadCount(response);
      notify("표시된 처리 필요 알림을 삭제했습니다.");
    } catch (error) {
      patch({ items: snapshot });
      notify(
        getNotificationClientError(error, "처리 필요 알림 삭제에 실패했습니다.").message,
        { tone: "error" },
      );
    } finally {
      patch({ pendingBulkAction: null });
    }
  }

  return {
    loadMoreStoredNotifications, markAllStoredNotificationsAsRead,
    markNotificationAsRead, deleteNotification,
    markVisibleNotificationsAsRead, deleteVisibleActionNotifications,
  };
}
