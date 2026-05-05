import { createAdminLogsCsvStream } from './log-insights/csv';
import {
  loadAdminLogListPage,
  loadAdminLogNormalizedPage,
  loadAdminLogRows,
  loadAdminLogSummaryAggregates,
  loadAdminLogSummaryRows,
  resolveActorMeta,
} from './log-insights/data';
import { buildChartBuckets, formatRangeDateTime } from './log-insights/range';
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
import { getLogLabel } from '@/components/admin/logs/utils';
import type { GroupFilter } from '@/components/admin/logs/types';
import type {
  AdminLogsAggregateData,
  AdminAuditLogRecord,
  AdminLogsLoadedData,
  AdminLogsFilterMeta,
  AdminLogsPageData,
  AdminLogsSummary,
  AuthSecurityLogRecord,
  CsvExportOptions,
  GetAdminLogsPageDataOptions,
  LogGroup,
  ProductLogRecord,
  ResolvedLogRange,
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

function resolveGroupFilter(value: string | null | undefined): GroupFilter {
  if (value === 'product' || value === 'audit' || value === 'security' || value === 'partner') {
    return value;
  }
  return 'all';
}

function resolveActualGroupFilter(value: string | null | undefined): LogGroup | 'all' {
  if (value === 'product' || value === 'audit' || value === 'security') {
    return value;
  }
  return 'all';
}

function shouldUseSplitAdminLogLoading(options: GetAdminLogsPageDataOptions, page: number, pageSize: number) {
  const hasComplexFilter =
    Boolean(options.search?.trim()) ||
    Boolean(options.group && options.group !== 'all') ||
    Boolean(options.name && options.name !== 'all') ||
    Boolean(options.actor && options.actor !== 'all') ||
    Boolean(options.status && options.status !== 'all');

  const sort = options.sort ?? 'newest';
  if (hasComplexFilter || sort !== 'newest') {
    return false;
  }
  return PAGE_MAX_LOG_ROWS_PER_GROUP === null
    ? true
    : page * pageSize <= PAGE_MAX_LOG_ROWS_PER_GROUP;
}

function resolvePartnerName(
  targetType: string | null,
  targetId: string | null,
  properties: Record<string, unknown> | null,
  lookup: Map<string, string>,
) {
  if (targetType === 'partner' && targetId) {
    return lookup.get(targetId) ?? (typeof properties?.partnerName === 'string' ? properties.partnerName : null);
  }
  return typeof properties?.partnerName === 'string' ? properties.partnerName : null;
}

function formatCountValue(count: number) {
  return `${count.toLocaleString()}건`;
}

function buildAggregateTopNamedItems(
  group: LogGroup,
  items: AdminLogsAggregateData['topProductEvents'],
) {
  return items
    .slice(0, 5)
    .map((item) => ({
      label: getLogLabel(group, item.name ?? ''),
      value: formatCountValue(item.count),
    }));
}

function buildAggregateTopLabelItems(items: AdminLogsAggregateData['topActors']) {
  return items
    .slice(0, 5)
    .map((item) => ({
      label: item.label ?? item.name ?? '알 수 없음',
      value: formatCountValue(item.count),
    }));
}

function buildAggregateChartBuckets(
  range: ResolvedLogRange,
  aggregate: AdminLogsAggregateData,
) {
  return aggregate.buckets.map((bucket) => {
    const start = new Date(bucket.start);
    const end = new Date(bucket.end);
    return {
      key: bucket.start,
      label: formatRangeDateTime(start),
      rangeLabel: `${formatRangeDateTime(start)} ~ ${formatRangeDateTime(end)}`,
      start: bucket.start,
      end: bucket.end,
      product: bucket.product,
      audit: bucket.audit,
      security: bucket.security,
      total: bucket.total,
    };
  });
}

function buildAggregateFilters(
  aggregate: AdminLogsAggregateData,
  groupFilter: LogGroup | 'all',
): AdminLogsFilterMeta {
  const availableNames = aggregate.availableNames
    .filter((item) => groupFilter === 'all' || item.group === groupFilter)
    .map((item) => ({
      value: item.name,
      label: getLogLabel(item.group, item.name),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko-KR'));

  return {
    availableNames,
    actorOptions: aggregate.actorOptions,
  };
}

function canUseMergedNewestList(options: GetAdminLogsPageDataOptions) {
  return (
    !options.search?.trim() &&
    (!options.group || options.group === 'all') &&
    (!options.name || options.name === 'all') &&
    (!options.actor || options.actor === 'all') &&
    (!options.status || options.status === 'all') &&
    (!options.sort || options.sort === 'newest')
  );
}

function buildAdminLogsPageDataFromRows({
  options,
  page,
  pageSize,
  summaryData,
  listSourceData,
  useDbPagedList,
  useSplitLoading,
}: {
  options: GetAdminLogsPageDataOptions;
  page: number;
  pageSize: number;
  summaryData: AdminLogsLoadedData;
  listSourceData: Omit<AdminLogsLoadedData, 'truncated'> &
    Partial<Pick<AdminLogsLoadedData, 'truncated'> & { total: number }>;
  useDbPagedList: boolean;
  useSplitLoading: boolean;
}): AdminLogsPageData {
  const productLogs: ProductLogRecord[] = summaryData.productRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, summaryData.memberLookup),
    partner_name: resolvePartnerName(
      row.target_type,
      row.target_id,
      row.properties,
      summaryData.partnerLookup,
    ),
  }));
  const auditLogs: AdminAuditLogRecord[] = summaryData.auditRows.map((row) => ({
    ...row,
    partner_name: resolvePartnerName(
      row.target_type,
      row.target_id,
      row.properties,
      summaryData.partnerLookup,
    ),
  }));
  const securityLogs: AuthSecurityLogRecord[] = summaryData.securityRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, summaryData.memberLookup),
    partner_name: null,
  }));
  const listProductLogs: ProductLogRecord[] = listSourceData.productRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, listSourceData.memberLookup),
    partner_name: resolvePartnerName(
      row.target_type,
      row.target_id,
      row.properties,
      listSourceData.partnerLookup,
    ),
  }));
  const listAuditLogs: AdminAuditLogRecord[] = listSourceData.auditRows.map((row) => ({
    ...row,
    partner_name: resolvePartnerName(
      row.target_type,
      row.target_id,
      row.properties,
      listSourceData.partnerLookup,
    ),
  }));
  const listSecurityLogs: AuthSecurityLogRecord[] = listSourceData.securityRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, listSourceData.memberLookup),
    partner_name: null,
  }));
  const fullRecords = {
    productLogs,
    auditLogs,
    securityLogs,
  };
  const unifiedLogs = buildUnifiedLogs(fullRecords);
  const groupFilter = resolveGroupFilter(options.group);
  const filters: AdminLogsFilterMeta = {
    availableNames: getAvailableLogNames(unifiedLogs, groupFilter),
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
    groupFilter,
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
    ? (typeof listSourceData.total === 'number' ? listSourceData.total : filteredList.length)
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

export function shouldUseDbPagedAdminLogList(
  options: GetAdminLogsPageDataOptions,
  _page: number,
  _pageSize: number,
) {
  void _page;
  void _pageSize;
  const sort = options.sort ?? 'newest';
  if (sort !== 'newest') {
    return false;
  }
  if (options.group === 'partner') {
    return false;
  }
  return true;
}

export async function getAdminLogsPageData(
  options: GetAdminLogsPageDataOptions = {},
): Promise<AdminLogsPageData> {
  const page = parsePage(options.page);
  const pageSize = parsePageSize(options.pageSize);
  const useSplitLoading = shouldUseSplitAdminLogLoading(options, page, pageSize);
  const useDbPagedList = shouldUseDbPagedAdminLogList(options, page, pageSize);

  if (useDbPagedList) {
    const useMergedNewestList = canUseMergedNewestList(options);
    const [summaryAggregateData, listSourceData] = await Promise.all([
      loadAdminLogSummaryAggregates(options),
      useMergedNewestList
        ? loadAdminLogRows(options, ['product', 'audit', 'security'], {
            maxRowsPerGroup: page * pageSize,
          })
        : options.group === 'product' || options.group === 'audit' || options.group === 'security'
        ? loadAdminLogListPage(options, {
            group: options.group as LogGroup,
            page,
            pageSize,
            status: options.status,
          })
        : loadAdminLogNormalizedPage(options, {
            page,
            pageSize,
        }),
    ]);
    if (summaryAggregateData.unavailable) {
      const fallbackData = await loadAdminLogRows(options, ['product', 'audit', 'security'], {
        maxRowsPerGroup: PAGE_MAX_LOG_ROWS_PER_GROUP,
      });
      return buildAdminLogsPageDataFromRows({
        options,
        page,
        pageSize,
        summaryData: fallbackData,
        listSourceData: fallbackData,
        useDbPagedList: false,
        useSplitLoading: false,
      });
    }
    const { range, aggregate } = summaryAggregateData;
    const listProductLogs: ProductLogRecord[] = listSourceData.productRows.map((row) => ({
      ...row,
      ...resolveActorMeta(row.actor_type, row.actor_id, listSourceData.memberLookup),
      partner_name: resolvePartnerName(
        row.target_type,
        row.target_id,
        row.properties,
        listSourceData.partnerLookup,
      ),
    }));
    const listAuditLogs: AdminAuditLogRecord[] = listSourceData.auditRows.map((row) => ({
      ...row,
      partner_name: resolvePartnerName(
        row.target_type,
        row.target_id,
        row.properties,
        listSourceData.partnerLookup,
      ),
    }));
    const listSecurityLogs: AuthSecurityLogRecord[] = listSourceData.securityRows.map((row) => ({
      ...row,
      ...resolveActorMeta(row.actor_type, row.actor_id, listSourceData.memberLookup),
      partner_name: null,
    }));
    const filteredList = filterAndSortLogs({
      unifiedLogs: buildUnifiedLogs({
        productLogs: listProductLogs,
        auditLogs: listAuditLogs,
        securityLogs: listSecurityLogs,
      }),
      searchValue: options.search ?? '',
      groupFilter: resolveGroupFilter(options.group),
      nameFilter: options.name || 'all',
      actorFilter: options.actor || 'all',
      statusFilter:
        options.status === 'success' || options.status === 'failure' || options.status === 'blocked'
          ? options.status
          : 'all',
      sortFilter: 'newest',
    });
    const pageItems = useMergedNewestList
      ? filteredList.slice((page - 1) * pageSize, page * pageSize)
      : filteredList;
    const productIds = new Set(pageItems.filter((log) => log.group === 'product').map((log) => log.id));
    const auditIds = new Set(pageItems.filter((log) => log.group === 'audit').map((log) => log.id));
    const securityIds = new Set(pageItems.filter((log) => log.group === 'security').map((log) => log.id));
    const listTotal = useMergedNewestList
      ? aggregate.counts.product + aggregate.counts.audit + aggregate.counts.security
      : 'total' in listSourceData
        ? listSourceData.total
        : filteredList.length;

    return {
      range,
      counts: aggregate.counts,
      truncated: {
        product: false,
        audit: false,
        security: false,
        any: false,
        limitPerGroup: null,
      },
      chartBuckets: buildAggregateChartBuckets(range, aggregate),
      filters: buildAggregateFilters(
        aggregate,
        resolveActualGroupFilter(options.group),
      ),
      summary: {
        topProductEvents: buildAggregateTopNamedItems('product', aggregate.topProductEvents),
        topAuditActions: buildAggregateTopNamedItems('audit', aggregate.topAuditActions),
        topActors: buildAggregateTopLabelItems(aggregate.topActors),
        topIps: buildAggregateTopLabelItems(aggregate.topIps),
        topPaths: buildAggregateTopLabelItems(aggregate.topPaths),
        securityStatusCounts: aggregate.securityStatusCounts,
      },
      list: {
        productLogs: listProductLogs.filter((log) => productIds.has(log.id)),
        auditLogs: listAuditLogs.filter((log) => auditIds.has(log.id)),
        securityLogs: listSecurityLogs.filter((log) => securityIds.has(log.id)),
        total: listTotal,
        page,
        pageSize,
      },
    };
  }

  const partnerPortalOnly = options.group === 'partner';
  const summaryData = useSplitLoading
    ? await loadAdminLogSummaryRows(options, ['product', 'audit', 'security'])
    : await loadAdminLogRows(options, ['product', 'audit', 'security'], {
        maxRowsPerGroup: PAGE_MAX_LOG_ROWS_PER_GROUP,
        partnerPortalOnly,
      });
  const listSourceData = useDbPagedList
    ? (
      options.group === 'product' || options.group === 'audit' || options.group === 'security'
        ? await loadAdminLogListPage(options, {
            group: options.group as LogGroup,
            page,
            pageSize,
            status: options.status,
          })
        : await loadAdminLogNormalizedPage(options, {
            page,
            pageSize,
          })
    )
    : useSplitLoading
      ? await loadAdminLogRows(options, ['product', 'audit', 'security'], {
          maxRowsPerGroup: page * pageSize,
          partnerPortalOnly,
        })
      : summaryData;

  return buildAdminLogsPageDataFromRows({
    options,
    page,
    pageSize,
    summaryData,
    listSourceData,
    useDbPagedList,
    useSplitLoading,
  });
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
