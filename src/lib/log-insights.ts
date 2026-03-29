import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { parseSsafyProfile } from '@/lib/mm-profile';
import type {
  AdminAuditAction,
  AuthSecurityEventName,
  AuthSecurityStatus,
  EventActorType,
  ProductEventName,
} from '@/lib/event-catalog';

export type LogRangePreset = '1h' | '12h' | '24h' | '7d' | '30d' | 'custom';
export type LogGroup = 'product' | 'audit' | 'security';

type MemberLookupRecord = {
  id: string;
  display_name: string | null;
  mm_username: string | null;
};

type ProductLogRow = {
  id: string;
  session_id: string | null;
  actor_type: EventActorType;
  actor_id: string | null;
  event_name: ProductEventName | string;
  path: string | null;
  referrer: string | null;
  target_type: string | null;
  target_id: string | null;
  properties: Record<string, unknown> | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
};

type AdminAuditLogRow = {
  id: string;
  actor_id: string | null;
  action: AdminAuditAction | string;
  path: string | null;
  target_type: string | null;
  target_id: string | null;
  properties: Record<string, unknown> | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
};

type AuthSecurityLogRow = {
  id: string;
  event_name: AuthSecurityEventName | string;
  status: AuthSecurityStatus | string;
  actor_type: EventActorType;
  actor_id: string | null;
  identifier: string | null;
  path: string | null;
  properties: Record<string, unknown> | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
};

type ResolvedActorMeta = {
  actor_name: string | null;
  actor_mm_username: string | null;
};

export type ProductLogRecord = ProductLogRow & ResolvedActorMeta;
export type AdminAuditLogRecord = AdminAuditLogRow;
export type AuthSecurityLogRecord = AuthSecurityLogRow & ResolvedActorMeta;

export type ResolvedLogRange = {
  preset: LogRangePreset;
  start: string;
  end: string;
  label: string;
  bucketLabel: string;
  durationMs: number;
};

export type LogChartBucket = {
  key: string;
  label: string;
  rangeLabel: string;
  start: string;
  end: string;
  product: number;
  audit: number;
  security: number;
  total: number;
};

export type AdminLogsPageData = {
  range: ResolvedLogRange;
  counts: {
    product: number;
    audit: number;
    security: number;
  };
  chartBuckets: LogChartBucket[];
  productLogs: ProductLogRecord[];
  auditLogs: AdminAuditLogRecord[];
  securityLogs: AuthSecurityLogRecord[];
};

export type GetAdminLogsPageDataOptions = {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
};

export type CsvExportOptions = {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
  groups?: LogGroup[];
};

type AdminSupabaseClient = ReturnType<typeof getSupabaseAdminClient>;

type UnifiedCsvRow = {
  group: LogGroup;
  action: string;
  status: string | null;
  actorType: string | null;
  actorName: string | null;
  actorMmUsername: string | null;
  actorId: string | null;
  identifier: string | null;
  ipAddress: string | null;
  path: string | null;
  referrer: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  properties: Record<string, unknown> | null;
};

