-- BEGIN CONSENT PROFILE TRANSACTIONS
create or replace function public.patch_member_notification_preferences_atomic(
  input_member_id uuid,
  input_enabled boolean,
  input_announcement_enabled boolean,
  input_new_partner_enabled boolean,
  input_expiring_partner_enabled boolean,
  input_review_enabled boolean,
  input_mm_enabled boolean,
  input_marketing_enabled boolean,
  input_ip_address text,
  input_user_agent text,
  input_marketing_policy_id uuid,
  input_marketing_policy_version integer
)
returns table (
  enabled boolean,
  announcement_enabled boolean,
  new_partner_enabled boolean,
  expiring_partner_enabled boolean,
  review_enabled boolean,
  mm_enabled boolean,
  marketing_enabled boolean
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_preferences public.push_preferences%rowtype;
  current_marketing_enabled boolean := false;
  active_push_subscription_count bigint := 0;
  active_marketing_policy_id uuid;
  active_marketing_policy_version integer;
  agreed_at timestamp with time zone := pg_catalog.clock_timestamp();
  next_enabled boolean;
  next_announcement_enabled boolean;
  next_new_partner_enabled boolean;
  next_expiring_partner_enabled boolean;
  next_review_enabled boolean;
  next_mm_enabled boolean;
  next_marketing_enabled boolean;
begin
  if input_member_id is null then
    raise exception using
      errcode = '22023',
      message = 'member_notification_preferences_invalid';
  end if;

  perform 1
  from public.members
  where id = input_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'member_not_found';
  end if;

  select *
  into current_preferences
  from public.push_preferences
  where member_id = input_member_id
  for update;

  current_marketing_enabled :=
    coalesce(current_preferences.marketing_enabled, false);

  select pg_catalog.count(*)
  into active_push_subscription_count
  from public.push_subscriptions
  where member_id = input_member_id
    and is_active = true;

  next_enabled :=
    coalesce(input_enabled, coalesce(current_preferences.enabled, false))
    and active_push_subscription_count > 0;
  next_announcement_enabled :=
    coalesce(
      input_announcement_enabled,
      coalesce(current_preferences.announcement_enabled, true)
    );
  next_new_partner_enabled :=
    coalesce(
      input_new_partner_enabled,
      coalesce(current_preferences.new_partner_enabled, true)
    );
  next_expiring_partner_enabled :=
    coalesce(
      input_expiring_partner_enabled,
      coalesce(current_preferences.expiring_partner_enabled, true)
    );
  next_review_enabled :=
    coalesce(
      input_review_enabled,
      coalesce(current_preferences.review_enabled, true)
    );
  next_mm_enabled :=
    coalesce(
      input_mm_enabled,
      coalesce(current_preferences.mm_enabled, true)
    );
  next_marketing_enabled :=
    coalesce(
      input_marketing_enabled,
      current_marketing_enabled
    );

  -- Consent requires explicit intent for exactly the immutable version reviewed.
  -- Locking that active row serializes us with a policy activation transaction.
  if input_marketing_enabled is true then
    if input_marketing_policy_id is null or input_marketing_policy_version is null
      or input_marketing_policy_version < 1 then
      raise exception using errcode = '22023', message = 'marketing_policy_confirmation_required';
    end if;
    select id, version
    into active_marketing_policy_id, active_marketing_policy_version
    from public.policy_documents
    where id = input_marketing_policy_id
      and version = input_marketing_policy_version
      and kind = 'marketing' and is_active = true
    for share;
    if not found then
      raise exception using errcode = 'P0001', message = 'marketing_policy_changed';
    end if;
  elsif input_marketing_policy_id is not null or input_marketing_policy_version is not null then
    raise exception using errcode = '22023', message = 'member_notification_preferences_invalid';
  end if;

  insert into public.push_preferences (
    member_id,
    enabled,
    announcement_enabled,
    new_partner_enabled,
    expiring_partner_enabled,
    review_enabled,
    mm_enabled,
    marketing_enabled,
    updated_at
  )
  values (
    input_member_id,
    next_enabled,
    next_announcement_enabled,
    next_new_partner_enabled,
    next_expiring_partner_enabled,
    next_review_enabled,
    next_mm_enabled,
    next_marketing_enabled,
    agreed_at
  )
  on conflict (member_id) do update
  set
    enabled = excluded.enabled,
    announcement_enabled = excluded.announcement_enabled,
    new_partner_enabled = excluded.new_partner_enabled,
    expiring_partner_enabled = excluded.expiring_partner_enabled,
    review_enabled = excluded.review_enabled,
    mm_enabled = excluded.mm_enabled,
    marketing_enabled = excluded.marketing_enabled,
    updated_at = excluded.updated_at;

  -- Unrelated patches and withdrawal preserve all historical consent evidence.
  -- A retry of a current opt-in is a no-op; a new opt-in after withdrawal records
  -- the fresh acceptance even if that immutable policy has prior evidence.
  if input_marketing_enabled is true and (
    not current_marketing_enabled or not exists (
      select 1 from public.member_policy_consents c
      where c.member_id = input_member_id
        and c.policy_document_id = active_marketing_policy_id
        and c.kind = 'marketing' and c.version = active_marketing_policy_version
    )
  ) then
    insert into public.member_policy_consents (
      member_id,
      policy_document_id,
      kind,
      version,
      agreed_at,
      ip_address,
      user_agent
    )
    values (
      input_member_id,
      active_marketing_policy_id,
      'marketing',
      active_marketing_policy_version,
      agreed_at,
      input_ip_address,
      input_user_agent
    )
    on conflict (member_id, policy_document_id) do update
    set
      kind = excluded.kind,
      version = excluded.version,
      agreed_at = excluded.agreed_at,
      ip_address = excluded.ip_address,
      user_agent = excluded.user_agent;
  end if;

  return query
  select
    next_enabled,
    next_announcement_enabled,
    next_new_partner_enabled,
    next_expiring_partner_enabled,
    next_review_enabled,
    next_mm_enabled,
    next_marketing_enabled and exists (
      select 1 from public.member_policy_consents c
      join public.policy_documents p on p.id = c.policy_document_id
      where c.member_id = input_member_id and c.kind = 'marketing'
        and p.kind = 'marketing' and p.is_active = true and c.version = p.version
    );
end;
$$;

revoke all on function public.patch_member_notification_preferences_atomic(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text, uuid, integer
) from public, anon, authenticated;
grant execute on function public.patch_member_notification_preferences_atomic(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text, uuid, integer
) to service_role;

-- Preserve the old signature for omission/withdrawal. Old clients cannot opt in
-- without reviewed-policy evidence, including stale full-state settings forms.
create or replace function public.update_member_push_preferences_atomic(
  input_member_id uuid,
  input_enabled boolean,
  input_announcement_enabled boolean,
  input_new_partner_enabled boolean,
  input_expiring_partner_enabled boolean,
  input_review_enabled boolean,
  input_mm_enabled boolean,
  input_marketing_enabled boolean,
  input_ip_address text,
  input_user_agent text
)
returns table (
  enabled boolean,
  announcement_enabled boolean,
  new_partner_enabled boolean,
  expiring_partner_enabled boolean,
  review_enabled boolean,
  mm_enabled boolean,
  marketing_enabled boolean
)
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select * from public.patch_member_notification_preferences_atomic(
    input_member_id, input_enabled, input_announcement_enabled,
    input_new_partner_enabled, input_expiring_partner_enabled, input_review_enabled,
    input_mm_enabled, input_marketing_enabled, input_ip_address, input_user_agent,
    null::uuid, null::integer
  );
$$;
revoke all on function public.update_member_push_preferences_atomic(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.update_member_push_preferences_atomic(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text
) to service_role;

create or replace function public.activate_member_profile_image_atomic(
  input_member_id uuid,
  input_image_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  target public.member_profile_images%rowtype;
  applied_at timestamptz;
begin
  perform 1 from public.members
  where id = input_member_id and deleted_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'profile_image_member_missing';
  end if;

  select * into target from public.member_profile_images
  where id = input_image_id and member_id = input_member_id
    and deleted_at is null and graduate_verification_request_id is null
    and source in ('legacy', 'mattermost') and status in ('pending', 'approved')
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'profile_image_not_activatable';
  end if;
  if target.status = 'approved' then
    return true;
  end if;

  applied_at := pg_catalog.clock_timestamp();
  update public.member_profile_images
  set status = 'superseded', delete_after = applied_at + interval '30 days', updated_at = applied_at
  where member_id = input_member_id and id <> input_image_id
    and status = 'approved' and deleted_at is null;

  update public.member_profile_images
  set status = 'approved', reviewed_at = applied_at, review_reason = null,
      delete_after = null, updated_at = applied_at
  where id = input_image_id;

  update public.members set updated_at = applied_at where id = input_member_id;
  return true;
end;
$$;
revoke all on function public.activate_member_profile_image_atomic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.activate_member_profile_image_atomic(uuid, uuid) to service_role;

-- Align admin replacement with automatic sync: lock member before image, then
-- revalidate the original pending target. Keep the active-admin review boundary.
create or replace function public.approve_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
  target_member_id uuid;
begin
  select member_id into target_member_id
  from public.member_profile_images
  where id = p_image_id and member_id is not null
    and graduate_verification_request_id is null and status = 'pending'
    and deleted_at is null;
  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;
  select * into member_row from public.members
  where id = target_member_id and deleted_at is null
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
  end if;
  select * into image_row from public.member_profile_images
  where id = p_image_id and member_id = member_row.id
    and graduate_verification_request_id is null and status = 'pending'
    and deleted_at is null
  for update;
  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;
  select id into reviewer_profile_id
  from public.admin_profiles
  where member_id = p_admin_id
    and is_active = true;
  if reviewer_profile_id is null then
    raise exception 'profile_image_admin_profile_missing';
  end if;

  update public.member_profile_images
  set status = 'superseded',
      delete_after = now() + interval '30 days',
      updated_at = now()
  where member_id = member_row.id
    and status = 'approved'
    and deleted_at is null;

  update public.member_profile_images
  set status = 'approved',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      updated_at = now()
  where id = image_row.id;

  update public.members
  set updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_member_profile_image_replacement(uuid, uuid) to service_role;

-- Rejection shares the same member-before-image order as approval.
create or replace function public.reject_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
  target_member_id uuid;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;
  select member_id into target_member_id
  from public.member_profile_images
  where id = p_image_id and member_id is not null
    and graduate_verification_request_id is null and status = 'pending';
  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;
  select * into member_row from public.members
  where id = target_member_id
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
  end if;
  select * into image_row from public.member_profile_images
  where id = p_image_id and member_id = member_row.id
    and graduate_verification_request_id is null and status = 'pending'
  for update;
  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;
  select id into reviewer_profile_id
  from public.admin_profiles
  where member_id = p_admin_id
    and is_active = true;
  if reviewer_profile_id is null then
    raise exception 'profile_image_admin_profile_missing';
  end if;

  update public.member_profile_images
  set status = 'rejected',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      review_reason = btrim(p_reason),
      reviewed_at = now(),
      delete_after = now() + interval '30 days',
      updated_at = now()
  where id = image_row.id;

  update public.members
  set updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_member_profile_image_replacement(uuid, uuid, text) to service_role;
-- END CONSENT PROFILE TRANSACTIONS

-- BEGIN WINNER DELIVERY
-- D2/D3 complete additive fragment for the database owner's integrated migration.
-- Requires the existing notification campaign/delivery schema and RPCs.
-- No historical rows are rewritten. Existing push signature/semantics retained.
-- Parent will stop Preview old writers before switching the application.
create unique index if not exists notification_deliveries_mattermost_v2_claim_unique
  on public.notification_deliveries(provider_idempotency_key)
  where provider = 'mattermost'
    and provider_idempotency_key like 'ssartnership:delivery:v2:%';

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
    or not ((p_channel is not distinct from 'push' and p_provider is not distinct from 'web_push')
      or (p_channel is not distinct from 'mm' and p_provider is not distinct from 'mattermost'))
    or (p_provider = 'mattermost' and normalized_idempotency_key is distinct from
      ('ssartnership:delivery:v2:' || p_notification_id::text || ':mm:' || p_member_id::text))
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

  if p_provider = 'web_push' then
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
  else
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
    'mm',
    'pending',
    null,
    'mattermost',
    nullif(pg_catalog.btrim(coalesce(p_provider_campaign_id, '')), ''),
    normalized_idempotency_key,
    'claimed',
    null,
    claim_time,
    claim_time
  )
  on conflict (provider_idempotency_key)
    where provider = 'mattermost'
      and provider_idempotency_key like 'ssartnership:delivery:v2:%'
  do nothing
  returning * into delivery_row;
  end if;

  if found then
    return pg_catalog.jsonb_build_object(
      'delivery_id', delivery_row.id,
      'disposition', 'claimed'
    );
  end if;

  select *
  into delivery_row
  from public.notification_deliveries
  where provider = p_provider
    and provider_idempotency_key = normalized_idempotency_key
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'notification_delivery_claim_conflict';
  end if;

  if delivery_row.notification_id <> p_notification_id
    or delivery_row.member_id is distinct from p_member_id
    or delivery_row.channel is distinct from p_channel
    or delivery_row.provider is distinct from p_provider
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
    or p_transition is null
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
      and ((channel = 'push' and provider = 'web_push')
        or (channel = 'mm' and provider = 'mattermost'
          and provider_idempotency_key =
            'ssartnership:delivery:v2:' || notification_id::text || ':mm:' || member_id::text))
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
      and ((channel = 'push' and provider = 'web_push')
        or (channel = 'mm' and provider = 'mattermost'
          and provider_idempotency_key =
            'ssartnership:delivery:v2:' || notification_id::text || ':mm:' || member_id::text))
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
      and ((channel = 'push' and provider = 'web_push')
        or (channel = 'mm' and provider = 'mattermost'
          and provider_idempotency_key =
            'ssartnership:delivery:v2:' || notification_id::text || ':mm:' || member_id::text))
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
      and ((channel = 'push' and provider = 'web_push')
        or (channel = 'mm' and provider = 'mattermost'
          and provider_idempotency_key =
            'ssartnership:delivery:v2:' || notification_id::text || ':mm:' || member_id::text))
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

-- Approved additional reserved-key identity guard; same 9-argument signature.
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

  -- The reserved winner namespace cannot be adopted by another campaign.
  if normalized_idempotency_key like 'event-reward:%' and (
    normalized_idempotency_key is distinct from
      ('event-reward:' || (p_metadata ->> 'eventRewardDrawId') || ':winner-notice:v1')
    or pg_catalog.btrim(coalesce(p_metadata ->> 'eventRewardDrawId', '')) = ''
    or pg_catalog.btrim(coalesce(p_metadata ->> 'eventSlug', '')) = ''
  ) then
    raise exception using
      errcode = '22023', message = 'notification_campaign_claim_invalid';
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

    if campaign_row.type <> p_type or (
      normalized_idempotency_key like 'event-reward:%' and (
        campaign_row.metadata ->> 'eventRewardDrawId' is distinct from p_metadata ->> 'eventRewardDrawId'
        or campaign_row.metadata ->> 'eventSlug' is distinct from p_metadata ->> 'eventSlug'
        or campaign_row.target_url is distinct from normalized_target_url
      )
    ) then
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
-- END WINNER DELIVERY

-- BEGIN UPLOAD LIFECYCLE
-- Review/signup references and cleanup share session row locks. Storage deletion
-- happens after the claim; it is not part of the PostgreSQL transaction.
create or replace function public.validate_partner_review_image_references()
returns trigger language plpgsql volatile security definer set search_path = pg_catalog, public
as $$
declare
  introduced_urls text[];
  image_row public.image_upload_sessions%rowtype;
  matched_urls text[] := '{}';
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'review_image_isolation_unsupported';
  end if;
  -- Anonymization detaches the author while preserving review content/media.
  -- It cannot introduce a URL or transfer ownership to another member.
  if TG_OP = 'UPDATE' and NEW.id is not distinct from OLD.id
    and NEW.partner_id is not distinct from OLD.partner_id
    and (NEW.member_id is not distinct from OLD.member_id
      or (NEW.member_id is null and NEW.images is not distinct from OLD.images)) then
    select coalesce(array_agg(distinct u), '{}') into introduced_urls
    from unnest(coalesce(NEW.images, '{}')) u where not (u = any(coalesce(OLD.images, '{}')));
  else
    select coalesce(array_agg(distinct u), '{}') into introduced_urls from unnest(coalesce(NEW.images, '{}')) u;
  end if;
  for image_row in
    select s.* from public.image_upload_sessions s
    where s.owner_kind = 'member' and s.owner_id = NEW.member_id::text and s.purpose = 'review'
      and s.final_url = any(introduced_urls)
    order by s.id for update
  loop
    if image_row.status <> 'attached' or image_row.role <> 'image'
      or image_row.attached_resource_type is distinct from 'partner_review'
      or image_row.attached_resource_id is distinct from NEW.id::text
      or image_row.final_bucket is distinct from 'review-media'
      or image_row.final_path is null
      or image_row.expires_at <= clock_timestamp() then
      raise exception 'review_image_reference_invalid';
    end if;
    matched_urls := array_append(matched_urls, image_row.final_url);
  end loop;
  if not (introduced_urls <@ matched_urls) then
    raise exception 'review_image_reference_invalid';
  end if;
  return NEW;
end;
$$;
create trigger partner_reviews_validate_image_references
before insert or update of images,id,member_id,partner_id on public.partner_reviews
for each row execute function public.validate_partner_review_image_references();
revoke all on function public.validate_partner_review_image_references() from public,anon,authenticated;

-- A pending signup approval is another durable upload reference. The application
-- already checks its owner; the DB invariant requires prepared, non-retired state.
create or replace function public.validate_signup_approval_image_reference()
returns trigger language plpgsql volatile security definer set search_path = pg_catalog, public
as $$
declare image_row public.image_upload_sessions%rowtype;
begin
  if NEW.profile_image_upload_id is null then return NEW; end if;
  if TG_OP = 'UPDATE' and NEW.profile_image_upload_id is not distinct from OLD.profile_image_upload_id then return NEW; end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'signup_image_isolation_unsupported';
  end if;
  select * into image_row from public.image_upload_sessions where id = NEW.profile_image_upload_id for update;
  if not found or image_row.purpose <> 'member-signup-profile' or image_row.owner_kind <> 'signup'
    or image_row.role <> 'profile' or image_row.status <> 'ready' or image_row.expires_at <= clock_timestamp() then
    raise exception 'signup_image_reference_invalid';
  end if;
  return NEW;
end;
$$;
create trigger member_signup_approval_validate_image_reference
before insert or update of profile_image_upload_id on public.member_signup_approval_requests
for each row execute function public.validate_signup_approval_image_reference();
revoke all on function public.validate_signup_approval_image_reference() from public,anon,authenticated;

-- Ledgered profile files outlive signup approval rows and remain protected until
-- the existing profile-retention owner marks the image deleted. Unledgered legacy
-- and Mattermost paths are unchanged; only common-upload paths join this fence.
create or replace function public.validate_member_profile_image_upload_reference()
returns trigger language plpgsql volatile security definer set search_path = pg_catalog, public
as $$
declare image_row public.image_upload_sessions%rowtype;
begin
  if TG_OP = 'UPDATE' and NEW.storage_path is not distinct from OLD.storage_path then return NEW; end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'profile_image_upload_isolation_unsupported';
  end if;
  for image_row in
    select s.* from public.image_upload_sessions s
    where s.final_bucket = 'member-profile-images' and s.final_path = NEW.storage_path
    order by s.id for update
  loop
    if image_row.status <> 'attached' then raise exception 'profile_image_upload_reference_invalid'; end if;
  end loop;
  return NEW;
end;
$$;
create trigger member_profile_images_validate_upload_reference
before insert or update of storage_path on public.member_profile_images
for each row execute function public.validate_member_profile_image_upload_reference();
revoke all on function public.validate_member_profile_image_upload_reference() from public,anon,authenticated;

create index if not exists image_upload_sessions_cleanup_tombstone_rotation_idx
  on public.image_upload_sessions(updated_at,id)
  where status = 'expired' and failure_code in ('review_cleanup_tombstone','image_cleanup_tombstone');

create or replace function public.claim_image_upload_cleanup(
  p_upload_id uuid default null,
  p_owner_kind text default null,
  p_owner_id text default null,
  p_purpose text default null,
  p_discard boolean default false,
  p_limit integer default 100
) returns table (
  id uuid, purpose text, storage_bucket text, storage_path text,
  source_storage_path text, final_bucket text, final_path text, final_url text,
  previous_status text, claim_updated_at timestamptz, cleanup_code text
) language plpgsql volatile security definer set search_path = pg_catalog, public
as $$
declare
  image_row public.image_upload_sessions%rowtype;
  claimed_row public.image_upload_sessions%rowtype;
  lane integer;
  lane_limit integer;
  first_lane integer;
  last_lane integer;
  old_status text;
  next_code text;
  now_at timestamptz := clock_timestamp();
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'image_cleanup_isolation_unsupported'; end if;
  if p_limit is null or p_limit not between 1 and 100 or p_discard is null then raise exception 'image_cleanup_parameters_invalid'; end if;
  if p_upload_id is null then
    if p_owner_kind is not null or p_owner_id is not null or p_purpose is not null or p_discard then
      raise exception 'image_cleanup_parameters_invalid';
    end if;
  elsif p_owner_kind is null or p_owner_id is null or p_purpose is null then
    raise exception 'image_cleanup_owner_required';
  end if;
  -- Three independent lanes reserve progress for ordinary expiry, review
  -- attachments, and retired paths which may receive a late Storage write.
  -- Tiny batches use one rotating pool instead of permanently starving a lane.
  first_lane := case when p_upload_id is null and p_limit < 3 then -1 else 0 end;
  last_lane := case when first_lane = -1 then -1 else 2 end;
  for lane in first_lane..last_lane loop
    lane_limit := case when p_upload_id is not null then 1 when lane = -1 then p_limit
      else p_limit / 3 + case when lane < p_limit % 3 then 1 else 0 end end;
    if lane_limit = 0 then continue; end if;
    -- Static state predicates let the retired-path lane use its partial ordered
    -- index even after PostgreSQL switches this function to a generic plan.
    for image_row in
      with ordinary as (
        select s.* from public.image_upload_sessions s
        where (p_upload_id is null or (s.id = p_upload_id and s.owner_kind = p_owner_kind and s.owner_id = p_owner_id and s.purpose = p_purpose))
          and lane in (-1,0) and s.status in ('signed','processing','ready','attaching','failed')
        and (p_discard or s.expires_at <= now_at or (s.status = 'signed' and s.signed_url_expires_at <= now_at))
        and not (s.purpose = 'review' and s.final_url is not null and exists (
          select 1 from public.partner_reviews r where s.final_url = any(r.images)
        ))
        and not (s.final_bucket = 'member-profile-images' and s.final_path is not null and exists (
          select 1 from public.member_profile_images i where i.storage_path = s.final_path and i.deleted_at is null
        ))
        and not (s.purpose = 'member-signup-profile' and exists (
          select 1 from public.member_signup_approval_requests a
          where a.profile_image_upload_id = s.id and a.status in ('pending','approved')
        ))
        order by s.updated_at,s.id limit lane_limit for update skip locked
      ),
      attached as (
        select s.* from public.image_upload_sessions s
        where (p_upload_id is null or (s.id = p_upload_id and s.owner_kind = p_owner_kind and s.owner_id = p_owner_id and s.purpose = p_purpose))
          and lane in (-1,1) and s.status = 'attached'
        and ((s.purpose = 'review' and (p_discard or s.expires_at <= now_at)) or (p_discard and s.purpose <> 'review'))
        and not (s.purpose = 'review' and s.final_url is not null and exists (
          select 1 from public.partner_reviews r where s.final_url = any(r.images)
        ))
        and not (s.final_bucket = 'member-profile-images' and s.final_path is not null and exists (
          select 1 from public.member_profile_images i where i.storage_path = s.final_path and i.deleted_at is null
        ))
        and not (s.purpose = 'member-signup-profile' and exists (
          select 1 from public.member_signup_approval_requests a
          where a.profile_image_upload_id = s.id and a.status in ('pending','approved')
        ))
        order by s.updated_at,s.id limit lane_limit for update skip locked
      ),
      tombstone as (
        select s.* from public.image_upload_sessions s
        where (p_upload_id is null or (s.id = p_upload_id and s.owner_kind = p_owner_kind and s.owner_id = p_owner_id and s.purpose = p_purpose))
          and lane in (-1,2) and s.status = 'expired'
        and s.failure_code in ('review_cleanup_tombstone','image_cleanup_tombstone')
        and s.updated_at <= now_at - interval '1 hour'
        and not (s.purpose = 'review' and s.final_url is not null and exists (
          select 1 from public.partner_reviews r where s.final_url = any(r.images)
        ))
        and not (s.final_bucket = 'member-profile-images' and s.final_path is not null and exists (
          select 1 from public.member_profile_images i where i.storage_path = s.final_path and i.deleted_at is null
        ))
        and not (s.purpose = 'member-signup-profile' and exists (
          select 1 from public.member_signup_approval_requests a
          where a.profile_image_upload_id = s.id and a.status in ('pending','approved')
        ))
        order by s.updated_at,s.id limit lane_limit for update skip locked
      )
      select candidate.* from (
        select * from ordinary union all select * from attached union all select * from tombstone
      ) candidate
      order by candidate.updated_at,candidate.id limit lane_limit
    loop
      -- Separate commands: these references must use a fresh snapshot AFTER the
      -- session lock. Never lock a review/approval row here (writer lock order).
      if image_row.purpose = 'review' and image_row.final_url is not null and exists (
        select 1 from public.partner_reviews r where image_row.final_url = any(r.images)
      ) then continue; end if;
      if image_row.purpose = 'member-signup-profile' and exists (
        select 1 from public.member_signup_approval_requests a
        where a.profile_image_upload_id = image_row.id and a.status in ('pending','approved')
      ) then continue; end if;
      if image_row.final_bucket = 'member-profile-images' and image_row.final_path is not null and exists (
        select 1 from public.member_profile_images i where i.storage_path = image_row.final_path and i.deleted_at is null
      ) then continue; end if;
      -- Preserve the original expiration through a failed tombstone re-sweep so
      -- acknowledgements cannot count the same session as newly expired twice.
      old_status := case when image_row.status = 'expired'
        or image_row.failure_code in ('review_cleanup_tombstone','image_cleanup_tombstone')
        then 'expired' else image_row.status end;
      next_code := case when old_status = 'expired' then
        case when image_row.purpose = 'review' then 'review_cleanup_tombstone' else 'image_cleanup_tombstone' end
        when image_row.purpose = 'review' then 'review_cleanup_pending' else 'cleanup_pending' end;
      update public.image_upload_sessions s set status = 'failed', failure_code = next_code,
        signed_url_expires_at = least(s.signed_url_expires_at, now_at), expires_at = least(s.expires_at,now_at)
      where s.id = image_row.id returning s.* into claimed_row;
      -- Existing updated_at trigger sets transaction timestamp; return the exact
      -- stored timestamp, not an independently generated client/clock token.
      return query select claimed_row.id,claimed_row.purpose,claimed_row.storage_bucket,claimed_row.storage_path,
        claimed_row.source_storage_path,claimed_row.final_bucket,claimed_row.final_path,claimed_row.final_url,
        old_status,claimed_row.updated_at,next_code;
    end loop;
  end loop;
end;
$$;
revoke all on function public.claim_image_upload_cleanup(uuid,text,text,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.claim_image_upload_cleanup(uuid,text,text,text,boolean,integer) to service_role;
-- END UPLOAD LIFECYCLE
