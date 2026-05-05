import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { parseSsafyProfile } from '@/lib/mm-profile';
import type {
  AdminLogsAggregateBucket,
  AdminLogsAggregateCountItem,
  AdminLogsAggregateData,
  AdminLogsAggregateName,
  AdminLogsLoadedData,
  AdminSupabaseClient,
  AuthSecurityLogRow,
  GetAdminLogsPageDataOptions,
  LogGroup,
  MemberLookupRecord,
  ProductLogRow,
  ResolvedActorMeta,
  AdminAuditLogRow,
} from './shared';
import {
  MEMBER_LOOKUP_CHUNK_SIZE,
  QUERY_PAGE_SIZE,
  SUMMARY_MAX_LOG_ROWS_PER_GROUP,
  uniqueLogGroups,
} from './shared';
import { getBucketSizeMs, resolveLogRange } from './range';
import { collectPagedRows } from './paging';

async function queryAllRows<T>(
  supabase: AdminSupabaseClient,
  table: string,
  select: string,
  startIso: string,
  endIso: string,
  maxRows: number | null,
  orFilter?: string,
): Promise<{ rows: T[]; truncated: boolean }> {
  return collectPagedRows<T>(
    maxRows,
    async (from, to) => {
      let query = supabase
        .from(table)
        .select(select)
        .gte('created_at', startIso)
        .lte('created_at', endIso);

      if (orFilter) {
        query = query.or(orFilter);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error(`[log-insights] ${table} query failed`, error.message);
        return { rows: [] as T[], error: true };
      }

      return {
        rows: (data ?? []) as T[],
        error: false,
      };
    },
    QUERY_PAGE_SIZE,
  );
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
  const results = await Promise.all(
    chunkValues(uniqueIds, MEMBER_LOOKUP_CHUNK_SIZE).map((chunk) =>
      supabase.from('members').select('id,display_name,mm_username').in('id', chunk),
    ),
  );

  for (const result of results) {
    if (result.error) {
      console.error('[log-insights] members query failed', result.error.message);
      continue;
    }

    (result.data ?? []).forEach((row) => {
      lookup.set(row.id, {
        ...(row as MemberLookupRecord),
        actor_name:
          parseSsafyProfile((row as MemberLookupRecord).display_name ?? undefined).displayName ??
          (row as MemberLookupRecord).display_name,
      });
    });
  }

  return lookup;
}

async function fetchPartnerLookup(
  supabase: AdminSupabaseClient,
  partnerIds: string[],
) {
  const lookup = new Map<string, string>();
  if (!partnerIds.length) {
    return lookup;
  }

  const uniqueIds = Array.from(new Set(partnerIds));
  const results = await Promise.all(
    chunkValues(uniqueIds, MEMBER_LOOKUP_CHUNK_SIZE).map((chunk) =>
      supabase.from('partners').select('id,name').in('id', chunk),
    ),
  );

  for (const result of results) {
    if (result.error) {
      console.error('[log-insights] partners query failed', result.error.message);
      continue;
    }

    (result.data ?? []).forEach((row) => {
      lookup.set(row.id, row.name ?? '');
    });
  }

  return lookup;
}

function extractPartnerIdFromProperties(properties: Record<string, unknown> | null | undefined) {
  if (!properties || typeof properties.partnerId !== 'string') {
    return null;
  }
  return properties.partnerId;
}

function extractPartnerTargetIds(
  productRows: ProductLogRow[],
  auditRows: AdminAuditLogRow[],
) {
  return Array.from(
    new Set([
      ...productRows
        .map((row) =>
          row.target_type === 'partner' ? row.target_id : extractPartnerIdFromProperties(row.properties),
        )
        .filter((value): value is string => Boolean(value)),
      ...auditRows
        .map((row) =>
          row.target_type === 'partner' ? row.target_id : extractPartnerIdFromProperties(row.properties),
        )
        .filter((value): value is string => Boolean(value)),
    ]),
  );
}

export function resolveActorMeta(
  actorType: string,
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
      member.actor_name,
    actor_mm_username: member.mm_username,
  };
}

