alter table partner_metric_rollups
  add column if not exists metric_kind text not null default 'pv';

alter table partner_metric_rollups
  drop constraint if exists partner_metric_rollups_metric_kind_check;
alter table partner_metric_rollups
  add constraint partner_metric_rollups_metric_kind_check
  check (metric_kind in ('pv', 'uv'));

update partner_metric_rollups
set metric_kind = 'pv'
where metric_kind is null;

drop index if exists partner_metric_rollups_total_unique_idx;
drop index if exists partner_metric_rollups_hour_unique_idx;
drop index if exists partner_metric_rollups_day_unique_idx;
drop index if exists partner_metric_rollups_weekday_unique_idx;
drop index if exists partner_metric_rollups_partner_metric_idx;
drop index if exists partner_metric_rollups_hour_lookup_idx;
drop index if exists partner_metric_rollups_day_lookup_idx;
drop index if exists partner_metric_rollups_weekday_lookup_idx;

create unique index if not exists partner_metric_rollups_total_unique_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone)
  where granularity = 'total';

create unique index if not exists partner_metric_rollups_hour_unique_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_start)
  where granularity = 'hour';

create unique index if not exists partner_metric_rollups_day_unique_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_date)
  where granularity = 'day';

create unique index if not exists partner_metric_rollups_weekday_unique_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_dow)
  where granularity = 'weekday';

create index if not exists partner_metric_rollups_partner_metric_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, granularity);

create index if not exists partner_metric_rollups_hour_lookup_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_start desc)
  where granularity = 'hour';

create index if not exists partner_metric_rollups_day_lookup_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_date desc)
  where granularity = 'day';

create index if not exists partner_metric_rollups_weekday_lookup_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_dow)
  where granularity = 'weekday';

create table if not exists partner_metric_unique_visitors (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  metric_name text not null,
  granularity text not null,
  bucket_timezone text not null default 'Asia/Seoul',
  bucket_local_start timestamp without time zone,
  bucket_local_date date,
  bucket_local_dow smallint,
  visitor_key text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_metric_unique_visitors_granularity_check
    check (granularity in ('total', 'hour', 'day', 'weekday')),
  constraint partner_metric_unique_visitors_bucket_shape_check
    check (
      (
        granularity = 'total'
        and bucket_local_start is null
        and bucket_local_date is null
        and bucket_local_dow is null
      )
      or (
        granularity = 'hour'
        and bucket_local_start is not null
        and bucket_local_date is null
        and bucket_local_dow is null
      )
      or (
        granularity = 'day'
        and bucket_local_start is null
        and bucket_local_date is not null
        and bucket_local_dow is null
      )
      or (
        granularity = 'weekday'
        and bucket_local_start is null
        and bucket_local_date is null
        and bucket_local_dow is not null
      )
    ),
  constraint partner_metric_unique_visitors_weekday_check
    check (bucket_local_dow is null or bucket_local_dow between 1 and 7)
);

comment on table partner_metric_unique_visitors is
  'Unique visitor buckets for partner detail UV rollups. Raw event_logs remain the source of truth.';

create unique index if not exists partner_metric_unique_visitors_total_unique_idx
  on partner_metric_unique_visitors(partner_id, metric_name, bucket_timezone, visitor_key)
  where granularity = 'total';

create unique index if not exists partner_metric_unique_visitors_hour_unique_idx
  on partner_metric_unique_visitors(partner_id, metric_name, bucket_timezone, bucket_local_start, visitor_key)
  where granularity = 'hour';

create unique index if not exists partner_metric_unique_visitors_day_unique_idx
  on partner_metric_unique_visitors(partner_id, metric_name, bucket_timezone, bucket_local_date, visitor_key)
  where granularity = 'day';

create unique index if not exists partner_metric_unique_visitors_weekday_unique_idx
  on partner_metric_unique_visitors(partner_id, metric_name, bucket_timezone, bucket_local_dow, visitor_key)
  where granularity = 'weekday';

create index if not exists partner_metric_unique_visitors_partner_metric_idx
  on partner_metric_unique_visitors(partner_id, metric_name, granularity);

alter table partner_metric_unique_visitors enable row level security;
revoke all on table partner_metric_unique_visitors from anon;
revoke all on table partner_metric_unique_visitors from authenticated;

create or replace function partner_metric_visitor_key(
  actor_type text,
  actor_id text,
  session_id text
)
returns text
language sql
immutable
as $$
  select coalesce(
    session_id,
    case when actor_id is not null then actor_type || ':' || actor_id end
  )
