import { createAdminLogsCsvStream } from './log-insights/csv';
import {
  loadAdminLogListPage,
  loadAdminLogRows,
  loadAdminLogSummaryRows,
  resolveActorMeta,
} from './log-insights/data';
import { buildChartBuckets } from './log-insights/range';
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
  filterAndSortLogs,
} from '@/components/admin/logs/selectors';
import type {
  AdminAuditLogRow,
  AdminLogsFilterMeta,
  AdminLogsPageData,
  AdminLogsSummary,
  AuthSecurityLogRecord,
  CsvExportOptions,
  GetAdminLogsPageDataOptions,
  LogGroup,
  ProductLogRecord,
} from './log-insights/shared';
import {
  EXPORT_MAX_LOG_ROWS_PER_GROUP,
  PAGE_MAX_LOG_ROWS_PER_GROUP,
  } from './log-insights/shared';

export type {
  AdminAuditLogRecord,
  AdminLogsLoadedData,
  AdminLogsPageData,
  AdminLogsRecordCollections,
  AdminSupabaseClient,
  AuthSecurityLogRecord,
  AuthSecurityLogRow,
  CsvExportOptions,
  GetAdminLogsPageDataOptions,
  LogChartBucket,
  LogGroup,
  LogRangePreset,
  ProductLogRecord,
  ProductLogRow,
  ResolvedLogRange,
} from './log-insights/shared';
export { iterateAdminLogsCsvRows } from './log-insights/csv';
export { resolveLogRange } from './log-insights/range';

const LOG_PAGE_SIZE_OPTIONS = [50, 100, 250, 500] as const;

