-- Phase 1 / backfill. Every statement is idempotent so Preview retries are
-- safe; ambiguous external identities are deliberately left unlinked.
update public.members
set generation = year
where generation is null;

update public.members
set staff_source_generation = staff_source_year
where staff_source_generation is null
  and staff_source_year is not null;

insert into public.mm_user_directory (
  mm_user_id,
  mm_username,
  display_name,
  campus,
  is_staff,
  source_years,
  display_name_snapshot,
  campus_snapshot,
  source_generations,
  is_active,
  last_seen_at,
  synced_at,
  updated_at
)
select
  member.mm_user_id,
  lower(btrim(member.mm_username)),
  coalesce(nullif(btrim(member.display_name), ''), lower(btrim(member.mm_username))),
  member.campus,
  member.year = 0,
  case when member.year = 0 then array[coalesce(member.staff_source_year, 0)] else array[member.year] end,
  coalesce(nullif(btrim(member.display_name), ''), lower(btrim(member.mm_username))),
  member.campus,
  case when member.year = 0 then array[coalesce(member.staff_source_year, 0)] else array[member.year] end,
  true,
  coalesce(member.updated_at, member.created_at, now()),
  coalesce(member.updated_at, member.created_at, now()),
  now()
from public.members member
where member.mm_user_id is not null
  and member.mm_username is not null
  and btrim(member.mm_username) <> ''
  and not exists (
    select 1
    from public.mm_user_directory existing_username
    where existing_username.mm_username = lower(btrim(member.mm_username))
      and existing_username.mm_user_id <> member.mm_user_id
  )
on conflict do nothing;

update public.mm_user_directory
set
  display_name_snapshot = coalesce(display_name_snapshot, display_name),
  campus_snapshot = coalesce(campus_snapshot, campus),
  source_generations = case
    when coalesce(array_length(source_generations, 1), 0) > 0 then source_generations
    else source_years
  end,
  last_seen_at = coalesce(last_seen_at, synced_at, updated_at, created_at),
  is_active = coalesce(is_active, true);

update public.mm_user_directory directory
set legacy_ssafy_mattermost_user_id = member.ssafy_mattermost_user_id,
    updated_at = now()
from public.members member
where directory.mm_user_id = member.mm_user_id
  and directory.legacy_ssafy_mattermost_user_id is null
  and member.ssafy_mattermost_user_id is not null
  and not exists (
    select 1
    from public.mm_user_directory conflicting_directory
    where conflicting_directory.legacy_ssafy_mattermost_user_id = member.ssafy_mattermost_user_id
      and conflicting_directory.id <> directory.id
  );

update public.members member
set mattermost_account_id = directory.id
from public.mm_user_directory directory
where member.mattermost_account_id is null
  and member.mm_user_id is not null
  and directory.mm_user_id = member.mm_user_id;

insert into public.member_ssafy_verifications (
  member_id,
  ssafy_sub,
  verified_at,
  auth_time,
  verification_id,
  track,
  track_name,
  last_scope,
  updated_at
)
select
  member.id,
  member.ssafy_sub,
  coalesce(member.ssafy_verified_at, member.updated_at, member.created_at, now()),
  member.ssafy_auth_time,
  member.ssafy_verification_id,
  member.ssafy_track,
  member.ssafy_track_name,
  member.ssafy_last_scope,
  now()
from public.members member
where member.ssafy_sub is not null
  and btrim(member.ssafy_sub) <> ''
on conflict do nothing;

update public.members member
set
  email = identity.identifier_normalized,
  email_normalized = identity.identifier_normalized,
  email_verified_at = coalesce(identity.verified_at, member.email_verified_at, now()),
  updated_at = now()
from public.member_auth_identities identity
where identity.member_id = member.id
  and identity.provider = 'graduate_email'
  and member.email_normalized is null;

update public.graduate_verification_requests
set inferred_generation = inferred_cohort
where inferred_generation is null;

insert into public.graduate_profiles (
  member_id,
  verification_request_id,
  verified_at,
  verification_source,
  updated_at
)
select
  member.id,
  request.id,
  coalesce(member.graduate_verified_at, request.reviewed_at, member.updated_at, now()),
  case
    when member.verification_source = 'graduate_certificate' then 'graduate_certificate'
    else 'legacy_migration'
  end,
  now()
from public.members member
left join public.member_auth_identities identity
  on identity.member_id = member.id
 and identity.provider = 'graduate_email'
left join lateral (
  select request_row.id, request_row.reviewed_at
  from public.graduate_verification_requests request_row
  where request_row.email_normalized = identity.identifier_normalized
    and request_row.status = 'approved'
  order by request_row.decided_at desc nulls last, request_row.created_at desc
  limit 1
) request on true
where member.graduate_verified_at is not null
on conflict do nothing;