export async function loadAdminLogRows(
  options: GetAdminLogsPageDataOptions = {},
  groups: LogGroup[] = ['product', 'audit', 'security'],
  config: {
    maxRowsPerGroup: number | null;
    shape?: 'full' | 'summary';
    partnerPortalOnly?: boolean;
  },
): Promise<AdminLogsLoadedData> {
  const supabase = getSupabaseAdminClient();
  const range = resolveLogRange(options);
  const selectedGroups = uniqueLogGroups(groups);
  const shape = config.shape ?? 'full';
  const partnerPortalOnly = Boolean(config.partnerPortalOnly);

  const [productResult, auditResult, securityResult] = await Promise.all([
    selectedGroups.includes('product')
      ? queryAllRows<ProductLogRow>(
          supabase,
          'event_logs',
          shape === 'summary'
            ? 'id,actor_type,actor_id,event_name,path,ip_address,created_at'
            : 'id,session_id,actor_type,actor_id,event_name,path,referrer,target_type,target_id,properties,ip_address,created_at',
          range.start,
          range.end,
          config.maxRowsPerGroup,
          partnerPortalOnly ? 'path.like./partner%' : undefined,
        )
      : Promise.resolve({ rows: [] as ProductLogRow[], truncated: false }),
    selectedGroups.includes('audit')
      ? queryAllRows<AdminAuditLogRow>(
          supabase,
          'admin_audit_logs',
          shape === 'summary'
            ? 'id,actor_id,action,path,ip_address,created_at'
            : 'id,actor_id,action,path,target_type,target_id,properties,ip_address,created_at',
          range.start,
          range.end,
          config.maxRowsPerGroup,
          partnerPortalOnly
            ? 'action.like.partner_portal_%,path.like./partner%,path.like./api/partner%'
            : undefined,
        )
      : Promise.resolve({ rows: [] as AdminAuditLogRow[], truncated: false }),
    selectedGroups.includes('security')
      ? queryAllRows<AuthSecurityLogRow>(
          supabase,
          'auth_security_logs',
          shape === 'summary'
            ? 'id,event_name,status,actor_type,actor_id,identifier,path,ip_address,created_at'
            : 'id,event_name,status,actor_type,actor_id,identifier,path,properties,ip_address,created_at',
          range.start,
          range.end,
          config.maxRowsPerGroup,
          partnerPortalOnly
            ? 'event_name.like.partner_%,path.like./partner%,path.like./api/partner%'
            : undefined,
        )
      : Promise.resolve({ rows: [] as AuthSecurityLogRow[], truncated: false }),
  ]);
  const productRows = productResult.rows.map((row) => ({
    ...row,
    session_id: row.session_id ?? null,
    referrer: row.referrer ?? null,
    target_type: row.target_type ?? null,
    target_id: row.target_id ?? null,
    properties: row.properties ?? null,
    created_at_ms: new Date(row.created_at).getTime(),
  }));
  const auditRows = auditResult.rows.map((row) => ({
    ...row,
    target_type: row.target_type ?? null,
    target_id: row.target_id ?? null,
    properties: row.properties ?? null,
    created_at_ms: new Date(row.created_at).getTime(),
  }));
  const securityRows = securityResult.rows.map((row) => ({
    ...row,
    properties: row.properties ?? null,
    created_at_ms: new Date(row.created_at).getTime(),
  }));

  const memberIds = Array.from(
    new Set([
      ...productRows
        .filter((row) => row.actor_type === 'member' && row.actor_id)
        .map((row) => row.actor_id as string),
      ...securityRows
        .filter((row) => row.actor_type === 'member' && row.actor_id)
        .map((row) => row.actor_id as string),
    ]),
  );
  const memberLookup = await fetchMemberLookup(supabase, memberIds);
  const partnerLookup = await fetchPartnerLookup(
    supabase,
    extractPartnerTargetIds(productRows, auditRows),
  );

  return {
    range,
    productRows,
    auditRows,
    securityRows,
    memberLookup,
    partnerLookup,
    truncated: {
      product: productResult.truncated,
      audit: auditResult.truncated,
      security: securityResult.truncated,
      any:
        productResult.truncated ||
        auditResult.truncated ||
        securityResult.truncated,
      limitPerGroup: config.maxRowsPerGroup,
    },
  };
}

export async function loadAdminLogSummaryRows(
  options: GetAdminLogsPageDataOptions = {},
  groups: LogGroup[] = ['product', 'audit', 'security'],
) {
  return loadAdminLogRows(options, groups, {
    maxRowsPerGroup: SUMMARY_MAX_LOG_ROWS_PER_GROUP,
    shape: 'summary',
  });
}

