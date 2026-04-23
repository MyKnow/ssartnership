"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FilterBar from "@/components/ui/FilterBar";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import type { PushAudienceScope } from "@/lib/push";
import type { AdminNotificationOperationLog, AdminNotificationType } from "@/lib/admin-notification-ops";
import {
  audienceLabels,
  formatNotificationChannels,
  formatPushLogDateTime,
  getPushLogStatusBadgeClass,
  statusLabels,
  typeLabels,
} from "./constants";
import type { AdminPushManagerProps, SortOption } from "./types";

type Props = {
  automaticSummaries: AdminPushManagerProps["automaticSummaries"];
  filteredLogs: AdminNotificationOperationLog[];
  filters: {
    search: string;
    typeFilter: AdminNotificationType | "all";
    sourceFilter: AdminNotificationOperationLog["source"] | "all";
    statusFilter: AdminNotificationOperationLog["status"] | "all";
    audienceFilter: PushAudienceScope | "all";
    sort: SortOption;
  };
  deletingLogId?: string | null;
  onUpdateFilter: (
    key: "search" | "typeFilter" | "sourceFilter" | "statusFilter" | "audienceFilter" | "sort",
    value: string,
  ) => void;
  onLoadLog?: (log: AdminNotificationOperationLog) => void;
  onDeleteLog?: (logId: string) => Promise<void>;
  readOnly?: boolean;
  title?: string;
  description?: string;
};

function AutomaticSummaryStrip({
  summaries,
}: {
  summaries: AdminPushManagerProps["automaticSummaries"];
}) {
  return (
    <FilterBar
      title="자동 알림 상태"
      description="자동 규칙은 간단히만 확인하고, 상세 이력은 아래 로그에서 봅니다."
      tone="default"
    >
      {summaries.map((summary) => (
        <div
          key={summary.notificationType}
          className="grid min-w-[14rem] gap-1 rounded-2xl border border-border bg-surface-inset px-4 py-3"
        >
          <p className="text-sm font-semibold text-foreground">{summary.label}</p>
          <p className="text-sm text-muted-foreground">
            최근 실행 {summary.lastRunAt ? formatPushLogDateTime(summary.lastRunAt) : "기록 없음"}
          </p>
          <p className="text-sm text-muted-foreground">
            실패 {summary.failedCount}건
            {summary.failureSamples[0] ? ` · ${summary.failureSamples[0]}` : ""}
          </p>
        </div>
      ))}
    </FilterBar>
  );
}

export function PushLogsSection({
  deletingLogId,
  automaticSummaries,
  filteredLogs,
  filters,
  readOnly = false,
  onDeleteLog,
  onLoadLog,
  onUpdateFilter,
  title = "알림 운영 로그",
  description = "최근 발송 이력을 검색하고 같은 구성을 다시 불러옵니다.",
}: Props) {
  return (
    <section className="grid min-w-0 gap-4 overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-[var(--shadow-flat)] sm:p-5">
      <SectionHeading
        title={title}
        description={description}
      />

      <AutomaticSummaryStrip summaries={automaticSummaries} />

      <FilterBar title="로그 검색" description="필요한 조건만 남겨서 최근 이력을 찾습니다.">
        <div className="grid min-w-[14rem] flex-1 gap-1">
          <span className="ui-caption">검색</span>
          <Input
            value={filters.search}
            onChange={(event) => onUpdateFilter("search", event.target.value)}
            placeholder="제목, 내용, URL, 대상 검색"
          />
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">유형</span>
          <Select
            value={filters.typeFilter}
            onChange={(event) => onUpdateFilter("typeFilter", event.target.value)}
          >
            <option value="all">전체 유형</option>
            <option value="announcement">운영 공지</option>
            <option value="marketing">마케팅/이벤트</option>
            <option value="new_partner">신규 제휴</option>
            <option value="expiring_partner">종료 임박</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">상태</span>
          <Select
            value={filters.statusFilter}
            onChange={(event) => onUpdateFilter("statusFilter", event.target.value)}
          >
            <option value="all">전체 상태</option>
            <option value="sent">발송 완료</option>
            <option value="partial_failed">일부 실패</option>
            <option value="failed">발송 실패</option>
            <option value="no_target">대상 없음</option>
            <option value="pending">대기</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">정렬</span>
          <Select
            value={filters.sort}
            onChange={(event) => onUpdateFilter("sort", event.target.value)}
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="delivered">성공 수 많은순</option>
            <option value="failed">실패 수 많은순</option>
          </Select>
        </div>
      </FilterBar>

      <div className="grid min-w-0 gap-3">
        {filteredLogs.length === 0 ? (
          <div className="min-w-0 overflow-hidden rounded-2xl border border-dashed border-border bg-surface-inset px-4 py-8 text-center text-sm text-muted-foreground">
            조건에 맞는 알림 운영 로그가 없습니다.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface-inset px-4 py-4"
            >
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-surface-muted text-foreground">
                      {typeLabels[log.notificationType]}
                    </Badge>
                    <Badge className="bg-surface-muted text-muted-foreground">
                      {audienceLabels[log.targetScope]}
                    </Badge>
                    <Badge className={getPushLogStatusBadgeClass(log.status)}>
                      {statusLabels[log.status]}
                    </Badge>
                  </div>
                  <p className="mt-3 break-words text-base font-semibold text-foreground">
                    {log.title}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {log.body}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <p>
                      {formatPushLogDateTime(log.createdAt)} · {log.source === "manual" ? "수동" : "자동"} · {formatNotificationChannels(log.selectedChannels)}
                    </p>
                    <p className="break-all">대상 {log.targetLabel}</p>
                    <p>
                      발송 인앱 {log.channelResults.in_app.sent} · 푸시 {log.channelResults.push.sent} · MM {log.channelResults.mm.sent}
                    </p>
                    {log.url ? <p className="break-all">이동 URL {log.url}</p> : null}
                    {log.exclusionReasons.length > 0 ? (
                      <p>
                        제외 {log.exclusionReasons.map((reason) => `${reason.label} ${reason.count}명`).join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>

                {!readOnly && onLoadLog && onDeleteLog ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <Button
                      className="w-full justify-center sm:w-auto"
                      variant="ghost"
                      onClick={() => onLoadLog(log)}
                    >
                      불러오기
                    </Button>
                    <Button
                      variant="danger"
                      className="w-full justify-center sm:w-auto"
                      onClick={() => void onDeleteLog(log.id)}
                      loading={deletingLogId === log.id}
                      loadingText="삭제 중"
                      disabled={Boolean(deletingLogId && deletingLogId !== log.id)}
                    >
                      삭제
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
