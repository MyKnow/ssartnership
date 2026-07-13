-- Contract phase: remove member-table mirrors after canonical relations are live.

do $$
begin
  if exists (
    select 1
    from public.members member
    where member.deleted_at is null
      and (
        btrim(coalesce(member.avatar_base64, '')) <> ''
        or btrim(coalesce(member.avatar_url, '')) <> ''
      )
  ) then
    raise exception 'member_legacy_avatar_migration_required';
  end if;

  if exists (
    select 1
    from public.member_auth_identities identity
    where identity.provider <> 'mattermost'
  ) then
    raise exception 'member_auth_identity_contract_requires_mattermost_only';
  end if;

  if exists (
    select 1
    from public.member_auth_identities identity
    left join public.members member
      on member.id = identity.member_id
    left join public.mm_user_directory directory
      on directory.id = member.mattermost_account_id
    where identity.provider = 'mattermost'
      and (
        directory.id is null
        or lower(directory.mm_username) <> identity.identifier_normalized
      )
  ) then
    raise exception 'member_auth_identity_contract_requires_directory_match';
  end if;

  if exists (
    select 1
    from public.member_profile_images image
    where image.member_id is not null
      and image.status = 'approved'
      and image.deleted_at is null
    group by image.member_id
    having count(*) > 1
  ) then
    raise exception 'member_profile_image_contract_requires_one_approved_image';
  end if;

  if exists (
    select 1
    from public.members member
    where member.active_profile_image_id is not null
      and not exists (
        select 1
        from public.member_profile_images image
        where image.id = member.active_profile_image_id
          and image.member_id = member.id
          and image.status = 'approved'
          and image.deleted_at is null
      )
  ) then
    raise exception 'member_profile_image_contract_requires_canonical_pointer';
  end if;
end;
$$;

create or replace function public.anonymize_deleted_member(p_member_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  mattermost_account_uuid uuid;
  verification_request_uuid uuid;
begin
  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is not null
    and deleted_at <= now() - interval '30 days'
    and anonymized_at is null
  for update;

  if not found then
    return false;
  end if;

  mattermost_account_uuid := member_row.mattermost_account_id;
  select verification_request_id into verification_request_uuid
  from public.graduate_profiles
  where member_id = p_member_id;

  delete from public.member_profile_images where member_id = p_member_id;
  delete from public.member_ssafy_verifications where member_id = p_member_id;
  delete from public.member_email_challenges where member_id = p_member_id;
  delete from public.member_password_action_tokens where member_id = p_member_id;
  delete from public.graduate_profiles where member_id = p_member_id;

  if verification_request_uuid is not null then
    update public.graduate_verification_requests
    set email = concat('deleted+', verification_request_uuid::text, '@deleted.invalid'),
        email_normalized = concat('deleted+', verification_request_uuid::text, '@deleted.invalid'),
        legal_name = '탈퇴한 수료생',
        document_number_hmac = null,
        certificate_storage_path = null,
        certificate_sha256 = null,
        certificate_deleted_at = coalesce(certificate_deleted_at, now()),
        review_note = null,
        rejection_reason = null,
        updated_at = now()
    where id = verification_request_uuid;
  end if;

  update public.members
  set email = null,
      email_normalized = null,
      email_verified_at = null,
      password_hash = null,
      password_salt = null,
      must_change_password = false,
      display_name = '탈퇴한 회원',
      campus = null,
      staff_source_generation = null,
      mattermost_account_id = null,
      anonymized_at = now(),
      updated_at = now()
  where id = p_member_id;

  if mattermost_account_uuid is not null then
    delete from public.mm_user_directory directory
    where directory.id = mattermost_account_uuid
      and not exists (
        select 1
        from public.members linked_member
        where linked_member.mattermost_account_id = directory.id
      );
  end if;

  return true;
end;
$$;

revoke all on function public.anonymize_deleted_member(uuid) from public;
revoke all on function public.anonymize_deleted_member(uuid) from anon;
revoke all on function public.anonymize_deleted_member(uuid) from authenticated;
grant execute on function public.anonymize_deleted_member(uuid) to service_role;

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

  update public.member_profile_images
  set member_id = new_member_id,
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

do $$
declare
  page_definition text;
  summary_definition text;
begin
  select pg_get_functiondef(
    'public.get_admin_logs_page(timestamp with time zone,timestamp with time zone,integer,integer,text,text,text,text,text)'::regprocedure
  ) into page_definition;
  if page_definition is null then
    raise exception 'get_admin_logs_page_missing';
  end if;

  page_definition := replace(
    page_definition,
    $page_event_current$
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    where$page_event_current$,
    $page_event_next$
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    left join public.mm_user_directory directory
      on directory.id = members.mattermost_account_id
    where$page_event_next$
  );
  page_definition := replace(
    page_definition,
    $page_security_current$
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    where$page_security_current$,
    $page_security_next$
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    left join public.mm_user_directory directory
      on directory.id = members.mattermost_account_id
    where$page_security_next$
  );
  page_definition := replace(page_definition, 'members.mm_username', 'directory.mm_username');
  if strpos(page_definition, 'members.mm_username') > 0
    or strpos(page_definition, 'directory.mm_username') = 0 then
    raise exception 'get_admin_logs_page_contract_rewrite_failed';
  end if;
  execute page_definition;

  select pg_get_functiondef(
    'public.get_admin_logs_summary(timestamp with time zone,timestamp with time zone,bigint)'::regprocedure
  ) into summary_definition;
  if summary_definition is null then
    raise exception 'get_admin_logs_summary_missing';
  end if;

  summary_definition := replace(
    summary_definition,
    $summary_event_current$
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    cross join params$summary_event_current$,
    $summary_event_next$
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    left join public.mm_user_directory directory
      on directory.id = members.mattermost_account_id
    cross join params$summary_event_next$
  );
  summary_definition := replace(
    summary_definition,
    $summary_security_current$
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    cross join params$summary_security_current$,
    $summary_security_next$
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    left join public.mm_user_directory directory
      on directory.id = members.mattermost_account_id
    cross join params$summary_security_next$
  );
  summary_definition := replace(summary_definition, 'members.mm_username', 'directory.mm_username');
  if strpos(summary_definition, 'members.mm_username') > 0
    or strpos(summary_definition, 'directory.mm_username') = 0 then
    raise exception 'get_admin_logs_summary_contract_rewrite_failed';
  end if;
  execute summary_definition;
end;
$$;

create or replace function public.enforce_member_profile_image_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'superseded'))
    or (old.status = 'approved' and new.status in ('superseded', 'rejected'))
  ) then
    raise exception 'invalid_member_profile_image_status_transition';
  end if;

  return new;
