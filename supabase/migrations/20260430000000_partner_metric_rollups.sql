create table if not exists partner_metric_rollups (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  metric_name text not null,
  granularity text not null,
  bucket_timezone text not null default 'Asia/Seoul',
  bucket_local_start timestamp without time zone,
  bucket_local_date date,
  bucket_local_dow smallint,
  metric_count integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_metric_rollups_granularity_check
    check (granularity in ('total', 'hour', 'day', 'weekday')),
  constraint partner_metric_rollups_bucket_shape_check
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
  constraint partner_metric_rollups_weekday_check
    check (bucket_local_dow is null or bucket_local_dow between 1 and 7)
);

comment on table partner_metric_rollups is
  'Derived brand metric rollups. Raw event_logs remain the source of truth.';

comment on column partner_metric_rollups.bucket_timezone is
  'Local aggregation timezone used for bucket columns. Stored in Asia/Seoul for now.';

create unique index if not exists partner_metric_rollups_total_unique_idx
  on partner_metric_rollups(partner_id, metric_name, bucket_timezone)
  where granularity = 'total';

create unique index if not exists partner_metric_rollups_hour_unique_idx
  on partner_metric_rollups(partner_id, metric_name, bucket_timezone, bucket_local_start)
  where granularity = 'hour';

create unique index if not exists partner_metric_rollups_day_unique_idx
  on partner_metric_rollups(partner_id, metric_name, bucket_timezone, bucket_local_date)
  where granularity = 'day';

create unique index if not exists partner_metric_rollups_weekday_unique_idx
  on partner_metric_rollups(partner_id, metric_name, bucket_timezone, bucket_local_dow)
  where granularity = 'weekday';

create index if not exists partner_metric_rollups_partner_metric_idx
  on partner_metric_rollups(partner_id, metric_name, granularity);

create index if not exists partner_metric_rollups_hour_lookup_idx
  on partner_metric_rollups(partner_id, metric_name, bucket_timezone, bucket_local_start desc)
  where granularity = 'hour';

create index if not exists partner_metric_rollups_day_lookup_idx
  on partner_metric_rollups(partner_id, metric_name, bucket_timezone, bucket_local_date desc)
  where granularity = 'day';

create index if not exists partner_metric_rollups_weekday_lookup_idx
  on partner_metric_rollups(partner_id, metric_name, bucket_timezone, bucket_local_dow)
  where granularity = 'weekday';

create or replace function is_partner_metric_event(event_name text)
returns boolean
language sql
immutable
as $$
  select event_name = any (
    array[
      'partner_detail_view',
      'partner_card_click',
      'partner_map_click',
      'reservation_click',
      'inquiry_click'
    ]
  )
$$;

with rollup_source as (
  select
    target_id::uuid as partner_id,
    event_name,
    count(*)::integer as metric_count
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and is_partner_metric_event(event_name)
  group by target_id::uuid, event_name
)
insert into partner_metric_rollups (
  partner_id,
  metric_name,
  granularity,
  bucket_timezone,
  metric_count
)
select
  partner_id,
  event_name,
  'total',
  'Asia/Seoul',
  metric_count
from rollup_source
on conflict (partner_id, metric_name, bucket_timezone)
  where granularity = 'total'
do update set
  metric_count = excluded.metric_count,
  updated_at = now();

with rollup_source as (
  select
    target_id::uuid as partner_id,
    event_name,
    date_trunc('hour', timezone('Asia/Seoul', coalesce(created_at, now()))) as bucket_local_start,
    count(*)::integer as metric_count
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and is_partner_metric_event(event_name)
  group by
    target_id::uuid,
    event_name,
    date_trunc('hour', timezone('Asia/Seoul', coalesce(created_at, now())))
)
insert into partner_metric_rollups (
  partner_id,
  metric_name,
  granularity,
  bucket_timezone,
  bucket_local_start,
  metric_count
)
select
  partner_id,
  event_name,
  'hour',
  'Asia/Seoul',
  bucket_local_start,
  metric_count
