begin;

delete from partner_metric_rollups
where metric_name in (
  'partner_detail_view',
  'partner_card_click',
  'partner_map_click',
  'reservation_click',
  'inquiry_click'
);

delete from partner_metric_unique_visitors
where metric_name = 'partner_detail_view';

with partner_events as (
  select
    target_id::uuid as partner_id,
    event_name,
    timezone('Asia/Seoul', coalesce(created_at, now())) as local_created_at
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and event_name in (
      'partner_detail_view',
      'partner_card_click',
      'partner_map_click',
      'reservation_click',
      'inquiry_click'
    )
)
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
  event_name,
  'pv',
  'total',
  'Asia/Seoul',
  count(*)
from partner_events
group by partner_id, event_name;

with partner_events as (
  select
    target_id::uuid as partner_id,
    event_name,
    date_trunc('hour', timezone('Asia/Seoul', coalesce(created_at, now()))) as bucket_local_start
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and event_name in (
      'partner_detail_view',
      'partner_card_click',
      'partner_map_click',
      'reservation_click',
      'inquiry_click'
    )
)
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
  event_name,
  'pv',
  'hour',
  'Asia/Seoul',
  bucket_local_start,
  count(*)
from partner_events
group by partner_id, event_name, bucket_local_start;

with partner_events as (
  select
    target_id::uuid as partner_id,
    event_name,
    timezone('Asia/Seoul', coalesce(created_at, now()))::date as bucket_local_date
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and event_name in (
      'partner_detail_view',
      'partner_card_click',
      'partner_map_click',
      'reservation_click',
      'inquiry_click'
    )
)
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
  event_name,
  'pv',
  'day',
  'Asia/Seoul',
  bucket_local_date,
  count(*)
from partner_events
group by partner_id, event_name, bucket_local_date;

with partner_events as (
  select
    target_id::uuid as partner_id,
    event_name,
    extract(isodow from timezone('Asia/Seoul', coalesce(created_at, now())))::smallint as bucket_local_dow
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and event_name in (
      'partner_detail_view',
      'partner_card_click',
      'partner_map_click',
      'reservation_click',
      'inquiry_click'
    )
)
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
  event_name,
  'pv',
  'weekday',
  'Asia/Seoul',
  bucket_local_dow,
  count(*)
from partner_events
group by partner_id, event_name, bucket_local_dow;

with partner_detail_events as (
  select
    target_id::uuid as partner_id,
    event_name,
    timezone('Asia/Seoul', coalesce(created_at, now())) as local_created_at,
    partner_metric_visitor_key(actor_type, actor_id, session_id) as visitor_key
  from event_logs
  where target_type = 'partner'
    and target_id is not null
    and event_name = 'partner_detail_view'
),
unique_events as (
  select distinct
    partner_id,
    event_name,
    'total'::text as granularity,
    'Asia/Seoul'::text as bucket_timezone,
    null::timestamp without time zone as bucket_local_start,
    null::date as bucket_local_date,
    null::smallint as bucket_local_dow,
    visitor_key
  from partner_detail_events
  where visitor_key is not null

  union all

  select distinct
    partner_id,
    event_name,
    'hour'::text as granularity,
    'Asia/Seoul'::text as bucket_timezone,
    date_trunc('hour', local_created_at) as bucket_local_start,
    null::date as bucket_local_date,
    null::smallint as bucket_local_dow,
    visitor_key
  from partner_detail_events
  where visitor_key is not null

  union all

  select distinct
    partner_id,
    event_name,
    'day'::text as granularity,
    'Asia/Seoul'::text as bucket_timezone,
    null::timestamp without time zone as bucket_local_start,
    local_created_at::date as bucket_local_date,
    null::smallint as bucket_local_dow,
    visitor_key
  from partner_detail_events
  where visitor_key is not null

  union all

  select distinct
    partner_id,
    event_name,
    'weekday'::text as granularity,
    'Asia/Seoul'::text as bucket_timezone,
    null::timestamp without time zone as bucket_local_start,
    null::date as bucket_local_date,
    extract(isodow from local_created_at)::smallint as bucket_local_dow,
    visitor_key
  from partner_detail_events
  where visitor_key is not null
)
insert into partner_metric_unique_visitors (
  partner_id,
  metric_name,
  granularity,
  bucket_timezone,
  bucket_local_start,
  bucket_local_date,
  bucket_local_dow,
  visitor_key
)
select
  partner_id,
  event_name,
  granularity,
  bucket_timezone,
  bucket_local_start,
  bucket_local_date,
  bucket_local_dow,
  visitor_key
from unique_events;

with unique_rows as (
  select
    partner_id,
    metric_name,
    granularity,
    bucket_timezone,
    bucket_local_start,
    bucket_local_date,
    bucket_local_dow,
    count(*) as metric_count
  from partner_metric_unique_visitors
  where metric_name = 'partner_detail_view'
  group by
    partner_id,
    metric_name,
    granularity,
    bucket_timezone,
    bucket_local_start,
    bucket_local_date,
    bucket_local_dow
)
insert into partner_metric_rollups (
  partner_id,
  metric_name,
  metric_kind,
  granularity,
  bucket_timezone,
  bucket_local_start,
  bucket_local_date,
  bucket_local_dow,
  metric_count
)
select
  partner_id,
  metric_name,
  'uv',
  granularity,
  bucket_timezone,
  bucket_local_start,
  bucket_local_date,
  bucket_local_dow,
  metric_count
from unique_rows;

commit;
