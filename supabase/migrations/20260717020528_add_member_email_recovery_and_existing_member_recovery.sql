-- Mattermost can be temporarily unavailable even though a member still knows
-- the local site password. Keep that recovery path constrained to a short
-- server-signed session and a one-time email proof; no full user session is
-- issued until the email ownership check has completed.
alter table public.member_email_challenges
  drop constraint if exists member_email_challenges_purpose_check;
alter table public.member_email_challenges
  add constraint member_email_challenges_purpose_check
  check (purpose in ('email_verify', 'email_change', 'email_recovery'));

alter table public.member_password_action_tokens
  drop constraint if exists member_password_action_tokens_purpose_check;
alter table public.member_password_action_tokens
  add constraint member_password_action_tokens_purpose_check
  check (
    purpose in (
      'graduate_initial_setup',
      'graduate_password_reset',
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition',
      'member_email_recovery_initial_setup'
    )
  );

alter table public.graduate_email_challenges
  add column if not exists request_kind text not null default 'graduate_signup';
alter table public.graduate_email_challenges
  drop constraint if exists graduate_email_challenges_request_kind_check;
alter table public.graduate_email_challenges
  add constraint graduate_email_challenges_request_kind_check
  check (request_kind in ('graduate_signup', 'existing_member_recovery'));

alter table public.graduate_verification_requests
  add column if not exists request_kind text not null default 'graduate_signup',
  add column if not exists recovery_member_id uuid references public.members(id) on delete restrict;
alter table public.graduate_verification_requests
  drop constraint if exists graduate_verification_requests_request_kind_check;
alter table public.graduate_verification_requests
  add constraint graduate_verification_requests_request_kind_check
  check (request_kind in ('graduate_signup', 'existing_member_recovery'));
alter table public.graduate_verification_requests
  drop constraint if exists graduate_verification_requests_recovery_member_approval_check;
alter table public.graduate_verification_requests
  add constraint graduate_verification_requests_recovery_member_approval_check
  check (
    request_kind <> 'existing_member_recovery'
    or status <> 'approved'
    or recovery_member_id is not null
  );

-- A recovery application and a new graduate application may use the same
-- email, but an applicant cannot create a second open request of the same
-- kind. The previous email-only index made the two independent flows block
-- one another.
drop index if exists public.graduate_verification_requests_open_email_idx;
create unique index if not exists graduate_verification_requests_open_email_kind_idx
  on public.graduate_verification_requests(email_normalized, request_kind)
  where status in ('draft', 'submitted', 'in_review', 'needs_resubmission');
create unique index if not exists graduate_verification_requests_recovery_member_once_idx
  on public.graduate_verification_requests(recovery_member_id)
  where request_kind = 'existing_member_recovery'
    and recovery_member_id is not null
    and status = 'approved';

