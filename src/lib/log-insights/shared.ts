import type {
  AdminAuditAction,
  AuthSecurityEventName,
  AuthSecurityStatus,
  EventActorType,
  ProductEventName,
} from '@/lib/event-catalog';

export type LogRangePreset = '1h' | '12h' | '24h' | '7d' | '30d' | 'custom';
export type LogGroup = 'product' | 'audit' | 'security';

export type MemberLookupRecord = {
  id: string;
  display_name: string | null;
  mm_username: string | null;
  actor_name: string | null;
};

export type ProductLogRow = {
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
  ip_address: string | null;
  created_at: string;
  created_at_ms?: number;
};

export type AdminAuditLogRow = {
  id: string;
  actor_id: string | null;
  action: AdminAuditAction | string;
  path: string | null;
  target_type: string | null;
  target_id: string | null;
  properties: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  created_at_ms?: number;
};

export type AuthSecurityLogRow = {
  id: string;
  event_name: AuthSecurityEventName | string;
  status: AuthSecurityStatus | string;
  actor_type: EventActorType;
  actor_id: string | null;
  identifier: string | null;
  path: string | null;
  properties: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  created_at_ms?: number;
};

export type ResolvedActorMeta = {
  actor_name: string | null;
  actor_mm_username: string | null;
};

export type ResolvedPartnerMeta = {
  partner_name: string | null;
};

export type ProductLogRecord = ProductLogRow & ResolvedActorMeta & ResolvedPartnerMeta;
export type AdminAuditLogRecord = AdminAuditLogRow & ResolvedPartnerMeta;
export type AuthSecurityLogRecord = AuthSecurityLogRow &
  ResolvedActorMeta & {
    partner_name: null;
  };

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

export type InsightListItem = {
  label: string;
  value: string;
};

export type SecurityStatusCounts = {
  success: number;
  failure: number;
  blocked: number;
};

export type AdminLogsFilterMeta = {
  availableNames: Array<{ value: string; label: string }>;
  actorOptions: string[];
};

export type AdminLogsSummary = {
  topProductEvents: InsightListItem[];
  topAuditActions: InsightListItem[];
  topActors: InsightListItem[];
  topIps: InsightListItem[];
  topPaths: InsightListItem[];
  securityStatusCounts: SecurityStatusCounts;
};

export type AdminLogsAggregateName = {
  group: LogGroup;
  name: string;
};

export type AdminLogsAggregateCountItem = {
  name?: string;
  label?: string;
  count: number;
};

export type AdminLogsAggregateBucket = {
  start: string;
  end: string;
  product: number;
  audit: number;
  security: number;
  total: number;
};

export type AdminLogsAggregateData = {
  counts: {
    product: number;
    audit: number;
    security: number;
  };
  securityStatusCounts: SecurityStatusCounts;
  buckets: AdminLogsAggregateBucket[];
  availableNames: AdminLogsAggregateName[];
  actorOptions: string[];
  topProductEvents: AdminLogsAggregateCountItem[];
  topAuditActions: AdminLogsAggregateCountItem[];
  topActors: AdminLogsAggregateCountItem[];
  topIps: AdminLogsAggregateCountItem[];
  topPaths: AdminLogsAggregateCountItem[];
};

export type AdminLogsRecordCollections = {
  productLogs: ProductLogRecord[];
  auditLogs: AdminAuditLogRecord[];
  securityLogs: AuthSecurityLogRecord[];
};

export type AdminLogsPageData = {
  range: ResolvedLogRange;
  counts: {
    product: number;
    audit: number;
    security: number;
  };
  truncated: {
    product: boolean;
    audit: boolean;
    security: boolean;
    any: boolean;
    limitPerGroup: number | null;
  };
  chartBuckets: LogChartBucket[];
  filters: AdminLogsFilterMeta;
  summary: AdminLogsSummary;
  list: {
    productLogs: ProductLogRecord[];
    auditLogs: AdminAuditLogRecord[];
    securityLogs: AuthSecurityLogRecord[];
    total: number;
    page: number;
    pageSize: number;
  };
};

export type GetAdminLogsPageDataOptions = {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
  search?: string | null;
  group?: string | null;
  name?: string | null;
  actor?: string | null;
  status?: string | null;
  sort?: string | null;
};

export type CsvExportOptions = {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
  groups?: LogGroup[];
};

export type AdminSupabaseClient = ReturnType<
  typeof import('@/lib/supabase/server').getSupabaseAdminClient
>;

export type UnifiedCsvRow = {
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

export type TimedLogRow = {
  created_at: string;
  created_at_ms?: number;
};

export type AdminLogsLoadedData = {
  range: ResolvedLogRange;
  productRows: ProductLogRow[];
  auditRows: AdminAuditLogRow[];
  securityRows: AuthSecurityLogRow[];
  memberLookup: Map<string, MemberLookupRecord>;
  partnerLookup: Map<string, string>;
  truncated: {
    product: boolean;
    audit: boolean;
    security: boolean;
    any: boolean;
    limitPerGroup: number | null;
  };
};

export const RANGE_PRESET_MS: Record<Exclude<LogRangePreset, 'custom'>, number> = {
  '1h': 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export const DEFAULT_PRESET: LogRangePreset = '24h';
export const QUERY_PAGE_SIZE = 1000;
export const MAX_CUSTOM_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
export const PAGE_MAX_LOG_ROWS_PER_GROUP: number | null = null;
export const EXPORT_MAX_LOG_ROWS_PER_GROUP = 20000;
export const MEMBER_LOOKUP_CHUNK_SIZE = 500;
export const SUMMARY_MAX_LOG_ROWS_PER_GROUP: number | null = null;
export const ADMIN_LOGS_CSV_HEADER = [
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
] as const;

export function uniqueLogGroups(groups: LogGroup[]) {
  return Array.from(new Set(groups));
}
