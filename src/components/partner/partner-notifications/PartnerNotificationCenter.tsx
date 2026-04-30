"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import type {
  PartnerNotificationCategory,
  PartnerNotificationCenterData,
  PartnerNotificationEntry,
  PartnerNotificationTone,
} from "@/lib/partner-notifications";

type NotificationFilter = PartnerNotificationCategory | "all";

const filterOptions: Array<{
  value: NotificationFilter;
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "request", label: "변경 요청" },
  { value: "review", label: "리뷰" },
  { value: "operation", label: "운영" },
];

function getCategoryLabel(category: PartnerNotificationCategory) {
  switch (category) {
    case "request":
      return "변경 요청";
    case "review":
      return "리뷰";
    case "operation":
      return "운영";
    default:
      return "알림";
  }
}

function getToneBadgeVariant(tone: PartnerNotificationTone) {
  return tone;
}

function getTargetLabel(item: PartnerNotificationEntry) {
  const labels = [item.companyName?.trim(), item.partnerName?.trim()].filter(
    (value): value is string => Boolean(value),
  );
  return labels.length > 0 ? labels.join(" · ") : "미지정";
}

function NotificationCard({ item }: { item: PartnerNotificationEntry }) {
  const createdAt = formatKoreanDateTimeToMinute(item.createdAt);
  const targetLabel = getTargetLabel(item);

  return (
    <Card tone="elevated" padding="md" className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{getCategoryLabel(item.category)}</Badge>
            <Badge variant={getToneBadgeVariant(item.tone)}>{item.badgeLabel}</Badge>
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              {item.title}
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {item.body}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{createdAt}</span>
            <span>대상 {targetLabel}</span>
          </div>
        </div>

        {item.href ? (
          <Button
            href={item.href}
            variant="secondary"
            className="w-full sm:w-auto sm:shrink-0"
          >
            바로 보기
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export default function PartnerNotificationCenter({
  data,
}: {
  data: PartnerNotificationCenterData;
}) {
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const visibleItems = useMemo(() => {
    if (filter === "all") {
      return data.items;
    }
    return data.items.filter((item) => item.category === filter);
  }, [data.items, filter]);

  return (
    <div className="grid min-w-0 gap-6">
      {data.warningMessage ? (
        <FormMessage variant="info">{data.warningMessage}</FormMessage>
      ) : null}

      <StatsRow
        minItemWidth="11rem"
        items={[
          {
            label: "전체 알림",
            value: `${data.summary.totalCount.toLocaleString("ko-KR")}건`,
            hint: "협력사 계정에 연결된 모든 알림",
          },
          {
            label: "변경 요청",
            value: `${data.summary.requestCount.toLocaleString("ko-KR")}건`,
            hint: "브랜드 수정 요청 알림",
          },
          {
            label: "대기 요청",
            value: `${data.summary.pendingRequestCount.toLocaleString("ko-KR")}건`,
            hint: "아직 처리되지 않은 요청",
          },
          {
            label: "처리 요청",
            value: `${data.summary.resolvedRequestCount.toLocaleString("ko-KR")}건`,
            hint: "승인, 반려, 취소 요청",
          },
          {
            label: "리뷰",
            value: `${data.summary.reviewCount.toLocaleString("ko-KR")}건`,
            hint: "브랜드 리뷰 관련 알림",
          },
          {
            label: "운영",
            value: `${data.summary.operationCount.toLocaleString("ko-KR")}건`,
            hint: "관리자 운영 및 권한 알림",
          },
        ]}
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[20rem_minmax(0,1fr)] xl:items-start">
        <Card tone="default" padding="md" className="space-y-4 xl:sticky xl:top-24">
          <div className="space-y-1">
            <p className="ui-kicker">필터</p>
            <p className="ui-body">
              변경 요청, 리뷰, 운영 알림을 나눠서 볼 수 있습니다.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {filterOptions.map((option) => {
              const active = filter === option.value;

              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={active ? "soft" : "secondary"}
                  size="sm"
                  ariaPressed={active}
                  onClick={() => setFilter(option.value)}
                  className="justify-start"
                >
                  {option.label}
                </Button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">{data.summary.companyCount}개 협력사</Badge>
            <Badge variant="neutral">{data.summary.serviceCount}개 브랜드</Badge>
            <Badge variant="neutral">{visibleItems.length}건 표시</Badge>
          </div>
        </Card>

        {visibleItems.length === 0 ? (
          <EmptyState
            title="표시할 알림이 없습니다."
            description="다른 필터를 선택하거나 잠시 후 다시 확인해 주세요."
            action={<Button href="/partner" variant="secondary">대시보드로 이동</Button>}
          />
        ) : (
          <div className="grid min-w-0 gap-3">
            {visibleItems.map((item) => (
              <NotificationCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
