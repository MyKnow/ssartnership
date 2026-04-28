-- Push newest-first admin log list filtering and pagination into Postgres for all-group and search-heavy cases.
-- Rollback, if needed:
--   drop function if exists public.get_admin_logs_page(timestamp with time zone, timestamp with time zone, integer, integer, text, text, text, text, text);

create or replace function public.get_admin_logs_page(
  input_start timestamp with time zone,
  input_end timestamp with time zone,
  input_page integer,
  input_page_size integer,
  input_group text default 'all',
  input_search text default '',
  input_name text default 'all',
  input_actor text default 'all',
  input_status text default 'all'
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
      coalesce(nullif(input_status, ''), 'all') as status_filter
  ),
  base_logs as (
    select
      'product'::text as group_name,
      event_logs.id,
      event_logs.event_name::text as name,
      null::text as status,
      event_logs.actor_type::text as actor_type,
      event_logs.actor_id,
      members.display_name as actor_name,
      members.mm_username as actor_mm_username,
      null::text as identifier,
      event_logs.ip_address,
      event_logs.path,
      event_logs.referrer,
      event_logs.target_type,
      event_logs.target_id,
      event_logs.properties,
      event_logs.created_at,
      lower(
        concat_ws(
          ' ',
          event_logs.event_name,
          members.display_name,
          members.mm_username,
          event_logs.actor_type,
          event_logs.actor_id,
          event_logs.ip_address,
          event_logs.path,
          event_logs.referrer,
          event_logs.target_type,
          event_logs.target_id,
          event_logs.properties::text
        )
      ) as search_text
    from public.event_logs
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    where event_logs.created_at >= input_start
      and event_logs.created_at <= input_end

    union all

    select
      'audit'::text as group_name,
      admin_audit_logs.id,
      admin_audit_logs.action::text as name,
      null::text as status,
      'admin'::text as actor_type,
      admin_audit_logs.actor_id,
      null::text as actor_name,
      null::text as actor_mm_username,
      null::text as identifier,
      admin_audit_logs.ip_address,
      admin_audit_logs.path,
      null::text as referrer,
      admin_audit_logs.target_type,
      admin_audit_logs.target_id,
      admin_audit_logs.properties,
      admin_audit_logs.created_at,
      lower(
        concat_ws(
          ' ',
          admin_audit_logs.action,
          admin_audit_logs.actor_id,
          admin_audit_logs.ip_address,
          admin_audit_logs.path,
          admin_audit_logs.target_type,
          admin_audit_logs.target_id,
          admin_audit_logs.properties::text
        )
      ) as search_text
    from public.admin_audit_logs
    where admin_audit_logs.created_at >= input_start
      and admin_audit_logs.created_at <= input_end

    union all

    select
      'security'::text as group_name,
      auth_security_logs.id,
      auth_security_logs.event_name::text as name,
      auth_security_logs.status::text as status,
      auth_security_logs.actor_type::text as actor_type,
      auth_security_logs.actor_id,
      members.display_name as actor_name,
      members.mm_username as actor_mm_username,
      auth_security_logs.identifier,
      auth_security_logs.ip_address,
      auth_security_logs.path,
      null::text as referrer,
      null::text as target_type,
      null::text as target_id,
      auth_security_logs.properties,
      auth_security_logs.created_at,
      lower(
        concat_ws(
          ' ',
          auth_security_logs.event_name,
          auth_security_logs.status,
          members.display_name,
          members.mm_username,
          auth_security_logs.actor_type,
          auth_security_logs.actor_id,
          auth_security_logs.identifier,
          auth_security_logs.ip_address,
          auth_security_logs.path,
          auth_security_logs.properties::text
        )
      ) as search_text
    from public.auth_security_logs
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    where auth_security_logs.created_at >= input_start
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
      and (
        params.search_query = ''
        or base_logs.search_text like '%' || params.search_query || '%'
      )
  ),
  counted_logs as (
    select
      filtered_logs.*,
      count(*) over () as total_count
    from filtered_logs
  )
  select
    counted_logs.group_name,
    counted_logs.id,
    counted_logs.name,
    counted_logs.status,
    counted_logs.actor_type,
    counted_logs.actor_id,
    counted_logs.actor_name,
    counted_logs.actor_mm_username,
    counted_logs.identifier,
    counted_logs.ip_address,
    counted_logs.path,
    counted_logs.referrer,
    counted_logs.target_type,
    counted_logs.target_id,
    counted_logs.properties,
    counted_logs.created_at,
    counted_logs.total_count
  from counted_logs
  cross join params
  order by counted_logs.created_at desc
  offset ((params.page - 1) * params.page_size)
  limit params.page_size;
$$;
