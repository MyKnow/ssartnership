create or replace function public.issue_member_wallet_pass(
  p_member_id uuid,
  p_platform text,
  p_consent_version integer,
  p_consented_at timestamp with time zone,
  p_snapshot_hash text,
  p_snapshot jsonb,
  p_idempotency_key text,
  p_request_fingerprint text
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
  is_new_pass boolean,
  is_new_revision boolean,
  operation_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  active_pass_row public.member_wallet_passes%rowtype;
  operation_row public.member_wallet_pass_operations%rowtype;
  revision_row public.member_wallet_pass_revisions%rowtype;
  normalized_platform text := trim(coalesce(p_platform, ''));
  normalized_snapshot_hash text := trim(coalesce(p_snapshot_hash, ''));
  normalized_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  normalized_request_fingerprint text := trim(coalesce(p_request_fingerprint, ''));
  next_revision integer;
  inserted_count integer := 0;
  created_pass boolean := false;
  created_revision boolean := false;
  generated_public_id text;
  generated_serial_number text;
begin
  if normalized_platform <> 'apple' then
    raise exception 'member_wallet_pass_platform_invalid';
  end if;
  if p_member_id is null then
    raise exception 'member_wallet_pass_member_required';
  end if;
  if p_consent_version is null or p_consent_version < 1 then
    raise exception 'member_wallet_pass_consent_version_invalid';
  end if;
  if p_consented_at is null then
    raise exception 'member_wallet_pass_consented_at_required';
  end if;
  if normalized_snapshot_hash = '' then
    raise exception 'member_wallet_pass_snapshot_hash_invalid';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'member_wallet_pass_snapshot_invalid';
  end if;
  if char_length(normalized_idempotency_key) < 16 or char_length(normalized_idempotency_key) > 128 then
    raise exception 'member_wallet_pass_idempotency_key_invalid';
  end if;
  if char_length(normalized_request_fingerprint) < 16 or char_length(normalized_request_fingerprint) > 256 then
    raise exception 'member_wallet_pass_request_fingerprint_invalid';
  end if;

  select * into member_row
  from public.members as member
  where member.id = p_member_id
    and member.deleted_at is null
  for update;
  if not found then
    raise exception 'member_wallet_pass_member_not_found';
  end if;
  if member_row.must_change_password then
    raise exception 'member_wallet_pass_member_password_change_required';
  end if;

  select * into operation_row
  from public.member_wallet_pass_operations as operations
  where operations.idempotency_key = normalized_idempotency_key
  for update;
  if found then
    if operation_row.operation <> 'issue'
       or operation_row.member_id <> p_member_id
       or operation_row.platform <> normalized_platform
       or operation_row.request_fingerprint <> normalized_request_fingerprint then
      raise exception 'member_wallet_pass_idempotency_conflict';
    end if;

    select * into active_pass_row
    from public.member_wallet_passes as passes
    where passes.id = operation_row.result_pass_id;
    if not found then
      raise exception 'member_wallet_pass_operation_result_missing';
    end if;

    select * into revision_row
    from public.member_wallet_pass_revisions as revisions
    where revisions.pass_id = active_pass_row.id
      and revisions.revision = operation_row.result_revision;
    if not found then
      raise exception 'member_wallet_pass_revision_missing';
    end if;

    return query
    select
      active_pass_row.id,
      active_pass_row.member_id,
      active_pass_row.platform,
      active_pass_row.public_id,
      active_pass_row.serial_number,
      active_pass_row.credential_status,
      active_pass_row.installation_status,
      active_pass_row.sync_status,
      active_pass_row.consent_version,
      active_pass_row.consented_at,
      active_pass_row.current_revision,
      active_pass_row.current_snapshot_hash,
      active_pass_row.current_snapshot,
      active_pass_row.issued_at,
      active_pass_row.revoked_at,
      active_pass_row.last_sync_attempted_at,
      active_pass_row.last_synced_at,
      active_pass_row.last_sync_error_code,
      active_pass_row.last_sync_error_at,
      active_pass_row.created_at,
      active_pass_row.updated_at,
      false,
      false,
      false;
    return;
  end if;

  select * into active_pass_row
  from public.member_wallet_passes as passes
  where passes.member_id = p_member_id
    and passes.platform = normalized_platform
    and passes.credential_status = 'active'
  order by passes.created_at desc
  limit 1
  for update;

  if not found then
    generated_public_id := rtrim(
      replace(
        replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'),
        '/',
        '_'
      ),
      '='
    );
    generated_serial_number := 'sp-' || generated_public_id;

    insert into public.member_wallet_passes (
      member_id,
      platform,
      public_id,
      serial_number,
      credential_status,
      installation_status,
      sync_status,
      consent_version,
      consented_at,
      current_revision,
      current_snapshot_hash,
      current_snapshot,
      issued_at
    ) values (
      p_member_id,
      normalized_platform,
      generated_public_id,
      generated_serial_number,
      'active',
      'pending',
      'pending',
      p_consent_version,
      p_consented_at,
      1,
      normalized_snapshot_hash,
      p_snapshot,
      now()
    )
    returning * into active_pass_row;

    created_pass := true;
    next_revision := 1;
  elsif active_pass_row.current_snapshot_hash = normalized_snapshot_hash
    and active_pass_row.current_snapshot = p_snapshot
    and active_pass_row.consent_version = p_consent_version
    and active_pass_row.consented_at = p_consented_at then
    next_revision := active_pass_row.current_revision;
  else
    next_revision := active_pass_row.current_revision + 1;

    update public.member_wallet_passes as passes
    set consent_version = p_consent_version,
        consented_at = p_consented_at,
        current_revision = next_revision,
        current_snapshot_hash = normalized_snapshot_hash,
        current_snapshot = p_snapshot,
        issued_at = now(),
        revoked_at = null,
        sync_status = 'pending',
        last_sync_error_code = null,
        last_sync_error_at = null,
        updated_at = now()
    where passes.id = active_pass_row.id
    returning * into active_pass_row;
  end if;

  select * into revision_row
  from public.member_wallet_pass_revisions as revisions
  where revisions.pass_id = active_pass_row.id
    and revisions.revision = next_revision;

  if not found then
    insert into public.member_wallet_pass_revisions (
      pass_id,
      revision,
      snapshot_hash,
      snapshot,
      consent_version,
      consented_at,
      issued_at
    ) values (
      active_pass_row.id,
      next_revision,
      normalized_snapshot_hash,
      p_snapshot,
      p_consent_version,
      p_consented_at,
      active_pass_row.issued_at
    )
    returning * into revision_row;
    created_revision := true;
  end if;

  insert into public.member_wallet_pass_operations (
    operation,
    idempotency_key,
    request_fingerprint,
    member_id,
    platform,
    result_pass_id,
    result_revision,
    result_status
  ) values (
    'issue',
    normalized_idempotency_key,
    normalized_request_fingerprint,
    p_member_id,
    normalized_platform,
    active_pass_row.id,
    next_revision,
    active_pass_row.credential_status
  ) on conflict (idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;

  select * into operation_row
  from public.member_wallet_pass_operations as operations
  where operations.idempotency_key = normalized_idempotency_key
  for update;
  if not found then
    raise exception 'member_wallet_pass_operation_record_failed';
  end if;
  if operation_row.operation <> 'issue'
     or operation_row.member_id <> p_member_id
     or operation_row.platform <> normalized_platform
     or operation_row.request_fingerprint <> normalized_request_fingerprint
     or operation_row.result_pass_id <> active_pass_row.id
     or operation_row.result_revision <> next_revision then
    raise exception 'member_wallet_pass_idempotency_conflict';
  end if;

  return query
  select
    active_pass_row.id,
    active_pass_row.member_id,
    active_pass_row.platform,
    active_pass_row.public_id,
    active_pass_row.serial_number,
    active_pass_row.credential_status,
    active_pass_row.installation_status,
    active_pass_row.sync_status,
    active_pass_row.consent_version,
    active_pass_row.consented_at,
    active_pass_row.current_revision,
    active_pass_row.current_snapshot_hash,
    active_pass_row.current_snapshot,
    active_pass_row.issued_at,
    active_pass_row.revoked_at,
    active_pass_row.last_sync_attempted_at,
    active_pass_row.last_synced_at,
    active_pass_row.last_sync_error_code,
    active_pass_row.last_sync_error_at,
    active_pass_row.created_at,
    active_pass_row.updated_at,
    created_pass,
    created_revision,
    inserted_count > 0;
end;
$$;
