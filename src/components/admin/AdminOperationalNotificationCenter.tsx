"use client";

import { useState, useTransition } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";

export type AdminOperationalNotificationItem = {
  recipientId: string;
  notificationId: string;
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  readAt: string | null;
  createdAt: string;
};

function getTypeLabel(type: string) {
  switch (type) {
    case "partner_change_request":
      return "변경 요청";
    case "partner_immediate_update":
      return "즉시 수정";
    case "expiring_partner":
      return "종료 임박";
    case "security_alert":
      return "보안";
    default:
      return "알림";
  }
}

function getTypeVariant(type: string) {
  if (type === "security_alert") {
    return "danger";
  }
  if (type === "expiring_partner") {
    return "warning";
  }
  if (type === "partner_change_request") {
    return "primary";
  }
  return "neutral";
}

async function patchNotification(notificationId: string) {
  const response = await fetch(`/api/admin/notifications/${notificationId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ read: true }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "알림을 처리하지 못했습니다.",
    );
  }
}

export default function AdminOperationalNotificationCenter({
  items,
  unreadCount,
}: {
  items: AdminOperationalNotificationItem[];
  unreadCount: number;
}) {
  const [currentItems, setCurrentItems] = useState(items);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function markRead(notificationId: string) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await patchNotification(notificationId);
        setCurrentItems((previous) =>
          previous.map((item) =>
            item.notificationId === notificationId
              ? { ...item, readAt: new Date().toISOString() }
              : item,
          ),
        );
        setMessage("알림을 읽음 처리했습니다.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "알림 처리에 실패했습니다.");
      }
    });
  }

  return (
    <Card tone="default" padding="md" className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="ui-kicker">Admin Inbox</p>
          <h2 className="text-lg font-semibold text-foreground">운영 알림</h2>
        </div>
        <Badge variant={unreadCount > 0 ? "primary" : "neutral"}>
          읽지 않음 {unreadCount.toLocaleString("ko-KR")}건
        </Badge>
      </div>

      {message ? <FormMessage variant="info">{message}</FormMessage> : null}
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}

      {currentItems.length === 0 ? (
        <EmptyState
          title="도착한 운영 알림이 없습니다."
          description="파트너 변경 요청, 종료 임박, 보안 이벤트가 발생하면 이곳에 표시됩니다."
        />
      ) : (
        <div className="grid gap-3">
          {currentItems.map((item) => (
            <div
              key={item.recipientId}
              className="grid gap-3 rounded-[1rem] border border-border bg-surface-inset p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getTypeVariant(item.type)}>
                      {getTypeLabel(item.type)}
                    </Badge>
                    {!item.readAt ? <Badge variant="primary">New</Badge> : null}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item.body}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatKoreanDateTimeToMinute(item.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!item.readAt ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isPending}
                      onClick={() => markRead(item.notificationId)}
                    >
                      읽음
                    </Button>
                  ) : null}
                  <Button href={item.targetUrl} variant="ghost" size="sm">
                    열기
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