type AdminLogsSummaryRpcPayload = {
  counts?: Partial<Record<LogGroup, number | string | null>>;
  securityStatusCounts?: {
    success?: number | string | null;
    failure?: number | string | null;
    blocked?: number | string | null;
  };
  buckets?: Array<Partial<Record<keyof AdminLogsAggregateBucket, string | number | null>>>;
  availableNames?: Array<Partial<AdminLogsAggregateName>>;
  actorOptions?: Array<string | null>;
  topProductEvents?: Array<Partial<AdminLogsAggregateCountItem>>;
  topAuditActions?: Array<Partial<AdminLogsAggregateCountItem>>;
  topActors?: Array<Partial<AdminLogsAggregateCountItem>>;
  topIps?: Array<Partial<AdminLogsAggregateCountItem>>;
  topPaths?: Array<Partial<AdminLogsAggregateCountItem>>;
};

function parseAggregateNumber(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeAggregateItems(
  items: Array<Partial<AdminLogsAggregateCountItem>> | undefined,
) {
  return (items ?? [])
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : undefined,
      label: typeof item.label === 'string' ? item.label : undefined,
      count: parseAggregateNumber(item.count),
    }))
    .filter((item) => item.name || item.label);
}

export async function loadAdminLogSummaryAggregates(
  options: GetAdminLogsPageDataOptions = {},
): Promise<{
  range: ReturnType<typeof resolveLogRange>;
  aggregate: AdminLogsAggregateData;
  unavailable: boolean;
}> {
  const supabase = getSupabaseAdminClient();
  const range = resolveLogRange(options);
  const { sizeMs } = getBucketSizeMs(range.durationMs);
  const { data, error } = await supabase.rpc('get_admin_logs_summary', {
    input_start: range.start,
    input_end: range.end,
    input_bucket_ms: sizeMs,
  });

  if (error) {
    const missingFunction =
      error.message.includes('Could not find the function') ||
      error.message.includes('get_admin_logs_summary');
    if (!missingFunction) {
      console.error('[log-insights] admin logs summary rpc failed', error.message);
    }
    return {
      range,
      unavailable: true,
      aggregate: {
        counts: { product: 0, audit: 0, security: 0 },
        securityStatusCounts: { success: 0, failure: 0, blocked: 0 },
        buckets: [],
        availableNames: [],
        actorOptions: [],
        topProductEvents: [],
        topAuditActions: [],
        topActors: [],
        topIps: [],
        topPaths: [],
      },
    };
  }

  const payload = (data ?? {}) as AdminLogsSummaryRpcPayload;
  return {
    range,
    unavailable: false,
    aggregate: {
      counts: {
        product: parseAggregateNumber(payload.counts?.product),
        audit: parseAggregateNumber(payload.counts?.audit),
        security: parseAggregateNumber(payload.counts?.security),
      },
      securityStatusCounts: {
        success: parseAggregateNumber(payload.securityStatusCounts?.success),
        failure: parseAggregateNumber(payload.securityStatusCounts?.failure),
        blocked: parseAggregateNumber(payload.securityStatusCounts?.blocked),
      },
      buckets: (payload.buckets ?? [])
        .map((bucket) => ({
          start: typeof bucket.start === 'string' ? bucket.start : '',
          end: typeof bucket.end === 'string' ? bucket.end : '',
          product: parseAggregateNumber(bucket.product),
          audit: parseAggregateNumber(bucket.audit),
          security: parseAggregateNumber(bucket.security),
          total: parseAggregateNumber(bucket.total),
        }))
        .filter((bucket) => bucket.start && bucket.end),
      availableNames: (payload.availableNames ?? [])
        .map((item) => ({
          group: item.group,
          name: item.name,
        }))
        .filter(
          (item): item is AdminLogsAggregateName =>
            (item.group === 'product' || item.group === 'audit' || item.group === 'security') &&
            typeof item.name === 'string' &&
            item.name.length > 0,
        ),
      actorOptions: Array.from(
        new Set((payload.actorOptions ?? []).filter((value): value is string => Boolean(value))),
      ).sort((a, b) => a.localeCompare(b, 'ko-KR')),
      topProductEvents: normalizeAggregateItems(payload.topProductEvents),
      topAuditActions: normalizeAggregateItems(payload.topAuditActions),
      topActors: normalizeAggregateItems(payload.topActors),
      topIps: normalizeAggregateItems(payload.topIps),
      topPaths: normalizeAggregateItems(payload.topPaths),
    },
  };
}