create or replace function public.complete_member_email_recovery(
  p_member_id uuid,
  p_email_normalized text,
  p_email_reservation_hash text,
  p_code_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  challenge_row public.member_email_challenges%rowtype;
begin
  if p_email_normalized is null
    or p_email_normalized = ''
    or lower(btrim(p_email_normalized)) <> p_email_normalized
    or p_email_reservation_hash is null
    or p_email_reservation_hash !~ '^[0-9a-f]{64}$'
    or p_code_hash is null
    or p_code_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('verified', false, 'reason', 'invalid_request');
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    return jsonb_build_object('verified', false, 'reason', 'member_missing');
  end if;

  select * into challenge_row
  from public.member_email_challenges
  where member_id = p_member_id
    and email_normalized = p_email_normalized
    and purpose = 'email_recovery'
    and consumed_at is null
  order by created_at desc
  limit 1
  for update;
  if not found then
    return jsonb_build_object('verified', false, 'reason', 'invalid_code');
  end if;

  if challenge_row.expires_at <= now()
    or challenge_row.attempt_count >= 5 then
    update public.member_email_challenges
    set consumed_at = now()
    where id = challenge_row.id
      and consumed_at is null;
    return jsonb_build_object('verified', false, 'reason', 'invalid_code');
  end if;

  if challenge_row.code_hash <> p_code_hash then
    update public.member_email_challenges
    set attempt_count = least(5, challenge_row.attempt_count + 1),
        consumed_at = case
          when challenge_row.attempt_count + 1 >= 5 then now()
          else consumed_at
        end
    where id = challenge_row.id
      and consumed_at is null;
    return jsonb_build_object('verified', false, 'reason', 'invalid_code');
  end if;

  if exists (
    select 1
    from public.members member
    where member.email_normalized = p_email_normalized
      and member.id <> p_member_id
      and member.deleted_at is null
  ) then
    return jsonb_build_object('verified', false, 'reason', 'email_conflict');
  end if;

  if exists (
    select 1
    from public.member_identifier_reservations reservation
    where reservation.identifier_kind = 'email'
      and reservation.identifier_hash = p_email_reservation_hash
  ) then
    return jsonb_build_object('verified', false, 'reason', 'email_reserved');
  end if;

  update public.members
  set email = p_email_normalized,
      email_normalized = p_email_normalized,
      email_verified_at = now(),
      auth_session_version = auth_session_version + 1,
      updated_at = now()
  where id = p_member_id
    and deleted_at is null;

  update public.member_email_challenges
  set verified_at = now(),
      consumed_at = now(),
      attempt_count = challenge_row.attempt_count + 1
  where id = challenge_row.id
    and consumed_at is null;

  return jsonb_build_object(
    'verified', true,
    'mustChangePassword', coalesce(member_row.must_change_password, false)
  );
end;
$$;

alter table public.member_email_challenges enable row level security;
revoke all on table public.member_email_challenges from public;
revoke all on table public.member_email_challenges from anon;
revoke all on table public.member_email_challenges from authenticated;
revoke all on function public.complete_member_email_recovery(uuid, text, text, text) from public;
revoke all on function public.complete_member_email_recovery(uuid, text, text, text) from anon;
revoke all on function public.complete_member_email_recovery(uuid, text, text, text) from authenticated;
grant execute on function public.complete_member_email_recovery(uuid, text, text, text) to service_role;

create or replace function public.approve_graduate_verification(
  p_request_id uuid,
  p_admin_id uuid,
  p_document_number_hmac text,
  p_setup_token_hash text,
  p_setup_expires_at timestamp with time zone,
  p_existing_member_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_row public.graduate_verification_requests%rowtype;
  photo_row public.member_profile_images%rowtype;
  reviewer_profile_id uuid;
  target_member public.members%rowtype;
  resolved_member_id uuid;
  resolved_generation integer;
  setup_purpose text;
begin
  select * into request_row
  from public.graduate_verification_requests
  where id = p_request_id
  for update;
  if not found or request_row.status <> 'in_review' then
    raise exception 'graduate_verification_not_reviewable';
  end if;
  if request_row.profile_image_id is null then
    raise exception 'graduate_verification_profile_image_missing';
  end if;

  select * into photo_row
  from public.member_profile_images
  where id = request_row.profile_image_id
  for update;
  if not found or photo_row.status <> 'pending' then
    raise exception 'graduate_verification_profile_image_not_pending';
  end if;

  if exists (
    select 1
    from public.graduate_verification_requests request
    where request.document_number_hmac = p_document_number_hmac
      and request.id <> p_request_id
      and request.status = 'approved'
  ) then
    raise exception 'graduate_verification_document_exists';
  end if;

  select profile.id into reviewer_profile_id
  from public.admin_profiles profile
  where profile.member_id = p_admin_id
    and profile.is_active = true;
  if reviewer_profile_id is null then
    raise exception 'graduate_verification_admin_profile_missing';
  end if;

  if request_row.request_kind = 'existing_member_recovery' then
    if p_existing_member_id is null then
      raise exception 'graduate_verification_recovery_member_required';
    end if;

    select * into target_member
    from public.members
    where id = p_existing_member_id
      and deleted_at is null
    for update;
    if not found then
      raise exception 'graduate_verification_recovery_member_missing';
    end if;
    if exists (
      select 1
      from public.members member
      where member.email_normalized = request_row.email_normalized
        and member.id <> target_member.id
        and member.deleted_at is null
    ) then
      raise exception 'graduate_verification_email_exists';
    end if;
    if exists (
      select 1
      from public.graduate_verification_requests request
      where request.request_kind = 'existing_member_recovery'
        and request.recovery_member_id = target_member.id
        and request.id <> p_request_id
        and request.status = 'approved'
    ) then
      raise exception 'graduate_verification_recovery_member_already_linked';
    end if;

    update public.member_profile_images
    set status = 'superseded',
        delete_after = now() + interval '30 days',
        updated_at = now()
    where member_id = target_member.id
      and id <> photo_row.id
      and status = 'approved'
      and deleted_at is null;

    update public.members
    set email = request_row.email,
        email_normalized = request_row.email_normalized,
        email_verified_at = now(),
        must_change_password = true,
        active_profile_image_id = photo_row.id,
        profile_photo_review_status = 'approved',
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where id = target_member.id;

    resolved_member_id := target_member.id;
    setup_purpose := 'member_email_recovery_initial_setup';
  elsif request_row.request_kind = 'graduate_signup' then
    if exists (
      select 1
      from public.members member
      where member.email_normalized = request_row.email_normalized
        and member.deleted_at is null
    ) then
      raise exception 'graduate_verification_email_exists';
    end if;

    resolved_generation := coalesce(
      request_row.inferred_generation,
      request_row.inferred_cohort
    );
    if resolved_generation is null then
      raise exception 'graduate_verification_generation_missing';
    end if;

    insert into public.members (
      display_name,
      generation,
      campus,
      email,
      email_normalized,
      email_verified_at,
      must_change_password,
      graduate_verified_at,
      verification_source
    ) values (
      request_row.legal_name,
      resolved_generation,
      request_row.campus,
      request_row.email,
      request_row.email_normalized,
      now(),
      true,
      now(),
      'graduate_certificate'
    ) returning id into resolved_member_id;

    insert into public.graduate_profiles (
      member_id,
      verification_request_id,
      verified_at,
      verification_source
    ) values (
      resolved_member_id,
      request_row.id,
      now(),
      'graduate_certificate'
    );
    setup_purpose := 'graduate_initial_setup';
  else
    raise exception 'graduate_verification_request_kind_invalid';
  end if;

  update public.member_profile_images
  set member_id = resolved_member_id,
      source = 'graduate_verification',
      status = 'approved',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      updated_at = now()
  where id = photo_row.id;

  update public.graduate_verification_requests
  set status = 'approved',
      document_number_hmac = p_document_number_hmac,
      inferred_generation = coalesce(inferred_generation, inferred_cohort),
      recovery_member_id = case
        when request_kind = 'existing_member_recovery' then p_existing_member_id
        else null
      end,
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      decided_at = now(),
      certificate_delete_after = now() + interval '30 days',
      resubmission_targets = '{}',
      updated_at = now()
  where id = p_request_id;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    delivery_channel,
    token_hash,
    expires_at
  ) values (
    resolved_member_id,
    setup_purpose,
    'email',
    p_setup_token_hash,
    p_setup_expires_at
  );
  return resolved_member_id;
end;
$$;

-- Retain the old RPC signature for callers deployed immediately before this
-- migration, but make recovery approval impossible without an explicit member.
create or replace function public.approve_graduate_verification(
  p_request_id uuid,
  p_admin_id uuid,
  p_document_number_hmac text,
  p_setup_token_hash text,
  p_setup_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  return public.approve_graduate_verification(
    p_request_id,
    p_admin_id,
    p_document_number_hmac,
    p_setup_token_hash,
    p_setup_expires_at,
    null
  );
end;
$$;

revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone, uuid) from public;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone, uuid) from anon;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone, uuid) from authenticated;
grant execute on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone, uuid) to service_role;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from public;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from anon;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from authenticated;
grant execute on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) to service_role;