from rollup_source
on conflict (partner_id, metric_name, bucket_timezone, bucket_local_start)
  where granularity = 'hour'
do update set
  metric_count = excluded.metric_count,
  updated_at = now();

with rollup_source as (
  select
    target_id::uuid as partner_id,
    event_name,
    timezone('Asia/Seoul', coalesce(created_at, now()))::date as bucket_local_date,
    count(*)::integer as metric_count
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and is_partner_metric_event(event_name)
  group by
    target_id::uuid,
    event_name,
    timezone('Asia/Seoul', coalesce(created_at, now()))::date
)
insert into partner_metric_rollups (
  partner_id,
  metric_name,
  granularity,
  bucket_timezone,
  bucket_local_date,
  metric_count
)
select
  partner_id,
  event_name,
  'day',
  'Asia/Seoul',
  bucket_local_date,
  metric_count
from rollup_source
on conflict (partner_id, metric_name, bucket_timezone, bucket_local_date)
  where granularity = 'day'
do update set
  metric_count = excluded.metric_count,
  updated_at = now();

with rollup_source as (
  select
    target_id::uuid as partner_id,
    event_name,
    extract(isodow from timezone('Asia/Seoul', coalesce(created_at, now())))::smallint as bucket_local_dow,
    count(*)::integer as metric_count
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and is_partner_metric_event(event_name)
  group by
    target_id::uuid,
    event_name,
    extract(isodow from timezone('Asia/Seoul', coalesce(created_at, now())))::smallint
)
insert into partner_metric_rollups (
  partner_id,
  metric_name,
  granularity,
  bucket_timezone,
  bucket_local_dow,
  metric_count
)
select
  partner_id,
  event_name,
  'weekday',
  'Asia/Seoul',
  bucket_local_dow,
  metric_count
from rollup_source
on conflict (partner_id, metric_name, bucket_timezone, bucket_local_dow)
  where granularity = 'weekday'
do update set
  metric_count = excluded.metric_count,
  updated_at = now();

alter table partner_metric_rollups enable row level security;

revoke all on table partner_metric_rollups from anon;
revoke all on table partner_metric_rollups from authenticated;

create or replace function sync_partner_metric_rollups_from_event_logs()
returns trigger
language plpgsql
as $$
declare
  local_created_at timestamp without time zone;
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
    granularity,
    bucket_timezone,
    metric_count
  )
  values (
    new.target_id::uuid,
    new.event_name,
    'total',
    'Asia/Seoul',
    1
  )
  on conflict (partner_id, metric_name, bucket_timezone)
    where granularity = 'total'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    granularity,
    bucket_timezone,
    bucket_local_start,
    metric_count
  )
  values (
    new.target_id::uuid,
    new.event_name,
    'hour',
    'Asia/Seoul',
    local_created_at,
    1
  )
  on conflict (partner_id, metric_name, bucket_timezone, bucket_local_start)
    where granularity = 'hour'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    granularity,
    bucket_timezone,
    bucket_local_date,
    metric_count
  )
  values (
    new.target_id::uuid,
    new.event_name,
    'day',
    'Asia/Seoul',
    local_created_at::date,
    1
  )
  on conflict (partner_id, metric_name, bucket_timezone, bucket_local_date)
    where granularity = 'day'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    granularity,
    bucket_timezone,
    bucket_local_dow,
    metric_count
  )
  values (
    new.target_id::uuid,
    new.event_name,
    'weekday',
    'Asia/Seoul',
    extract(isodow from local_created_at)::smallint,
    1
  )
  on conflict (partner_id, metric_name, bucket_timezone, bucket_local_dow)
    where granularity = 'weekday'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists partner_metric_rollups_from_event_logs on event_logs;

create trigger partner_metric_rollups_from_event_logs
after insert on event_logs
for each row
execute function sync_partner_metric_rollups_from_event_logs();
