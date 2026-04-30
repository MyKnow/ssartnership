"use client";

import { useMemo, useState } from "react";
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

type SortFilter = "newest" | "oldest" | "event" | "ip";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

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

function stringifyProperties(properties: Record<string, unknown> | null) {
  if (!properties) {
    return "";
  }
  try {
    return JSON.stringify(properties);
  } catch {
    return String(properties);
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
}: {
  logs: AdminMemberSecurityLog[];
}) {
  const [searchValue, setSearchValue] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pathFilter, setPathFilter] = useState("all");
  const [sortFilter, setSortFilter] = useState<SortFilter>("newest");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [currentPage, setCurrentPage] = useState(1);

  const eventOptions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.eventName).filter(Boolean))).sort(),
    [logs],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.status).filter(Boolean) as string[])).sort(),
    [logs],
  );
  const pathOptions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.path).filter(Boolean) as string[])).sort(),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    const nextLogs = logs.filter((log) => {
      const searchText = [
        log.eventName,
        log.status,
        log.identifier,
        log.path,
        log.ipAddress,
        stringifyProperties(log.properties),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchText.includes(query)) &&
        (eventFilter === "all" || log.eventName === eventFilter) &&
        (statusFilter === "all" || log.status === statusFilter) &&
        (pathFilter === "all" || log.path === pathFilter)
      );
    });

    return [...nextLogs].sort((a, b) => {
      switch (sortFilter) {
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "event":
          return a.eventName.localeCompare(b.eventName);
        case "ip":
          return (a.ipAddress ?? "").localeCompare(b.ipAddress ?? "");
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [eventFilter, logs, pathFilter, searchValue, sortFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const visibleLogs = filteredLogs.slice(pageStart, pageStart + pageSize);
  const rangeLabel =
    filteredLogs.length === 0
      ? "0건"
      : `${pageStart + 1}-${Math.min(pageStart + visibleLogs.length, filteredLogs.length)} / ${filteredLogs.length}`;

  function updateFilter(callback: () => void) {
    callback();
    setCurrentPage(1);
  }

  return (
    <section className="grid gap-5 rounded-panel border border-border/70 bg-surface-elevated px-5 py-5 shadow-flat sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          title="인증/보안 활동 로그"
          description="로그 조회와 같은 방식으로 이벤트, 상태, 경로, 검색어를 조합해 이 회원의 보안 활동을 탐색합니다."
        />
        <Badge className="w-fit bg-surface text-muted-foreground">
          필터 결과 {filteredLogs.length.toLocaleString()}건 / 전체 {logs.length.toLocaleString()}건
        </Badge>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,0.6fr)_minmax(0,1.7fr)] xl:items-start">
        <Card tone="muted" padding="md" className="grid gap-4 xl:sticky xl:top-24">
          <div className="grid gap-1">
            <p className="ui-kicker">탐색 필터</p>
            <h3 className="text-lg font-semibold text-foreground">검색과 정렬</h3>
            <p className="text-sm text-muted-foreground">
              보안 이벤트명, 상태, 입력값, IP, 경로, 속성 값을 검색합니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="grid gap-2 text-sm font-medium text-foreground sm:col-span-2 xl:col-span-1">
              검색
              <Input
                value={searchValue}
                onChange={(event) =>
                  updateFilter(() => setSearchValue(event.target.value))
                }
                placeholder="이벤트, 상태, 입력값, IP, 경로, 속성으로 검색"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              이벤트
              <Select
                value={eventFilter}
                onChange={(event) =>
                  updateFilter(() => setEventFilter(event.target.value))
                }
              >
                <option value="all">전체</option>
                {eventOptions.map((eventName) => (
                  <option key={eventName} value={eventName}>
                    {eventName}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              상태
              <Select
                value={statusFilter}
                onChange={(event) =>
                  updateFilter(() => setStatusFilter(event.target.value))
                }
              >
                <option value="all">전체</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              경로
              <Select
                value={pathFilter}
                onChange={(event) =>
                  updateFilter(() => setPathFilter(event.target.value))
                }
              >
                <option value="all">전체</option>
                {pathOptions.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              정렬
              <Select
                value={sortFilter}
                onChange={(event) => setSortFilter(event.target.value as SortFilter)}
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
                <option value="event">이벤트순</option>
                <option value="ip">IP순</option>
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
                  value={String(pageSize)}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                    setCurrentPage(1);
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
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                <span className="min-w-[5.5rem] text-center text-xs sm:text-sm">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            </div>
          </div>

          {visibleLogs.length === 0 ? (
            <Card className="min-w-0 overflow-hidden bg-surface-elevated shadow-raised">
              <EmptyState
                title="조건에 맞는 로그가 없습니다."
                description="검색어나 필터 조건을 조정해 다시 확인해 주세요."
              />
            </Card>
          ) : (
            visibleLogs.map((log) => {
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
