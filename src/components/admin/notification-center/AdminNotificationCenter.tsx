"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PushLogsSection } from "@/components/admin/push-manager/PushLogsSection";
import { filterPushLogs } from "@/components/admin/push-manager/selectors";
import type { AdminPushManagerProps, SortOption } from "@/components/admin/push-manager/types";
import type { PushAudienceScope } from "@/lib/push";
import type { AdminNotificationOperationLog, AdminNotificationType } from "@/lib/admin-notification-ops";

type Props = Pick<AdminPushManagerProps, "automaticSummaries" | "recentLogs">;

type CenterFilterState = {
  search: string;
  typeFilter: AdminNotificationType | "all";
  sourceFilter: AdminNotificationOperationLog["source"] | "all";
  statusFilter: AdminNotificationOperationLog["status"] | "all";
  audienceFilter: PushAudienceScope | "all";
  sort: SortOption;
};
type CenterFilterKey = keyof CenterFilterState;

type CenterStats = {
  sentLogs: number;
  failedLogs: number;
  pendingLogs: number;
  automaticLogs: number;
  manualLogs: number;
  audienceTotal: number;
  audienceScopes: Record<PushAudienceScope, number>;
};

const initialFilters: CenterFilterState = {
  search: "",
  typeFilter: "all",
  sourceFilter: "all",
  statusFilter: "all",
  audienceFilter: "all",
  sort: "newest" as SortOption,
};

function summarizeLogs(logs: AdminNotificationOperationLog[]): CenterStats {
  return logs.reduce<CenterStats>(
    (accumulator, log) => {
      accumulator.audienceTotal += log.totalAudienceCount;
      accumulator.audienceScopes[log.targetScope] += 1;

      if (log.status === "sent") {
        accumulator.sentLogs += 1;
      }
      if (log.status === "failed" || log.status === "partial_failed") {
        accumulator.failedLogs += 1;
      }
      if (log.status === "pending" || log.status === "no_target") {
        accumulator.pendingLogs += 1;
      }
      if (log.source === "automatic") {
        accumulator.automaticLogs += 1;
      }
      if (log.source === "manual") {
        accumulator.manualLogs += 1;
      }
      return accumulator;
    },
    {
      sentLogs: 0,
      failedLogs: 0,
      pendingLogs: 0,
      automaticLogs: 0,
      manualLogs: 0,
      audienceTotal: 0,
      audienceScopes: {
        all: 0,
        year: 0,
        campus: 0,
        member: 0,
      },
    },
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Card tone="elevated" padding="md" className="min-w-0">
      <p className="ui-kicker">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}

export default function AdminNotificationCenter({
  automaticSummaries,
  recentLogs,
}: Props) {
  const [filters, setFilters] = useState(initialFilters);
  const filteredLogs = useMemo(
    () =>
      filterPushLogs({
        logs: recentLogs,
        ...filters,
      }),
    [filters, recentLogs],
  );
  const stats = useMemo(() => summarizeLogs(recentLogs), [recentLogs]);
  const updateFilter = (key: CenterFilterKey, value: string) => {
    setFilters((current) => {
      switch (key) {
        case "sort":
          return { ...current, sort: value as SortOption };
        case "search":
          return { ...current, search: value };
        case "typeFilter":
          return { ...current, typeFilter: value as CenterFilterState["typeFilter"] };
        case "sourceFilter":
          return { ...current, sourceFilter: value as CenterFilterState["sourceFilter"] };
        case "statusFilter":
          return { ...current, statusFilter: value as CenterFilterState["statusFilter"] };
        case "audienceFilter":
          return { ...current, audienceFilter: value as CenterFilterState["audienceFilter"] };
        default:
          return current;
      }
    });
  };

  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="발송 결과"
          value={`${stats.sentLogs.toLocaleString()}건`}
          description="발송 완료로 마감된 로그"
        />
        <MetricCard
          label="실패"
          value={`${stats.failedLogs.toLocaleString()}건`}
          description="실패 및 일부 실패 로그"
        />
        <MetricCard
          label="예약/대기"
          value={`${stats.pendingLogs.toLocaleString()}건`}
          description="대기 또는 대상 없음 로그"
        />
        <MetricCard
          label="즉시 / 자동"
          value={`${stats.manualLogs.toLocaleString()} · ${stats.automaticLogs.toLocaleString()}`}
          description="즉시 발송 · 자동 발송"
        />
        <MetricCard
          label="대상자 요약"
          value={`${stats.audienceTotal.toLocaleString()}명`}
          description={`전체 ${stats.audienceScopes.all} · 기수 ${stats.audienceScopes.year} · 캠퍼스 ${stats.audienceScopes.campus} · 개인 ${stats.audienceScopes.member}`}
        />
      </div>

      <PushLogsSection
        automaticSummaries={automaticSummaries}
        filteredLogs={filteredLogs}
        filters={filters}
        readOnly
        title="발송 기록"
        description="최근 알림 로그를 검색하고 상태별로 확인합니다. 전송·삭제 작업은 알림 전송 화면에서만 가능합니다."
        onUpdateFilter={updateFilter}
      />

      <div className="flex justify-end">
        <Button href="/admin/push" variant="secondary">
          알림 전송으로 이동
        </Button>
      </div>
    </div>
  );
}