type AdminLogPageRpcRow = {
  group_name: LogGroup;
  id: string;
  name: string;
  status: string | null;
  actor_type: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_mm_username: string | null;
  identifier: string | null;
  ip_address: string | null;
  path: string | null;
  referrer: string | null;
  target_type: string | null;
  target_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
  total_count: number | string | null;
};

function parseRpcCount(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function loadAdminLogNormalizedPage(
  options: GetAdminLogsPageDataOptions,
  config: {
    page: number;
    pageSize: number;
  },
) {
  const supabase = getSupabaseAdminClient();
  const range = resolveLogRange(options);
  const { data, error } = await supabase.rpc('get_admin_logs_page', {
    input_start: range.start,
    input_end: range.end,
    input_page: config.page,
    input_page_size: config.pageSize,
    input_group: options.group ?? 'all',
    input_search: options.search ?? '',
    input_name: options.name ?? 'all',
    input_actor: options.actor ?? 'all',
    input_status: options.status ?? 'all',
  });

  if (error) {
    console.error('[log-insights] admin logs page rpc failed', error.message);
    return {
      range,
      productRows: [] as ProductLogRow[],
      auditRows: [] as AdminAuditLogRow[],
      securityRows: [] as AuthSecurityLogRow[],
      memberLookup: new Map<string, MemberLookupRecord>(),
      partnerLookup: new Map<string, string>(),
      total: 0,
    };
  }

  const rows = (data ?? []) as AdminLogPageRpcRow[];
  const memberLookup = new Map<string, MemberLookupRecord>();
  for (const row of rows) {
    if (row.actor_type !== 'member' || !row.actor_id) {
      continue;
    }
    memberLookup.set(row.actor_id, {
      id: row.actor_id,
      display_name: row.actor_name,
      mm_username: row.actor_mm_username,
      actor_name: row.actor_name,
    });
  }
  const productRows = rows
    .filter((row) => row.group_name === 'product')
    .map((row) => ({
      id: row.id,
      session_id: null,
      actor_type: (row.actor_type ?? 'guest') as ProductLogRow['actor_type'],
      actor_id: row.actor_id,
      event_name: row.name,
      path: row.path,
      referrer: row.referrer,
      target_type: row.target_type,
      target_id: row.target_id,
      properties: row.properties,
      ip_address: row.ip_address,
      created_at: row.created_at,
      created_at_ms: new Date(row.created_at).getTime(),
    })) as ProductLogRow[];
  const auditRows = rows
    .filter((row) => row.group_name === 'audit')
    .map((row) => ({
      id: row.id,
      actor_id: row.actor_id,
      action: row.name,
      path: row.path,
      target_type: row.target_type,
      target_id: row.target_id,
      properties: row.properties,
      ip_address: row.ip_address,
      created_at: row.created_at,
      created_at_ms: new Date(row.created_at).getTime(),
    })) as AdminAuditLogRow[];
  const securityRows = rows
    .filter((row) => row.group_name === 'security')
    .map((row) => ({
      id: row.id,
      event_name: row.name,
      status: row.status ?? 'failure',
      actor_type: (row.actor_type ?? 'guest') as AuthSecurityLogRow['actor_type'],
      actor_id: row.actor_id,
      identifier: row.identifier,
      path: row.path,
      properties: row.properties,
      ip_address: row.ip_address,
      created_at: row.created_at,
      created_at_ms: new Date(row.created_at).getTime(),
    })) as AuthSecurityLogRow[];
  const partnerLookup = await fetchPartnerLookup(
    supabase,
    extractPartnerTargetIds(productRows, auditRows),
  );

  return {
    range,
    productRows,
    auditRows,
    securityRows,
    memberLookup,
    partnerLookup,
    total: parseRpcCount(rows[0]?.total_count),
  };
}

export async function loadAdminLogListPage(
  options: GetAdminLogsPageDataOptions,
  config: {
    group: LogGroup;
    page: number;
    pageSize: number;
    status?: string | null;
  },
) {
  const supabase = getSupabaseAdminClient();
  const range = resolveLogRange(options);
  const from = (config.page - 1) * config.pageSize;
  const to = from + config.pageSize - 1;

  if (config.group === 'product') {
    const { data, error, count } = await supabase
      .from('event_logs')
      .select(
        'id,session_id,actor_type,actor_id,event_name,path,referrer,target_type,target_id,properties,ip_address,created_at',
        { count: 'exact' },
      )
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[log-insights] event_logs paged query failed', error.message);
      return {
        range,
        productRows: [] as ProductLogRow[],
        auditRows: [] as AdminAuditLogRow[],
        securityRows: [] as AuthSecurityLogRow[],
        memberLookup: new Map<string, MemberLookupRecord>(),
        partnerLookup: new Map<string, string>(),
        total: 0,
      };
    }

    const productRows = ((data ?? []) as ProductLogRow[]).map((row) => ({
      ...row,
      session_id: row.session_id ?? null,
      referrer: row.referrer ?? null,
      target_type: row.target_type ?? null,
      target_id: row.target_id ?? null,
      properties: row.properties ?? null,
      created_at_ms: new Date(row.created_at).getTime(),
    }));
    const memberLookup = await fetchMemberLookup(
      supabase,
      productRows
        .filter((row) => row.actor_type === 'member' && row.actor_id)
        .map((row) => row.actor_id as string),
    );

    return {
      range,
      productRows,
      auditRows: [] as AdminAuditLogRow[],
      securityRows: [] as AuthSecurityLogRow[],
      memberLookup,
      partnerLookup: await fetchPartnerLookup(
        supabase,
        extractPartnerTargetIds(productRows, []),
      ),
      total: count ?? 0,
    };
  }

  if (config.group === 'audit') {
    const { data, error, count } = await supabase
      .from('admin_audit_logs')
      .select(
        'id,actor_id,action,path,target_type,target_id,properties,ip_address,created_at',
        { count: 'exact' },
      )
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[log-insights] admin_audit_logs paged query failed', error.message);
      return {
        range,
        productRows: [] as ProductLogRow[],
        auditRows: [] as AdminAuditLogRow[],
        securityRows: [] as AuthSecurityLogRow[],
        memberLookup: new Map<string, MemberLookupRecord>(),
        partnerLookup: new Map<string, string>(),
        total: 0,
      };
    }

    const auditRows = ((data ?? []) as AdminAuditLogRow[]).map((row) => ({
      ...row,
      target_type: row.target_type ?? null,
      target_id: row.target_id ?? null,
      properties: row.properties ?? null,
      created_at_ms: new Date(row.created_at).getTime(),
    }));

    return {
      range,
      productRows: [] as ProductLogRow[],
      auditRows,
      securityRows: [] as AuthSecurityLogRow[],
      memberLookup: new Map<string, MemberLookupRecord>(),
      partnerLookup: await fetchPartnerLookup(
        supabase,
        extractPartnerTargetIds([], auditRows),
      ),
      total: count ?? 0,
    };
  }

  let query = supabase
    .from('auth_security_logs')
    .select(
      'id,event_name,status,actor_type,actor_id,identifier,path,properties,ip_address,created_at',
      { count: 'exact' },
    )
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (config.status && config.status !== 'all') {
    query = query.eq('status', config.status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[log-insights] auth_security_logs paged query failed', error.message);
    return {
      range,
      productRows: [] as ProductLogRow[],
      auditRows: [] as AdminAuditLogRow[],
      securityRows: [] as AuthSecurityLogRow[],
      memberLookup: new Map<string, MemberLookupRecord>(),
      partnerLookup: new Map<string, string>(),
      total: 0,
    };
  }

  const securityRows = ((data ?? []) as AuthSecurityLogRow[]).map((row) => ({
    ...row,
    properties: row.properties ?? null,
    created_at_ms: new Date(row.created_at).getTime(),
  }));
  const memberLookup = await fetchMemberLookup(
    supabase,
    securityRows
      .filter((row) => row.actor_type === 'member' && row.actor_id)
      .map((row) => row.actor_id as string),
  );

  return {
    range,
    productRows: [] as ProductLogRow[],
    auditRows: [] as AdminAuditLogRow[],
    securityRows,
    memberLookup,
    partnerLookup: new Map<string, string>(),
    total: count ?? 0,
  };
}
