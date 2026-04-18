"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import InlineMessage from "@/components/ui/InlineMessage";
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

type NotificationInboxState = NotificationListResult;

type NotificationInboxProps = {
  initialState: NotificationInboxState;
  className?: string;
};

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

  const unreadLabel = useMemo(
    () => (state.unreadCount > 99 ? "99+" : String(state.unreadCount)),
    [state.unreadCount],
  );

  async function markAsReadAndOpen(item: MemberNotificationRecord) {
    if (pendingId) {
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
    if (pendingId) {
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
    <Card className={cn("mx-auto w-full max-w-3xl overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-5 sm:px-6">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">알림 수신함</h2>
            <Badge variant={state.unreadCount > 0 ? "danger" : "neutral"}>
              {unreadLabel}
            </Badge>
          </div>
          <p className="ui-body max-w-2xl">
            읽지 않은 알림만 badge에 반영됩니다. 항목을 누르면 읽음 처리 후 바로
            이동합니다.
          </p>
        </div>
      </div>

      {state.items.length > 0 ? (
        <div className="divide-y divide-border/70">
          {state.items.map((item) => {
            const isBusy = pendingId === item.id;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`${item.title} 알림 열기`}
                className={cn(
                  "group relative flex cursor-pointer gap-4 px-5 py-4 outline-none transition-colors hover:bg-surface-muted/70 focus-visible:bg-surface-muted/70 sm:px-6",
                  item.isUnread ? "bg-primary-soft/20" : "bg-surface",
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
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary">{getNotificationTypeLabel(item.type)}</Badge>
                    {item.isUnread ? <Badge variant="danger">새 알림</Badge> : null}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold leading-6 text-foreground">
                      {item.title}
                    </h3>
                    <p className="ui-body line-clamp-2">{item.body}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{formatNotificationDate(item.createdAt)}</span>
                    <span>{item.isUnread ? "읽지 않음" : "읽음"}</span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-surface text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label="알림 삭제"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteNotification(item);
                    }}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-5 sm:px-6">
          <InlineMessage
            tone="info"
            title="아직 도착한 알림이 없습니다"
            description="새 제휴, 종료 임박, 운영 공지, 마케팅 안내가 이곳에 쌓입니다."
            actionHref="/"
            actionLabel="혜택 둘러보기"
          />
        </div>
      )}

      {state.hasMore ? (
        <div className="border-t border-border/70 px-5 py-4 sm:px-6">
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
