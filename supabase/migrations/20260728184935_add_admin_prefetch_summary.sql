-- Aggregate intent-triggered administrator prefetch utilization without
-- exposing raw URLs or event properties to the logs UI.
-- The used/requested ratio is an application-observable proxy because Next.js
-- does not expose its internal RSC cache-hit bit.
-- Rollback: drop both functions and the two partial indexes below.

create index if not exists event_logs_admin_prefetch_created_at_idx
  on public.event_logs(target_id, created_at desc)
  where event_name = 'admin_prefetch';

create index if not exists event_logs_admin_prefetch_viewport_idx
  on public.event_logs(
    (coalesce(properties ->> 'viewport', 'unknown')),
    target_id,
    created_at desc
  )
  where event_name = 'admin_prefetch';

create or replace function public.get_admin_prefetch_summary(
  input_start timestamp with time zone,
  input_end timestamp with time zone
)
returns table (
  route_key text,
  requested_count bigint,
  used_count bigint,
  utilization_rate numeric
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    event_log.target_id as route_key,
    count(*) filter (
      where event_log.properties ->> 'stage' = 'requested'
    )::bigint as requested_count,
    count(*) filter (
      where event_log.properties ->> 'stage' = 'used'
    )::bigint as used_count,
    (
      count(*) filter (where event_log.properties ->> 'stage' = 'used')::numeric
      / nullif(
        count(*) filter (where event_log.properties ->> 'stage' = 'requested'),
        0
      )::numeric
      * 100
    ) as utilization_rate
  from public.event_logs as event_log
  where event_log.event_name = 'admin_prefetch'
    and event_log.target_type = 'admin_performance'
    and event_log.target_id ~ '^admin\.[a-z0-9._:-]+$'
    and event_log.created_at >= input_start
    and event_log.created_at <= input_end
    and event_log.properties ->> 'stage' in ('requested', 'used')
  group by event_log.target_id
  order by utilization_rate asc nulls last;
$$;

create or replace function public.get_admin_prefetch_dimension_summary(
  input_start timestamp with time zone,
  input_end timestamp with time zone
)
returns table (
  viewport text,
  route_key text,
  requested_count bigint,
  used_count bigint,
  utilization_rate numeric
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with dimensioned_events as (
    select
      case
        when event_log.properties ->> 'viewport' in ('mobile', 'tablet', 'desktop')
          then event_log.properties ->> 'viewport'
        else 'unknown'
      end as viewport,
      event_log.target_id as route_key,
      event_log.properties ->> 'stage' as stage
    from public.event_logs as event_log
    where event_log.event_name = 'admin_prefetch'
      and event_log.target_type = 'admin_performance'
      and event_log.target_id ~ '^admin\.[a-z0-9._:-]+$'
      and event_log.created_at >= input_start
      and event_log.created_at <= input_end
      and event_log.properties ->> 'stage' in ('requested', 'used')
  )
  select
    dimensioned_events.viewport,
    dimensioned_events.route_key,
    count(*) filter (where dimensioned_events.stage = 'requested')::bigint,
    count(*) filter (where dimensioned_events.stage = 'used')::bigint,
    (
      count(*) filter (where dimensioned_events.stage = 'used')::numeric
      / nullif(
        count(*) filter (where dimensioned_events.stage = 'requested'),
        0
      )::numeric
      * 100
    ) as utilization_rate
  from dimensioned_events
  group by dimensioned_events.viewport, dimensioned_events.route_key
  order by dimensioned_events.viewport, utilization_rate asc nulls last;
$$;

revoke all on function public.get_admin_prefetch_summary(timestamp with time zone, timestamp with time zone) from public;
revoke all on function public.get_admin_prefetch_summary(timestamp with time zone, timestamp with time zone) from anon;
revoke all on function public.get_admin_prefetch_summary(timestamp with time zone, timestamp with time zone) from authenticated;
grant execute on function public.get_admin_prefetch_summary(timestamp with time zone, timestamp with time zone) to service_role;

revoke all on function public.get_admin_prefetch_dimension_summary(timestamp with time zone, timestamp with time zone) from public;
revoke all on function public.get_admin_prefetch_dimension_summary(timestamp with time zone, timestamp with time zone) from anon;
revoke all on function public.get_admin_prefetch_dimension_summary(timestamp with time zone, timestamp with time zone) from authenticated;
grant execute on function public.get_admin_prefetch_dimension_summary(timestamp with time zone, timestamp with time zone) to service_role;
