-- Connect member deletion to Apple Wallet without broadening direct table
-- privileges. The helper is intentionally narrow so only the service-role
-- lifecycle path can transition credentials while soft_delete_member keeps
-- the member row, identifier reservations, and Wallet revocation atomic.
create or replace function public.revoke_deleted_member_wallet_passes(
  p_member_id uuid,
  p_changed_at timestamp with time zone default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  lifecycle_changed_at timestamp with time zone := coalesce(p_changed_at, now());
  revoked_pass_count integer := 0;
begin
  if p_member_id is null then
    raise exception 'member_wallet_lifecycle_member_required';
  end if;

  select * into member_row
  from public.members as member
  where member.id = p_member_id
    and member.deleted_at is not null
    and member.anonymized_at is null
  for update;

  if not found then
    raise exception 'member_wallet_lifecycle_soft_delete_required';
  end if;

  update public.member_wallet_passes as passes
  set credential_status = 'revoked',
      sync_status = 'pending',
      revoked_at = coalesce(passes.revoked_at, lifecycle_changed_at),
      last_sync_error_code = null,
      last_sync_error_at = null,
      updated_at = greatest(
        passes.updated_at + interval '1 microsecond',
        lifecycle_changed_at,
        clock_timestamp()
      )
  where passes.member_id = p_member_id
    and passes.platform = 'apple'
    and passes.credential_status = 'active';
  get diagnostics revoked_pass_count = row_count;

  return revoked_pass_count;
end;
$$;

revoke all on function public.revoke_deleted_member_wallet_passes(uuid, timestamp with time zone) from public;
revoke all on function public.revoke_deleted_member_wallet_passes(uuid, timestamp with time zone) from anon;
revoke all on function public.revoke_deleted_member_wallet_passes(uuid, timestamp with time zone) from authenticated;
grant execute on function public.revoke_deleted_member_wallet_passes(uuid, timestamp with time zone) to service_role;

-- The Wallet operation rows are an idempotency ledger, not the durable audit
-- source. Once the 30-day member recovery window closes, remove them before
-- deleting passes; pass deletion then cascades through revisions and encrypted
-- Apple device registrations. event_logs remain untouched for aggregate audit.
create or replace function public.purge_deleted_member_wallet_data_for_anonymization(
  p_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row public.members%rowtype;
begin
  if p_member_id is null then
    return false;
  end if;

  select * into member_row
  from public.members as member
  where member.id = p_member_id
    and member.deleted_at is not null
    and member.deleted_at <= now() - interval '30 days'
    and member.anonymized_at is null
  for update;

  if not found then
    return false;
  end if;

  delete from public.member_wallet_pass_operations as operations
  where operations.member_id = p_member_id;

  delete from public.member_wallet_passes as passes
  where passes.member_id = p_member_id;

  return true;
end;
$$;

revoke all on function public.purge_deleted_member_wallet_data_for_anonymization(uuid) from public;
revoke all on function public.purge_deleted_member_wallet_data_for_anonymization(uuid) from anon;
revoke all on function public.purge_deleted_member_wallet_data_for_anonymization(uuid) from authenticated;
grant execute on function public.purge_deleted_member_wallet_data_for_anonymization(uuid) to service_role;

-- Resolve every private object with database time under the same retention
-- gate used by anonymize_deleted_member. The lock cannot span the external
-- Storage calls, so the final anonymization RPC still revalidates the gate.
create or replace function public.get_deleted_member_anonymization_storage_plan(
  p_member_id uuid
)
returns table (
  profile_image_paths text[],
  certificate_paths text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  verification_request_uuid uuid;
begin
  if p_member_id is null then
    return;
  end if;

  select * into member_row
  from public.members as member
  where member.id = p_member_id
    and member.deleted_at is not null
    and member.deleted_at <= now() - interval '30 days'
    and member.anonymized_at is null
  for update;

  if not found then
    return;
  end if;

  select profile.verification_request_id into verification_request_uuid
  from public.graduate_profiles as profile
  where profile.member_id = p_member_id;

  return query
  select
    coalesce(
      array(
        select distinct image.storage_path
        from public.member_profile_images as image
        where image.member_id = p_member_id
        order by image.storage_path
      ),
      '{}'::text[]
    ),
    coalesce(
      array(
        select distinct request.certificate_storage_path
        from public.graduate_verification_requests as request
        where request.certificate_storage_path is not null
          and (
            request.id = verification_request_uuid
            or request.recovery_member_id = p_member_id
          )
        order by request.certificate_storage_path
      ),
      '{}'::text[]
    );
end;
$$;

revoke all on function public.get_deleted_member_anonymization_storage_plan(uuid) from public;
revoke all on function public.get_deleted_member_anonymization_storage_plan(uuid) from anon;
revoke all on function public.get_deleted_member_anonymization_storage_plan(uuid) from authenticated;
grant execute on function public.get_deleted_member_anonymization_storage_plan(uuid) to service_role;

create or replace function public.soft_delete_member(
  p_member_id uuid,
  p_identifier_reservations jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  reservation record;
  lifecycle_changed_at timestamp with time zone := now();
begin
  select * into member_row
  from public.members
  where id = p_member_id
  for update;

  if not found or member_row.deleted_at is not null then
    return false;
  end if;

  for reservation in
    select identifier_kind, identifier_hash
    from jsonb_to_recordset(coalesce(p_identifier_reservations, '[]'::jsonb))
      as value(identifier_kind text, identifier_hash text)
  loop
    insert into public.member_identifier_reservations (
      identifier_kind,
      identifier_hash
    )
    values (reservation.identifier_kind, reservation.identifier_hash)
    on conflict (identifier_kind, identifier_hash) do nothing;
  end loop;

  update public.members
  set deleted_at = lifecycle_changed_at, updated_at = lifecycle_changed_at
  where id = p_member_id;

  perform public.revoke_deleted_member_wallet_passes(p_member_id, lifecycle_changed_at);

  update public.admin_profiles
  set is_active = false,
      permission_version = permission_version + 1,
      updated_at = lifecycle_changed_at
  where member_id = p_member_id;

  delete from public.push_subscriptions
  where member_id = p_member_id;

  return true;
end;
$$;

revoke all on function public.soft_delete_member(uuid, jsonb) from public;
revoke all on function public.soft_delete_member(uuid, jsonb) from anon;
revoke all on function public.soft_delete_member(uuid, jsonb) from authenticated;
grant execute on function public.soft_delete_member(uuid, jsonb) to service_role;

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

  if not public.purge_deleted_member_wallet_data_for_anonymization(p_member_id) then
    raise exception 'member_wallet_lifecycle_anonymization_gate_failed';
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
