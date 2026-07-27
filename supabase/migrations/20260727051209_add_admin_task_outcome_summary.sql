-- Aggregate safe administrator task outcomes without exposing raw event
-- properties, paths, or operational identifiers to the logs UI.
-- Rollback: drop function public.get_admin_task_outcome_summary(timestamptz, timestamptz)
-- and drop index public.event_logs_admin_task_outcome_created_at_idx.

create index if not exists event_logs_admin_task_outcome_created_at_idx
  on public.event_logs(target_id, created_at desc)
  where event_name in (
    'admin_task_start',
    'admin_task_complete',
    'admin_task_recovery'
  );

create or replace function public.get_admin_task_outcome_summary(
  input_start timestamp with time zone,
  input_end timestamp with time zone
)
returns table (
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
    task_events.task_key,
    count(*) filter (where task_events.event_name = 'admin_task_start')::bigint as start_count,
    count(*) filter (where task_events.event_name = 'admin_task_complete')::bigint as complete_count,
    count(*) filter (where task_events.event_name = 'admin_task_recovery')::bigint as recovery_count,
    (
      count(*) filter (where task_events.event_name = 'admin_task_complete')::numeric
      / nullif(count(*) filter (where task_events.event_name = 'admin_task_start'), 0)::numeric
      * 100
    ) as completion_rate,
    (
      count(*) filter (where task_events.event_name = 'admin_task_recovery')::numeric
      / nullif(count(*) filter (where task_events.event_name = 'admin_task_start'), 0)::numeric
      * 100
    ) as recovery_rate,
    percentile_cont(0.75) within group (order by task_events.duration_ms)
      filter (where task_events.duration_ms is not null) as p75_duration_ms
  from task_events
  group by task_events.task_key
  order by start_count desc, task_events.task_key;
$$;

revoke all on function public.get_admin_task_outcome_summary(timestamp with time zone, timestamp with time zone) from public;
revoke all on function public.get_admin_task_outcome_summary(timestamp with time zone, timestamp with time zone) from anon;
revoke all on function public.get_admin_task_outcome_summary(timestamp with time zone, timestamp with time zone) from authenticated;
grant execute on function public.get_admin_task_outcome_summary(timestamp with time zone, timestamp with time zone) to service_role;