function parsePage(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);
  return LOG_PAGE_SIZE_OPTIONS.includes(parsed as (typeof LOG_PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : 100;
}

function shouldUseSplitAdminLogLoading(options: GetAdminLogsPageDataOptions, page: number, pageSize: number) {
  const hasComplexFilter =
    Boolean(options.search?.trim()) ||
    Boolean(options.group && options.group !== 'all') ||
    Boolean(options.name && options.name !== 'all') ||
    Boolean(options.actor && options.actor !== 'all') ||
    Boolean(options.status && options.status !== 'all');

  const sort = options.sort ?? 'newest';
  return !hasComplexFilter && sort === 'newest' && page * pageSize <= PAGE_MAX_LOG_ROWS_PER_GROUP;
}

export function shouldUseDbPagedAdminLogList(
  options: GetAdminLogsPageDataOptions,
  page: number,
  pageSize: number,
) {
  const group =
    options.group === 'product' || options.group === 'audit' || options.group === 'security'
      ? options.group
      : 'all';
  const sort = options.sort ?? 'newest';
  const hasUnsupportedFilter =
    Boolean(options.search?.trim()) ||
    Boolean(options.name && options.name !== 'all') ||
    Boolean(options.actor && options.actor !== 'all');

  if (hasUnsupportedFilter || sort !== 'newest' || group === 'all') {
    return false;
  }

  if (group !== 'security' && options.status && options.status !== 'all') {
    return false;
  }

  return page * pageSize <= PAGE_MAX_LOG_ROWS_PER_GROUP;
}

export async function getAdminLogsPageData(
  options: GetAdminLogsPageDataOptions = {},
): Promise<AdminLogsPageData> {
  const page = parsePage(options.page);
  const pageSize = parsePageSize(options.pageSize);
  const useSplitLoading = shouldUseSplitAdminLogLoading(options, page, pageSize);
  const useDbPagedList = shouldUseDbPagedAdminLogList(options, page, pageSize);
  const summaryData = useSplitLoading
    ? await loadAdminLogSummaryRows(options, ['product', 'audit', 'security'])
    : await loadAdminLogRows(options, ['product', 'audit', 'security'], {
        maxRowsPerGroup: PAGE_MAX_LOG_ROWS_PER_GROUP,
      });
  const listSourceData = useDbPagedList
    ? await loadAdminLogListPage(options, {
        group: options.group as LogGroup,
        page,
        pageSize,
        status: options.status,
      })
    : useSplitLoading
      ? await loadAdminLogRows(options, ['product', 'audit', 'security'], {
          maxRowsPerGroup: page * pageSize,
        })
      : summaryData;

  const productLogs: ProductLogRecord[] = summaryData.productRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, summaryData.memberLookup),
  }));
  const auditLogs: AdminAuditLogRow[] = summaryData.auditRows;
  const securityLogs: AuthSecurityLogRecord[] = summaryData.securityRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, summaryData.memberLookup),
  }));
  const listProductLogs: ProductLogRecord[] = listSourceData.productRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, listSourceData.memberLookup),
  }));
  const listAuditLogs: AdminAuditLogRow[] = listSourceData.auditRows;
  const listSecurityLogs: AuthSecurityLogRecord[] = listSourceData.securityRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, listSourceData.memberLookup),
  }));
  const fullRecords = {
    productLogs,
    auditLogs,
    securityLogs,
  };
  const unifiedLogs = buildUnifiedLogs(fullRecords);
  const filters: AdminLogsFilterMeta = {
    availableNames: getAvailableLogNames(
      unifiedLogs,
      options.group === 'product' || options.group === 'audit' || options.group === 'security'
        ? options.group
        : 'all',
    ),
    actorOptions: getActorOptions(unifiedLogs),
  };
  const summary: AdminLogsSummary = {
    topProductEvents: createTopProductEvents(fullRecords),
    topAuditActions: createTopAuditActions(fullRecords),
    topActors: createTopActors(unifiedLogs),
    topIps: createTopIps(unifiedLogs),
    topPaths: createTopPaths(unifiedLogs),
    securityStatusCounts: getSecurityStatusCounts(fullRecords),
  };
  const filteredList = filterAndSortLogs({
    unifiedLogs: useDbPagedList
      ? buildUnifiedLogs({
          productLogs: listProductLogs,
          auditLogs: listAuditLogs,
          securityLogs: listSecurityLogs,
        })
      : useSplitLoading
      ? buildUnifiedLogs({
          productLogs: listProductLogs,
          auditLogs: listAuditLogs,
          securityLogs: listSecurityLogs,
        })
      : unifiedLogs,
    searchValue: options.search ?? '',
    groupFilter:
      options.group === 'product' || options.group === 'audit' || options.group === 'security'
        ? options.group
        : 'all',
    nameFilter: options.name || 'all',
    actorFilter: options.actor || 'all',
    statusFilter:
      options.status === 'success' || options.status === 'failure' || options.status === 'blocked'
        ? options.status
        : 'all',
    sortFilter:
      options.sort === 'oldest' || options.sort === 'actor' || options.sort === 'ip'
        ? options.sort
        : 'newest',
  });
  const unfilteredTotal = productLogs.length + auditLogs.length + securityLogs.length;
  const effectiveFilteredTotal = useDbPagedList
    ? ('total' in listSourceData ? listSourceData.total : filteredList.length)
    : useSplitLoading
      ? unfilteredTotal
      : filteredList.length;
  const pageStart = (page - 1) * pageSize;
  const pageItems = useDbPagedList ? filteredList : filteredList.slice(pageStart, pageStart + pageSize);
  const productIds = new Set(pageItems.filter((log) => log.group === 'product').map((log) => log.id));
  const auditIds = new Set(pageItems.filter((log) => log.group === 'audit').map((log) => log.id));
  const securityIds = new Set(pageItems.filter((log) => log.group === 'security').map((log) => log.id));

  return {
    range: summaryData.range,
    counts: {
      product: productLogs.length,
      audit: auditLogs.length,
      security: securityLogs.length,
    },
    truncated: summaryData.truncated,
    chartBuckets: buildChartBuckets(
      summaryData.range,
      productLogs,
      auditLogs,
      securityLogs,
    ),
    filters,
    summary,
    list: {
      productLogs: listProductLogs.filter((log) => productIds.has(log.id)),
      auditLogs: listAuditLogs.filter((log) => auditIds.has(log.id)),
      securityLogs: listSecurityLogs.filter((log) => securityIds.has(log.id)),
      total: effectiveFilteredTotal,
      page,
      pageSize,
    },
  };
}

export async function exportAdminLogsCsv(options: CsvExportOptions = {}) {
  const groups = (options.groups?.length
    ? options.groups
    : ['product', 'audit', 'security']) as LogGroup[];
  const data = await loadAdminLogRows(options, groups, {
    maxRowsPerGroup: EXPORT_MAX_LOG_ROWS_PER_GROUP,
  });

  return {
    filename:
      'admin-logs-' +
      new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-') +
      '.csv',
    stream: createAdminLogsCsvStream(data, groups),
  };
}
