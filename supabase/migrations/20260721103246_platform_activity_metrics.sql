-- Keep a private, daily deduplicated activity projection for administrator MAU.
-- Raw event_logs remain the source of truth and the matching data backfill is
-- intentionally kept in the next migration.

create table if not exists public.platform_active_identities (
  activity_date date not null,
  identity_kind text not null,
  identity_hash text not null,
  first_event_at timestamp with time zone not null,
  last_event_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (activity_date, identity_kind, identity_hash),
  constraint platform_active_identities_kind_check
    check (identity_kind in ('member', 'guest_session'))
);

comment on table public.platform_active_identities is
  'Private daily active identity projection. It stores one-way identity hashes only; raw event_logs remain the source of truth.';

alter table public.platform_active_identities enable row level security;
revoke all on table public.platform_active_identities from anon;
revoke all on table public.platform_active_identities from authenticated;

create or replace function public.platform_activity_identity_key(
  input_actor_type text,
  input_actor_id text,
  input_session_id text
)
returns table (
  identity_kind text,
  identity_hash text
)
language sql
immutable
set search_path = pg_catalog
as $$
  select
    'member'::text as identity_kind,
    md5('member:' || btrim(input_actor_id)) as identity_hash
  where input_actor_type = 'member'
    and nullif(btrim(input_actor_id), '') is not null

  union all

  select
    'guest_session'::text as identity_kind,
    md5('guest_session:' || btrim(input_session_id)) as identity_hash
  where input_actor_type = 'guest'
    and nullif(btrim(input_session_id), '') is not null;
$$;

create or replace function public.sync_platform_activity_from_event_logs()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  activity_timestamp timestamp with time zone := coalesce(new.recorded_at, new.created_at, now());
begin
  insert into public.platform_active_identities (
    activity_date,
    identity_kind,
    identity_hash,
    first_event_at,
    last_event_at
  )
  select
    (activity_timestamp at time zone 'Asia/Seoul')::date,
    identity.identity_kind,
    identity.identity_hash,
    activity_timestamp,
    activity_timestamp
  from public.platform_activity_identity_key(
    new.actor_type,
    new.actor_id,
    new.session_id
  ) as identity
  on conflict (activity_date, identity_kind, identity_hash)
  do update
  set
    first_event_at = least(
      public.platform_active_identities.first_event_at,
      excluded.first_event_at
    ),
    last_event_at = greatest(
      public.platform_active_identities.last_event_at,
      excluded.last_event_at
    ),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists platform_activity_from_event_logs on public.event_logs;
create trigger platform_activity_from_event_logs
  after insert on public.event_logs
  for each row
  execute function public.sync_platform_activity_from_event_logs();

revoke all on function public.sync_platform_activity_from_event_logs() from public;
revoke all on function public.sync_platform_activity_from_event_logs() from anon;
revoke all on function public.sync_platform_activity_from_event_logs() from authenticated;
grant execute on function public.sync_platform_activity_from_event_logs() to service_role;

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
  daily_activity as (
    select
      series.activity_date,
      count(recent_activity.identity_hash) filter (
        where recent_activity.identity_kind = 'member'
      )::bigint as member_active_count,
      count(recent_activity.identity_hash) filter (
        where recent_activity.identity_kind = 'guest_session'
      )::bigint as guest_session_count
    from parameters
    cross join lateral generate_series(
      parameters.as_of_date - 29,
      parameters.as_of_date,
      interval '1 day'
    ) as series(activity_date)
    left join recent_activity
      on recent_activity.activity_date = series.activity_date::date
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

revoke all on function public.platform_activity_identity_key(text, text, text) from public;
revoke all on function public.platform_activity_identity_key(text, text, text) from anon;
revoke all on function public.platform_activity_identity_key(text, text, text) from authenticated;
grant execute on function public.platform_activity_identity_key(text, text, text) to service_role;

revoke all on function public.get_admin_platform_activity_metrics() from public;
revoke all on function public.get_admin_platform_activity_metrics() from anon;
revoke all on function public.get_admin_platform_activity_metrics() from authenticated;
grant execute on function public.get_admin_platform_activity_metrics() to service_role;
