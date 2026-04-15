'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import FormMessage from '@/components/ui/FormMessage';
import Input from '@/components/ui/Input';
import SectionHeading from '@/components/ui/SectionHeading';
import { useToast } from '@/components/ui/Toast';
import {
  ActivityChart,
  ExportDialog,
  InsightListCard,
  MetricCard,
  RangePresetButton,
  SecurityStatusCard,
} from '@/components/admin/logs/AdminLogsPanels';
import { AdminLogsExplorer } from '@/components/admin/logs/AdminLogsExplorer';
import type { GroupFilter, NormalizedLog, SortFilter, StatusFilter } from '@/components/admin/logs/types';
import {
  RANGE_PRESET_OPTIONS,
  toDateTimeLocalValue,
  toIsoFromLocalValue,
} from '@/components/admin/logs/utils';
import {
  buildUnifiedLogs,
  createTopActors,
  createTopAuditActions,
  createTopIps,
  createTopPaths,
  createTopProductEvents,
  filterAndSortLogs,
  getActorOptions,
  getAvailableLogNames,
  getSecurityStatusCounts,
} from '@/components/admin/logs/selectors';
import type {
  AdminLogsPageData,
  LogChartBucket,
  LogGroup,
  LogRangePreset,
} from '@/lib/log-insights';

