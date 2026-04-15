"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FilterBar from "@/components/ui/FilterBar";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import type { PushAudienceScope, PushMessageLog } from "@/lib/push";
import {
  audienceLabels,
  formatPushLogDateTime,
  getPushLogStatusBadgeClass,
  sourceLabels,
  statusLabels,
  typeLabels,
} from "./constants";
import type { SortOption } from "./types";

type Props = {
  filteredLogs: PushMessageLog[];
  filters: {
    search: string;
    typeFilter: PushMessageLog["type"] | "all";
    sourceFilter: PushMessageLog["source"] | "all";
    statusFilter: PushMessageLog["status"] | "all";
    audienceFilter: PushAudienceScope | "all";
    sort: SortOption;
  };
  deletingLogId: string | null;
  onUpdateFilter: (
    key: "search" | "typeFilter" | "sourceFilter" | "statusFilter" | "audienceFilter" | "sort",
    value: string,
  ) => void;
  onLoadLog: (log: PushMessageLog) => void;
  onDeleteLog: (logId: string) => Promise<void>;
};

export function PushLogsSection({
  deletingLogId,
  filteredLogs,
  filters,
  onDeleteLog,
  onLoadLog,
  onUpdateFilter,
}: Props) {
  return (
    <section className="grid min-w-0 gap-4 overflow-hidden rounded-3xl border border-border bg-surface-muted/50 p-4 sm:p-5">
      <SectionHeading
        title="푸시 메시지 로그"
        description="과거 메시지를 검색, 정렬, 필터링하고 필요하면 입력 폼으로 다시 불러올 수 있습니다."
      />

      <FilterBar title="로그 필터" description="유형, 대상, 상태, 정렬 기준으로 이력을 압축해서 봅니다.">
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
            <option value="new_partner">신규 제휴</option>
            <option value="expiring_partner">종료 임박</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">발송 방식</span>
          <Select
            value={filters.sourceFilter}
            onChange={(event) => onUpdateFilter("sourceFilter", event.target.value)}
          >
            <option value="all">전체 발송 방식</option>
            <option value="manual">수동 발송</option>
            <option value="automatic">자동 발송</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">대상</span>
          <Select
            value={filters.audienceFilter}
            onChange={(event) => onUpdateFilter("audienceFilter", event.target.value)}
          >
            <option value="all">전체</option>
            <option value="year">기수</option>
            <option value="campus">캠퍼스</option>
            <option value="member">개인</option>
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
          <div className="min-w-0 overflow-hidden rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
            조건에 맞는 푸시 메시지 로그가 없습니다.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface px-4 py-4"
            >
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-surface-muted text-foreground">
                      {typeLabels[log.type]}
                    </Badge>
                    <Badge className="bg-surface-muted text-muted-foreground">
                      {audienceLabels[log.target_scope]}
                    </Badge>
                    <Badge className="bg-surface-muted text-muted-foreground">
                      {sourceLabels[log.source]}
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
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                    <p>발송 시각: {formatPushLogDateTime(log.created_at)}</p>
                    <p className="break-all">발송 대상: {log.target_label}</p>
                    <p className="break-all">이동 URL: {log.url || "없음"}</p>
                    <p>
                      대상 {log.targeted} · 성공 {log.delivered} · 실패 {log.failed}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  <Button
                    className="w-full justify-center sm:w-auto"
                    variant="ghost"
                    onClick={() => onLoadLog(log)}
                  >
                    메시지 불러오기
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
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
