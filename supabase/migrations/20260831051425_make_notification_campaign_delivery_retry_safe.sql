create unique index if not exists notification_deliveries_web_push_idempotency_unique
  on public.notification_deliveries(provider_idempotency_key)
  where provider = 'web_push'
    and provider_idempotency_key is not null;

create or replace function public.claim_notification_campaign(
  p_type text,
  p_title text,
  p_body text,
  p_target_url text,
  p_metadata jsonb,
  p_created_by_member_id uuid,
  p_idempotency_key text,
  p_recipient_member_ids uuid[],
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  campaign_row public.notifications%rowtype;
  normalized_idempotency_key text := pg_catalog.btrim(
    coalesce(p_idempotency_key, '')
  );
  normalized_target_url text := pg_catalog.btrim(coalesce(p_target_url, ''));
  normalized_recipient_ids uuid[];
  claim_time timestamp with time zone := pg_catalog.clock_timestamp();
  lease_expires_at timestamp with time zone;
  existing_lease_expires_at timestamp with time zone;
  attempt_token text := pg_catalog.gen_random_uuid()::text;
  campaign_status text;
  claim_disposition text;
  claimed_metadata jsonb;
begin
  if p_type is null
    or pg_catalog.btrim(p_type) = ''
    or p_title is null
    or pg_catalog.btrim(p_title) = ''
    or p_body is null
    or pg_catalog.btrim(p_body) = ''
    or normalized_target_url = ''
    or pg_catalog.left(normalized_target_url, 1) <> '/'
    or pg_catalog.left(normalized_target_url, 2) = '//'
    or normalized_idempotency_key = ''
    or p_lease_seconds is null
    or p_lease_seconds < 30
    or p_lease_seconds > 3600 then
    raise exception using
      errcode = '22023',
      message = 'notification_campaign_claim_invalid';
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

  lease_expires_at :=
    claim_time + pg_catalog.make_interval(secs => p_lease_seconds);
  claimed_metadata :=
    (
      coalesce(p_metadata, '{}'::jsonb)
      - 'completedAt'
      - 'channelResults'
      - 'warnings'
    )
    || pg_catalog.jsonb_build_object(
      'adminOperationIdempotencyKey', normalized_idempotency_key,
      'campaignStatus', 'pending',
      'campaignAttemptToken', attempt_token,
      'campaignClaimedAt', claim_time,
      'campaignLeaseExpiresAt', lease_expires_at
    );

  insert into public.notifications (
    type,
    title,
    body,
    target_url,
    metadata,
    created_by_member_id,
    idempotency_key
  )
  values (
    p_type,
    p_title,
    p_body,
    normalized_target_url,
    claimed_metadata,
    p_created_by_member_id,
    normalized_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning * into campaign_row;

  if found then
    claim_disposition := 'claimed';
  else
    select *
    into campaign_row
    from public.notifications
    where idempotency_key = normalized_idempotency_key
    for update;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'notification_campaign_claim_conflict';
    end if;

    if campaign_row.type <> p_type then
      raise exception using
        errcode = '23505',
        message = 'notification_campaign_idempotency_conflict';
    end if;

    campaign_status :=
      coalesce(campaign_row.metadata ->> 'campaignStatus', '');
    if campaign_status in ('sent', 'no_target') then
      return pg_catalog.jsonb_build_object(
        'disposition', 'completed',
        'attempt_token', null,
        'notification', pg_catalog.to_jsonb(campaign_row),
        'recipient_member_ids', pg_catalog.to_jsonb('{}'::uuid[])
      );
    end if;

    begin
      existing_lease_expires_at := nullif(
        campaign_row.metadata ->> 'campaignLeaseExpiresAt',
        ''
      )::timestamp with time zone;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        existing_lease_expires_at := null;
    end;

    if campaign_status = 'pending'
      and existing_lease_expires_at is not null
      and existing_lease_expires_at > claim_time then
      return pg_catalog.jsonb_build_object(
        'disposition', 'in_progress',
        'attempt_token', null,
        'notification', pg_catalog.to_jsonb(campaign_row),
        'recipient_member_ids', pg_catalog.to_jsonb('{}'::uuid[])
      );
    end if;

    claim_disposition := 'resumed';
    update public.notifications
    set
      title = p_title,
      body = p_body,
      target_url = normalized_target_url,
      metadata =
        (
          coalesce(metadata, '{}'::jsonb)
          - 'completedAt'
          - 'channelResults'
          - 'warnings'
        )
        || (
          coalesce(p_metadata, '{}'::jsonb)
          - 'completedAt'
          - 'channelResults'
          - 'warnings'
        )
        || pg_catalog.jsonb_build_object(
          'adminOperationIdempotencyKey', normalized_idempotency_key,
          'campaignStatus', 'pending',
          'campaignAttemptToken', attempt_token,
          'campaignClaimedAt', claim_time,
          'campaignLeaseExpiresAt', lease_expires_at
        )
    where id = campaign_row.id
    returning * into campaign_row;
  end if;

  insert into public.member_notifications (
    notification_id,
    member_id,
    read_at,
    deleted_at,
    created_at,
    updated_at
  )
  select
    campaign_row.id,
    recipients.member_id,
    null,
    null,
    claim_time,
    claim_time
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
    campaign_row.id,
    recipients.member_id,
    'in_app',
    'sent',
    claim_time,
    claim_time,
    claim_time
  from pg_catalog.unnest(normalized_recipient_ids) as recipients(member_id)
  where not exists (
    select 1
    from public.notification_deliveries as existing_delivery
    where existing_delivery.notification_id = campaign_row.id
      and existing_delivery.member_id = recipients.member_id
      and existing_delivery.channel = 'in_app'
  );

  return pg_catalog.jsonb_build_object(
    'disposition', claim_disposition,
    'attempt_token', attempt_token,
    'notification', pg_catalog.to_jsonb(campaign_row),
    'recipient_member_ids', pg_catalog.to_jsonb(normalized_recipient_ids)
  );
end;
$$;

revoke all on function public.claim_notification_campaign(
  text, text, text, text, jsonb, uuid, text, uuid[], integer
) from public;
revoke all on function public.claim_notification_campaign(
  text, text, text, text, jsonb, uuid, text, uuid[], integer
) from anon;
revoke all on function public.claim_notification_campaign(
  text, text, text, text, jsonb, uuid, text, uuid[], integer
) from authenticated;
grant execute on function public.claim_notification_campaign(
  text, text, text, text, jsonb, uuid, text, uuid[], integer
) to service_role;

create or replace function public.finalize_notification_campaign(
  p_notification_id uuid,
  p_attempt_token text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  final_status text := coalesce(p_metadata ->> 'campaignStatus', '');
begin
  if p_notification_id is null
    or pg_catalog.btrim(coalesce(p_attempt_token, '')) = ''
    or final_status not in ('sent', 'partial_failed', 'failed', 'no_target') then
    raise exception using
      errcode = '22023',
      message = 'notification_campaign_finalize_invalid';
  end if;

  update public.notifications
  set metadata =
    coalesce(metadata, '{}'::jsonb)
    || coalesce(p_metadata, '{}'::jsonb)
    || pg_catalog.jsonb_build_object(
      'campaignAttemptToken', p_attempt_token,
      'campaignLeaseExpiresAt', null
    )
  where id = p_notification_id
    and metadata ->> 'campaignStatus' = 'pending'
    and metadata ->> 'campaignAttemptToken' = p_attempt_token;

  return found;
end;
$$;

revoke all on function public.finalize_notification_campaign(
  uuid, text, jsonb
) from public;
revoke all on function public.finalize_notification_campaign(
  uuid, text, jsonb
) from anon;
revoke all on function public.finalize_notification_campaign(
  uuid, text, jsonb
) from authenticated;
grant execute on function public.finalize_notification_campaign(
  uuid, text, jsonb
) to service_role;

create or replace function public.claim_notification_delivery(
  p_notification_id uuid,
  p_member_id uuid,
  p_channel text,
  p_provider text,
  p_provider_campaign_id text,
  p_provider_idempotency_key text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  delivery_row public.notification_deliveries%rowtype;
  normalized_idempotency_key text := pg_catalog.btrim(
    coalesce(p_provider_idempotency_key, '')
  );
  claim_time timestamp with time zone := pg_catalog.clock_timestamp();
  stale_before timestamp with time zone;
begin
  if p_notification_id is null
    or p_member_id is null
    or p_channel is distinct from 'push'
    or p_provider is distinct from 'web_push'
    or normalized_idempotency_key = ''
    or p_lease_seconds is null
    or p_lease_seconds < 30
    or p_lease_seconds > 3600 then
    raise exception using
      errcode = '22023',
      message = 'notification_delivery_claim_invalid';
  end if;

  stale_before :=
    claim_time - pg_catalog.make_interval(secs => p_lease_seconds);

  insert into public.notification_deliveries (
    notification_id,
    member_id,
    channel,
    status,
    error_message,
    provider,
    provider_campaign_id,
    provider_idempotency_key,
    provider_status,
    delivered_at,
    created_at,
    updated_at
  )
  values (
    p_notification_id,
    p_member_id,
    'push',
    'pending',
    null,
    'web_push',
    nullif(pg_catalog.btrim(coalesce(p_provider_campaign_id, '')), ''),
    normalized_idempotency_key,
    'claimed',
    null,
    claim_time,
    claim_time
  )
  on conflict (provider_idempotency_key)
    where provider = 'web_push'
      and provider_idempotency_key is not null
  do nothing
  returning * into delivery_row;

  if found then
    return pg_catalog.jsonb_build_object(
      'delivery_id', delivery_row.id,
      'disposition', 'claimed'
    );
  end if;

  select *
  into delivery_row
  from public.notification_deliveries
  where provider = 'web_push'
    and provider_idempotency_key = normalized_idempotency_key
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'notification_delivery_claim_conflict';
  end if;

  if delivery_row.notification_id <> p_notification_id
    or delivery_row.member_id is distinct from p_member_id
    or delivery_row.channel <> 'push'
    or delivery_row.provider_campaign_id is distinct from
      nullif(pg_catalog.btrim(coalesce(p_provider_campaign_id, '')), '') then
    raise exception using
      errcode = '23505',
      message = 'notification_delivery_idempotency_conflict';
  end if;

  if delivery_row.status = 'sent' then
    return pg_catalog.jsonb_build_object(
      'delivery_id', delivery_row.id,
      'disposition', 'sent'
    );
  end if;

  if delivery_row.provider_status = 'needs_reconciliation' then
    return pg_catalog.jsonb_build_object(
      'delivery_id', delivery_row.id,
      'disposition', 'needs_reconciliation'
    );
  end if;

  if delivery_row.status = 'failed' then
    update public.notification_deliveries
    set
      status = 'pending',
      error_message = null,
      provider_status = 'claimed',
      delivered_at = null,
      updated_at = claim_time
    where id = delivery_row.id;

    return pg_catalog.jsonb_build_object(
      'delivery_id', delivery_row.id,
      'disposition', 'claimed'
    );
  end if;

  if delivery_row.status = 'pending'
    and delivery_row.provider_status = 'claimed'
    and coalesce(delivery_row.updated_at, delivery_row.created_at) <= stale_before then
    update public.notification_deliveries
    set updated_at = claim_time
    where id = delivery_row.id;

    return pg_catalog.jsonb_build_object(
      'delivery_id', delivery_row.id,
      'disposition', 'claimed'
    );
  end if;

  if delivery_row.status = 'pending'
    and delivery_row.provider_status = 'sending'
    and coalesce(delivery_row.updated_at, delivery_row.created_at) <= stale_before then
    update public.notification_deliveries
    set
      provider_status = 'needs_reconciliation',
      error_message = 'provider_delivery_outcome_unknown',
      updated_at = claim_time
    where id = delivery_row.id;

    return pg_catalog.jsonb_build_object(
      'delivery_id', delivery_row.id,
      'disposition', 'needs_reconciliation'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'delivery_id', delivery_row.id,
    'disposition', 'in_progress'
  );
end;
$$;

revoke all on function public.claim_notification_delivery(
  uuid, uuid, text, text, text, text, integer
) from public;
revoke all on function public.claim_notification_delivery(
  uuid, uuid, text, text, text, text, integer
) from anon;
revoke all on function public.claim_notification_delivery(
  uuid, uuid, text, text, text, text, integer
) from authenticated;
grant execute on function public.claim_notification_delivery(
  uuid, uuid, text, text, text, text, integer
) to service_role;

create or replace function public.transition_notification_delivery(
  p_delivery_id uuid,
  p_transition text,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  transition_time timestamp with time zone := pg_catalog.clock_timestamp();
begin
  if p_delivery_id is null
    or p_transition not in (
      'sending',
      'sent',
      'failed',
      'needs_reconciliation'
    ) then
    raise exception using
      errcode = '22023',
      message = 'notification_delivery_transition_invalid';
  end if;

  if p_transition = 'sending' then
    update public.notification_deliveries
    set
      provider_status = 'sending',
      updated_at = transition_time
    where id = p_delivery_id
      and channel = 'push'
      and provider = 'web_push'
      and status = 'pending'
      and provider_status = 'claimed';
  elsif p_transition = 'sent' then
    update public.notification_deliveries
    set
      status = 'sent',
      error_message = null,
      provider_status = 'sent',
      delivered_at = transition_time,
      updated_at = transition_time
    where id = p_delivery_id
      and channel = 'push'
      and provider = 'web_push'
      and status = 'pending'
      and provider_status = 'sending';
  elsif p_transition = 'failed' then
    update public.notification_deliveries
    set
      status = 'failed',
      error_message = coalesce(
        nullif(p_error_message, ''),
        '푸시 알림 전송에 실패했습니다.'
      ),
      provider_status = 'failed',
      delivered_at = null,
      updated_at = transition_time
    where id = p_delivery_id
      and channel = 'push'
      and provider = 'web_push'
      and status = 'pending'
      and provider_status = 'sending';
  else
    update public.notification_deliveries
    set
      error_message = coalesce(
        nullif(p_error_message, ''),
        'provider_delivery_outcome_unknown'
      ),
      provider_status = 'needs_reconciliation',
      delivered_at = null,
      updated_at = transition_time
    where id = p_delivery_id
      and channel = 'push'
      and provider = 'web_push'
      and status = 'pending'
      and provider_status in ('claimed', 'sending');
  end if;

  return found;
end;
$$;

revoke all on function public.transition_notification_delivery(
  uuid, text, text
) from public;
revoke all on function public.transition_notification_delivery(
  uuid, text, text
) from anon;
revoke all on function public.transition_notification_delivery(
  uuid, text, text
) from authenticated;
grant execute on function public.transition_notification_delivery(
  uuid, text, text
) to service_role;
