"use client";

import { useMemo, useState } from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import IconActionButton, { IconActionGroup } from "@/components/ui/IconActionButton";
import { useToast } from "@/components/ui/Toast";
import {
  emitNotificationUnreadCount,
} from "@/hooks/useNotificationUnreadCount";
import {
  getNotificationTypeLabel,
  type MemberNotificationRecord,
  type NotificationListResult,
} from "@/lib/notifications/shared";
import { cn } from "@/lib/cn";
import { formatKoreanDateTime } from "@/lib/datetime";

type NotificationInboxState = NotificationListResult;

type NotificationInboxProps = {
  initialState: NotificationInboxState;
  className?: string;
};

function formatNotificationDate(value: string) {
  return formatKoreanDateTime(value, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function parseNotificationResponse(response: Response) {
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    summary?: { unreadCount?: number };
    items?: MemberNotificationRecord[];
    nextOffset?: number;
    hasMore?: boolean;
  };

  if (!response.ok) {
    throw new Error(data.message ?? "알림을 처리하지 못했습니다.");
  }

  return data;
}

export default function NotificationInbox({
  initialState,
  className,
}: NotificationInboxProps) {
  const router = useRouter();
  const { notify } = useToast();
  const [state, setState] = useState(initialState);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"read-all" | "delete-all" | null>(null);

  const unreadLabel = useMemo(
    () => (state.unreadCount > 99 ? "99+" : String(state.unreadCount)),
    [state.unreadCount],
  );
  const isBulkActionPending = pendingAction !== null;

  async function markAsRead(item: MemberNotificationRecord) {
    if (pendingId || pendingAction || !item.isUnread) {
      return;
    }

    setPendingId(item.id);
    setState((current) => ({
      ...current,
      unreadCount: Math.max(0, current.unreadCount - 1),
      items: current.items.map((row) =>
        row.id === item.id
          ? {
              ...row,
              readAt: row.readAt ?? new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isUnread: false,
            }
          : row,
      ),
    }));

    try {
      const response = await fetch(`/api/notifications/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await parseNotificationResponse(response);
      if (typeof data.summary?.unreadCount === "number") {
        emitNotificationUnreadCount(data.summary.unreadCount);
        setState((current) => ({
          ...current,
          unreadCount: data.summary?.unreadCount ?? current.unreadCount,
        }));
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        unreadCount: current.unreadCount + 1,
        items: current.items.map((row) =>
          row.id === item.id
            ? {
                ...row,
                readAt: item.readAt,
                updatedAt: item.updatedAt,
                isUnread: true,
              }
            : row,
        ),
      }));
      notify(error instanceof Error ? error.message : "읽음 처리에 실패했습니다.");
    } finally {
      setPendingId(null);
    }
  }

  async function markAsReadAndOpen(item: MemberNotificationRecord) {
    if (pendingId || pendingAction) {
      return;
    }

    setPendingId(item.id);
    try {
      const response = await fetch(`/api/notifications/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await parseNotificationResponse(response);
      if (typeof data.summary?.unreadCount === "number") {
        setState((current) => ({
          ...current,
          unreadCount: data.summary?.unreadCount ?? current.unreadCount,
          items: current.items.map((row) =>
            row.id === item.id
              ? {
                  ...row,
                  readAt: row.readAt ?? new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  isUnread: false,
                }
              : row,
          ),
        }));
        emitNotificationUnreadCount(data.summary.unreadCount);
      }
      router.push(item.targetUrl);
    } catch (error) {
      notify(error instanceof Error ? error.message : "알림을 열지 못했습니다.");
    } finally {
      setPendingId(null);
    }
  }

  async function deleteNotification(item: MemberNotificationRecord) {
    if (pendingId || pendingAction) {
      return;
    }

    setPendingId(item.id);
    const wasUnread = item.isUnread;
    setState((current) => ({
      ...current,
      unreadCount: wasUnread
        ? Math.max(0, current.unreadCount - 1)
        : current.unreadCount,
      items: current.items.filter((row) => row.id !== item.id),
    }));

    try {
      const response = await fetch(`/api/notifications/${item.id}`, {
        method: "DELETE",
      });
      const data = await parseNotificationResponse(response);
      if (typeof data.summary?.unreadCount === "number") {
        emitNotificationUnreadCount(data.summary.unreadCount);
        setState((current) => ({
          ...current,
          unreadCount: data.summary?.unreadCount ?? current.unreadCount,
        }));
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        unreadCount: wasUnread ? current.unreadCount + 1 : current.unreadCount,
        items: [item, ...current.items],
      }));
      notify(error instanceof Error ? error.message : "알림을 삭제하지 못했습니다.");
    } finally {
      setPendingId(null);
    }
  }

  async function markAllAsRead() {
    if (pendingId || pendingAction || state.unreadCount === 0) {
      return;
    }

    const snapshot = state;
    const now = new Date().toISOString();
    setPendingAction("read-all");
    setState((current) => ({
      ...current,
      unreadCount: 0,
      items: current.items.map((row) =>
        row.isUnread
          ? {
              ...row,
              readAt: row.readAt ?? now,
              updatedAt: now,
              isUnread: false,
            }
          : row,
      ),
    }));

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
      });
      const data = await parseNotificationResponse(response);
      if (typeof data.summary?.unreadCount === "number") {
        emitNotificationUnreadCount(data.summary.unreadCount);
        setState((current) => ({
          ...current,
          unreadCount: data.summary?.unreadCount ?? current.unreadCount,
        }));
      }
      notify("모든 알림을 읽음 처리했습니다.");
    } catch (error) {
      setState(snapshot);
      notify(error instanceof Error ? error.message : "전체 읽음 처리에 실패했습니다.");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteAllNotifications() {
    if (pendingId || pendingAction || state.items.length === 0) {
      return;
    }

    if (!window.confirm("수신함의 모든 알림을 삭제할까요?")) {
      return;
    }

    const snapshot = state;
    setPendingAction("delete-all");
    setState((current) => ({
      ...current,
      unreadCount: 0,
      items: [],
      nextOffset: 0,
      hasMore: false,
    }));

    try {
      const response = await fetch("/api/notifications", {
        method: "DELETE",
      });
      const data = await parseNotificationResponse(response);
      if (typeof data.summary?.unreadCount === "number") {
        emitNotificationUnreadCount(data.summary.unreadCount);
        setState((current) => ({
          ...current,
          unreadCount: data.summary?.unreadCount ?? current.unreadCount,
        }));
      }
      notify("모든 알림을 삭제했습니다.");
    } catch (error) {
      setState(snapshot);
      notify(error instanceof Error ? error.message : "전체 삭제에 실패했습니다.");
    } finally {
      setPendingAction(null);
    }
  }

  async function loadMore() {
    if (loadingMore || !state.hasMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/notifications?offset=${state.nextOffset}&limit=10`,
      );
      const data = await parseNotificationResponse(response);
      setState((current) => ({
        unreadCount: data.summary?.unreadCount ?? current.unreadCount,
        items: [...current.items, ...(data.items ?? [])],
        nextOffset: data.nextOffset ?? current.nextOffset,
        hasMore: Boolean(data.hasMore),
      }));
    } catch (error) {
      notify(error instanceof Error ? error.message : "알림을 더 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card
      padding="none"
      className={cn("mx-auto w-full max-w-3xl overflow-hidden", className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">수신함</h2>
          {state.items.length > 0 && state.unreadCount > 0 ? (
            <Badge variant="danger">안 읽음 {unreadLabel}</Badge>
          ) : null}
        </div>
        {state.items.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="!h-8 !min-h-8 !min-w-0 rounded-full border-success/20 bg-success/10 px-3 text-xs font-semibold text-success shadow-[var(--shadow-raised)] hover:border-success/30 hover:bg-success/15"
              onClick={() => {
                void markAllAsRead();
              }}
              disabled={state.unreadCount === 0 || isBulkActionPending || Boolean(pendingId)}
            >
              전체 읽음
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="!h-8 !min-h-8 !min-w-0 rounded-full px-3 text-xs font-semibold shadow-[var(--shadow-raised)]"
              onClick={() => {
                void deleteAllNotifications();
              }}
              disabled={state.items.length === 0 || isBulkActionPending || Boolean(pendingId)}
            >
              전체 삭제
            </Button>
          </div>
        ) : null}
      </div>

      {state.items.length > 0 ? (
        <div className="divide-y divide-border/70">
          {state.items.map((item) => {
            const isBusy = Boolean(pendingAction) || pendingId === item.id;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`${item.title} 알림 열기`}
                className={cn(
                  "group relative grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3.5 outline-none transition-colors hover:bg-surface-muted/70 focus-visible:bg-surface-muted/70 sm:px-5 sm:py-4",
                  item.isUnread
                    ? "bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                    : "bg-[color-mix(in_srgb,var(--surface)_28%,var(--background)_72%)] opacity-[0.74]",
                  isBusy ? "pointer-events-none opacity-70" : null,
                )}
                onClick={() => {
                  void markAsReadAndOpen(item);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void markAsReadAndOpen(item);
                  }
                }}
              >
                <div className="mt-1 shrink-0 pt-1">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "block h-2.5 w-2.5 rounded-full",
                      item.isUnread ? "bg-danger shadow-[0_0_0_4px_rgba(194,65,92,0.12)]" : "bg-border/75",
                    )}
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={item.isUnread ? "primary" : "neutral"}
                      className={cn(
                        "px-2 py-0.5 text-[10px]",
                        item.isUnread
                          ? "border-primary/20 bg-primary-soft text-primary"
                          : "border-border/40 bg-surface-muted/55 text-muted-foreground/75",
                      )}
                    >
                      {getNotificationTypeLabel(item.type)}
                    </Badge>
                    <span
                      className={cn(
                        "text-xs text-muted-foreground",
                        item.isUnread ? "text-foreground-soft" : "text-muted-foreground/65",
                      )}
                    >
                      {formatNotificationDate(item.createdAt)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h3
                      className={cn(
                        "text-sm font-semibold leading-6 text-foreground sm:text-[15px]",
                        item.isUnread ? "text-foreground" : "text-foreground-soft/75",
                      )}
                    >
                      {item.title}
                    </h3>
                    <p
                      className={cn(
                        "line-clamp-2 text-sm leading-5 text-muted-foreground sm:leading-6",
                        item.isUnread ? "text-muted-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {item.body}
                    </p>
                  </div>
                </div>

                <IconActionGroup className="self-center">
                  {item.isUnread ? (
                    <IconActionButton
                      tone="success"
                      aria-label="읽음 처리"
                      onClick={(event) => {
                        event.stopPropagation();
                        void markAsRead(item);
                      }}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </IconActionButton>
                  ) : null}
                  <IconActionButton
                    tone="danger"
                    aria-label="알림 삭제"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteNotification(item);
                    }}
                  >
                      <XMarkIcon className="h-4 w-4" />
                  </IconActionButton>
                </IconActionGroup>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-6 sm:px-5 sm:py-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                아직 도착한 알림이 없습니다
              </p>
              <p className="text-sm text-muted-foreground">
                알림이 도착하면 이곳에 표시됩니다.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              href="/"
              className="w-full justify-center sm:w-auto"
            >
              혜택 둘러보기
            </Button>
          </div>
        </div>
      )}

      {state.hasMore ? (
        <div className="border-t border-border/70 px-4 py-4 sm:px-6">
          <div className="flex justify-center">
            <Button
              variant="secondary"
              className="w-full max-w-sm"
              onClick={() => {
                void loadMore();
              }}
              loading={loadingMore}
              loadingText="불러오는 중"
              disabled={loadingMore}
            >
              더보기
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
