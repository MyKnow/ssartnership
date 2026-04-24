create or replace function apply_partner_metric_event_rollups(
  input_partner_id uuid,
  input_event_name text,
  input_actor_type text,
  input_actor_id text,
  input_session_id text,
  input_created_at timestamp with time zone default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  local_created_at timestamp without time zone;
  resolved_visitor_key text;
  inserted_count integer;
begin
  if input_partner_id is null or not is_partner_metric_event(input_event_name) then
    return;
  end if;

  local_created_at := date_trunc(
    'hour',
    timezone('Asia/Seoul', coalesce(input_created_at, now()))
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
    input_partner_id,
    input_event_name,
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
    input_partner_id,
    input_event_name,
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
    input_partner_id,
    input_event_name,
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
    input_partner_id,
    input_event_name,
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

  if input_event_name = 'partner_detail_view' then
    resolved_visitor_key := partner_metric_visitor_key(
      input_actor_type,
      input_actor_id,
      input_session_id
    );

    if resolved_visitor_key is not null then
      insert into partner_metric_unique_visitors (
        partner_id,
        metric_name,
        granularity,
        bucket_timezone,
        visitor_key
      )
      values (
        input_partner_id,
        input_event_name,
        'total',
        'Asia/Seoul',
        resolved_visitor_key
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
          input_partner_id,
          input_event_name,
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
        input_partner_id,
        input_event_name,
        'hour',
        'Asia/Seoul',
        local_created_at,
        resolved_visitor_key
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
          input_partner_id,
          input_event_name,
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
        input_partner_id,
        input_event_name,
        'day',
        'Asia/Seoul',
        local_created_at::date,
        resolved_visitor_key
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
          input_partner_id,
          input_event_name,
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
        input_partner_id,
        input_event_name,
        'weekday',
        'Asia/Seoul',
        extract(isodow from local_created_at)::smallint,
        resolved_visitor_key
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
          input_partner_id,
          input_event_name,
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
end;
$$;

create or replace function apply_partner_metric_event(
  input_partner_id uuid,
  input_event_name text,
  input_actor_type text,
  input_actor_id text default null,
  input_session_id text default null,
  input_created_at timestamp with time zone default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform apply_partner_metric_event_rollups(
    input_partner_id,
    input_event_name,
    input_actor_type,
    input_actor_id,
    input_session_id,
    input_created_at
  );
end;
$$;

create or replace function reconcile_partner_metric_rollups(
  input_partner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row record;
begin
  if input_partner_id is null then
    return;
  end if;

  delete from partner_metric_rollups
  where partner_id = input_partner_id
    and is_partner_metric_event(metric_name);

  delete from partner_metric_unique_visitors
  where partner_id = input_partner_id
    and metric_name = 'partner_detail_view';

  for event_row in
    select
      target_id::uuid as partner_id,
      event_name,
      actor_type,
      actor_id,
      session_id,
      created_at
    from event_logs
    where target_type = 'partner'
      and target_id = input_partner_id::text
      and target_id is not null
      and is_partner_metric_event(event_name)
    order by created_at asc nulls last
  loop
    perform apply_partner_metric_event_rollups(
      event_row.partner_id,
      event_row.event_name,
      event_row.actor_type,
      event_row.actor_id,
      event_row.session_id,
      event_row.created_at
    );
  end loop;
end;
$$;

create or replace function sync_partner_metric_rollups_from_event_logs()
returns trigger
language plpgsql
as $$
begin
  if new.target_type <> 'partner' or new.target_id is null then
    return new;
  end if;

  perform apply_partner_metric_event_rollups(
    new.target_id::uuid,
    new.event_name,
    new.actor_type,
    new.actor_id,
    new.session_id,
    new.created_at
  );

  return new;
end;
$$;
