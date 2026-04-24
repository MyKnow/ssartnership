import type {
  AdminAuditLogRow,
  AdminLogsLoadedData,
  AuthSecurityLogRow,
  LogGroup,
  ProductLogRow,
  TimedLogRow,
  UnifiedCsvRow,
} from './shared';
import { ADMIN_LOGS_CSV_HEADER, uniqueLogGroups } from './shared';
import { resolveActorMeta } from './data';

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsvCell(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return escapeCsvValue(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return escapeCsvValue(JSON.stringify(value));
}

function toCsvLine(row: UnifiedCsvRow) {
  return [
    row.group,
    row.action,
    row.status,
    row.actorType,
    row.actorName,
    row.actorMmUsername,
    row.actorId,
    row.identifier,
    row.ipAddress,
    row.path,
    row.referrer,
    row.targetType,
    row.targetId,
    row.createdAt,
    row.properties,
  ]
    .map(toCsvCell)
    .join(',');
}

function buildProductCsvRow(
  log: ProductLogRow,
  data: AdminLogsLoadedData,
): UnifiedCsvRow {
  const actorMeta = resolveActorMeta(log.actor_type, log.actor_id, data.memberLookup);
  return {
    group: 'product',
    action: String(log.event_name),
    status: null,
    actorType: log.actor_type,
    actorName: actorMeta.actor_name,
    actorMmUsername: actorMeta.actor_mm_username,
    actorId: log.actor_id,
    identifier: null,
    ipAddress: log.ip_address,
    path: log.path,
    referrer: log.referrer,
    targetType: log.target_type,
    targetId: log.target_id,
    createdAt: log.created_at,
    properties: log.properties,
  };
}

function buildAuditCsvRow(log: AdminAuditLogRow): UnifiedCsvRow {
  return {
    group: 'audit',
    action: String(log.action),
    status: null,
    actorType: 'admin',
    actorName: null,
    actorMmUsername: null,
    actorId: log.actor_id,
    identifier: null,
    ipAddress: log.ip_address,
    path: log.path,
    referrer: null,
    targetType: log.target_type,
    targetId: log.target_id,
    createdAt: log.created_at,
    properties: log.properties,
  };
}

function buildSecurityCsvRow(
  log: AuthSecurityLogRow,
  data: AdminLogsLoadedData,
): UnifiedCsvRow {
  const actorMeta = resolveActorMeta(log.actor_type, log.actor_id, data.memberLookup);
  return {
    group: 'security',
    action: String(log.event_name),
    status: log.status,
    actorType: log.actor_type,
    actorName: actorMeta.actor_name,
    actorMmUsername: actorMeta.actor_mm_username,
    actorId: log.actor_id,
    identifier: log.identifier,
    ipAddress: log.ip_address,
    path: log.path,
    referrer: null,
    targetType: null,
    targetId: null,
    createdAt: log.created_at,
    properties: log.properties,
  };
}

function createCsvRowSources(
  data: AdminLogsLoadedData,
  groups: LogGroup[],
) {
  const sources: Array<{
    rows: readonly TimedLogRow[];
    index: number;
    toCsvRow: (row: TimedLogRow) => UnifiedCsvRow;
  }> = [];

  for (const group of uniqueLogGroups(groups)) {
    if (group === 'product') {
      sources.push({
        rows: data.productRows,
        index: 0,
        toCsvRow: (row) => buildProductCsvRow(row as ProductLogRow, data),
      });
      continue;
    }

    if (group === 'audit') {
      sources.push({
        rows: data.auditRows,
        index: 0,
        toCsvRow: (row) => buildAuditCsvRow(row as AdminAuditLogRow),
      });
      continue;
    }

    if (group === 'security') {
      sources.push({
        rows: data.securityRows,
        index: 0,
        toCsvRow: (row) => buildSecurityCsvRow(row as AuthSecurityLogRow, data),
      });
    }
  }

  return sources;
}

export function* iterateAdminLogsCsvRows(
  data: AdminLogsLoadedData,
  groups: LogGroup[],
): Generator<UnifiedCsvRow> {
  const sources = createCsvRowSources(data, groups);

  while (true) {
    let nextIndex = -1;
    let nextTimestamp = -1;

    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      const row = source.rows[source.index];
      if (!row) {
        continue;
      }

      const timestamp =
        typeof row.created_at_ms === 'number'
          ? row.created_at_ms
          : new Date(row.created_at).getTime();
      if (
        nextIndex === -1 ||
        timestamp > nextTimestamp ||
        (timestamp === nextTimestamp && index < nextIndex)
      ) {
        nextIndex = index;
        nextTimestamp = timestamp;
      }
    }

    if (nextIndex === -1) {
      return;
    }

    const source = sources[nextIndex];
    const row = source.rows[source.index];
    if (!row) {
      return;
    }

    yield source.toCsvRow(row);
    source.index += 1;
  }
}

export function createAdminLogsCsvStream(
  data: AdminLogsLoadedData,
  groups: LogGroup[],
) {
  const encoder = new TextEncoder();
  const csvRows = iterateAdminLogsCsvRows(data, groups);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        controller.enqueue(encoder.encode(`${ADMIN_LOGS_CSV_HEADER.join(',')}\n`));

        const buffer: string[] = [];
        for (const row of csvRows) {
          buffer.push(toCsvLine(row));
          if (buffer.length >= 100) {
            controller.enqueue(encoder.encode(`${buffer.join('\n')}\n`));
            buffer.length = 0;
          }
        }

        if (buffer.length > 0) {
          controller.enqueue(encoder.encode(`${buffer.join('\n')}\n`));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