$$;

with detail_events as (
  select
    target_id::uuid as partner_id,
    event_name as metric_name,
    partner_metric_visitor_key(actor_type, actor_id, session_id) as visitor_key,
    date_trunc('hour', timezone('Asia/Seoul', coalesce(created_at, now()))) as bucket_local_start,
    timezone('Asia/Seoul', coalesce(created_at, now()))::date as bucket_local_date,
    extract(isodow from timezone('Asia/Seoul', coalesce(created_at, now())))::smallint as bucket_local_dow
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and event_name = 'partner_detail_view'
),
dedup_total as (
  select distinct partner_id, metric_name, visitor_key
  from detail_events
  where visitor_key is not null
)
insert into partner_metric_unique_visitors (
  partner_id,
  metric_name,
  granularity,
  bucket_timezone,
  visitor_key
)
select
  partner_id,
  metric_name,
  'total',
  'Asia/Seoul',
  visitor_key
from dedup_total
on conflict (partner_id, metric_name, bucket_timezone, visitor_key)
  where granularity = 'total'
do nothing;

with detail_events as (
  select
    target_id::uuid as partner_id,
    event_name as metric_name,
    partner_metric_visitor_key(actor_type, actor_id, session_id) as visitor_key,
    date_trunc('hour', timezone('Asia/Seoul', coalesce(created_at, now()))) as bucket_local_start,
    timezone('Asia/Seoul', coalesce(created_at, now()))::date as bucket_local_date,
    extract(isodow from timezone('Asia/Seoul', coalesce(created_at, now())))::smallint as bucket_local_dow
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and event_name = 'partner_detail_view'
),
dedup_hour as (
  select distinct partner_id, metric_name, bucket_local_start, visitor_key
  from detail_events
  where visitor_key is not null
)
insert into partner_metric_unique_visitors (
  partner_id,
  metric_name,
  granularity,
  bucket_timezone,
  bucket_local_start,
  visitor_key
)
select
  partner_id,
  metric_name,
  'hour',
  'Asia/Seoul',
  bucket_local_start,
  visitor_key
from dedup_hour
on conflict (partner_id, metric_name, bucket_timezone, bucket_local_start, visitor_key)
  where granularity = 'hour'
do nothing;

with detail_events as (
  select
    target_id::uuid as partner_id,
    event_name as metric_name,
    partner_metric_visitor_key(actor_type, actor_id, session_id) as visitor_key,
    date_trunc('hour', timezone('Asia/Seoul', coalesce(created_at, now()))) as bucket_local_start,
    timezone('Asia/Seoul', coalesce(created_at, now()))::date as bucket_local_date,
    extract(isodow from timezone('Asia/Seoul', coalesce(created_at, now())))::smallint as bucket_local_dow
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and event_name = 'partner_detail_view'
),
dedup_day as (
  select distinct partner_id, metric_name, bucket_local_date, visitor_key
  from detail_events
  where visitor_key is not null
)
insert into partner_metric_unique_visitors (
  partner_id,
  metric_name,
  granularity,
  bucket_timezone,
  bucket_local_date,
  visitor_key
)
select
  partner_id,
  metric_name,
  'day',
  'Asia/Seoul',
  bucket_local_date,
  visitor_key
from dedup_day
on conflict (partner_id, metric_name, bucket_timezone, bucket_local_date, visitor_key)
  where granularity = 'day'
do nothing;

with detail_events as (
  select
    target_id::uuid as partner_id,
    event_name as metric_name,
    partner_metric_visitor_key(actor_type, actor_id, session_id) as visitor_key,
    date_trunc('hour', timezone('Asia/Seoul', coalesce(created_at, now()))) as bucket_local_start,
    timezone('Asia/Seoul', coalesce(created_at, now()))::date as bucket_local_date,
    extract(isodow from timezone('Asia/Seoul', coalesce(created_at, now())))::smallint as bucket_local_dow
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and event_name = 'partner_detail_view'
),
dedup_weekday as (
  select distinct partner_id, metric_name, bucket_local_dow, visitor_key
  from detail_events
  where visitor_key is not null
)
insert into partner_metric_unique_visitors (
  partner_id,
  metric_name,
  granularity,
  bucket_timezone,
  bucket_local_dow,
  visitor_key
)
select
  partner_id,
  metric_name,
  'weekday',
  'Asia/Seoul',
  bucket_local_dow,
  visitor_key
