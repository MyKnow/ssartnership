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
import { MAX_LOG_ROWS_PER_GROUP, QUERY_PAGE_SIZE, uniqueLogGroups } from './shared';
import { resolveLogRange } from './range';

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
    if (chunk.length < QUERY_PAGE_SIZE || rows.length >= MAX_LOG_ROWS_PER_GROUP) {
      if (rows.length > MAX_LOG_ROWS_PER_GROUP) {
        return rows.slice(0, MAX_LOG_ROWS_PER_GROUP);
      }
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
      parseSsafyProfile(member.display_name ?? undefined).displayName ??
      member.display_name,
    actor_mm_username: member.mm_username,
  };
}

export async function loadAdminLogRows(
  options: GetAdminLogsPageDataOptions = {},
  groups: LogGroup[] = ['product', 'audit', 'security'],
): Promise<AdminLogsLoadedData> {
  const supabase = getSupabaseAdminClient();
  const range = resolveLogRange(options);
  const selectedGroups = uniqueLogGroups(groups);

  const [productRows, auditRows, securityRows] = await Promise.all([
    selectedGroups.includes('product')
      ? queryAllRows<ProductLogRow>(
          supabase,
          'event_logs',
          'id,session_id,actor_type,actor_id,event_name,path,referrer,target_type,target_id,properties,user_agent,ip_address,created_at',
          range.start,
          range.end,
        )
      : Promise.resolve([] as ProductLogRow[]),
    selectedGroups.includes('audit')
      ? queryAllRows<AdminAuditLogRow>(
          supabase,
          'admin_audit_logs',
          'id,actor_id,action,path,target_type,target_id,properties,user_agent,ip_address,created_at',
          range.start,
          range.end,
        )
      : Promise.resolve([] as AdminAuditLogRow[]),
    selectedGroups.includes('security')
      ? queryAllRows<AuthSecurityLogRow>(
          supabase,
          'auth_security_logs',
          'id,event_name,status,actor_type,actor_id,identifier,path,properties,user_agent,ip_address,created_at',
          range.start,
          range.end,
        )
      : Promise.resolve([] as AuthSecurityLogRow[]),
  ]);

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
  };
}
