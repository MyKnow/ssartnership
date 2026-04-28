import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { parseSsafyProfile } from '@/lib/mm-profile';
import type {
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
import { resolveLogRange } from './range';
import { collectPagedRows } from './paging';

async function queryAllRows<T>(
  supabase: AdminSupabaseClient,
  table: string,
  select: string,
  startIso: string,
  endIso: string,
  maxRows: number,
): Promise<{ rows: T[]; truncated: boolean }> {
  return collectPagedRows<T>(
    maxRows,
    async (from, to) => {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
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
    maxRowsPerGroup: number;
    shape?: 'full' | 'summary';
  },
): Promise<AdminLogsLoadedData> {
  const supabase = getSupabaseAdminClient();
  const range = resolveLogRange(options);
  const selectedGroups = uniqueLogGroups(groups);
  const shape = config.shape ?? 'full';

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

  return {
    range,
    productRows,
    auditRows,
    securityRows,
    memberLookup,
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
    total: count ?? 0,
  };
}
