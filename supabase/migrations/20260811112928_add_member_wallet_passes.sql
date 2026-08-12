create table if not exists public.member_wallet_passes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  platform text not null,
  public_id text not null,
  serial_number text not null,
  credential_status text not null default 'active',
  installation_status text not null default 'pending',
  sync_status text not null default 'pending',
  consent_version integer not null,
  consented_at timestamp with time zone not null,
  current_revision integer not null default 1,
  current_snapshot_hash text not null,
  current_snapshot jsonb not null default '{}'::jsonb,
  issued_at timestamp with time zone not null default now(),
  revoked_at timestamp with time zone,
  last_sync_attempted_at timestamp with time zone,
  last_synced_at timestamp with time zone,
  last_sync_error_code text,
  last_sync_error_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint member_wallet_passes_platform_check
    check (platform in ('apple')),
  constraint member_wallet_passes_public_id_check
    check (public_id ~ '^[A-Za-z0-9_-]{43}$'),
  constraint member_wallet_passes_serial_number_check
    check (serial_number = 'sp-' || public_id),
  constraint member_wallet_passes_credential_status_check
    check (credential_status in ('active', 'revoked')),
  constraint member_wallet_passes_installation_status_check
    check (installation_status in ('pending', 'installed', 'removed')),
  constraint member_wallet_passes_sync_status_check
    check (sync_status in ('pending', 'synced', 'failed')),
  constraint member_wallet_passes_consent_version_check
    check (consent_version > 0),
  constraint member_wallet_passes_current_revision_check
    check (current_revision >= 1),
  constraint member_wallet_passes_current_snapshot_object_check
    check (jsonb_typeof(current_snapshot) = 'object'),
  constraint member_wallet_passes_current_snapshot_minimal_check
    check (
      current_snapshot ?& array['displayName', 'generationLabel', 'campusLabel', 'roleLabel']
      and current_snapshot - 'displayName' - 'generationLabel' - 'campusLabel' - 'roleLabel' = '{}'::jsonb
      and jsonb_typeof(current_snapshot -> 'displayName') = 'string'
      and jsonb_typeof(current_snapshot -> 'generationLabel') = 'string'
      and jsonb_typeof(current_snapshot -> 'campusLabel') = 'string'
      and jsonb_typeof(current_snapshot -> 'roleLabel') = 'string'
    )
);

create unique index if not exists member_wallet_passes_public_id_key
  on public.member_wallet_passes(public_id);
create unique index if not exists member_wallet_passes_platform_serial_number_key
  on public.member_wallet_passes(platform, serial_number);
create unique index if not exists member_wallet_passes_active_member_platform_key
  on public.member_wallet_passes(member_id, platform)
  where credential_status = 'active';
create index if not exists member_wallet_passes_member_platform_created_idx
  on public.member_wallet_passes(member_id, platform, created_at desc);
create index if not exists member_wallet_passes_updated_at_idx
  on public.member_wallet_passes(updated_at desc, id desc);

create table if not exists public.member_wallet_pass_revisions (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.member_wallet_passes(id) on delete cascade,
  revision integer not null,
  snapshot_hash text not null,
  snapshot jsonb not null default '{}'::jsonb,
  consent_version integer not null,
  consented_at timestamp with time zone not null,
  issued_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint member_wallet_pass_revisions_revision_check
    check (revision >= 1),
  constraint member_wallet_pass_revisions_snapshot_object_check
    check (jsonb_typeof(snapshot) = 'object'),
  constraint member_wallet_pass_revisions_snapshot_minimal_check
    check (
      snapshot ?& array['displayName', 'generationLabel', 'campusLabel', 'roleLabel']
      and snapshot - 'displayName' - 'generationLabel' - 'campusLabel' - 'roleLabel' = '{}'::jsonb
      and jsonb_typeof(snapshot -> 'displayName') = 'string'
      and jsonb_typeof(snapshot -> 'generationLabel') = 'string'
      and jsonb_typeof(snapshot -> 'campusLabel') = 'string'
      and jsonb_typeof(snapshot -> 'roleLabel') = 'string'
    ),
  constraint member_wallet_pass_revisions_consent_version_check
    check (consent_version > 0),
  constraint member_wallet_pass_revisions_pass_revision_key
    unique (pass_id, revision)
);

