-- Restrict administrative log result sets before pagination/search, and mask PII in SQL.
-- Existing log RPCs remain available during rolling deploys.

create or replace function public.get_admin_logs_page_scoped(
  input_start timestamp with time zone,
  input_end timestamp with time zone,
  input_page integer,
  input_page_size integer,
  input_group text default 'all',
  input_search text default '',
  input_name text default 'all',
  input_actor text default 'all',
  input_status text default 'all',
  input_allowed_groups text[] default '{}',
  input_include_pii boolean default false
)
returns table (
  group_name text,
  id uuid,
  name text,
  status text,
  actor_type text,
  actor_id text,
  actor_name text,
  actor_mm_username text,
  identifier text,
  ip_address text,
  path text,
  referrer text,
  target_type text,
  target_id text,
  properties jsonb,
  created_at timestamp with time zone,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      greatest(coalesce(input_page, 1), 1) as page,
      greatest(coalesce(input_page_size, 100), 1) as page_size,
      lower(coalesce(nullif(input_search, ''), '')) as search_query,
      coalesce(nullif(input_group, ''), 'all') as group_filter,
      coalesce(nullif(input_name, ''), 'all') as name_filter,
      coalesce(nullif(input_actor, ''), 'all') as actor_filter,
      coalesce(nullif(input_status, ''), 'all') as status_filter,
      array(
        select candidate
        from unnest(coalesce(input_allowed_groups, '{}'::text[])) as candidate
        where candidate in ('product', 'audit', 'security')
      ) as allowed_groups,
      coalesce(input_include_pii, false) as include_pii
  ),
  base_logs as (
    select
      'product'::text as group_name,
      event_logs.id,
      event_logs.event_name::text as name,
      null::text as status,
      event_logs.actor_type::text as actor_type,
      case when params.include_pii then event_logs.actor_id else null end as actor_id,
      case when params.include_pii then members.display_name else null end as actor_name,
      case when params.include_pii then directory.mm_username else null end as actor_mm_username,
      null::text as identifier,
      case when params.include_pii then event_logs.ip_address else null end as ip_address,
      case when params.include_pii then event_logs.path else null end as path,
      case when params.include_pii then event_logs.referrer else null end as referrer,
      event_logs.target_type,
      case when params.include_pii then event_logs.target_id else null end as target_id,
      case when params.include_pii then event_logs.properties else null end as properties,
      event_logs.created_at,
      lower(concat_ws(' ',
        event_logs.event_name,
        event_logs.actor_type,
        case when params.include_pii then event_logs.path end,
        event_logs.target_type,
        case when params.include_pii then members.display_name end,
        case when params.include_pii then directory.mm_username end,
        case when params.include_pii then event_logs.actor_id end,
        case when params.include_pii then event_logs.ip_address end,
        case when params.include_pii then event_logs.referrer end,
        case when params.include_pii then event_logs.target_id end,
        case when params.include_pii then event_logs.properties::text end
      )) as search_text
    from public.event_logs
    cross join params
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    left join public.mm_user_directory directory
      on directory.id = members.mattermost_account_id
    where 'product' = any(params.allowed_groups)
      and event_logs.created_at >= input_start
      and event_logs.created_at <= input_end

    union all

    select
      'audit'::text as group_name,
      admin_audit_logs.id,
      admin_audit_logs.action::text as name,
      null::text as status,
      coalesce(admin_audit_logs.actor_type, 'admin')::text as actor_type,
      case when params.include_pii then admin_audit_logs.actor_id else null end as actor_id,
      null::text as actor_name,
      null::text as actor_mm_username,
      null::text as identifier,
      case when params.include_pii then admin_audit_logs.ip_address else null end as ip_address,
      case when params.include_pii then admin_audit_logs.path else null end as path,
      null::text as referrer,
      admin_audit_logs.target_type,
      case when params.include_pii then admin_audit_logs.target_id else null end as target_id,
      case when params.include_pii then admin_audit_logs.properties else null end as properties,
      admin_audit_logs.created_at,
      lower(concat_ws(' ',
        admin_audit_logs.action,
        coalesce(admin_audit_logs.actor_type, 'admin'),
        case when params.include_pii then admin_audit_logs.path end,
        admin_audit_logs.target_type,
        case when params.include_pii then admin_audit_logs.actor_id end,
        case when params.include_pii then admin_audit_logs.ip_address end,
        case when params.include_pii then admin_audit_logs.target_id end,
        case when params.include_pii then admin_audit_logs.properties::text end
      )) as search_text
    from public.admin_audit_logs
    cross join params
    where 'audit' = any(params.allowed_groups)
      and admin_audit_logs.created_at >= input_start
      and admin_audit_logs.created_at <= input_end

    union all

    select
      'security'::text as group_name,
      auth_security_logs.id,
      auth_security_logs.event_name::text as name,
      auth_security_logs.status::text as status,
      auth_security_logs.actor_type::text as actor_type,
      case when params.include_pii then auth_security_logs.actor_id else null end as actor_id,
      case when params.include_pii then members.display_name else null end as actor_name,
      case when params.include_pii then directory.mm_username else null end as actor_mm_username,
      case when params.include_pii then auth_security_logs.identifier else null end as identifier,
      case when params.include_pii then auth_security_logs.ip_address else null end as ip_address,
      case when params.include_pii then auth_security_logs.path else null end as path,
      null::text as referrer,
      null::text as target_type,
      null::text as target_id,
      case when params.include_pii then auth_security_logs.properties else null end as properties,
      auth_security_logs.created_at,
      lower(concat_ws(' ',
        auth_security_logs.event_name,
        auth_security_logs.status,
        auth_security_logs.actor_type,
        case when params.include_pii then auth_security_logs.path end,
        case when params.include_pii then members.display_name end,
        case when params.include_pii then directory.mm_username end,
        case when params.include_pii then auth_security_logs.actor_id end,
        case when params.include_pii then auth_security_logs.identifier end,
        case when params.include_pii then auth_security_logs.ip_address end,
        case when params.include_pii then auth_security_logs.properties::text end
      )) as search_text
    from public.auth_security_logs
    cross join params
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    left join public.mm_user_directory directory
      on directory.id = members.mattermost_account_id
    where 'security' = any(params.allowed_groups)
      and auth_security_logs.created_at >= input_start
      and auth_security_logs.created_at <= input_end
  ),
  filtered_logs as (
    select base_logs.*
    from base_logs
    cross join params
    where (params.group_filter = 'all' or base_logs.group_name = params.group_filter)
      and (params.name_filter = 'all' or base_logs.name = params.name_filter)
      and (params.actor_filter = 'all' or coalesce(base_logs.actor_type, '') = params.actor_filter)
      and (params.status_filter = 'all' or coalesce(base_logs.status, '') = params.status_filter)
      and (params.search_query = '' or base_logs.search_text like '%' || params.search_query || '%')
  ),
  counted_logs as (
    select filtered_logs.*, count(*) over () as total_count
    from filtered_logs
  ),
  paged_logs as (
    select counted_logs.*, row_number() over (order by created_at desc, id desc) as row_num
    from counted_logs
  )
  select
    paged_logs.group_name,
    paged_logs.id,
    paged_logs.name,
    paged_logs.status,
    paged_logs.actor_type,
    paged_logs.actor_id,
    paged_logs.actor_name,
    paged_logs.actor_mm_username,
    paged_logs.identifier,
    paged_logs.ip_address,
    paged_logs.path,
    paged_logs.referrer,
    paged_logs.target_type,
    paged_logs.target_id,
    paged_logs.properties,
    paged_logs.created_at,
    paged_logs.total_count
  from paged_logs
  cross join params
  where paged_logs.row_num > ((params.page - 1) * params.page_size)
    and paged_logs.row_num <= (params.page * params.page_size)
  order by paged_logs.created_at desc, paged_logs.id desc;
