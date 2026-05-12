-- Reduce UX-facing DB latency for public event tracking and admin log dashboards.
-- Rollback, if needed:
--   drop index if exists public.event_logs_created_at_id_idx;
--   drop index if exists public.admin_audit_logs_created_at_id_idx;
--   drop index if exists public.auth_security_logs_created_at_id_idx;
--   drop index if exists public.event_logs_name_created_at_idx;
--   drop index if exists public.admin_audit_logs_action_created_at_idx;
--   drop index if exists public.auth_security_logs_name_status_created_at_idx;
--   drop index if exists public.event_logs_actor_type_created_at_idx;
--   drop index if exists public.admin_audit_logs_actor_created_at_idx;
--   drop index if exists public.auth_security_logs_actor_status_created_at_idx;
--   drop index if exists public.event_logs_path_prefix_idx;
--   drop index if exists public.admin_audit_logs_path_prefix_idx;
--   drop index if exists public.auth_security_logs_path_prefix_idx;

create index if not exists event_logs_created_at_id_idx
  on public.event_logs(created_at desc, id desc);

create index if not exists admin_audit_logs_created_at_id_idx
  on public.admin_audit_logs(created_at desc, id desc);

create index if not exists auth_security_logs_created_at_id_idx
  on public.auth_security_logs(created_at desc, id desc);

create index if not exists event_logs_name_created_at_idx
  on public.event_logs(event_name, created_at desc);

create index if not exists admin_audit_logs_action_created_at_idx
  on public.admin_audit_logs(action, created_at desc);

create index if not exists auth_security_logs_name_status_created_at_idx
  on public.auth_security_logs(event_name, status, created_at desc);

create index if not exists event_logs_actor_type_created_at_idx
  on public.event_logs(actor_type, created_at desc);

create index if not exists admin_audit_logs_actor_created_at_idx
  on public.admin_audit_logs(actor_id, created_at desc);

create index if not exists auth_security_logs_actor_status_created_at_idx
  on public.auth_security_logs(actor_type, status, created_at desc);

create index if not exists event_logs_path_prefix_idx
  on public.event_logs(path text_pattern_ops)
  where path is not null;

create index if not exists admin_audit_logs_path_prefix_idx
  on public.admin_audit_logs(path text_pattern_ops)
  where path is not null;

create index if not exists auth_security_logs_path_prefix_idx
  on public.auth_security_logs(path text_pattern_ops)
  where path is not null;

