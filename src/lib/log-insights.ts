import { createAdminLogsCsvStream } from './log-insights/csv';
import { loadAdminLogRows, resolveActorMeta } from './log-insights/data';
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

export async function getAdminLogsPageData(
  options: GetAdminLogsPageDataOptions = {},
): Promise<AdminLogsPageData> {
  const data = await loadAdminLogRows(options, ['product', 'audit', 'security'], {
    maxRowsPerGroup: PAGE_MAX_LOG_ROWS_PER_GROUP,
  });

  const productLogs: ProductLogRecord[] = data.productRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, data.memberLookup),
  }));
  const auditLogs: AdminAuditLogRow[] = data.auditRows;
  const securityLogs: AuthSecurityLogRecord[] = data.securityRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, data.memberLookup),
  }));
  const page = parsePage(options.page);
  const pageSize = parsePageSize(options.pageSize);
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
    unifiedLogs,
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
  const pageStart = (page - 1) * pageSize;
  const pageItems = filteredList.slice(pageStart, pageStart + pageSize);
  const productIds = new Set(pageItems.filter((log) => log.group === 'product').map((log) => log.id));
  const auditIds = new Set(pageItems.filter((log) => log.group === 'audit').map((log) => log.id));
  const securityIds = new Set(pageItems.filter((log) => log.group === 'security').map((log) => log.id));

  return {
    range: data.range,
    counts: {
      product: productLogs.length,
      audit: auditLogs.length,
      security: securityLogs.length,
    },
    truncated: data.truncated,
    chartBuckets: buildChartBuckets(
      data.range,
      productLogs,
      auditLogs,
      securityLogs,
    ),
    filters,
    summary,
    list: {
      productLogs: productLogs.filter((log) => productIds.has(log.id)),
      auditLogs: auditLogs.filter((log) => auditIds.has(log.id)),
      securityLogs: securityLogs.filter((log) => securityIds.has(log.id)),
      total: filteredList.length,
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
