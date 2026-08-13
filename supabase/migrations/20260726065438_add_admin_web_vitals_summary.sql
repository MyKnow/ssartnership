-- Aggregate anonymous administrator RUM in PostgreSQL so the logs page can
-- evaluate p75 without loading raw browser event properties into the UI.
-- Rollback: drop function public.get_admin_web_vitals_summary(timestamptz, timestamptz)
-- and drop index public.event_logs_admin_web_vital_created_at_idx.

create index if not exists event_logs_admin_web_vital_created_at_idx
  on public.event_logs(created_at desc)
  where event_name = 'admin_web_vital';

create or replace function public.get_admin_web_vitals_summary(
  input_start timestamp with time zone,
  input_end timestamp with time zone
)
returns table (
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
  select
    event_log.properties ->> 'metric' as metric,
    count(*)::bigint as sample_count,
    percentile_cont(0.75) within group (
      order by (event_log.properties ->> 'value')::double precision
    )::double precision as p75_value,
    count(*) filter (where event_log.properties ->> 'rating' = 'good')::bigint as good_count,
    count(*) filter (
      where event_log.properties ->> 'rating' = 'needs-improvement'
    )::bigint as needs_improvement_count,
    count(*) filter (where event_log.properties ->> 'rating' = 'poor')::bigint as poor_count
  from public.event_logs as event_log
  where event_log.event_name = 'admin_web_vital'
    and event_log.created_at >= input_start
    and event_log.created_at <= input_end
    and event_log.properties ->> 'metric' in ('INP', 'LCP', 'TTFB')
    and event_log.properties ->> 'value' ~ '^[0-9]+(?:\.[0-9]+)?$'
  group by event_log.properties ->> 'metric';
$$;

revoke all on function public.get_admin_web_vitals_summary(timestamp with time zone, timestamp with time zone) from public;
revoke all on function public.get_admin_web_vitals_summary(timestamp with time zone, timestamp with time zone) from anon;
revoke all on function public.get_admin_web_vitals_summary(timestamp with time zone, timestamp with time zone) from authenticated;
grant execute on function public.get_admin_web_vitals_summary(timestamp with time zone, timestamp with time zone) to service_role;
