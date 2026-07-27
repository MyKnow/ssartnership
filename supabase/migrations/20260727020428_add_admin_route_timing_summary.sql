-- Aggregate safe administrator route timing fields without exposing raw paths
-- or event properties to the logs UI.
-- Rollback: drop function public.get_admin_route_timing_summary(timestamptz, timestamptz)
-- and drop index public.event_logs_admin_route_timing_created_at_idx.

create index if not exists event_logs_admin_route_timing_created_at_idx
  on public.event_logs(target_id, created_at desc)
  where event_name = 'admin_route_timing';

create or replace function public.get_admin_route_timing_summary(
  input_start timestamp with time zone,
  input_end timestamp with time zone
)
returns table (
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
  select
    event_log.target_id as route_key,
    count(*)::bigint as sample_count,
    percentile_cont(0.75) within group (
      order by (event_log.properties ->> 'durationMs')::double precision
    )::double precision as p75_duration_ms,
    count(*) filter (
      where event_log.properties ->> 'outcome' = 'complete'
    )::bigint as complete_count,
    count(*) filter (
      where event_log.properties ->> 'outcome' = 'unknown'
    )::bigint as unknown_count,
    count(*) filter (
      where event_log.properties ->> 'outcome' = 'error'
    )::bigint as error_count
  from public.event_logs as event_log
  where event_log.event_name = 'admin_route_timing'
    and event_log.target_type = 'admin_performance'
    and event_log.target_id is not null
    and event_log.created_at >= input_start
    and event_log.created_at <= input_end
    and event_log.properties ->> 'durationMs' ~ '^[0-9]+$'
  group by event_log.target_id
  order by p75_duration_ms desc nulls last;
$$;

revoke all on function public.get_admin_route_timing_summary(timestamp with time zone, timestamp with time zone) from public;
revoke all on function public.get_admin_route_timing_summary(timestamp with time zone, timestamp with time zone) from anon;
revoke all on function public.get_admin_route_timing_summary(timestamp with time zone, timestamp with time zone) from authenticated;
grant execute on function public.get_admin_route_timing_summary(timestamp with time zone, timestamp with time zone) to service_role;