end;
$$;

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
  set updated_at = now()
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

  update public.member_profile_images
  set status = 'rejected',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      review_reason = btrim(p_reason),
      reviewed_at = now(),
      delete_after = now() + interval '30 days',
      updated_at = now()
  where member_id = member_row.id
    and status = 'approved'
    and deleted_at is null;

  update public.members
  set updated_at = now()
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

drop trigger if exists members_keep_single_super_admin on public.members;
drop function if exists public.ensure_single_member_super_admin();

create unique index if not exists member_profile_images_one_approved_per_member_idx
  on public.member_profile_images(member_id)
  where member_id is not null
    and status = 'approved'
    and deleted_at is null;

drop table if exists public.member_auth_identities;

alter table public.members
  drop column if exists mm_user_id,
  drop column if exists mm_username,
  drop column if exists year,
  drop column if exists staff_source_year,
  drop column if exists service_policy_version,
  drop column if exists service_policy_consented_at,
  drop column if exists privacy_policy_version,
  drop column if exists privacy_policy_consented_at,
  drop column if exists marketing_policy_version,
  drop column if exists marketing_policy_consented_at,
  drop column if exists admin_permission_id,
  drop column if exists admin_managed_campus_slugs,
  drop column if exists avatar_content_type,
  drop column if exists avatar_base64,
  drop column if exists avatar_url,
  drop column if exists ssafy_sub,
  drop column if exists ssafy_verified_at,
  drop column if exists ssafy_auth_time,
  drop column if exists ssafy_verification_id,
  drop column if exists ssafy_mattermost_user_id,
  drop column if exists ssafy_last_scope,
  drop column if exists ssafy_track,
  drop column if exists ssafy_track_name,
  drop column if exists graduate_verified_at,
  drop column if exists graduate_completion_stage,
  drop column if exists verification_source,
  drop column if exists active_profile_image_id,
  drop column if exists profile_photo_review_status;