export default function AdminLogsManager({
  initialData,
}: {
  initialData: AdminLogsPageData;
}) {
  const { notify } = useToast();
  const [data, setData] = useState(initialData);
  const [activePreset, setActivePreset] = useState<LogRangePreset>(
    initialData.range.preset,
  );
  const [customStartInput, setCustomStartInput] = useState(
    toDateTimeLocalValue(initialData.range.start),
  );
  const [customEndInput, setCustomEndInput] = useState(
    toDateTimeLocalValue(initialData.range.end),
  );
  const [searchValue, setSearchValue] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [nameFilter, setNameFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortFilter, setSortFilter] = useState<SortFilter>('newest');
  const [isLoading, setIsLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'current' | 'custom'>('current');
  const [exportCustomStart, setExportCustomStart] = useState(
    toDateTimeLocalValue(initialData.range.start),
  );
  const [exportCustomEnd, setExportCustomEnd] = useState(
    toDateTimeLocalValue(initialData.range.end),
  );
  const [exportGroups, setExportGroups] = useState<Record<LogGroup, boolean>>({
    product: true,
    audit: true,
    security: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const unifiedLogs = useMemo<NormalizedLog[]>(() => buildUnifiedLogs(data), [data]);

  const availableNames = useMemo(
    () => getAvailableLogNames(unifiedLogs, groupFilter),
    [groupFilter, unifiedLogs],
  );

  const actorOptions = useMemo(() => getActorOptions(unifiedLogs), [unifiedLogs]);

  const filteredLogs = useMemo(
    () =>
      filterAndSortLogs({
        unifiedLogs,
        searchValue,
        groupFilter,
        nameFilter,
        actorFilter,
        statusFilter,
        sortFilter,
      }),
    [
      actorFilter,
      groupFilter,
      nameFilter,
      searchValue,
      sortFilter,
      statusFilter,
      unifiedLogs,
    ],
  );

  const totalLogs = data.counts.product + data.counts.audit + data.counts.security;

  const topProductEvents = useMemo(() => createTopProductEvents(data), [data]);
  const topAuditActions = useMemo(() => createTopAuditActions(data), [data]);
  const topActors = useMemo(() => createTopActors(unifiedLogs), [unifiedLogs]);
  const topIps = useMemo(() => createTopIps(unifiedLogs), [unifiedLogs]);
  const topPaths = useMemo(() => createTopPaths(unifiedLogs), [unifiedLogs]);
  const securityStatusCounts = useMemo(() => getSecurityStatusCounts(data), [data]);

  async function fetchLogs(params: {
    preset: LogRangePreset;
    start?: string;
    end?: string;
  }) {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const searchParams = new URLSearchParams();
      searchParams.set('preset', params.preset);
      if (params.start) {
        searchParams.set('start', params.start);
      }
      if (params.end) {
        searchParams.set('end', params.end);
      }

      const response = await fetch(`/api/admin/logs?${searchParams.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setErrorMessage(payload?.message ?? '로그 조회에 실패했습니다.');
        return;
      }

      const nextData = (await response.json()) as AdminLogsPageData;
      setData(nextData);
      setActivePreset(nextData.range.preset);
      setCustomStartInput(toDateTimeLocalValue(nextData.range.start));
      setCustomEndInput(toDateTimeLocalValue(nextData.range.end));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  function handlePresetSelect(preset: LogRangePreset) {
    setActivePreset(preset);
    if (preset === 'custom') {
      return;
    }
    void fetchLogs({ preset });
  }

  function handleApplyCustomRange() {
    if (!customStartInput || !customEndInput) {
      notify('시작 시각과 종료 시각을 모두 입력해 주세요.');
      return;
    }

    const start = new Date(customStartInput);
    const end = new Date(customEndInput);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      notify('유효한 날짜 범위를 입력해 주세요.');
      return;
    }

    void fetchLogs({
      preset: 'custom',
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }

  function handleBucketSelect(bucket: LogChartBucket) {
    setActivePreset('custom');
    setCustomStartInput(toDateTimeLocalValue(bucket.start));
    setCustomEndInput(toDateTimeLocalValue(bucket.end));
    void fetchLogs({
      preset: 'custom',
      start: bucket.start,
      end: bucket.end,
    });
  }

  function handleOpenExport() {
    setExportScope('current');
    setExportCustomStart(toDateTimeLocalValue(data.range.start));
    setExportCustomEnd(toDateTimeLocalValue(data.range.end));
    setExportOpen(true);
  }

  async function handleExport() {
    const selectedGroups = (Object.entries(exportGroups) as Array<[LogGroup, boolean]>)
      .filter(([, checked]) => checked)
      .map(([group]) => group);

    if (!selectedGroups.length) {
      notify('내보낼 로그 종류를 하나 이상 선택해 주세요.');
      return;
    }

    let start = data.range.start;
    let end = data.range.end;

    if (exportScope === 'custom') {
      if (!exportCustomStart || !exportCustomEnd) {
        notify('내보낼 사용자 지정 범위를 입력해 주세요.');
        return;
      }
      try {
        start = toIsoFromLocalValue(exportCustomStart);
        end = toIsoFromLocalValue(exportCustomEnd);
      } catch {
        notify('유효한 사용자 지정 범위를 입력해 주세요.');
        return;
      }
    }

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const searchParams = new URLSearchParams({
        preset: 'custom',
        start,
        end,
        groups: selectedGroups.join(','),
      });

      const response = await fetch(`/api/admin/logs/export?${searchParams.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setErrorMessage(payload?.message ?? 'CSV 다운로드에 실패했습니다.');
        return;
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `admin-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setExportOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'CSV 다운로드에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <div className="grid min-w-0 gap-8 overflow-x-hidden">
        <section className="grid gap-4 rounded-3xl border border-border bg-surface-muted/50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading
              title="로그 집계 뷰"
              description="조회 범위를 바꾸면 카드, 대시보드, 원본 로그가 모두 같은 범위 기준으로 다시 집계됩니다."
            />
            <Button variant="ghost" onClick={handleOpenExport} className="self-end sm:self-auto">
              CSV 다운로드
            </Button>
          </div>

          {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {RANGE_PRESET_OPTIONS.map((option) => (
              <RangePresetButton
                key={option.value}
                active={activePreset === option.value}
                onClick={() => handlePresetSelect(option.value)}
                disabled={isLoading}
              >
                {option.label}
              </RangePresetButton>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-surface px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-1">
                <p className="text-sm font-semibold text-foreground">현재 조회 범위</p>
                <p className="break-all text-sm text-muted-foreground">{data.range.label}</p>
              </div>
              <Badge className="bg-surface-muted text-muted-foreground">
                {data.range.bucketLabel}
              </Badge>
            </div>
          </div>

          {activePreset === 'custom' ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                시작 시각
                <Input
                  type="datetime-local"
                  value={customStartInput}
                  onChange={(event) => setCustomStartInput(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                종료 시각
                <Input
                  type="datetime-local"
                  value={customEndInput}
                  onChange={(event) => setCustomEndInput(event.target.value)}
                />
              </label>
              <div className="flex items-end justify-end">
                <Button
                  onClick={handleApplyCustomRange}
                  loading={isLoading}
                  loadingText="조회 중"
                  className="w-full lg:w-auto"
                >
                  범위 적용
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="전체 로그"
            value={`${totalLogs.toLocaleString()}건`}
            description="현재 조회 범위 안에서 적재된 전체 로그 수입니다."
          />
          <MetricCard
            title="사용자 이벤트"
            value={`${data.counts.product.toLocaleString()}건`}
            description="페이지 조회, 클릭, 검색, 푸시 설정 등 제품 로그입니다."
          />
          <MetricCard
            title="관리자 감사"
            value={`${data.counts.audit.toLocaleString()}건`}
            description="관리자 CRUD와 푸시 발송/삭제 같은 조작 이력입니다."
          />
          <MetricCard
            title="인증·보안"
            value={`${data.counts.security.toLocaleString()}건`}
            description="로그인, 회원가입 인증, 비밀번호/탈퇴 관련 로그입니다."
          />
        </section>

        <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)]">
          <div className="min-w-0">
            <ActivityChart
              buckets={data.chartBuckets}
              loading={isLoading}
              onSelectBucket={handleBucketSelect}
            />
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-1">
            <SecurityStatusCard
              success={securityStatusCounts.success}
              failure={securityStatusCounts.failure}
              blocked={securityStatusCounts.blocked}
            />
            <InsightListCard
              title="상위 사용자 이벤트"
              description="조회 범위 안에서 가장 많이 발생한 사용자 이벤트입니다."
              items={topProductEvents}
            />
          </div>
        </section>

        <section className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <InsightListCard
            title="상위 관리자 액션"
            description="조회 범위 안에서 많이 발생한 관리자 작업입니다."
            items={topAuditActions}
          />
          <InsightListCard
            title="상위 사용자/MM ID"
            description="로그인된 사용자 기준으로 가장 많이 행위를 남긴 계정입니다."
            items={topActors}
          />
          <InsightListCard
            title="상위 IP"
            description="조회 범위 안에서 가장 많은 로그를 남긴 IP 주소입니다."
            items={topIps}
          />
          <InsightListCard
            title="상위 경로"
            description="가장 자주 기록된 페이지 경로입니다."
            items={topPaths}
          />
        </section>

        <AdminLogsExplorer
          filteredLogs={filteredLogs}
          totalLogs={totalLogs}
          searchValue={searchValue}
          groupFilter={groupFilter}
          nameFilter={nameFilter}
          actorFilter={actorFilter}
          statusFilter={statusFilter}
          sortFilter={sortFilter}
          availableNames={availableNames}
          actorOptions={actorOptions}
          onSearchChange={setSearchValue}
          onGroupFilterChange={setGroupFilter}
          onNameFilterChange={setNameFilter}
          onActorFilterChange={setActorFilter}
          onStatusFilterChange={setStatusFilter}
          onSortFilterChange={setSortFilter}
        />
      </div>

      <ExportDialog
        open={exportOpen}
        exportScope={exportScope}
        exportGroups={exportGroups}
        exportCustomStart={exportCustomStart}
        exportCustomEnd={exportCustomEnd}
        loading={isExporting}
        onClose={() => {
          if (!isExporting) {
            setExportOpen(false);
          }
        }}
        onChangeScope={setExportScope}
        onToggleGroup={(group) =>
          setExportGroups((prev) => ({
            ...prev,
            [group]: !prev[group],
          }))
        }
        onChangeCustomStart={setExportCustomStart}
        onChangeCustomEnd={setExportCustomEnd}
        onSubmit={handleExport}
      />
    </>
  );
}
