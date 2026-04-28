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
  },
): Promise<AdminLogsLoadedData> {
  const supabase = getSupabaseAdminClient();
  const range = resolveLogRange(options);
  const selectedGroups = uniqueLogGroups(groups);

  const [productResult, auditResult, securityResult] = await Promise.all([
    selectedGroups.includes('product')
      ? queryAllRows<ProductLogRow>(
          supabase,
          'event_logs',
          'id,session_id,actor_type,actor_id,event_name,path,referrer,target_type,target_id,properties,ip_address,created_at',
          range.start,
          range.end,
          config.maxRowsPerGroup,
        )
      : Promise.resolve({ rows: [] as ProductLogRow[], truncated: false }),
    selectedGroups.includes('audit')
      ? queryAllRows<AdminAuditLogRow>(
          supabase,
          'admin_audit_logs',
          'id,actor_id,action,path,target_type,target_id,properties,ip_address,created_at',
          range.start,
          range.end,
          config.maxRowsPerGroup,
        )
      : Promise.resolve({ rows: [] as AdminAuditLogRow[], truncated: false }),
    selectedGroups.includes('security')
      ? queryAllRows<AuthSecurityLogRow>(
          supabase,
          'auth_security_logs',
          'id,event_name,status,actor_type,actor_id,identifier,path,properties,ip_address,created_at',
          range.start,
          range.end,
          config.maxRowsPerGroup,
        )
      : Promise.resolve({ rows: [] as AuthSecurityLogRow[], truncated: false }),
  ]);
  const productRows = productResult.rows.map((row) => ({
    ...row,
    created_at_ms: new Date(row.created_at).getTime(),
  }));
  const auditRows = auditResult.rows.map((row) => ({
    ...row,
    created_at_ms: new Date(row.created_at).getTime(),
  }));
  const securityRows = securityResult.rows.map((row) => ({
    ...row,
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
