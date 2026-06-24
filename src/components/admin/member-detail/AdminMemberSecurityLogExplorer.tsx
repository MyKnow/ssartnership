"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";

export type AdminMemberSecurityLog = {
  id: string;
  eventName: string;
  status: string | null;
  identifier: string | null;
  path: string | null;
  ipAddress: string | null;
  properties: Record<string, unknown> | null;
  createdAt: string;
};

type StatusFilter = "all" | "success" | "failure" | "blocked";
type SortFilter = "newest" | "oldest";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "success", label: "success" },
  { value: "failure", label: "failure" },
  { value: "blocked", label: "blocked" },
];

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return formatKoreanDateTimeToMinute(value);
}

function getStatusBadgeClass(status: string | null) {
  switch (status) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "failure":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200";
    case "blocked":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200";
    default:
      return "border-border bg-surface-muted text-muted-foreground";
  }
}

function getPropertyEntries(properties: Record<string, unknown> | null) {
  if (!properties) {
    return [];
  }
  return Object.entries(properties).slice(0, 8);
}

export default function AdminMemberSecurityLogExplorer({
  logs,
  pagination,
  filters,
}: {
  logs: AdminMemberSecurityLog[];
  pagination: {
    totalCount: number;
    page: number;
    pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
  };
  filters: {
    searchValue: string;
    statusFilter: StatusFilter;
    sortFilter: SortFilter;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchDraft, setSearchDraft] = useState({
    sourceValue: filters.searchValue,
    value: filters.searchValue,
  });

  const totalPages = Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize));
  const safeCurrentPage = Math.min(pagination.page, totalPages);
  const pageStart = (safeCurrentPage - 1) * pagination.pageSize;
  const searchValue =
    searchDraft.sourceValue === filters.searchValue
      ? searchDraft.value
      : filters.searchValue;
  const isSearchDirty = searchValue !== filters.searchValue;
  const rangeLabel =
    pagination.totalCount === 0
      ? "0건"
      : `${pageStart + 1}-${Math.min(pageStart + logs.length, pagination.totalCount)} / ${pagination.totalCount}`;

  function updateQuery(updates: Record<string, string | number | null>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function updateFilter(updates: Record<string, string | number | null>) {
    updateQuery({ ...updates, logPage: null });
  }

  function applySearchFilter() {
    const nextSearchValue = searchValue.trim();
    setSearchDraft({
      sourceValue: filters.searchValue,
      value: nextSearchValue,
    });
    if (nextSearchValue === filters.searchValue) {
      return;
    }
    updateFilter({ logQ: nextSearchValue });
  }

  function resetSearchFilter() {
    setSearchDraft({ sourceValue: filters.searchValue, value: "" });
    updateFilter({ logQ: null });
  }

  function syncPage(nextPage: number) {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    updateQuery({ logPage: safePage });
  }

  return (
    <section className="grid gap-5 rounded-panel border border-border/70 bg-surface-elevated px-5 py-5 shadow-flat sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          title="인증/보안 활동 로그"
          description="이 회원의 보안 활동을 서버 페이지 단위로 검색합니다. 이벤트명, 입력값, IP, 경로를 조합해 조회할 수 있습니다."
        />
        <Badge className="w-fit bg-surface text-muted-foreground">
          서버 결과 {pagination.totalCount.toLocaleString()}건
          {isPending ? " · 갱신 중" : ""}
        </Badge>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,0.6fr)_minmax(0,1.7fr)] xl:items-start">
        <Card tone="muted" padding="md" className="grid gap-4 xl:sticky xl:top-24">
          <div className="grid gap-1">
            <p className="ui-kicker">탐색 필터</p>
            <h3 className="text-lg font-semibold text-foreground">검색과 정렬</h3>
            <p className="text-sm text-muted-foreground">
              로그 원본 전체를 브라우저로 받지 않고, 현재 조건의 결과 페이지만 불러옵니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2 xl:col-span-1">
              검색
              <div className="grid gap-2">
                <Input
                  value={searchValue}
                  onChange={(event) => {
                    setSearchDraft({
                      sourceValue: filters.searchValue,
                      value: event.target.value,
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applySearchFilter();
                    }
                  }}
                  placeholder="이벤트, 입력값, IP, 경로로 검색"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={applySearchFilter}
                    disabled={!isSearchDirty || isPending}
                    className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    검색
                  </button>
                  <button
                    type="button"
                    onClick={resetSearchFilter}
                    disabled={!filters.searchValue || isPending}
                    className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    초기화
                  </button>
                </div>
              </div>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              상태
              <Select
                value={filters.statusFilter}
                onChange={(event) => {
                  updateFilter({ logStatus: event.target.value });
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              정렬
              <Select
                value={filters.sortFilter}
                onChange={(event) => {
                  updateFilter({ logSort: event.target.value });
                }}
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
              </Select>
            </label>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/70 bg-surface px-4 py-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>현재 범위</span>
              <span className="font-semibold text-foreground">{rangeLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>페이지</span>
              <span className="font-semibold text-foreground">
                {safeCurrentPage} / {totalPages}
              </span>
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-surface-muted/40 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>{rangeLabel}</p>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <label className="flex items-center justify-between gap-2 whitespace-nowrap sm:justify-start">
                <span>페이지당</span>
                <Select
                  value={String(pagination.pageSize)}
                  onChange={(event) => {
                    const value = Number(event.target.value) as
                      | (typeof PAGE_SIZE_OPTIONS)[number];
                    updateFilter({ logPageSize: value });
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}건
                    </option>
                  ))}
                </Select>
              </label>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncPage(safeCurrentPage - 1)}
                  disabled={safeCurrentPage === 1 || isPending}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                <span className="min-w-[5.5rem] text-center text-xs sm:text-sm">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => syncPage(safeCurrentPage + 1)}
                  disabled={safeCurrentPage === totalPages || isPending}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            </div>
          </div>

          {logs.length === 0 ? (
            <Card className="min-w-0 overflow-hidden bg-surface-elevated shadow-raised">
              <EmptyState
                title="조건에 맞는 로그가 없습니다."
                description="검색어나 필터 조건을 조정해 다시 확인해 주세요."
              />
            </Card>
          ) : (
            logs.map((log) => {
              const propertyEntries = getPropertyEntries(log.properties);
              return (
                <Card
                  key={log.id}
                  className="min-w-0 overflow-hidden bg-surface-elevated shadow-raised"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={getStatusBadgeClass(log.status)}>
                          {log.status ?? "상태 없음"}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                      <h3 className="mt-3 break-words text-lg font-semibold text-foreground">
                        {log.eventName}
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="max-w-full break-all">입력 ID: {log.identifier ?? "-"}</span>
                        <span className="max-w-full break-all">IP: {log.ipAddress ?? "-"}</span>
                        <span className="max-w-full break-all">경로: {log.path ?? "-"}</span>
                      </div>
                    </div>
                  </div>

                  {propertyEntries.length > 0 ? (
                    <div className="mt-4 grid gap-2 rounded-2xl border border-border/70 bg-surface-muted/50 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        속성 요약
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {propertyEntries.map(([key, value]) => (
                          <Badge
                            key={key}
                            className="max-w-full break-all whitespace-normal bg-surface-muted text-foreground"
                          >
                            {key}: {Array.isArray(value) ? value.join(", ") : String(value)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
