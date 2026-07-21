create or replace function public.get_admin_forward_activity_metrics(
  p_anchor_date date default null
)
returns table (
  as_of_date date,
  today_date date,
  member_dau bigint,
  member_wau bigint,
  member_mau bigint,
  wau_observed_through date,
  mau_observed_through date,
  history_start_date date,
  daily_series jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with parameters as (
    select
      least(coalesce(p_anchor_date, (now() at time zone 'Asia/Seoul')::date), (now() at time zone 'Asia/Seoul')::date) as as_of_date,
      (now() at time zone 'Asia/Seoul')::date as today_date
  ),
  windows as (
    select
      parameters.*,
      least(parameters.as_of_date + 6, parameters.today_date) as wau_observed_through,
      least(parameters.as_of_date + 29, parameters.today_date) as mau_observed_through
    from parameters
  ),
  metric_counts as (
    select
      count(distinct identities.identity_hash) filter (
        where identities.identity_kind = 'member'
          and identities.activity_date = windows.as_of_date
      )::bigint as member_dau,
      count(distinct identities.identity_hash) filter (
        where identities.identity_kind = 'member'
          and identities.activity_date between windows.as_of_date and windows.wau_observed_through
      )::bigint as member_wau,
      count(distinct identities.identity_hash) filter (
        where identities.identity_kind = 'member'
          and identities.activity_date between windows.as_of_date and windows.mau_observed_through
      )::bigint as member_mau
    from windows
    left join public.platform_active_identities as identities
      on identities.activity_date between windows.as_of_date and windows.mau_observed_through
  ),
  day_series as (
    select
      series.activity_date::date as activity_date,
      count(distinct identities.identity_hash) filter (where identities.identity_kind = 'member')::bigint as member_active_count,
      count(distinct identities.identity_hash) filter (where identities.identity_kind = 'guest_session')::bigint as guest_session_count,
      count(distinct future_identity.identity_hash) filter (
        where future_identity.identity_kind = 'member'
          and future_identity.activity_date between series.activity_date::date and least(series.activity_date::date + 6, windows.today_date)
      )::bigint as member_wau,
      count(distinct future_identity.identity_hash) filter (
        where future_identity.identity_kind = 'member'
          and future_identity.activity_date between series.activity_date::date and least(series.activity_date::date + 29, windows.today_date)
      )::bigint as member_mau
    from windows
    cross join lateral generate_series(windows.today_date - 83, windows.today_date, interval '1 day') as series(activity_date)
    left join public.platform_active_identities as identities
      on identities.activity_date = series.activity_date::date
    left join public.platform_active_identities as future_identity
      on future_identity.activity_date between series.activity_date::date and least(series.activity_date::date + 29, windows.today_date)
    group by series.activity_date, windows.today_date
  )
  select
    windows.as_of_date,
    windows.today_date,
    metric_counts.member_dau,
    metric_counts.member_wau,
    metric_counts.member_mau,
    windows.wau_observed_through,
    windows.mau_observed_through,
    (select min(activity_date) from public.platform_active_identities),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'activity_date', day_series.activity_date,
        'member_active_count', day_series.member_active_count,
        'guest_session_count', day_series.guest_session_count,
        'member_wau', day_series.member_wau,
        'member_mau', day_series.member_mau,
        'wau_observed_through', least(day_series.activity_date + 6, windows.today_date),
        'mau_observed_through', least(day_series.activity_date + 29, windows.today_date)
      ) order by day_series.activity_date), '[]'::jsonb) as daily_series
  from windows
  cross join metric_counts;
$$;

revoke all on function public.get_admin_forward_activity_metrics(date) from public;
revoke all on function public.get_admin_forward_activity_metrics(date) from anon;
revoke all on function public.get_admin_forward_activity_metrics(date) from authenticated;
grant execute on function public.get_admin_forward_activity_metrics(date) to service_role;