create or replace function public.get_admin_dashboard_counts()
returns table (
  member_count bigint,
  company_count bigint,
  partner_count bigint,
  category_count bigint,
  account_count bigint,
  review_count bigint,
  active_push_subscription_count bigint,
  product_log_count bigint,
  audit_log_count bigint,
  security_log_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    (select count(*)::bigint from public.members) as member_count,
    (select count(*)::bigint from public.partner_companies) as company_count,
    (select count(*)::bigint from public.partners) as partner_count,
    (select count(*)::bigint from public.categories) as category_count,
    (select count(*)::bigint from public.partner_accounts) as account_count,
    (
      select count(*)::bigint
      from public.partner_reviews
      where deleted_at is null
    ) as review_count,
    (
      select count(*)::bigint
      from public.push_subscriptions
      where is_active = true
    ) as active_push_subscription_count,
    greatest(
      coalesce((select reltuples::bigint from pg_class where oid = 'public.event_logs'::regclass), 0),
      0
    ) as product_log_count,
    greatest(
      coalesce((select reltuples::bigint from pg_class where oid = 'public.admin_audit_logs'::regclass), 0),
      0
    ) as audit_log_count,
    greatest(
      coalesce((select reltuples::bigint from pg_class where oid = 'public.auth_security_logs'::regclass), 0),
      0
    ) as security_log_count;
$$;

create or replace function public.get_admin_logs_summary(
  input_start timestamp with time zone,
  input_end timestamp with time zone,
  input_bucket_ms bigint
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with params as (
    select
      input_start as start_at,
      input_end as end_at,
      greatest(coalesce(input_bucket_ms, 60000), 60000)::bigint as bucket_ms
  ),
  product_logs as materialized (
    select
      'product'::text as group_name,
      event_logs.event_name::text as name,
      null::text as status,
      event_logs.actor_type::text as actor_type,
      coalesce(
        nullif('@' || members.mm_username, '@'),
        nullif(members.display_name, ''),
        nullif(event_logs.actor_id, ''),
        case when event_logs.actor_type = 'guest' then '비로그인 사용자' end
      ) as actor_label,
      event_logs.ip_address::text as ip_address,
      event_logs.path::text as path,
      event_logs.created_at
    from public.event_logs
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    cross join params
    where event_logs.created_at >= params.start_at
      and event_logs.created_at <= params.end_at
  ),
  audit_logs as materialized (
    select
      'audit'::text as group_name,
      admin_audit_logs.action::text as name,
      null::text as status,
      'admin'::text as actor_type,
      coalesce(nullif(admin_audit_logs.actor_id, ''), 'admin') as actor_label,
      admin_audit_logs.ip_address::text as ip_address,
      admin_audit_logs.path::text as path,
      admin_audit_logs.created_at
    from public.admin_audit_logs
    cross join params
    where admin_audit_logs.created_at >= params.start_at
      and admin_audit_logs.created_at <= params.end_at
  ),
  security_logs as materialized (
    select
      'security'::text as group_name,
      auth_security_logs.event_name::text as name,
      auth_security_logs.status::text as status,
      auth_security_logs.actor_type::text as actor_type,
      coalesce(
        nullif('@' || members.mm_username, '@'),
        nullif(members.display_name, ''),
        nullif(auth_security_logs.identifier, ''),
        nullif(auth_security_logs.actor_id, ''),
        case when auth_security_logs.actor_type = 'guest' then '비로그인 사용자' end
      ) as actor_label,
      auth_security_logs.ip_address::text as ip_address,
      auth_security_logs.path::text as path,
      auth_security_logs.created_at
    from public.auth_security_logs
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    cross join params
    where auth_security_logs.created_at >= params.start_at
      and auth_security_logs.created_at <= params.end_at
  ),
  unified_logs as materialized (
    select * from product_logs
    union all
    select * from audit_logs
    union all
    select * from security_logs
  ),
  bucket_series as (
    select
      generate_series(
        0,
        greatest(
          ceil(extract(epoch from (params.end_at - params.start_at)) * 1000 / params.bucket_ms)::integer - 1,
          0
        )
      ) as bucket_index
    from params
  ),
  bucketed_logs as materialized (
    select
      floor(extract(epoch from (unified_logs.created_at - params.start_at)) * 1000 / params.bucket_ms)::integer as bucket_index,
      unified_logs.group_name
    from unified_logs
    cross join params
  ),
  buckets as (
    select
      (params.start_at + ((bucket_series.bucket_index * params.bucket_ms)::double precision * interval '1 millisecond')) as bucket_start,
      least(
        params.end_at,
        params.start_at + (((bucket_series.bucket_index + 1) * params.bucket_ms)::double precision * interval '1 millisecond')
      ) as bucket_end,
      count(*) filter (where bucketed_logs.group_name = 'product')::bigint as product_count,
      count(*) filter (where bucketed_logs.group_name = 'audit')::bigint as audit_count,
      count(*) filter (where bucketed_logs.group_name = 'security')::bigint as security_count,
      count(bucketed_logs.group_name)::bigint as total_count
    from bucket_series
    cross join params
    left join bucketed_logs
      on bucketed_logs.bucket_index = bucket_series.bucket_index
    group by bucket_series.bucket_index, params.start_at, params.end_at, params.bucket_ms
    order by bucket_series.bucket_index
  )
  select jsonb_build_object(
    'counts',
    jsonb_build_object(
      'product', (select count(*) from product_logs),
      'audit', (select count(*) from audit_logs),
      'security', (select count(*) from security_logs)
    ),
    'securityStatusCounts',
    jsonb_build_object(
      'success', (select count(*) from security_logs where status = 'success'),
      'failure', (select count(*) from security_logs where status = 'failure'),
      'blocked', (select count(*) from security_logs where status = 'blocked')
    ),
    'buckets',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'start', bucket_start,
            'end', bucket_end,
            'product', product_count,
            'audit', audit_count,
            'security', security_count,
            'total', total_count
          )
          order by bucket_start
        )
        from buckets
      ),
      '[]'::jsonb
    ),
    'availableNames',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('group', group_name, 'name', name)
          order by group_name, name
        )
        from (
          select distinct group_name, name
          from unified_logs
          where name is not null
        ) names
      ),
      '[]'::jsonb
    ),
    'actorOptions',
    coalesce(
      (
        select jsonb_agg(actor_type order by actor_type)
        from (
          select distinct actor_type
          from unified_logs
          where actor_type is not null
        ) actors
      ),
      '[]'::jsonb
    ),
    'topProductEvents',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('name', name, 'count', event_count) order by event_count desc, name)
        from (
          select name, count(*)::bigint as event_count
          from product_logs
          group by name
          order by event_count desc, name
          limit 5
        ) ranked
      ),
      '[]'::jsonb
    ),
    'topAuditActions',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('name', name, 'count', action_count) order by action_count desc, name)
        from (
          select name, count(*)::bigint as action_count
          from audit_logs
          group by name
          order by action_count desc, name
          limit 5
        ) ranked
      ),
      '[]'::jsonb
    ),
    'topActors',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('label', actor_label, 'count', actor_count) order by actor_count desc, actor_label)
        from (
          select actor_label, count(*)::bigint as actor_count
          from unified_logs
          where actor_label is not null
            and actor_label <> '비로그인 사용자'
          group by actor_label
          order by actor_count desc, actor_label
          limit 5
        ) ranked
      ),
      '[]'::jsonb
    ),
    'topIps',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('label', ip_address, 'count', ip_count) order by ip_count desc, ip_address)
        from (
          select ip_address, count(*)::bigint as ip_count
          from unified_logs
          where ip_address is not null
          group by ip_address
          order by ip_count desc, ip_address
          limit 5
        ) ranked
      ),
      '[]'::jsonb
    ),
    'topPaths',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('label', path, 'count', path_count) order by path_count desc, path)
        from (
          select path, count(*)::bigint as path_count
          from unified_logs
          where path is not null
          group by path
          order by path_count desc, path
          limit 5
        ) ranked
      ),
      '[]'::jsonb
    )
  );
$$;
