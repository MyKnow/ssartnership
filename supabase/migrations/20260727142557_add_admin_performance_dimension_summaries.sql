-- Keep administrator performance aggregates separable by coarse viewport class.
-- The client only emits mobile/tablet/desktop; invalid or legacy values are
-- grouped as unknown. No raw URL, record identifier, or event property is
-- returned by these service-role-only summaries.
-- Rollback: drop the three *_dimension_summary functions and the partial index.

create index if not exists event_logs_admin_performance_viewport_idx
  on public.event_logs(
    (coalesce(properties ->> 'viewport', 'unknown')),
    created_at desc
  )
  where event_name in (
    'admin_web_vital',
    'admin_route_timing',
    'admin_task_start',
    'admin_task_complete',
    'admin_task_recovery'
  );

create or replace function public.get_admin_web_vitals_dimension_summary(
  input_start timestamp with time zone,
  input_end timestamp with time zone
)
returns table (
  viewport text,
  metric text,
  sample_count bigint,
  p75_value double precision,
  good_count bigint,
  needs_improvement_count bigint,
  poor_count bigint
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
      event_log.properties ->> 'metric' as metric,
      event_log.properties ->> 'rating' as rating,
      (event_log.properties ->> 'value')::double precision as value
    from public.event_logs as event_log
    where event_log.event_name = 'admin_web_vital'
      and event_log.created_at >= input_start
      and event_log.created_at <= input_end
      and event_log.properties ->> 'metric' in ('INP', 'LCP', 'TTFB')
      and event_log.properties ->> 'value' ~ '^[0-9]+(?:\.[0-9]+)?$'
  )
  select
    dimensioned_events.viewport,
    dimensioned_events.metric,
    count(*)::bigint as sample_count,
    percentile_cont(0.75) within group (order by dimensioned_events.value)::double precision,
    count(*) filter (where dimensioned_events.rating = 'good')::bigint,
    count(*) filter (where dimensioned_events.rating = 'needs-improvement')::bigint,
    count(*) filter (where dimensioned_events.rating = 'poor')::bigint
  from dimensioned_events
  group by dimensioned_events.viewport, dimensioned_events.metric
  order by dimensioned_events.viewport, dimensioned_events.metric;
$$;

create or replace function public.get_admin_route_timing_dimension_summary(
  input_start timestamp with time zone,
  input_end timestamp with time zone
)
returns table (
  viewport text,
  route_key text,
  sample_count bigint,
  p75_duration_ms double precision,
  complete_count bigint,
  unknown_count bigint,
  error_count bigint
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
      event_log.properties ->> 'outcome' as outcome,
      (event_log.properties ->> 'durationMs')::double precision as duration_ms
    from public.event_logs as event_log
    where event_log.event_name = 'admin_route_timing'
      and event_log.target_type = 'admin_performance'
      and event_log.target_id ~ '^admin\.[a-z0-9._:-]+$'
      and event_log.created_at >= input_start
      and event_log.created_at <= input_end
      and event_log.properties ->> 'durationMs' ~ '^[0-9]+$'
  )
  select
    dimensioned_events.viewport,
    dimensioned_events.route_key,
    count(*)::bigint,
    percentile_cont(0.75) within group (order by dimensioned_events.duration_ms)::double precision,
    count(*) filter (where dimensioned_events.outcome = 'complete')::bigint,
    count(*) filter (where dimensioned_events.outcome = 'unknown')::bigint,
    count(*) filter (where dimensioned_events.outcome = 'error')::bigint
  from dimensioned_events
  group by dimensioned_events.viewport, dimensioned_events.route_key
  order by dimensioned_events.viewport, p75_duration_ms desc nulls last;
$$;

create or replace function public.get_admin_task_outcome_dimension_summary(
  input_start timestamp with time zone,
  input_end timestamp with time zone
)
returns table (
  viewport text,
  task_key text,
  start_count bigint,
  complete_count bigint,
  recovery_count bigint,
  completion_rate numeric,
  recovery_rate numeric,
  p75_duration_ms double precision
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with task_events as (
    select
      case
        when event_log.properties ->> 'viewport' in ('mobile', 'tablet', 'desktop')
          then event_log.properties ->> 'viewport'
        else 'unknown'
      end as viewport,
      event_log.target_id as task_key,
      event_log.event_name,
      case
        when event_log.properties ->> 'durationMs' ~ '^[0-9]{1,6}$'
          and (event_log.properties ->> 'durationMs')::double precision between 0 and 120000
        then (event_log.properties ->> 'durationMs')::double precision
        else null
      end as duration_ms
    from public.event_logs as event_log
    where event_log.event_name in (
      'admin_task_start',
      'admin_task_complete',
      'admin_task_recovery'
    )
      and event_log.target_type = 'admin_task'
      and event_log.target_id ~ '^admin\.[a-z0-9._:-]+$'
      and event_log.created_at >= input_start
      and event_log.created_at <= input_end
  )
  select
    task_events.viewport,
    task_events.task_key,
    count(*) filter (where task_events.event_name = 'admin_task_start')::bigint,
    count(*) filter (where task_events.event_name = 'admin_task_complete')::bigint,
    count(*) filter (where task_events.event_name = 'admin_task_recovery')::bigint,
    (
      count(*) filter (where task_events.event_name = 'admin_task_complete')::numeric
      / nullif(count(*) filter (where task_events.event_name = 'admin_task_start'), 0)::numeric
      * 100
    ),
    (
      count(*) filter (where task_events.event_name = 'admin_task_recovery')::numeric
      / nullif(count(*) filter (where task_events.event_name = 'admin_task_start'), 0)::numeric
      * 100
    ),
    percentile_cont(0.75) within group (order by task_events.duration_ms)
      filter (where task_events.duration_ms is not null)
  from task_events
  group by task_events.viewport, task_events.task_key
  order by task_events.viewport, start_count desc, task_events.task_key;
$$;

revoke all on function public.get_admin_web_vitals_dimension_summary(timestamp with time zone, timestamp with time zone) from public;
revoke all on function public.get_admin_web_vitals_dimension_summary(timestamp with time zone, timestamp with time zone) from anon;
revoke all on function public.get_admin_web_vitals_dimension_summary(timestamp with time zone, timestamp with time zone) from authenticated;
grant execute on function public.get_admin_web_vitals_dimension_summary(timestamp with time zone, timestamp with time zone) to service_role;

revoke all on function public.get_admin_route_timing_dimension_summary(timestamp with time zone, timestamp with time zone) from public;
revoke all on function public.get_admin_route_timing_dimension_summary(timestamp with time zone, timestamp with time zone) from anon;
revoke all on function public.get_admin_route_timing_dimension_summary(timestamp with time zone, timestamp with time zone) from authenticated;
grant execute on function public.get_admin_route_timing_dimension_summary(timestamp with time zone, timestamp with time zone) to service_role;

revoke all on function public.get_admin_task_outcome_dimension_summary(timestamp with time zone, timestamp with time zone) from public;
revoke all on function public.get_admin_task_outcome_dimension_summary(timestamp with time zone, timestamp with time zone) from anon;
revoke all on function public.get_admin_task_outcome_dimension_summary(timestamp with time zone, timestamp with time zone) from authenticated;
grant execute on function public.get_admin_task_outcome_dimension_summary(timestamp with time zone, timestamp with time zone) to service_role;