$$;

create or replace function public.get_admin_logs_summary_scoped(
  input_start timestamp with time zone,
  input_end timestamp with time zone,
  input_bucket_ms bigint,
  input_allowed_groups text[] default '{}',
  input_include_pii boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      input_start as start_at,
      input_end as end_at,
      greatest(coalesce(input_bucket_ms, 60000), 60000)::bigint as bucket_ms,
      array(
        select candidate
        from unnest(coalesce(input_allowed_groups, '{}'::text[])) as candidate
        where candidate in ('product', 'audit', 'security')
      ) as allowed_groups,
      coalesce(input_include_pii, false) as include_pii
  ),
  product_logs as materialized (
    select
      'product'::text as group_name,
      event_logs.event_name::text as name,
      null::text as status,
      event_logs.actor_type::text as actor_type,
      case when params.include_pii then coalesce(nullif('@' || directory.mm_username, '@'), nullif(members.display_name, ''), nullif(event_logs.actor_id, '')) end as actor_label,
      case when params.include_pii then event_logs.ip_address::text end as ip_address,
      case when params.include_pii then event_logs.path::text end as path,
      event_logs.created_at
    from public.event_logs
    cross join params
    left join public.members on event_logs.actor_type = 'member' and members.id::text = event_logs.actor_id
    left join public.mm_user_directory directory on directory.id = members.mattermost_account_id
    where 'product' = any(params.allowed_groups)
      and event_logs.created_at >= params.start_at and event_logs.created_at <= params.end_at
  ),
  audit_logs as materialized (
    select
      'audit'::text as group_name,
      admin_audit_logs.action::text as name,
      null::text as status,
      coalesce(admin_audit_logs.actor_type, 'admin')::text as actor_type,
      case when params.include_pii then coalesce(nullif(admin_audit_logs.actor_id, ''), 'admin') end as actor_label,
      case when params.include_pii then admin_audit_logs.ip_address::text end as ip_address,
      case when params.include_pii then admin_audit_logs.path::text end as path,
      admin_audit_logs.created_at
    from public.admin_audit_logs
    cross join params
    where 'audit' = any(params.allowed_groups)
      and admin_audit_logs.created_at >= params.start_at and admin_audit_logs.created_at <= params.end_at
  ),
  security_logs as materialized (
    select
      'security'::text as group_name,
      auth_security_logs.event_name::text as name,
      auth_security_logs.status::text as status,
      auth_security_logs.actor_type::text as actor_type,
      case when params.include_pii then coalesce(nullif('@' || directory.mm_username, '@'), nullif(members.display_name, ''), nullif(auth_security_logs.identifier, ''), nullif(auth_security_logs.actor_id, '')) end as actor_label,
      case when params.include_pii then auth_security_logs.ip_address::text end as ip_address,
      case when params.include_pii then auth_security_logs.path::text end as path,
      auth_security_logs.created_at
    from public.auth_security_logs
    cross join params
    left join public.members on auth_security_logs.actor_type = 'member' and members.id::text = auth_security_logs.actor_id
    left join public.mm_user_directory directory on directory.id = members.mattermost_account_id
    where 'security' = any(params.allowed_groups)
      and auth_security_logs.created_at >= params.start_at and auth_security_logs.created_at <= params.end_at
  ),
  unified_logs as materialized (
    select * from product_logs union all select * from audit_logs union all select * from security_logs
  ),
  bucket_series as (
    select generate_series(0, greatest(ceil(extract(epoch from (params.end_at - params.start_at)) * 1000 / params.bucket_ms)::integer - 1, 0)) as bucket_index
    from params
  ),
  bucketed_logs as materialized (
    select floor(extract(epoch from (unified_logs.created_at - params.start_at)) * 1000 / params.bucket_ms)::integer as bucket_index, unified_logs.group_name
    from unified_logs cross join params
  ),
  buckets as (
    select
      params.start_at + ((bucket_series.bucket_index * params.bucket_ms)::double precision * interval '1 millisecond') as bucket_start,
      least(params.end_at, params.start_at + (((bucket_series.bucket_index + 1) * params.bucket_ms)::double precision * interval '1 millisecond')) as bucket_end,
      count(*) filter (where bucketed_logs.group_name = 'product')::bigint as product_count,
      count(*) filter (where bucketed_logs.group_name = 'audit')::bigint as audit_count,
      count(*) filter (where bucketed_logs.group_name = 'security')::bigint as security_count,
      count(bucketed_logs.group_name)::bigint as total_count
    from bucket_series cross join params
    left join bucketed_logs on bucketed_logs.bucket_index = bucket_series.bucket_index
    group by bucket_series.bucket_index, params.start_at, params.end_at, params.bucket_ms
    order by bucket_series.bucket_index
  )
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'product', (select count(*) from product_logs),
      'audit', (select count(*) from audit_logs),
      'security', (select count(*) from security_logs)
    ),
    'securityStatusCounts', jsonb_build_object(
      'success', (select count(*) from security_logs where status = 'success'),
      'failure', (select count(*) from security_logs where status = 'failure'),
      'blocked', (select count(*) from security_logs where status = 'blocked')
    ),
    'buckets', coalesce((select jsonb_agg(jsonb_build_object('start', bucket_start, 'end', bucket_end, 'product', product_count, 'audit', audit_count, 'security', security_count, 'total', total_count) order by bucket_start) from buckets), '[]'::jsonb),
    'availableNames', coalesce((select jsonb_agg(jsonb_build_object('group', group_name, 'name', name) order by group_name, name) from (select distinct group_name, name from unified_logs where name is not null) names), '[]'::jsonb),
    'actorOptions', coalesce((select jsonb_agg(actor_type order by actor_type) from (select distinct actor_type from unified_logs where actor_type is not null) actors), '[]'::jsonb),
    'topProductEvents', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'count', event_count) order by event_count desc, name) from (select name, count(*)::bigint as event_count from product_logs group by name order by event_count desc, name limit 5) ranked), '[]'::jsonb),
    'topAuditActions', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'count', action_count) order by action_count desc, name) from (select name, count(*)::bigint as action_count from audit_logs group by name order by action_count desc, name limit 5) ranked), '[]'::jsonb),
    'topActors', case when (select include_pii from params) then coalesce((select jsonb_agg(jsonb_build_object('label', actor_label, 'count', actor_count) order by actor_count desc, actor_label) from (select actor_label, count(*)::bigint as actor_count from unified_logs where actor_label is not null group by actor_label order by actor_count desc, actor_label limit 5) ranked), '[]'::jsonb) else '[]'::jsonb end,
    'topIps', case when (select include_pii from params) then coalesce((select jsonb_agg(jsonb_build_object('label', ip_address, 'count', ip_count) order by ip_count desc, ip_address) from (select ip_address, count(*)::bigint as ip_count from unified_logs where ip_address is not null group by ip_address order by ip_count desc, ip_address limit 5) ranked), '[]'::jsonb) else '[]'::jsonb end,
    'topPaths', case when (select include_pii from params) then coalesce((select jsonb_agg(jsonb_build_object('label', path, 'count', path_count) order by path_count desc, path) from (select path, count(*)::bigint as path_count from unified_logs where path is not null group by path order by path_count desc, path limit 5) ranked), '[]'::jsonb) else '[]'::jsonb end
  );
$$;

revoke all on function public.get_admin_logs_page_scoped(timestamp with time zone, timestamp with time zone, integer, integer, text, text, text, text, text, text[], boolean) from public;
revoke all on function public.get_admin_logs_page_scoped(timestamp with time zone, timestamp with time zone, integer, integer, text, text, text, text, text, text[], boolean) from anon;
revoke all on function public.get_admin_logs_page_scoped(timestamp with time zone, timestamp with time zone, integer, integer, text, text, text, text, text, text[], boolean) from authenticated;
grant execute on function public.get_admin_logs_page_scoped(timestamp with time zone, timestamp with time zone, integer, integer, text, text, text, text, text, text[], boolean) to service_role;

revoke all on function public.get_admin_logs_summary_scoped(timestamp with time zone, timestamp with time zone, bigint, text[], boolean) from public;
revoke all on function public.get_admin_logs_summary_scoped(timestamp with time zone, timestamp with time zone, bigint, text[], boolean) from anon;
revoke all on function public.get_admin_logs_summary_scoped(timestamp with time zone, timestamp with time zone, bigint, text[], boolean) from authenticated;
grant execute on function public.get_admin_logs_summary_scoped(timestamp with time zone, timestamp with time zone, bigint, text[], boolean) to service_role;