const RANGE_PRESET_MS: Record<Exclude<LogRangePreset, 'custom'>, number> = {
  '1h': 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const DEFAULT_PRESET: LogRangePreset = '24h';
const QUERY_PAGE_SIZE = 1000;

function isRangePreset(value: string | null | undefined): value is LogRangePreset {
  return (
    value === '1h' ||
    value === '12h' ||
    value === '24h' ||
    value === '7d' ||
    value === '30d' ||
    value === 'custom'
  );
}

function parseDateInput(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRangeDateTime(date: Date) {
  return date.toLocaleString('ko-KR', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRangePresetLabel(preset: LogRangePreset) {
  switch (preset) {
    case '1h':
      return '최근 1시간';
    case '12h':
      return '최근 12시간';
    case '24h':
      return '최근 24시간';
    case '7d':
      return '최근 7일';
    case '30d':
      return '최근 30일';
    case 'custom':
      return '사용자 지정';
    default:
      return '조회 범위';
  }
}

function getBucketSizeMs(durationMs: number) {
  if (durationMs <= 60 * 60 * 1000) {
    return { sizeMs: 5 * 60 * 1000, label: '5분 단위' };
  }
  if (durationMs <= 12 * 60 * 60 * 1000) {
    return { sizeMs: 60 * 60 * 1000, label: '1시간 단위' };
  }
  if (durationMs <= 24 * 60 * 60 * 1000) {
    return { sizeMs: 2 * 60 * 60 * 1000, label: '2시간 단위' };
  }
  if (durationMs <= 7 * 24 * 60 * 60 * 1000) {
    return { sizeMs: 24 * 60 * 60 * 1000, label: '1일 단위' };
  }
  if (durationMs <= 31 * 24 * 60 * 60 * 1000) {
    return { sizeMs: 5 * 24 * 60 * 60 * 1000, label: '5일 단위' };
  }
  if (durationMs <= 90 * 24 * 60 * 60 * 1000) {
    return { sizeMs: 7 * 24 * 60 * 60 * 1000, label: '1주 단위' };
  }
  return { sizeMs: 30 * 24 * 60 * 60 * 1000, label: '1개월 단위' };
}

function formatBucketLabel(start: Date, bucketSizeMs: number) {
  if (bucketSizeMs <= 2 * 60 * 60 * 1000) {
    return start.toLocaleString('ko-KR', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return start.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  });
}

function formatBucketRangeLabel(start: Date, end: Date) {
  return `${formatRangeDateTime(start)} ~ ${formatRangeDateTime(end)}`;
}

export function resolveLogRange(
  options: GetAdminLogsPageDataOptions = {},
): ResolvedLogRange {
  const now = new Date();
  const requestedPreset = isRangePreset(options.preset)
    ? options.preset
    : DEFAULT_PRESET;

  if (requestedPreset !== 'custom') {
    const durationMs = RANGE_PRESET_MS[requestedPreset];
    const start = new Date(now.getTime() - durationMs);
    const bucket = getBucketSizeMs(durationMs);
    return {
      preset: requestedPreset,
      start: start.toISOString(),
      end: now.toISOString(),
      label: getRangePresetLabel(requestedPreset),
      bucketLabel: bucket.label,
      durationMs,
    };
  }

  const parsedStart = parseDateInput(options.start);
  const parsedEnd = parseDateInput(options.end);
  if (!parsedStart || !parsedEnd) {
    return resolveLogRange({ preset: DEFAULT_PRESET });
  }

  let start = parsedStart;
  let end = parsedEnd;
  if (start.getTime() > end.getTime()) {
    [start, end] = [end, start];
  }
  if (start.getTime() === end.getTime()) {
    end = new Date(end.getTime() + 60 * 1000);
  }

  const durationMs = end.getTime() - start.getTime();
  const bucket = getBucketSizeMs(durationMs);
  return {
    preset: 'custom',
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${formatRangeDateTime(start)} ~ ${formatRangeDateTime(end)}`,
    bucketLabel: bucket.label,
    durationMs,
  };
}

async function queryAllRows<T>(
  supabase: AdminSupabaseClient,
  table: string,
  select: string,
  startIso: string,
  endIso: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
      .range(from, from + QUERY_PAGE_SIZE - 1);

    if (error) {
      console.error(`[log-insights] ${table} query failed`, error.message);
      return rows;
    }

    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < QUERY_PAGE_SIZE) {
      return rows;
    }

    from += QUERY_PAGE_SIZE;
  }
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function fetchMemberLookup(
  supabase: AdminSupabaseClient,
  memberIds: string[],
) {
  const lookup = new Map<string, MemberLookupRecord>();
  if (!memberIds.length) {
    return lookup;
  }

  const uniqueIds = Array.from(new Set(memberIds));
  for (const chunk of chunkValues(uniqueIds, 200)) {
    const { data, error } = await supabase
      .from('members')
      .select('id,display_name,mm_username')
      .in('id', chunk);

    if (error) {
      console.error('[log-insights] members query failed', error.message);
      continue;
    }

    (data ?? []).forEach((row) => {
      lookup.set(row.id, row as MemberLookupRecord);
    });
  }

  return lookup;
}

function resolveActorMeta(
  actorType: EventActorType,
  actorId: string | null,
  memberLookup: Map<string, MemberLookupRecord>,
): ResolvedActorMeta {
  if (actorType !== 'member' || !actorId) {
    return {
      actor_name: null,
      actor_mm_username: null,
    };
  }

  const member = memberLookup.get(actorId);
  if (!member) {
    return {
      actor_name: null,
      actor_mm_username: null,
    };
  }

  return {
    actor_name:
      parseSsafyProfile(member.display_name ?? undefined).displayName ??
      member.display_name,
    actor_mm_username: member.mm_username,
  };
}

function buildChartBuckets(
  range: ResolvedLogRange,
  productLogs: ProductLogRecord[],
  auditLogs: AdminAuditLogRecord[],
  securityLogs: AuthSecurityLogRecord[],
) {
  const startTime = new Date(range.start).getTime();
  const endTime = new Date(range.end).getTime();
  const { sizeMs } = getBucketSizeMs(range.durationMs);
  const buckets: LogChartBucket[] = [];

  for (let cursor = startTime; cursor < endTime; cursor += sizeMs) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(Math.min(cursor + sizeMs, endTime));
    buckets.push({
      key: bucketStart.toISOString(),
      label: formatBucketLabel(bucketStart, sizeMs),
      rangeLabel: formatBucketRangeLabel(bucketStart, bucketEnd),
      start: bucketStart.toISOString(),
      end: bucketEnd.toISOString(),
      product: 0,
      audit: 0,
      security: 0,
      total: 0,
    });
  }

  const increment = (value: string, group: LogGroup) => {
    const timestamp = new Date(value).getTime();
    const rawIndex = Math.floor((timestamp - startTime) / sizeMs);
    const bucketIndex = Math.max(0, Math.min(buckets.length - 1, rawIndex));
    const bucket = buckets[bucketIndex];
    if (!bucket) {
      return;
    }
    bucket[group] += 1;
    bucket.total += 1;
  };

  productLogs.forEach((log) => increment(log.created_at, 'product'));
  auditLogs.forEach((log) => increment(log.created_at, 'audit'));
  securityLogs.forEach((log) => increment(log.created_at, 'security'));

  return buckets;
}

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

function toUnifiedCsvRows(data: AdminLogsPageData, groups: LogGroup[]) {
  const rows: UnifiedCsvRow[] = [];

  if (groups.includes('product')) {
    data.productLogs.forEach((log) => {
      rows.push({
        group: 'product',
        action: String(log.event_name),
        status: null,
        actorType: log.actor_type,
        actorName: log.actor_name,
        actorMmUsername: log.actor_mm_username,
        actorId: log.actor_id,
        identifier: null,
        ipAddress: log.ip_address,
        path: log.path,
        referrer: log.referrer,
        targetType: log.target_type,
        targetId: log.target_id,
        createdAt: log.created_at,
        properties: log.properties,
      });
    });
  }

  if (groups.includes('audit')) {
    data.auditLogs.forEach((log) => {
      rows.push({
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
      });
    });
  }

  if (groups.includes('security')) {
    data.securityLogs.forEach((log) => {
      rows.push({
        group: 'security',
        action: String(log.event_name),
        status: log.status,
        actorType: log.actor_type,
        actorName: log.actor_name,
        actorMmUsername: log.actor_mm_username,
        actorId: log.actor_id,
        identifier: log.identifier,
        ipAddress: log.ip_address,
        path: log.path,
        referrer: null,
        targetType: null,
        targetId: null,
        createdAt: log.created_at,
        properties: log.properties,
      });
    });
  }

  return rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getAdminLogsPageData(
  options: GetAdminLogsPageDataOptions = {},
): Promise<AdminLogsPageData> {
  const supabase = getSupabaseAdminClient();
  const range = resolveLogRange(options);

  const [productRows, auditRows, securityRows] = await Promise.all([
    queryAllRows<ProductLogRow>(
      supabase,
      'event_logs',
      'id,session_id,actor_type,actor_id,event_name,path,referrer,target_type,target_id,properties,user_agent,ip_address,created_at',
      range.start,
      range.end,
    ),
    queryAllRows<AdminAuditLogRow>(
      supabase,
      'admin_audit_logs',
      'id,actor_id,action,path,target_type,target_id,properties,user_agent,ip_address,created_at',
      range.start,
      range.end,
    ),
    queryAllRows<AuthSecurityLogRow>(
      supabase,
      'auth_security_logs',
      'id,event_name,status,actor_type,actor_id,identifier,path,properties,user_agent,ip_address,created_at',
      range.start,
      range.end,
    ),
  ]);

  const memberIds = [
    ...productRows
      .filter((row) => row.actor_type === 'member' && row.actor_id)
      .map((row) => row.actor_id as string),
    ...securityRows
      .filter((row) => row.actor_type === 'member' && row.actor_id)
      .map((row) => row.actor_id as string),
  ];
  const memberLookup = await fetchMemberLookup(supabase, memberIds);

  const productLogs: ProductLogRecord[] = productRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, memberLookup),
  }));
  const auditLogs: AdminAuditLogRecord[] = auditRows;
  const securityLogs: AuthSecurityLogRecord[] = securityRows.map((row) => ({
    ...row,
    ...resolveActorMeta(row.actor_type, row.actor_id, memberLookup),
  }));

  return {
    range,
    counts: {
      product: productLogs.length,
      audit: auditLogs.length,
      security: securityLogs.length,
    },
    chartBuckets: buildChartBuckets(range, productLogs, auditLogs, securityLogs),
    productLogs,
    auditLogs,
    securityLogs,
  };
}

export async function exportAdminLogsCsv(options: CsvExportOptions = {}) {
  const groups = (options.groups?.length
    ? options.groups
    : ['product', 'audit', 'security']) as LogGroup[];
  const data = await getAdminLogsPageData(options);
  const rows = toUnifiedCsvRows(data, groups);

  const header = [
    'group',
    'action',
    'status',
    'actor_type',
    'actor_name',
    'actor_mm_username',
    'actor_id',
    'identifier',
    'ip_address',
    'path',
    'referrer',
    'target_type',
    'target_id',
    'created_at',
    'properties',
  ];

  const body = rows.map((row) =>
    [
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
      .join(','),
  );

  return {
    filename: `admin-logs-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[T:]/g, '-')}.csv`,
    csv: [header.join(','), ...body].join('\n'),
  };
}
