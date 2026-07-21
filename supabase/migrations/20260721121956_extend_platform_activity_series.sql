-- Keep DAU/WAU/MAU on their established windows while giving the admin
-- calendar enough columns to read like a compact GitHub-style activity graph.
create or replace function public.get_admin_platform_activity_metrics()
returns table (
  as_of_date date,
  member_dau bigint,
  member_wau bigint,
  member_mau bigint,
  guest_session_dau bigint,
  guest_session_wau bigint,
  guest_session_mau bigint,
  history_start_date date,
  daily_series jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with parameters as (
    select (now() at time zone 'Asia/Seoul')::date as as_of_date
  ),
  recent_activity as (
    select
      identities.activity_date,
      identities.identity_kind,
      identities.identity_hash
    from public.platform_active_identities as identities
    cross join parameters
    where identities.activity_date between parameters.as_of_date - 29 and parameters.as_of_date
  ),
  series_activity as (
    select
      identities.activity_date,
      identities.identity_kind,
      identities.identity_hash
    from public.platform_active_identities as identities
    cross join parameters
    where identities.activity_date between parameters.as_of_date - 83 and parameters.as_of_date
  ),
  daily_activity as (
    select
      series.activity_date,
      count(series_activity.identity_hash) filter (
        where series_activity.identity_kind = 'member'
      )::bigint as member_active_count,
      count(series_activity.identity_hash) filter (
        where series_activity.identity_kind = 'guest_session'
      )::bigint as guest_session_count
    from parameters
    cross join lateral generate_series(
      parameters.as_of_date - 83,
      parameters.as_of_date,
      interval '1 day'
    ) as series(activity_date)
    left join series_activity
      on series_activity.activity_date = series.activity_date::date
    group by series.activity_date
  ),
  metric_counts as (
    select
      count(distinct identity_hash) filter (
        where identity_kind = 'member'
          and activity_date = parameters.as_of_date
      )::bigint as member_dau,
      count(distinct identity_hash) filter (
        where identity_kind = 'member'
          and activity_date >= parameters.as_of_date - 6
      )::bigint as member_wau,
      count(distinct identity_hash) filter (
        where identity_kind = 'member'
      )::bigint as member_mau,
      count(distinct identity_hash) filter (
        where identity_kind = 'guest_session'
          and activity_date = parameters.as_of_date
      )::bigint as guest_session_dau,
      count(distinct identity_hash) filter (
        where identity_kind = 'guest_session'
          and activity_date >= parameters.as_of_date - 6
      )::bigint as guest_session_wau,
      count(distinct identity_hash) filter (
        where identity_kind = 'guest_session'
      )::bigint as guest_session_mau
    from recent_activity
    cross join parameters
  )
  select
    parameters.as_of_date,
    metric_counts.member_dau,
    metric_counts.member_wau,
    metric_counts.member_mau,
    metric_counts.guest_session_dau,
    metric_counts.guest_session_wau,
    metric_counts.guest_session_mau,
    (select min(activity_date) from public.platform_active_identities),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'activity_date', daily_activity.activity_date::date,
            'member_active_count', daily_activity.member_active_count,
            'guest_session_count', daily_activity.guest_session_count
          )
          order by daily_activity.activity_date
        )
        from daily_activity
      ),
      '[]'::jsonb
    ) as daily_series
  from parameters
  cross join metric_counts;
$$;
