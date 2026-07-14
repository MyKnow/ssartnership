-- Directly provisioned members do not have a Mattermost account. Keep their
-- login IDs in an explicit namespace so they can be resolved without an
-- external SSAFY Verify lookup and cannot be mistaken for Mattermost IDs.
alter table public.members
  add column if not exists manual_login_id text;

alter table public.members
  drop constraint if exists members_manual_login_id_check;
alter table public.members
  add constraint members_manual_login_id_check
  check (
    manual_login_id is null
    or (
      manual_login_id = lower(btrim(manual_login_id))
      and manual_login_id ~ '^manual-[a-z0-9._-]{1,57}$'
    )
  );

create unique index if not exists members_manual_login_id_key
  on public.members(manual_login_id)
  where manual_login_id is not null;

-- A directly created login ID is personal data. It remains reserved during
-- the soft-delete retention period, then is removed with the rest of the
-- member identity after anonymization.
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
  delete from public.member_auth_identities where member_id = p_member_id;
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
      manual_login_id = null,
      password_hash = null,
      password_salt = null,
      must_change_password = false,
      display_name = '탈퇴한 회원',
      campus = null,
      staff_source_generation = null,
      mattermost_account_id = null,
      mm_user_id = null,
      mm_username = null,
      ssafy_sub = null,
      ssafy_verified_at = null,
      ssafy_auth_time = null,
      ssafy_verification_id = null,
      ssafy_mattermost_user_id = null,
      ssafy_track = null,
      ssafy_track_name = null,
      ssafy_last_scope = null,
      avatar_content_type = null,
      avatar_base64 = null,
      avatar_url = null,
      graduate_verified_at = null,
      graduate_completion_stage = null,
      verification_source = null,
      admin_permission_id = null,
      admin_managed_campus_slugs = '{}',
      service_policy_version = null,
      service_policy_consented_at = null,
      privacy_policy_version = null,
      privacy_policy_consented_at = null,
      marketing_policy_version = null,
      marketing_policy_consented_at = null,
      active_profile_image_id = null,
      profile_photo_review_status = 'approved',
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
