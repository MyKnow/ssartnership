import { createAdminLogsCsvStream } from './log-insights/csv';
import { loadAdminLogRows, resolveActorMeta } from './log-insights/data';
import { buildChartBuckets } from './log-insights/range';
import type {
  AdminAuditLogRow,
  AdminLogsPageData,
  AuthSecurityLogRecord,
  CsvExportOptions,
  GetAdminLogsPageDataOptions,
  LogGroup,
  ProductLogRecord,
} from './log-insights/shared';

export type {
  AdminAuditLogRecord,
  AdminLogsLoadedData,
  AdminLogsPageData,
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

export async function getAdminLogsPageData(
  options: GetAdminLogsPageDataOptions = {},
): Promise<AdminLogsPageData> {
  const data = await loadAdminLogRows(options);

  const productLogs: ProductLogRecord[] = data.productRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, data.memberLookup),
  }));
  const auditLogs: AdminAuditLogRow[] = data.auditRows;
  const securityLogs: AuthSecurityLogRecord[] = data.securityRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, data.memberLookup),
  }));

  return {
    range: data.range,
    counts: {
      product: productLogs.length,
      audit: auditLogs.length,
      security: securityLogs.length,
    },
    chartBuckets: buildChartBuckets(
      data.range,
      productLogs,
      auditLogs,
      securityLogs,
    ),
    productLogs,
    auditLogs,
    securityLogs,
  };
}

export async function exportAdminLogsCsv(options: CsvExportOptions = {}) {
  const groups = (options.groups?.length
    ? options.groups
    : ['product', 'audit', 'security']) as LogGroup[];
  const data = await loadAdminLogRows(options, groups);

  return {
    filename:
      'admin-logs-' +
      new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-') +
      '.csv',
    stream: createAdminLogsCsvStream(data, groups),
  };
}