insert into public.admin_profiles (
  member_id,
  permission_template_key,
  managed_campus_slugs,
  is_active,
  updated_at
)
select
  member.id,
  case
    when lower(coalesce(member.mm_username, '')) = 'myknow' then 'super_admin'
    else member.admin_permission_id
  end,
  coalesce(member.admin_managed_campus_slugs, '{}'),
  true,
  now()
from public.members member
where (
    member.admin_permission_id is not null
    or lower(coalesce(member.mm_username, '')) = 'myknow'
  )
  and exists (
    select 1
    from public.admin_permission_templates template
    where template.key = case
      when lower(coalesce(member.mm_username, '')) = 'myknow' then 'super_admin'
      else member.admin_permission_id
    end
  )
on conflict (member_id) do nothing;

update public.graduate_verification_requests request
set reviewer_admin_profile_id = profile.id
from public.admin_profiles profile
where request.reviewer_admin_profile_id is null
  and request.reviewer_admin_id = profile.member_id;

update public.member_profile_images image
set
  reviewer_admin_profile_id = profile.id,
  source = case
    when image.graduate_verification_request_id is not null then 'graduate_verification'
    when image.member_id is not null then 'member_upload'
    else 'legacy'
  end,
  updated_at = now()
from public.admin_profiles profile
where image.reviewer_admin_profile_id is null
  and image.reviewer_admin_id = profile.member_id;

update public.member_profile_images
set source = case
  when graduate_verification_request_id is not null then 'graduate_verification'
  when member_id is not null then 'member_upload'
  else 'legacy'
end
where source = 'legacy';

insert into public.member_policy_consents (
  member_id,
  policy_document_id,
  kind,
  version,
  agreed_at
)
select
  member.id,
  document.id,
  document.kind,
  document.version,
  consent.agreed_at
from public.members member
cross join lateral (
  values
    ('service'::text, member.service_policy_version, member.service_policy_consented_at),
    ('privacy'::text, member.privacy_policy_version, member.privacy_policy_consented_at),
    ('marketing'::text, member.marketing_policy_version, member.marketing_policy_consented_at)
) as consent(kind, version, agreed_at)
join public.policy_documents document
  on document.kind = consent.kind
 and document.version = consent.version
where consent.version is not null
  and consent.agreed_at is not null
on conflict (member_id, policy_document_id) do nothing;

-- New graduate approvals now write the normalized email, generation, graduate
-- profile, and administrator-profile references. Legacy identity/member fields
-- remain dual-written until the contract migration removes their readers.
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
declare
  request_row public.graduate_verification_requests%rowtype;
  photo_row public.member_profile_images%rowtype;
  reviewer_profile_id uuid;
  new_member_id uuid;
  resolved_generation integer;
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
    from public.members member
    where member.email_normalized = request_row.email_normalized
      and member.deleted_at is null
  ) or exists (
    select 1
    from public.member_auth_identities identity
    where identity.provider = 'graduate_email'
      and identity.identifier_normalized = request_row.email_normalized
  ) then
    raise exception 'graduate_verification_email_exists';
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
    year,
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
    resolved_generation,
    request_row.campus,
    request_row.email,
    request_row.email_normalized,
    now(),
    true,
    now(),
    'graduate_certificate'
  ) returning id into new_member_id;

  insert into public.graduate_profiles (
    member_id,
    verification_request_id,
    verified_at,
    verification_source
  ) values (
    new_member_id,
    request_row.id,
    now(),
    'graduate_certificate'
  );

  insert into public.member_auth_identities (
    member_id,
    provider,
    identifier_normalized,
    verified_at
  ) values (
    new_member_id,
    'graduate_email',
    request_row.email_normalized,
    now()
  );

  update public.member_profile_images
  set member_id = new_member_id,
      source = 'graduate_verification',
      status = 'approved',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      updated_at = now()
  where id = photo_row.id;

  update public.members
  set active_profile_image_id = photo_row.id,
      profile_photo_review_status = 'approved',
      updated_at = now()
  where id = new_member_id;

  update public.graduate_verification_requests
  set status = 'approved',
      document_number_hmac = p_document_number_hmac,
      inferred_generation = resolved_generation,
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
    token_hash,
    expires_at
  ) values (
    new_member_id,
    'graduate_initial_setup',
    p_setup_token_hash,
    p_setup_expires_at
  );
  return new_member_id;
