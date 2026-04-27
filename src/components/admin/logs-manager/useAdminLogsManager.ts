'use client';

import { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import {
  buildUnifiedLogs,
  createTopActors,
  createTopAuditActions,
  createTopIps,
  createTopPaths,
  createTopProductEvents,
  getActorOptions,
  getAvailableLogNames,
  getSecurityStatusCounts,
} from '@/components/admin/logs/selectors';
import {
  toDateTimeLocalValue,
  toIsoFromLocalValue,
} from '@/components/admin/logs/utils';
import type { GroupFilter, NormalizedLog, SortFilter, StatusFilter } from '@/components/admin/logs/types';
import type {
  AdminLogsPageData,
  LogChartBucket,
  LogGroup,
  LogRangePreset,
} from '@/lib/log-insights';

const LOG_PAGE_SIZE_OPTIONS = [50, 100, 250, 500] as const;

export function useAdminLogsManager(initialData: AdminLogsPageData) {
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
  const [pageSize, setPageSizeState] =
    useState<(typeof LOG_PAGE_SIZE_OPTIONS)[number]>(initialData.list.pageSize as (typeof LOG_PAGE_SIZE_OPTIONS)[number]);
  const [pageInputValue, setPageInputValue] = useState(String(initialData.list.page));

  const unifiedLogs = useMemo<NormalizedLog[]>(() => buildUnifiedLogs(data), [data]);
  const visibleLogs = useMemo<NormalizedLog[]>(
    () =>
      buildUnifiedLogs({
        ...data,
        productLogs: data.list.productLogs,
        auditLogs: data.list.auditLogs,
        securityLogs: data.list.securityLogs,
      }),
    [data],
  );
  const availableNames = useMemo(
    () => getAvailableLogNames(unifiedLogs, groupFilter),
    [groupFilter, unifiedLogs],
  );
  const actorOptions = useMemo(() => getActorOptions(unifiedLogs), [unifiedLogs]);
  const filteredLogs = visibleLogs;
  const totalPages = Math.max(1, Math.ceil(data.list.total / pageSize));
  const currentPage = Math.min(data.list.page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const totalLogs = data.counts.product + data.counts.audit + data.counts.security;
  const topProductEvents = useMemo(() => createTopProductEvents(data), [data]);
  const topAuditActions = useMemo(() => createTopAuditActions(data), [data]);
  const topActors = useMemo(() => createTopActors(unifiedLogs), [unifiedLogs]);
  const topIps = useMemo(() => createTopIps(unifiedLogs), [unifiedLogs]);
  const topPaths = useMemo(() => createTopPaths(unifiedLogs), [unifiedLogs]);
  const securityStatusCounts = useMemo(() => getSecurityStatusCounts(data), [data]);

  function syncPage(nextPage: number) {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    setPageInputValue(String(safePage));
    void fetchLogs({ preset: activePreset, start: data.range.start, end: data.range.end, page: safePage });
  }

  async function fetchLogs(params: {
    preset: LogRangePreset;
    start?: string;
    end?: string;
    page?: number;
    pageSize?: number;
    searchValue?: string;
    groupFilter?: GroupFilter;
    nameFilter?: string;
    actorFilter?: 'all' | string;
    statusFilter?: StatusFilter;
    sortFilter?: SortFilter;
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
      searchParams.set('page', String(params.page ?? 1));
      searchParams.set('pageSize', String(params.pageSize ?? pageSize));
      const nextSearchValue = params.searchValue ?? searchValue;
      const nextGroupFilter = params.groupFilter ?? groupFilter;
      const nextNameFilter = params.nameFilter ?? nameFilter;
      const nextActorFilter = params.actorFilter ?? actorFilter;
      const nextStatusFilter = params.statusFilter ?? statusFilter;
      const nextSortFilter = params.sortFilter ?? sortFilter;
      if (nextSearchValue.trim()) {
        searchParams.set('search', nextSearchValue.trim());
      }
      if (nextGroupFilter !== 'all') {
        searchParams.set('group', nextGroupFilter);
      }
      if (nextNameFilter !== 'all') {
        searchParams.set('name', nextNameFilter);
      }
      if (nextActorFilter !== 'all') {
        searchParams.set('actor', nextActorFilter);
      }
      if (nextStatusFilter !== 'all') {
        searchParams.set('status', nextStatusFilter);
      }
      if (nextSortFilter !== 'newest') {
        searchParams.set('sort', nextSortFilter);
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
      setPageSizeState(
        LOG_PAGE_SIZE_OPTIONS.includes(
          nextData.list.pageSize as (typeof LOG_PAGE_SIZE_OPTIONS)[number],
        )
          ? (nextData.list.pageSize as (typeof LOG_PAGE_SIZE_OPTIONS)[number])
          : LOG_PAGE_SIZE_OPTIONS[1],
      );
      setPageInputValue(String(nextData.list.page));
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

  return {
    data,
    activePreset,
    customStartInput,
    customEndInput,
    searchValue,
    groupFilter,
    nameFilter,
    actorFilter,
    statusFilter,
    sortFilter,
    isLoading,
    exportOpen,
    exportScope,
    exportCustomStart,
    exportCustomEnd,
    exportGroups,
    isExporting,
    errorMessage,
    unifiedLogs,
    availableNames,
    actorOptions,
    filteredLogs,
    filteredTotal: data.list.total,
    visibleLogs,
    currentPage,
    totalPages,
    pageSize,
    pageInputValue,
    pageSizeOptions: LOG_PAGE_SIZE_OPTIONS,
    pageStart,
    totalLogs,
    topProductEvents,
    topAuditActions,
    topActors,
    topIps,
    topPaths,
    securityStatusCounts,
    setCustomStartInput,
    setCustomEndInput,
    setSearchValue: (value: string) => {
      setSearchValue(value);
      void fetchLogs({ preset: activePreset, start: data.range.start, end: data.range.end, searchValue: value });
    },
    setGroupFilter: (value: GroupFilter) => {
      setGroupFilter(value);
      void fetchLogs({ preset: activePreset, start: data.range.start, end: data.range.end, groupFilter: value });
    },
    setNameFilter: (value: string) => {
      setNameFilter(value);
      void fetchLogs({ preset: activePreset, start: data.range.start, end: data.range.end, nameFilter: value });
    },
    setActorFilter: (value: 'all' | string) => {
      setActorFilter(value);
      void fetchLogs({ preset: activePreset, start: data.range.start, end: data.range.end, actorFilter: value });
    },
    setStatusFilter: (value: StatusFilter) => {
      setStatusFilter(value);
      void fetchLogs({ preset: activePreset, start: data.range.start, end: data.range.end, statusFilter: value });
    },
    setSortFilter: (value: SortFilter) => {
      setSortFilter(value);
      void fetchLogs({ preset: activePreset, start: data.range.start, end: data.range.end, sortFilter: value });
    },
    setPageInputValue,
    setPageSize: (value: number) => {
      const nextPageSize = LOG_PAGE_SIZE_OPTIONS.includes(
        value as (typeof LOG_PAGE_SIZE_OPTIONS)[number],
      )
        ? (value as (typeof LOG_PAGE_SIZE_OPTIONS)[number])
        : LOG_PAGE_SIZE_OPTIONS[1];
      setPageSizeState(nextPageSize);
      setPageInputValue('1');
      void fetchLogs({ preset: activePreset, start: data.range.start, end: data.range.end, pageSize: nextPageSize });
    },
    setExportOpen,
    setExportScope,
    setExportCustomStart,
    setExportCustomEnd,
    setExportGroups,
    handlePresetSelect,
    handleApplyCustomRange,
    handleBucketSelect,
    handleOpenExport,
    handleExport,
    syncPage,
  };
}
