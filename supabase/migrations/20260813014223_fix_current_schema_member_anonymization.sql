-- Keep the delayed member anonymization RPC aligned with the contracted
-- members schema. Legacy Verify proof rows remain in place globally; only the
-- row linked to the member being anonymized is removed as before.
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
  delete from public.member_email_login_transitions where member_id = p_member_id;
  delete from public.member_password_action_tokens where member_id = p_member_id;

  -- The normalized member contract dropped this legacy table. Keep cleanup
  -- compatible with a lagging environment without making it a dependency of
  -- the current Production function.
  if pg_catalog.to_regclass('public.member_auth_identities') is not null then
    execute 'delete from public.member_auth_identities where member_id = $1'
      using p_member_id;
  end if;

  delete from public.graduate_profiles where member_id = p_member_id;

  update public.graduate_verification_requests as request
  set email = concat('deleted+', request.id::text, '@deleted.invalid'),
      email_normalized = concat('deleted+', request.id::text, '@deleted.invalid'),
      legal_name = '탈퇴한 수료생',
      document_number_hmac = null,
      certificate_storage_path = null,
      certificate_sha256 = null,
      certificate_deleted_at = coalesce(request.certificate_deleted_at, now()),
      review_note = null,
      rejection_reason = null,
      status = case
        when request.request_kind = 'existing_member_recovery'
          and request.recovery_member_id = p_member_id
          and request.status = 'approved'
        then 'withdrawn'
        else request.status
      end,
      recovery_member_id = case
        when request.recovery_member_id = p_member_id then null
        else request.recovery_member_id
      end,
      updated_at = now()
  where request.id = verification_request_uuid
     or request.recovery_member_id = p_member_id;

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
      mattermost_login_disabled_at = null,
      mattermost_login_disabled_reason = null,
      auth_session_version = auth_session_version + 1,
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