end;
$$;
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
begin
  select * into request_row
  from public.graduate_verification_requests
  where id = p_request_id
    and status = 'approved'
  for update;
  if not found then
    raise exception 'graduate_initial_setup_request_invalid';
  end if;

  select member.* into member_row
  from public.members member
  join public.graduate_profiles profile
    on profile.member_id = member.id
  where member.email_normalized = request_row.email_normalized
    and member.must_change_password = true
    and member.deleted_at is null
  for update of member;
  if not found then
    raise exception 'graduate_initial_setup_already_completed';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = member_row.id
    and purpose = 'graduate_initial_setup'
    and consumed_at is null;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    token_hash,
    expires_at
  ) values (
    member_row.id,
    'graduate_initial_setup',
    p_setup_token_hash,
    p_setup_expires_at
  );
  return member_row.id;
end;
$$;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from public;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from anon;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) to service_role;

create or replace function public.issue_graduate_password_reset(
  p_challenge_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  challenge_row public.graduate_email_challenges%rowtype;
  member_row public.members%rowtype;
begin
  select * into challenge_row
  from public.graduate_email_challenges
  where id = p_challenge_id
    and purpose = 'password_reset'
    and verified_at is not null
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'graduate_password_reset_challenge_invalid';
  end if;

  select member.* into member_row
  from public.members member
  join public.graduate_profiles profile
    on profile.member_id = member.id
  where member.email_normalized = challenge_row.email_normalized
    and member.deleted_at is null
  for update of member;
  if not found then
    update public.graduate_email_challenges
    set consumed_at = now()
    where id = challenge_row.id;
    return null;
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = member_row.id
    and purpose = 'graduate_password_reset'
    and consumed_at is null;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    token_hash,
    expires_at
  ) values (
    member_row.id,
    'graduate_password_reset',
    p_token_hash,
    p_expires_at
  );
  update public.graduate_email_challenges
  set consumed_at = now()
  where id = challenge_row.id;
  return member_row.id;
end;
$$;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from public;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from anon;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) to service_role;

-- Photo-review actions retain the legacy reviewer member ID for compatibility
-- and record the normalized administrator profile ID at the same time.
create or replace function public.approve_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
begin
  select * into image_row
  from public.member_profile_images
  where id = p_image_id
    and graduate_verification_request_id is null
    and member_id is not null
    and status = 'pending'
  for update;
  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;
  select * into member_row
  from public.members
  where id = image_row.member_id
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
  end if;
  select id into reviewer_profile_id
  from public.admin_profiles
  where member_id = p_admin_id
    and is_active = true;
  if reviewer_profile_id is null then
    raise exception 'profile_image_admin_profile_missing';
  end if;

  if member_row.active_profile_image_id is not null then
    update public.member_profile_images
    set status = 'superseded',
        delete_after = now() + interval '30 days',
        updated_at = now()
    where id = member_row.active_profile_image_id;
  end if;
  update public.member_profile_images
  set status = 'approved',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      updated_at = now()
  where id = image_row.id;
  update public.members
  set active_profile_image_id = image_row.id,
      profile_photo_review_status = 'approved',
      updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

create or replace function public.reject_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;
  select * into image_row
  from public.member_profile_images
  where id = p_image_id
    and graduate_verification_request_id is null
    and member_id is not null
    and status = 'pending'
  for update;
  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;
  select * into member_row
  from public.members
  where id = image_row.member_id
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
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
  set profile_photo_review_status = 'rejected',
      updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

create or replace function public.reject_member_active_profile_photo(
  p_member_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;
  select * into member_row
  from public.members
  where id = p_member_id
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
  end if;
  select id into reviewer_profile_id
  from public.admin_profiles
  where member_id = p_admin_id
    and is_active = true;
  if reviewer_profile_id is null then
    raise exception 'profile_image_admin_profile_missing';
  end if;

  if member_row.active_profile_image_id is not null then
    update public.member_profile_images
    set status = 'rejected',
        reviewer_admin_id = p_admin_id,
        reviewer_admin_profile_id = reviewer_profile_id,
        review_reason = btrim(p_reason),
        reviewed_at = now(),
        delete_after = now() + interval '30 days',
        updated_at = now()
    where id = member_row.active_profile_image_id
      and status = 'approved';
  end if;
  update public.members
  set active_profile_image_id = null,
      profile_photo_review_status = 'rejected',
      updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from public;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from anon;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from authenticated;
grant execute on function public.approve_member_profile_image_replacement(uuid, uuid) to service_role;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from public;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from anon;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_profile_image_replacement(uuid, uuid, text) to service_role;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from public;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from anon;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_active_profile_photo(uuid, uuid, text) to service_role;