create or replace function public.reissue_graduate_initial_setup(
  p_request_id uuid,
  p_setup_token_hash text,
  p_setup_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_row public.graduate_verification_requests%rowtype;
  member_row public.members%rowtype;
  setup_purpose text;
begin
  select * into request_row
  from public.graduate_verification_requests
  where id = p_request_id
    and status = 'approved'
  for update;
  if not found then
    raise exception 'graduate_initial_setup_request_invalid';
  end if;

  if request_row.request_kind = 'existing_member_recovery' then
    select * into member_row
    from public.members
    where id = request_row.recovery_member_id
      and must_change_password = true
      and deleted_at is null
    for update;
    setup_purpose := 'member_email_recovery_initial_setup';
  else
    select member.* into member_row
    from public.members member
    join public.graduate_profiles profile
      on profile.member_id = member.id
    where member.email_normalized = request_row.email_normalized
      and member.must_change_password = true
      and member.deleted_at is null
    for update of member;
    setup_purpose := 'graduate_initial_setup';
  end if;
  if not found then
    raise exception 'graduate_initial_setup_already_completed';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = member_row.id
    and purpose = setup_purpose
    and consumed_at is null;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    delivery_channel,
    token_hash,
    expires_at
  ) values (
    member_row.id,
    setup_purpose,
    'email',
    p_setup_token_hash,
    p_setup_expires_at
  );
  return member_row.id;
end;
$$;

create or replace function public.complete_graduate_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.member_password_action_tokens%rowtype;
  member_row public.members%rowtype;
  token_id uuid;
  member_id uuid;
begin
  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in (
      'graduate_initial_setup',
      'graduate_password_reset',
      'member_email_recovery_initial_setup'
    )
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'graduate_password_action_invalid';
  end if;
  token_id := token_row.id;
  member_id := token_row.member_id;

  select * into member_row
  from public.members
  where id = member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'graduate_password_action_member_missing';
  end if;

  select * into token_row
  from public.member_password_action_tokens
  where id = token_id
    and token_hash = p_token_hash
    and purpose in (
      'graduate_initial_setup',
      'graduate_password_reset',
      'member_email_recovery_initial_setup'
    )
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'graduate_password_action_invalid';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where id = token_row.id;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      auth_session_version = auth_session_version + 1,
      updated_at = now()
  where id = token_row.member_id
    and deleted_at is null;
  if not found then
    raise exception 'graduate_password_action_member_missing';
  end if;

  return token_row.member_id;
end;
$$;

revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from public;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from anon;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) to service_role;
revoke all on function public.complete_graduate_password_action(text, text, text) from public;
revoke all on function public.complete_graduate_password_action(text, text, text) from anon;
revoke all on function public.complete_graduate_password_action(text, text, text) from authenticated;
grant execute on function public.complete_graduate_password_action(text, text, text) to service_role;
