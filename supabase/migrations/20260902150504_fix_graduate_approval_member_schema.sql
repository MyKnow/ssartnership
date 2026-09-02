-- The recovery-aware approval RPC was introduced after the members table had
-- dropped its legacy verification and profile-image pointer columns. Redefine
-- the RPC against the canonical graduate_profiles and member_profile_images
-- ledgers so both signup and existing-member recovery approvals stay atomic.
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
      must_change_password
    ) values (
      request_row.legal_name,
      resolved_generation,
      request_row.campus,
      request_row.email,
      request_row.email_normalized,
      now(),
      true
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

-- Keep the five-argument signature for callers that predate member recovery.
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
