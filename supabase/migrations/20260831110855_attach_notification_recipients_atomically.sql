create or replace function public.attach_notification_recipients(
  p_notification_id uuid,
  p_recipient_member_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_recipient_ids uuid[];
  attached_at timestamp with time zone := pg_catalog.clock_timestamp();
begin
  if p_notification_id is null then
    raise exception using
      errcode = '22023',
      message = 'notification_recipient_attachment_invalid';
  end if;

  perform 1
  from public.notifications
  where id = p_notification_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'notification_not_found';
  end if;

  select coalesce(
    pg_catalog.array_agg(distinct recipients.member_id),
    '{}'::uuid[]
  )
  into normalized_recipient_ids
  from pg_catalog.unnest(
    coalesce(p_recipient_member_ids, '{}'::uuid[])
  ) as recipients(member_id)
  where recipients.member_id is not null;

  insert into public.member_notifications (
    notification_id,
    member_id,
    read_at,
    deleted_at,
    created_at,
    updated_at
  )
  select
    p_notification_id,
    recipients.member_id,
    null,
    null,
    attached_at,
    attached_at
  from pg_catalog.unnest(normalized_recipient_ids) as recipients(member_id)
  on conflict (notification_id, member_id) do nothing;

  insert into public.notification_deliveries (
    notification_id,
    member_id,
    channel,
    status,
    delivered_at,
    created_at,
    updated_at
  )
  select
    p_notification_id,
    recipients.member_id,
    'in_app',
    'sent',
    attached_at,
    attached_at,
    attached_at
  from pg_catalog.unnest(normalized_recipient_ids) as recipients(member_id)
  where not exists (
    select 1
    from public.notification_deliveries as existing_delivery
    where existing_delivery.notification_id = p_notification_id
      and existing_delivery.member_id = recipients.member_id
      and existing_delivery.channel = 'in_app'
  );

  return pg_catalog.cardinality(normalized_recipient_ids);
end;
$$;

revoke all on function public.attach_notification_recipients(uuid, uuid[]) from public;
revoke all on function public.attach_notification_recipients(uuid, uuid[]) from anon;
revoke all on function public.attach_notification_recipients(uuid, uuid[]) from authenticated;
grant execute on function public.attach_notification_recipients(uuid, uuid[]) to service_role;

create or replace function public.attach_notification_audience(
  p_notification_id uuid,
  p_scope text,
  p_generation integer,
  p_campus text,
  p_recipient_member_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_scope text := pg_catalog.btrim(coalesce(p_scope, ''));
  resolved_recipient_ids uuid[];
begin
  if normalized_scope not in ('all', 'year', 'campus', 'member')
    or (normalized_scope = 'year' and p_generation is null)
    or (
      normalized_scope = 'campus'
      and pg_catalog.btrim(coalesce(p_campus, '')) = ''
    ) then
    raise exception using
      errcode = '22023',
      message = 'notification_audience_attachment_invalid';
  end if;

  select coalesce(
    pg_catalog.array_agg(member.id order by member.id),
    '{}'::uuid[]
  )
  into resolved_recipient_ids
  from public.members as member
  where member.deleted_at is null
    and (
      normalized_scope = 'all'
      or (
      normalized_scope = 'year'
      and member.generation = p_generation
      )
      or (
      normalized_scope = 'campus'
      and member.campus = p_campus
      )
      or (
      normalized_scope = 'member'
      and member.id = any(coalesce(p_recipient_member_ids, '{}'::uuid[]))
      )
    );

  return public.attach_notification_recipients(
    p_notification_id,
    resolved_recipient_ids
  );
end;
$$;

revoke all on function public.attach_notification_audience(
  uuid, text, integer, text, uuid[]
) from public;
revoke all on function public.attach_notification_audience(
  uuid, text, integer, text, uuid[]
) from anon;
revoke all on function public.attach_notification_audience(
  uuid, text, integer, text, uuid[]
) from authenticated;
grant execute on function public.attach_notification_audience(
  uuid, text, integer, text, uuid[]
) to service_role;
