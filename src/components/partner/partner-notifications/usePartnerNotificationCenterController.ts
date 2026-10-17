"use client";

import { useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type {
  PartnerNotificationCenterData,
  PartnerNotificationStatus,
} from "@/lib/partner-notification-contract";
import {
  derivePartnerNotificationUiModel,
  filterPartnerNotificationUiModels,
  hasUnloadedUnreadPartnerNotifications,
  summarizePartnerNotificationUiModels,
  type PartnerNotificationPriority,
  type PartnerNotificationUiFilters,
  type PartnerNotificationUiType,
  type PartnerNotificationUiModel,
} from "@/lib/partner-notification-ui";
import { createPartnerNotificationCenterCommands } from "./partner-notification-center-commands";
import { createPartnerNotificationCenterState } from "./partner-notification-center-state";

export function usePartnerNotificationCenterController(
  data: PartnerNotificationCenterData,
) {
  const { notify } = useToast();
  const [state, setState] = useState(() => createPartnerNotificationCenterState(data));
  const { items, storedPage, pendingNotificationId, pendingBulkAction } = state;
  // 읽음·삭제 응답 이후, 더 보기의 오래된 미확인 수가 최신 값을 덮지 않게 한다.
  const unreadCountSyncVersionRef = useRef(0);
  const [deleteActionConfirmOpen, setDeleteActionConfirmOpen] = useState(false);
  const [filters, setFilters] = useState<PartnerNotificationUiFilters>({
    category: "all",
    type: "all",
    purpose: "all",
    priority: "all",
    status: "all",
    readState: "all",
    companyId: "all",
    period: "all",
    searchQuery: "",
  });

  const uiItems = useMemo(
    () => items.map((item) => derivePartnerNotificationUiModel(item)),
    [items],
  );

  const summary = useMemo(() => summarizePartnerNotificationUiModels(uiItems), [uiItems]);

  const visibleItems = useMemo(
    () => filterPartnerNotificationUiModels(uiItems, filters),
    [filters, uiItems],
  );

  const attentionItems = useMemo(
    () =>
      uiItems
        .filter((model) => model.purpose === "action")
        .sort((left, right) => {
          const priorityRank: Record<PartnerNotificationPriority, number> = {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
          };
          return (
            priorityRank[left.priority] - priorityRank[right.priority] ||
            new Date(right.item.createdAt).getTime() - new Date(left.item.createdAt).getTime()
          );
        })
        .slice(0, 3),
    [uiItems],
  );

  const typeOptions = useMemo(() => {
    const map = new Map<PartnerNotificationUiType, string>();
    uiItems.forEach((model) => map.set(model.type, model.typeLabel));
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [uiItems]);

  const statusOptions = useMemo(() => {
    const map = new Map<PartnerNotificationStatus, string>();
    uiItems.forEach((model) => map.set(model.item.status, model.statusLabel));
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [uiItems]);

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    uiItems.forEach((model) => {
      map.set(model.item.companyId ?? "global", model.item.companyName || "계정 전역");
    });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [uiItems]);

  const activeFilterCount = [
    filters.category !== "all",
    filters.type !== "all",
    filters.purpose !== "all",
    filters.priority !== "all",
    filters.status !== "all",
    filters.readState !== "all",
    filters.companyId !== "all",
    filters.period !== "all",
    Boolean(filters.searchQuery.trim()),
  ].filter(Boolean).length;
  const isMutationPending = Boolean(pendingNotificationId || pendingBulkAction);
  const showPartialFilterNotice = storedPage.hasMore && activeFilterCount > 0;
  const canReadUnloadedStoredNotifications = hasUnloadedUnreadPartnerNotifications({
    storedUnreadCount: storedPage.unreadCount,
    loadedUnreadCount: summary.unreadCount,
    hasMore: storedPage.hasMore,
  });
  const visibleUnreadNotificationIds = visibleItems
    .filter((model) => model.readState === "unread")
    .map((model) => model.item.notificationId)
    .filter((value): value is string => Boolean(value));
  const visibleActionNotificationIds = visibleItems
    .filter((model) => model.purpose === "action")
    .map((model) => model.item.notificationId)
    .filter((value): value is string => Boolean(value));

  function updateFilter<K extends keyof PartnerNotificationUiFilters>(
    key: K,
    value: PartnerNotificationUiFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function commands() {
    return createPartnerNotificationCenterCommands({
      state,
      updateState: setState,
      notify,
      getUnreadCountSyncVersion: () => unreadCountSyncVersionRef.current,
      advanceUnreadCountSyncVersion: () => { unreadCountSyncVersionRef.current += 1; },
      visibleUnreadNotificationIds, visibleActionNotificationIds,
    });
  }

  return {
    ...state,
    loadMoreStoredNotifications: () => commands().loadMoreStoredNotifications(),
    markAllStoredNotificationsAsRead: () => commands().markAllStoredNotificationsAsRead(),
    markNotificationAsRead: (model: PartnerNotificationUiModel) => commands().markNotificationAsRead(model),
    deleteNotification: (model: PartnerNotificationUiModel) => commands().deleteNotification(model),
    markVisibleNotificationsAsRead: () => commands().markVisibleNotificationsAsRead(),
    deleteVisibleActionNotifications: () => commands().deleteVisibleActionNotifications(),
    filters, setFilters, updateFilter,
    deleteActionConfirmOpen, setDeleteActionConfirmOpen,
    summary, visibleItems, attentionItems, typeOptions, statusOptions, companyOptions,
    activeFilterCount, isMutationPending, showPartialFilterNotice,
    canReadUnloadedStoredNotifications, visibleUnreadNotificationIds, visibleActionNotificationIds,
  };
}