create index if not exists member_wallet_pass_revisions_pass_created_idx
  on public.member_wallet_pass_revisions(pass_id, created_at desc);

create table if not exists public.apple_wallet_device_registrations (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references public.member_wallet_passes(id) on delete cascade,
  device_library_identifier_hash text not null,
  push_token_ciphertext text not null,
  push_token_iv text not null,
  push_token_auth_tag text not null,
  push_token_key_version integer not null,
  last_registered_at timestamp with time zone not null default now(),
  removed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint apple_wallet_device_registrations_identifier_hash_check
    check (char_length(trim(device_library_identifier_hash)) between 16 and 256),
  constraint apple_wallet_device_registrations_push_token_ciphertext_check
    check (char_length(trim(push_token_ciphertext)) > 0),
  constraint apple_wallet_device_registrations_push_token_iv_check
    check (char_length(trim(push_token_iv)) > 0),
  constraint apple_wallet_device_registrations_push_token_auth_tag_check
    check (char_length(trim(push_token_auth_tag)) > 0),
  constraint apple_wallet_device_registrations_key_version_check
    check (push_token_key_version > 0),
  constraint apple_wallet_device_registrations_pass_device_key
    unique (pass_id, device_library_identifier_hash)
);

create index if not exists apple_wallet_device_registrations_pass_updated_idx
  on public.apple_wallet_device_registrations(pass_id, updated_at desc);
create index if not exists apple_wallet_device_registrations_active_pass_idx
  on public.apple_wallet_device_registrations(pass_id, updated_at desc)
  where removed_at is null;

create table if not exists public.member_wallet_pass_operations (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  member_id uuid not null references public.members(id) on delete cascade,
  platform text not null,
  result_pass_id uuid references public.member_wallet_passes(id) on delete set null,
  result_revision integer,
  result_status text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint member_wallet_pass_operations_operation_check
    check (operation in ('issue', 'revoke')),
  constraint member_wallet_pass_operations_platform_check
    check (platform in ('apple')),
  constraint member_wallet_pass_operations_result_status_check
    check (result_status in ('active', 'revoked')),
  constraint member_wallet_pass_operations_idempotency_key_check
    check (char_length(trim(idempotency_key)) between 16 and 128),
  constraint member_wallet_pass_operations_request_fingerprint_check
    check (char_length(trim(request_fingerprint)) between 16 and 256),
  constraint member_wallet_pass_operations_idempotency_key_key
    unique (idempotency_key)
);

create index if not exists member_wallet_pass_operations_member_platform_created_idx
  on public.member_wallet_pass_operations(member_id, platform, created_at desc);

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
        replace(encode(gen_random_bytes(32), 'base64'), '+', '-'),
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