from dedup_weekday
on conflict (partner_id, metric_name, bucket_timezone, bucket_local_dow, visitor_key)
  where granularity = 'weekday'
do nothing;

insert into partner_metric_rollups (
  partner_id,
  metric_name,
  metric_kind,
  granularity,
  bucket_timezone,
  metric_count
)
select
  partner_id,
  metric_name,
  'uv',
  'total',
  'Asia/Seoul',
  count(*)::integer
from partner_metric_unique_visitors
where granularity = 'total'
  and metric_name = 'partner_detail_view'
group by partner_id, metric_name
on conflict (partner_id, metric_name, metric_kind, bucket_timezone)
  where granularity = 'total'
do update set
  metric_count = excluded.metric_count,
  updated_at = now();

insert into partner_metric_rollups (
  partner_id,
  metric_name,
  metric_kind,
  granularity,
  bucket_timezone,
  bucket_local_start,
  metric_count
)
select
  partner_id,
  metric_name,
  'uv',
  'hour',
  'Asia/Seoul',
  bucket_local_start,
  count(*)::integer
from partner_metric_unique_visitors
where granularity = 'hour'
  and metric_name = 'partner_detail_view'
group by partner_id, metric_name, bucket_local_start
on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_start)
  where granularity = 'hour'
do update set
  metric_count = excluded.metric_count,
  updated_at = now();

insert into partner_metric_rollups (
  partner_id,
  metric_name,
  metric_kind,
  granularity,
  bucket_timezone,
  bucket_local_date,
  metric_count
)
select
  partner_id,
  metric_name,
  'uv',
  'day',
  'Asia/Seoul',
  bucket_local_date,
  count(*)::integer
from partner_metric_unique_visitors
where granularity = 'day'
  and metric_name = 'partner_detail_view'
group by partner_id, metric_name, bucket_local_date
on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_date)
  where granularity = 'day'
do update set
  metric_count = excluded.metric_count,
  updated_at = now();

insert into partner_metric_rollups (
  partner_id,
  metric_name,
  metric_kind,
  granularity,
  bucket_timezone,
  bucket_local_dow,
  metric_count
)
select
  partner_id,
  metric_name,
  'uv',
  'weekday',
  'Asia/Seoul',
  bucket_local_dow,
  count(*)::integer
from partner_metric_unique_visitors
where granularity = 'weekday'
  and metric_name = 'partner_detail_view'
group by partner_id, metric_name, bucket_local_dow
on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_dow)
  where granularity = 'weekday'
do update set
  metric_count = excluded.metric_count,
  updated_at = now();

create or replace function sync_partner_metric_rollups_from_event_logs()
returns trigger
language plpgsql
as $$
declare
  local_created_at timestamp without time zone;
  visitor_key text;
  inserted_count integer;
