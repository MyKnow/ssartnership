create or replace function public.register_apple_wallet_device(
  p_public_id text,
  p_device_library_identifier_hash text,
  p_push_token_ciphertext text,
  p_push_token_iv text,
  p_push_token_auth_tag text,
  p_push_token_key_version integer
)
returns table (
  pass_id uuid,
  member_id uuid,
  platform text,
  public_id text,
  serial_number text,
  credential_status text,
  installation_status text,
  sync_status text,
  consent_version integer,
  consented_at timestamp with time zone,
  current_revision integer,
  current_snapshot_hash text,
  current_snapshot jsonb,
  issued_at timestamp with time zone,
  revoked_at timestamp with time zone,
  last_sync_attempted_at timestamp with time zone,
  last_synced_at timestamp with time zone,
  last_sync_error_code text,
  last_sync_error_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  registration_id uuid,
  device_library_identifier_hash text,
  push_token_ciphertext text,
  push_token_iv text,
  push_token_auth_tag text,
  push_token_key_version integer,
  last_registered_at timestamp with time zone,
  removed_at timestamp with time zone,
  registration_created_at timestamp with time zone,
  registration_updated_at timestamp with time zone,
  is_new_registration boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  pass_row public.member_wallet_passes%rowtype;
  registration_row public.apple_wallet_device_registrations%rowtype;
  normalized_public_id text := trim(coalesce(p_public_id, ''));
  normalized_device_hash text := trim(coalesce(p_device_library_identifier_hash, ''));
  normalized_push_token_ciphertext text := trim(coalesce(p_push_token_ciphertext, ''));
  normalized_push_token_iv text := trim(coalesce(p_push_token_iv, ''));
  normalized_push_token_auth_tag text := trim(coalesce(p_push_token_auth_tag, ''));
  inserted_registration_count integer := 0;
begin
  if normalized_public_id = '' then
    raise exception 'apple_wallet_device_public_id_invalid';
  end if;
  if char_length(normalized_device_hash) < 16 then
    raise exception 'apple_wallet_device_identifier_invalid';
  end if;
  if normalized_push_token_ciphertext = '' or normalized_push_token_iv = '' or normalized_push_token_auth_tag = '' then
    raise exception 'apple_wallet_device_push_token_invalid';
  end if;
  if p_push_token_key_version is null or p_push_token_key_version < 1 then
    raise exception 'apple_wallet_device_push_token_key_version_invalid';
  end if;

  select * into pass_row
  from public.member_wallet_passes as passes
  where passes.public_id = normalized_public_id
    and passes.platform = 'apple'
  for update;
  if not found then
    raise exception 'member_wallet_pass_not_found';
  end if;
  if pass_row.credential_status <> 'active' then
    raise exception 'member_wallet_pass_revoked';
  end if;

  insert into public.apple_wallet_device_registrations (
    pass_id,
    device_library_identifier_hash,
    push_token_ciphertext,
    push_token_iv,
    push_token_auth_tag,
    push_token_key_version,
    last_registered_at,
    removed_at
  ) values (
    pass_row.id,
    normalized_device_hash,
    normalized_push_token_ciphertext,
    normalized_push_token_iv,
    normalized_push_token_auth_tag,
    p_push_token_key_version,
    now(),
    null
  ) on conflict on constraint apple_wallet_device_registrations_pass_device_key do nothing
  returning * into registration_row;
  get diagnostics inserted_registration_count = row_count;

  if inserted_registration_count = 0 then
    update public.apple_wallet_device_registrations as registrations
    set push_token_ciphertext = normalized_push_token_ciphertext,
        push_token_iv = normalized_push_token_iv,
        push_token_auth_tag = normalized_push_token_auth_tag,
        push_token_key_version = p_push_token_key_version,
        last_registered_at = now(),
        removed_at = null,
        updated_at = now()
    where registrations.pass_id = pass_row.id
      and registrations.device_library_identifier_hash = normalized_device_hash
    returning * into registration_row;
    if not found then
      raise exception 'apple_wallet_device_registration_failed';
    end if;
  end if;

  update public.member_wallet_passes as passes
  set installation_status = 'installed',
      updated_at = now()
  where passes.id = pass_row.id
  returning * into pass_row;

  return query
  select
    pass_row.id,
    pass_row.member_id,
    pass_row.platform,
    pass_row.public_id,
    pass_row.serial_number,
    pass_row.credential_status,
    pass_row.installation_status,
    pass_row.sync_status,
    pass_row.consent_version,
    pass_row.consented_at,
    pass_row.current_revision,
    pass_row.current_snapshot_hash,
    pass_row.current_snapshot,
    pass_row.issued_at,
    pass_row.revoked_at,
    pass_row.last_sync_attempted_at,
    pass_row.last_synced_at,
    pass_row.last_sync_error_code,
    pass_row.last_sync_error_at,
    pass_row.created_at,
    pass_row.updated_at,
    registration_row.id,
    registration_row.device_library_identifier_hash,
    registration_row.push_token_ciphertext,
    registration_row.push_token_iv,
    registration_row.push_token_auth_tag,
    registration_row.push_token_key_version,
    registration_row.last_registered_at,
    registration_row.removed_at,
    registration_row.created_at,
    registration_row.updated_at,
    inserted_registration_count > 0;
end;
$$;