create or replace function public.revoke_member_wallet_pass(
  p_member_id uuid,
  p_platform text,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_reason text
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
  already_revoked boolean,
  operation_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  pass_row public.member_wallet_passes%rowtype;
  operation_row public.member_wallet_pass_operations%rowtype;
  normalized_platform text := trim(coalesce(p_platform, ''));
  normalized_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  normalized_request_fingerprint text := trim(coalesce(p_request_fingerprint, ''));
  normalized_reason text := trim(coalesce(p_reason, ''));
  inserted_count integer := 0;
  was_already_revoked boolean := false;
begin
  if normalized_platform <> 'apple' then
    raise exception 'member_wallet_pass_platform_invalid';
  end if;
  if p_member_id is null then
    raise exception 'member_wallet_pass_member_required';
  end if;
  if char_length(normalized_idempotency_key) < 16 or char_length(normalized_idempotency_key) > 128 then
    raise exception 'member_wallet_pass_idempotency_key_invalid';
  end if;
  if char_length(normalized_request_fingerprint) < 16 or char_length(normalized_request_fingerprint) > 256 then
    raise exception 'member_wallet_pass_request_fingerprint_invalid';
  end if;
  if normalized_reason = '' then
    raise exception 'member_wallet_pass_revoke_reason_invalid';
  end if;

  select * into operation_row
  from public.member_wallet_pass_operations as operations
  where operations.idempotency_key = normalized_idempotency_key
  for update;
  if found then
    if operation_row.operation <> 'revoke'
       or operation_row.member_id <> p_member_id
       or operation_row.platform <> normalized_platform
       or operation_row.request_fingerprint <> normalized_request_fingerprint then
      raise exception 'member_wallet_pass_idempotency_conflict';
    end if;

    select * into pass_row
    from public.member_wallet_passes as passes
    where passes.id = operation_row.result_pass_id;
    if not found then
      raise exception 'member_wallet_pass_operation_result_missing';
    end if;

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
      pass_row.credential_status = 'revoked',
      false;
    return;
  end if;

  select * into member_row
  from public.members as member
  where member.id = p_member_id
    and member.deleted_at is null
  for update;
  if not found then
    raise exception 'member_wallet_pass_member_not_found';
  end if;

  select * into pass_row
  from public.member_wallet_passes as passes
  where passes.member_id = p_member_id
    and passes.platform = normalized_platform
  order by
    case when passes.credential_status = 'active' then 0 else 1 end,
    passes.created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'member_wallet_pass_not_found';
  end if;

  if pass_row.credential_status = 'revoked' then
    was_already_revoked := true;
  else
    update public.member_wallet_passes as passes
    set credential_status = 'revoked',
        sync_status = 'pending',
        revoked_at = now(),
        last_sync_error_code = null,
        last_sync_error_at = null,
        updated_at = now()
    where passes.id = pass_row.id
    returning * into pass_row;
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
    'revoke',
    normalized_idempotency_key,
    normalized_request_fingerprint,
    p_member_id,
    normalized_platform,
    pass_row.id,
    pass_row.current_revision,
    pass_row.credential_status
  ) on conflict (idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;

  select * into operation_row
  from public.member_wallet_pass_operations as operations
  where operations.idempotency_key = normalized_idempotency_key
  for update;
  if not found then
    raise exception 'member_wallet_pass_operation_record_failed';
  end if;
  if operation_row.operation <> 'revoke'
     or operation_row.member_id <> p_member_id
     or operation_row.platform <> normalized_platform
     or operation_row.request_fingerprint <> normalized_request_fingerprint
     or operation_row.result_pass_id <> pass_row.id then
    raise exception 'member_wallet_pass_idempotency_conflict';
  end if;

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
    was_already_revoked,
    inserted_count > 0;
end;
$$;

create or replace function public.reconcile_member_wallet_pass_content(
  p_pass_id uuid,
  p_action text,
  p_snapshot_hash text default null,
  p_snapshot jsonb default null,
  p_changed_at timestamp with time zone default null
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
  updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  pass_row public.member_wallet_passes%rowtype;
  normalized_action text := trim(coalesce(p_action, ''));
  normalized_snapshot_hash text := trim(coalesce(p_snapshot_hash, ''));
  changed_at timestamp with time zone := coalesce(p_changed_at, now());
  next_revision integer;
begin
  if p_pass_id is null then
    raise exception 'member_wallet_pass_id_required';
  end if;
  if normalized_action not in ('refresh', 'invalidate') then
    raise exception 'member_wallet_pass_reconcile_action_invalid';
  end if;
  if normalized_action = 'refresh' then
    if normalized_snapshot_hash = '' then
      raise exception 'member_wallet_pass_snapshot_hash_invalid';
    end if;
    if p_snapshot is null
       or jsonb_typeof(p_snapshot) <> 'object'
       or not (p_snapshot ?& array['displayName', 'generationLabel', 'campusLabel', 'roleLabel'])
       or p_snapshot - 'displayName' - 'generationLabel' - 'campusLabel' - 'roleLabel' <> '{}'::jsonb
       or jsonb_typeof(p_snapshot -> 'displayName') <> 'string'
       or jsonb_typeof(p_snapshot -> 'generationLabel') <> 'string'
       or jsonb_typeof(p_snapshot -> 'campusLabel') <> 'string'
       or jsonb_typeof(p_snapshot -> 'roleLabel') <> 'string' then
      raise exception 'member_wallet_pass_snapshot_invalid';
    end if;
  end if;

  select * into pass_row
  from public.member_wallet_passes as passes
  where passes.id = p_pass_id
    and passes.platform = 'apple'
    and passes.credential_status = 'active'
  for update;
  if not found then
    raise exception 'member_wallet_pass_not_found';
  end if;

  if normalized_action = 'invalidate' then
    update public.member_wallet_passes as passes
    set credential_status = 'revoked',
        sync_status = 'pending',
        revoked_at = changed_at,
        last_sync_error_code = null,
        last_sync_error_at = null,
        updated_at = changed_at
    where passes.id = pass_row.id
    returning * into pass_row;
  elsif pass_row.current_snapshot_hash <> normalized_snapshot_hash
     or pass_row.current_snapshot <> p_snapshot then
    next_revision := pass_row.current_revision + 1;
    update public.member_wallet_passes as passes
    set current_revision = next_revision,
        current_snapshot_hash = normalized_snapshot_hash,
        current_snapshot = p_snapshot,
        issued_at = changed_at,
        sync_status = 'pending',
        last_sync_error_code = null,
        last_sync_error_at = null,
        updated_at = changed_at
    where passes.id = pass_row.id
    returning * into pass_row;

    insert into public.member_wallet_pass_revisions (
      pass_id,
      revision,
      snapshot_hash,
      snapshot,
      consent_version,
      consented_at,
      issued_at,
      created_at
    ) values (
      pass_row.id,
      next_revision,
      normalized_snapshot_hash,
      p_snapshot,
      pass_row.consent_version,
      pass_row.consented_at,
      changed_at,
      changed_at
    );
  end if;

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
    pass_row.updated_at;
end;
$$;


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
  ) on conflict (pass_id, device_library_identifier_hash) do nothing
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

create or replace function public.unregister_apple_wallet_device(
  p_public_id text,
  p_device_library_identifier_hash text
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
  removed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  pass_row public.member_wallet_passes%rowtype;
  active_registration_count bigint := 0;
  removed_registration_count bigint := 0;
  normalized_public_id text := trim(coalesce(p_public_id, ''));
  normalized_device_hash text := trim(coalesce(p_device_library_identifier_hash, ''));
begin
  if normalized_public_id = '' then
    raise exception 'apple_wallet_device_public_id_invalid';
  end if;
  if char_length(normalized_device_hash) < 16 then
    raise exception 'apple_wallet_device_identifier_invalid';
  end if;

  select * into pass_row
  from public.member_wallet_passes as passes
  where passes.public_id = normalized_public_id
    and passes.platform = 'apple'
  for update;
  if not found then
    raise exception 'member_wallet_pass_not_found';
  end if;

  update public.apple_wallet_device_registrations as registrations
  set removed_at = now(),
      updated_at = now()
  where registrations.pass_id = pass_row.id
    and registrations.device_library_identifier_hash = normalized_device_hash
    and registrations.removed_at is null;
  get diagnostics removed_registration_count = row_count;

  select count(*)::bigint into active_registration_count
  from public.apple_wallet_device_registrations as registrations
  where registrations.pass_id = pass_row.id
    and registrations.removed_at is null;

  update public.member_wallet_passes as passes
  set installation_status = case
        when active_registration_count > 0 then 'installed'
        else 'removed'
      end,
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
    removed_registration_count > 0;
end;
$$;

create or replace function public.list_updated_apple_wallet_passes(
  p_device_library_identifier_hash text,
  p_updated_since timestamp with time zone default null,
  p_limit integer default 100
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
  updated_at timestamp with time zone
)
language sql
security definer
set search_path = public
as $$
  select
    pass.id,
    pass.member_id,
    pass.platform,
    pass.public_id,
    pass.serial_number,
    pass.credential_status,
    pass.installation_status,
    pass.sync_status,
    pass.consent_version,
    pass.consented_at,
    pass.current_revision,
    pass.current_snapshot_hash,
    pass.current_snapshot,
    pass.issued_at,
    pass.revoked_at,
    pass.last_sync_attempted_at,
    pass.last_synced_at,
    pass.last_sync_error_code,
    pass.last_sync_error_at,
    pass.created_at,
    pass.updated_at
  from public.member_wallet_passes as pass
  join public.apple_wallet_device_registrations as registration
    on registration.pass_id = pass.id
   and registration.removed_at is null
   and registration.device_library_identifier_hash = trim(coalesce(p_device_library_identifier_hash, ''))
  where pass.platform = 'apple'
    and trim(coalesce(p_device_library_identifier_hash, '')) <> ''
    and pass.updated_at > coalesce(p_updated_since, to_timestamp(0))
  order by pass.updated_at asc, pass.id asc
  limit greatest(coalesce(p_limit, 100), 1);
$$;

alter table public.member_wallet_passes enable row level security;
alter table public.member_wallet_pass_revisions enable row level security;
alter table public.apple_wallet_device_registrations enable row level security;
alter table public.member_wallet_pass_operations enable row level security;

revoke all on table public.member_wallet_passes from anon;
revoke all on table public.member_wallet_passes from authenticated;
revoke all on table public.member_wallet_passes from service_role;
revoke all on table public.member_wallet_pass_revisions from anon;
revoke all on table public.member_wallet_pass_revisions from authenticated;
revoke all on table public.member_wallet_pass_revisions from service_role;
revoke all on table public.apple_wallet_device_registrations from anon;
revoke all on table public.apple_wallet_device_registrations from authenticated;
revoke all on table public.apple_wallet_device_registrations from service_role;
revoke all on table public.member_wallet_pass_operations from anon;
revoke all on table public.member_wallet_pass_operations from authenticated;
revoke all on table public.member_wallet_pass_operations from service_role;

grant select, update on table public.member_wallet_passes to service_role;
grant select on table public.member_wallet_pass_revisions to service_role;
grant select on table public.apple_wallet_device_registrations to service_role;

revoke all on function public.issue_member_wallet_pass(uuid, text, integer, timestamp with time zone, text, jsonb, text, text) from public;
revoke all on function public.issue_member_wallet_pass(uuid, text, integer, timestamp with time zone, text, jsonb, text, text) from anon;
revoke all on function public.issue_member_wallet_pass(uuid, text, integer, timestamp with time zone, text, jsonb, text, text) from authenticated;
grant execute on function public.issue_member_wallet_pass(uuid, text, integer, timestamp with time zone, text, jsonb, text, text) to service_role;

revoke all on function public.revoke_member_wallet_pass(uuid, text, text, text, text) from public;
revoke all on function public.revoke_member_wallet_pass(uuid, text, text, text, text) from anon;
revoke all on function public.revoke_member_wallet_pass(uuid, text, text, text, text) from authenticated;
grant execute on function public.revoke_member_wallet_pass(uuid, text, text, text, text) to service_role;

revoke all on function public.reconcile_member_wallet_pass_content(uuid, text, text, jsonb, timestamp with time zone) from public;
revoke all on function public.reconcile_member_wallet_pass_content(uuid, text, text, jsonb, timestamp with time zone) from anon;
revoke all on function public.reconcile_member_wallet_pass_content(uuid, text, text, jsonb, timestamp with time zone) from authenticated;
grant execute on function public.reconcile_member_wallet_pass_content(uuid, text, text, jsonb, timestamp with time zone) to service_role;


revoke all on function public.register_apple_wallet_device(text, text, text, text, text, integer) from public;
revoke all on function public.register_apple_wallet_device(text, text, text, text, text, integer) from anon;
revoke all on function public.register_apple_wallet_device(text, text, text, text, text, integer) from authenticated;
grant execute on function public.register_apple_wallet_device(text, text, text, text, text, integer) to service_role;

revoke all on function public.unregister_apple_wallet_device(text, text) from public;
revoke all on function public.unregister_apple_wallet_device(text, text) from anon;
revoke all on function public.unregister_apple_wallet_device(text, text) from authenticated;
grant execute on function public.unregister_apple_wallet_device(text, text) to service_role;

revoke all on function public.list_updated_apple_wallet_passes(text, timestamp with time zone, integer) from public;
revoke all on function public.list_updated_apple_wallet_passes(text, timestamp with time zone, integer) from anon;
revoke all on function public.list_updated_apple_wallet_passes(text, timestamp with time zone, integer) from authenticated;
grant execute on function public.list_updated_apple_wallet_passes(text, timestamp with time zone, integer) to service_role;
