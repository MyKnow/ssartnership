-- Use a stable created_at/id keyset for interactive log continuation.
-- The existing page RPC remains available for direct page-number links and rolling deploys.
create or replace function public.get_admin_logs_cursor_scoped(
  input_start timestamp with time zone,
  input_end timestamp with time zone,
  input_page_size integer,
  input_cursor_created_at timestamp with time zone default null,
  input_cursor_id uuid default null,
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
  cursor_logs as (
    select counted_logs.*
    from counted_logs
    where input_cursor_created_at is null
       or counted_logs.created_at < input_cursor_created_at
       or (
         counted_logs.created_at = input_cursor_created_at
         and input_cursor_id is not null
         and counted_logs.id < input_cursor_id
       )
  )
  select
    cursor_logs.group_name,
    cursor_logs.id,
    cursor_logs.name,
    cursor_logs.status,
    cursor_logs.actor_type,
    cursor_logs.actor_id,
    cursor_logs.actor_name,
    cursor_logs.actor_mm_username,
    cursor_logs.identifier,
    cursor_logs.ip_address,
    cursor_logs.path,
    cursor_logs.referrer,
    cursor_logs.target_type,
    cursor_logs.target_id,
    cursor_logs.properties,
    cursor_logs.created_at,
    cursor_logs.total_count
  from cursor_logs
  cross join params
  order by cursor_logs.created_at desc, cursor_logs.id desc
  limit (select page_size from params);
$$;

revoke all on function public.get_admin_logs_cursor_scoped(
  timestamp with time zone,
  timestamp with time zone,
  integer,
  timestamp with time zone,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text[],
  boolean
) from public;
revoke all on function public.get_admin_logs_cursor_scoped(
  timestamp with time zone,
  timestamp with time zone,
  integer,
  timestamp with time zone,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text[],
  boolean
) from anon;
revoke all on function public.get_admin_logs_cursor_scoped(
  timestamp with time zone,
  timestamp with time zone,
  integer,
  timestamp with time zone,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text[],
  boolean
) from authenticated;
grant execute on function public.get_admin_logs_cursor_scoped(
  timestamp with time zone,
  timestamp with time zone,
  integer,
  timestamp with time zone,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text[],
  boolean
) to service_role;