begin
  if new.target_type <> 'partner' or new.target_id is null then
    return new;
  end if;

  if not is_partner_metric_event(new.event_name) then
    return new;
  end if;

  local_created_at := date_trunc(
    'hour',
    timezone('Asia/Seoul', coalesce(new.created_at, now()))
  );

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    metric_kind,
    granularity,
    bucket_timezone,
    metric_count
  )
  values (
    new.target_id::uuid,
    new.event_name,
    'pv',
    'total',
    'Asia/Seoul',
    1
  )
  on conflict (partner_id, metric_name, metric_kind, bucket_timezone)
    where granularity = 'total'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    metric_kind,
    granularity,
    bucket_timezone,
    bucket_local_start,
    metric_count
  )
  values (
    new.target_id::uuid,
    new.event_name,
    'pv',
    'hour',
    'Asia/Seoul',
    local_created_at,
    1
  )
  on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_start)
    where granularity = 'hour'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    metric_kind,
    granularity,
    bucket_timezone,
    bucket_local_date,
    metric_count
  )
  values (
    new.target_id::uuid,
    new.event_name,
    'pv',
    'day',
    'Asia/Seoul',
    local_created_at::date,
    1
  )
  on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_date)
    where granularity = 'day'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    metric_kind,
    granularity,
    bucket_timezone,
    bucket_local_dow,
    metric_count
  )
  values (
    new.target_id::uuid,
    new.event_name,
    'pv',
    'weekday',
    'Asia/Seoul',
    extract(isodow from local_created_at)::smallint,
    1
  )
  on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_dow)
    where granularity = 'weekday'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  if new.event_name = 'partner_detail_view' then
    visitor_key := partner_metric_visitor_key(new.actor_type, new.actor_id, new.session_id);

    if visitor_key is not null then
      insert into partner_metric_unique_visitors (
        partner_id,
        metric_name,
        granularity,
        bucket_timezone,
        visitor_key
      )
      values (
        new.target_id::uuid,
        new.event_name,
        'total',
        'Asia/Seoul',
        visitor_key
      )
      on conflict (partner_id, metric_name, bucket_timezone, visitor_key)
        where granularity = 'total'
      do nothing;
      get diagnostics inserted_count = row_count;
      if inserted_count > 0 then
        insert into partner_metric_rollups (
          partner_id,
          metric_name,
          metric_kind,
          granularity,
          bucket_timezone,
          metric_count
        )
        values (
          new.target_id::uuid,
          new.event_name,
          'uv',
          'total',
          'Asia/Seoul',
          1
        )
        on conflict (partner_id, metric_name, metric_kind, bucket_timezone)
          where granularity = 'total'
        do update set
          metric_count = partner_metric_rollups.metric_count + 1,
          updated_at = now();
      end if;

      insert into partner_metric_unique_visitors (
        partner_id,
        metric_name,
        granularity,
        bucket_timezone,
        bucket_local_start,
        visitor_key
      )
      values (
        new.target_id::uuid,
        new.event_name,
        'hour',
        'Asia/Seoul',
        local_created_at,
        visitor_key
      )
      on conflict (partner_id, metric_name, bucket_timezone, bucket_local_start, visitor_key)
        where granularity = 'hour'
      do nothing;
      get diagnostics inserted_count = row_count;
      if inserted_count > 0 then
        insert into partner_metric_rollups (
          partner_id,
          metric_name,
          metric_kind,
          granularity,
          bucket_timezone,
          bucket_local_start,
          metric_count
        )
        values (
          new.target_id::uuid,
          new.event_name,
          'uv',
          'hour',
          'Asia/Seoul',
          local_created_at,
          1
        )
        on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_start)
          where granularity = 'hour'
        do update set
          metric_count = partner_metric_rollups.metric_count + 1,
          updated_at = now();
      end if;

      insert into partner_metric_unique_visitors (
        partner_id,
        metric_name,
        granularity,
        bucket_timezone,
        bucket_local_date,
        visitor_key
      )
      values (
        new.target_id::uuid,
        new.event_name,
        'day',
        'Asia/Seoul',
        local_created_at::date,
        visitor_key
      )
      on conflict (partner_id, metric_name, bucket_timezone, bucket_local_date, visitor_key)
        where granularity = 'day'
      do nothing;
      get diagnostics inserted_count = row_count;
      if inserted_count > 0 then
        insert into partner_metric_rollups (
          partner_id,
          metric_name,
          metric_kind,
          granularity,
          bucket_timezone,
          bucket_local_date,
          metric_count
        )
        values (
          new.target_id::uuid,
          new.event_name,
          'uv',
          'day',
          'Asia/Seoul',
          local_created_at::date,
          1
        )
        on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_date)
          where granularity = 'day'
        do update set
          metric_count = partner_metric_rollups.metric_count + 1,
          updated_at = now();
      end if;

      insert into partner_metric_unique_visitors (
        partner_id,
        metric_name,
        granularity,
        bucket_timezone,
        bucket_local_dow,
        visitor_key
      )
      values (
        new.target_id::uuid,
        new.event_name,
        'weekday',
        'Asia/Seoul',
        extract(isodow from local_created_at)::smallint,
        visitor_key
      )
      on conflict (partner_id, metric_name, bucket_timezone, bucket_local_dow, visitor_key)
        where granularity = 'weekday'
      do nothing;
      get diagnostics inserted_count = row_count;
      if inserted_count > 0 then
        insert into partner_metric_rollups (
          partner_id,
          metric_name,
          metric_kind,
          granularity,
          bucket_timezone,
          bucket_local_dow,
          metric_count
        )
        values (
          new.target_id::uuid,
          new.event_name,
          'uv',
          'weekday',
          'Asia/Seoul',
          extract(isodow from local_created_at)::smallint,
          1
        )
        on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_dow)
          where granularity = 'weekday'
        do update set
          metric_count = partner_metric_rollups.metric_count + 1,
          updated_at = now();
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists partner_metric_rollups_from_event_logs on event_logs;
create trigger partner_metric_rollups_from_event_logs
  after insert on event_logs
  for each row
  execute function sync_partner_metric_rollups_from_event_logs();
