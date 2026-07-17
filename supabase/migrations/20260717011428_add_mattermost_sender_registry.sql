-- Mattermost sender credentials are encrypted in the application with a
-- Vercel-managed AES-256-GCM root key. This table stores no plaintext login
-- ID, password, or Mattermost session token.
create table if not exists public.mattermost_sender_credentials (
  id uuid primary key default uuid_generate_v4(),
  generation integer not null,
  status text not null default 'pending',
  login_id_hint text not null,
  sender_mm_user_id text,
  sender_username_hint text,
  encrypted_ciphertext text,
  encrypted_nonce text,
  encrypted_auth_tag text,
  key_version integer,
  verified_at timestamp with time zone,
  last_tested_at timestamp with time zone,
  last_test_target_kind text,
  last_error_code text,
  expires_at timestamp with time zone,
  created_by_admin_id uuid references public.members(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint mattermost_sender_credentials_generation_check
    check (generation between 1 and 99),
  constraint mattermost_sender_credentials_status_check
    check (status in ('pending', 'active', 'superseded', 'disabled')),
  constraint mattermost_sender_credentials_login_id_hint_check
    check (char_length(login_id_hint) between 3 and 64),
  constraint mattermost_sender_credentials_key_version_check
    check (key_version is null or key_version between 1 and 99),
  constraint mattermost_sender_credentials_test_target_check
    check (
      last_test_target_kind is null
      or last_test_target_kind in ('previous_generation_sender', 'super_admin_bootstrap')
    ),
  constraint mattermost_sender_credentials_encryption_check
    check (
      (
        status in ('pending', 'active')
        and encrypted_ciphertext is not null
        and encrypted_nonce is not null
        and encrypted_auth_tag is not null
        and key_version is not null
      )
      or (
        status in ('superseded', 'disabled')
        and encrypted_ciphertext is null
        and encrypted_nonce is null
        and encrypted_auth_tag is null
        and key_version is null
      )
    )
);

create unique index if not exists mattermost_sender_credentials_one_active_generation_idx
  on public.mattermost_sender_credentials(generation)
  where status = 'active';
create unique index if not exists mattermost_sender_credentials_one_pending_generation_idx
  on public.mattermost_sender_credentials(generation)
  where status = 'pending';
create index if not exists mattermost_sender_credentials_generation_updated_at_idx
  on public.mattermost_sender_credentials(generation, updated_at desc);

drop trigger if exists mattermost_sender_credentials_set_updated_at
  on public.mattermost_sender_credentials;
create trigger mattermost_sender_credentials_set_updated_at
  before update on public.mattermost_sender_credentials
  for each row
  execute function public.set_partnership_updated_at();

-- This table uses the shared fixed-window implementation. The key format is
-- deliberately scoped by admin, candidate and IP in application code.
create table if not exists public.mattermost_sender_test_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint mattermost_sender_test_attempts_count_check check (count >= 0)
);

alter table public.mattermost_sender_credentials enable row level security;
alter table public.mattermost_sender_test_attempts enable row level security;

revoke all on table public.mattermost_sender_credentials from public;
revoke all on table public.mattermost_sender_credentials from anon;
revoke all on table public.mattermost_sender_credentials from authenticated;
revoke all on table public.mattermost_sender_test_attempts from public;
revoke all on table public.mattermost_sender_test_attempts from anon;
revoke all on table public.mattermost_sender_test_attempts from authenticated;
grant select, insert, update, delete on table public.mattermost_sender_credentials to service_role;
grant select, insert, update, delete on table public.mattermost_sender_test_attempts to service_role;

alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;
alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'members', 'reviews', 'logs', 'brands', 'companies', 'notifications',
    'home_ads', 'events', 'cycles', 'admin_management', 'graduate_verifications',
    'profile_images', 'mattermost_senders'
  ));

-- The permission resource exists for auditability, but only the super-admin
-- template receives it. Application code also checks the template key.
update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{mattermost_senders}',
  '{"create":true,"read":true,"update":true,"delete":true}'::jsonb,
  true
), updated_at = now()
where key = 'super_admin';

update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{mattermost_senders}',
  '{"create":false,"read":false,"update":false,"delete":false}'::jsonb,
  true
), updated_at = now()
where key <> 'super_admin';

create or replace function public.expire_pending_mattermost_sender_candidates()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  expired_count integer;
begin
  update public.mattermost_sender_credentials
  set
    status = 'disabled',
    encrypted_ciphertext = null,
    encrypted_nonce = null,
    encrypted_auth_tag = null,
    key_version = null,
    last_error_code = 'candidate_expired',
    updated_at = now()
  where status = 'pending'
    and expires_at is not null
    and expires_at <= now();
  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace function public.save_mattermost_sender_candidate_with_audit(
  p_generation integer,
  p_login_id_hint text,
  p_ciphertext text,
  p_nonce text,
  p_auth_tag text,
  p_key_version integer,
  p_actor_id uuid,
  p_request_id text,
  p_path text,
  p_user_agent text,
  p_ip_address text,
  p_properties jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  candidate_id uuid;
begin
  if p_generation not between 1 and 99 then
    raise exception 'mattermost_sender_generation_invalid';
  end if;
  if char_length(btrim(coalesce(p_login_id_hint, ''))) not between 3 and 64 then
    raise exception 'mattermost_sender_login_hint_invalid';
  end if;
  if char_length(coalesce(p_ciphertext, '')) = 0
    or char_length(coalesce(p_nonce, '')) = 0
    or char_length(coalesce(p_auth_tag, '')) = 0
    or p_key_version not between 1 and 99 then
    raise exception 'mattermost_sender_encrypted_payload_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtext('mattermost_sender_generation:' || p_generation::text));

  -- A new candidate replaces only an unverified candidate. The currently
  -- active sender remains usable until the new candidate passes a test DM.
  update public.mattermost_sender_credentials
  set
    status = 'disabled',
    encrypted_ciphertext = null,
    encrypted_nonce = null,
    encrypted_auth_tag = null,
    key_version = null,
    last_error_code = 'candidate_replaced',
    updated_at = now()
  where generation = p_generation
    and status = 'pending';

  insert into public.mattermost_sender_credentials (
    generation,
    status,
    login_id_hint,
    encrypted_ciphertext,
    encrypted_nonce,
    encrypted_auth_tag,
    key_version,
    expires_at,
    created_by_admin_id
  ) values (
    p_generation,
    'pending',
    btrim(p_login_id_hint),
    p_ciphertext,
    p_nonce,
    p_auth_tag,
    p_key_version,
    now() + interval '24 hours',
    p_actor_id
  ) returning id into candidate_id;

  insert into public.admin_audit_logs (
    request_id, actor_type, actor_id, action, path, target_type, target_id,
    properties, user_agent, ip_address
  ) values (
    p_request_id, 'admin', p_actor_id::text, 'mattermost_sender_candidate_save',
    p_path, 'mattermost_sender', candidate_id::text,
    coalesce(p_properties, '{}'::jsonb), p_user_agent, p_ip_address
  );

  return candidate_id;
end;
$$;

create or replace function public.record_mattermost_sender_test_failure_with_audit(
  p_candidate_id uuid,
  p_error_code text,
  p_actor_id uuid,
  p_request_id text,
  p_path text,
  p_user_agent text,
  p_ip_address text,
  p_properties jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  candidate_row public.mattermost_sender_credentials%rowtype;
begin
  if coalesce(p_error_code, '') not in (
    'test_target_unavailable', 'unauthorized', 'forbidden', 'rate_limited',
    'not_found', 'unavailable', 'timeout', 'invalid_response',
    'request_rejected', 'configuration_invalid'
  ) then
    raise exception 'mattermost_sender_test_error_invalid';
  end if;

  select * into candidate_row
  from public.mattermost_sender_credentials
  where id = p_candidate_id
  for update;
  if not found then
    raise exception 'mattermost_sender_candidate_missing';
  end if;

  update public.mattermost_sender_credentials
  set
    last_tested_at = now(),
    last_error_code = p_error_code,
    updated_at = now()
  where id = candidate_row.id;

  insert into public.admin_audit_logs (
    request_id, actor_type, actor_id, action, path, target_type, target_id,
    properties, user_agent, ip_address
  ) values (
    p_request_id, 'admin', p_actor_id::text, 'mattermost_sender_test',
    p_path, 'mattermost_sender', candidate_row.id::text,
    coalesce(p_properties, '{}'::jsonb), p_user_agent, p_ip_address
  );
end;
$$;

create or replace function public.activate_mattermost_sender_candidate_with_audit(
  p_candidate_id uuid,
  p_sender_mm_user_id text,
  p_sender_username_hint text,
  p_test_target_kind text,
  p_actor_id uuid,
  p_request_id text,
  p_path text,
  p_user_agent text,
  p_ip_address text,
  p_properties jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  candidate_row public.mattermost_sender_credentials%rowtype;
begin
  select * into candidate_row
  from public.mattermost_sender_credentials
  where id = p_candidate_id
  for update;
  if not found then
    raise exception 'mattermost_sender_candidate_missing';
  end if;
  if candidate_row.status <> 'pending'
    or candidate_row.expires_at is null
    or candidate_row.expires_at <= now() then
    raise exception 'mattermost_sender_candidate_not_activatable';
  end if;
  if char_length(btrim(coalesce(p_sender_mm_user_id, ''))) = 0 then
    raise exception 'mattermost_sender_user_invalid';
  end if;
  if coalesce(p_test_target_kind, '') not in ('previous_generation_sender', 'super_admin_bootstrap') then
    raise exception 'mattermost_sender_test_target_invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('mattermost_sender_generation:' || candidate_row.generation::text)
  );

  -- Ciphertext of a superseded active sender is removed in the same
  -- transaction that makes the tested candidate active.
  update public.mattermost_sender_credentials
  set
    status = 'superseded',
    encrypted_ciphertext = null,
    encrypted_nonce = null,
    encrypted_auth_tag = null,
    key_version = null,
    updated_at = now()
  where generation = candidate_row.generation
    and status = 'active';

  update public.mattermost_sender_credentials
  set
    status = 'active',
    sender_mm_user_id = btrim(p_sender_mm_user_id),
    sender_username_hint = nullif(btrim(coalesce(p_sender_username_hint, '')), ''),
    verified_at = now(),
    last_tested_at = now(),
    last_test_target_kind = p_test_target_kind,
    last_error_code = null,
    expires_at = null,
    updated_at = now()
  where id = candidate_row.id;

  insert into public.admin_audit_logs (
    request_id, actor_type, actor_id, action, path, target_type, target_id,
    properties, user_agent, ip_address
  ) values (
    p_request_id, 'admin', p_actor_id::text, 'mattermost_sender_activate',
    p_path, 'mattermost_sender', candidate_row.id::text,
    coalesce(p_properties, '{}'::jsonb), p_user_agent, p_ip_address
  );

  return candidate_row.id;
end;
$$;

create or replace function public.disable_mattermost_sender_with_audit(
  p_candidate_id uuid,
  p_generation_confirmation integer,
  p_actor_id uuid,
  p_request_id text,
  p_path text,
  p_user_agent text,
  p_ip_address text,
  p_properties jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  candidate_row public.mattermost_sender_credentials%rowtype;
begin
  select * into candidate_row
  from public.mattermost_sender_credentials
  where id = p_candidate_id
  for update;
  if not found then
    raise exception 'mattermost_sender_candidate_missing';
  end if;
  if candidate_row.generation <> p_generation_confirmation then
    raise exception 'mattermost_sender_confirmation_invalid';
  end if;
  if candidate_row.status not in ('pending', 'active') then
    raise exception 'mattermost_sender_not_disablable';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('mattermost_sender_generation:' || candidate_row.generation::text)
  );

  update public.mattermost_sender_credentials
  set
    status = 'disabled',
    encrypted_ciphertext = null,
    encrypted_nonce = null,
    encrypted_auth_tag = null,
    key_version = null,
    updated_at = now()
  where id = candidate_row.id;

  insert into public.admin_audit_logs (
    request_id, actor_type, actor_id, action, path, target_type, target_id,
    properties, user_agent, ip_address
  ) values (
    p_request_id, 'admin', p_actor_id::text, 'mattermost_sender_disable',
    p_path, 'mattermost_sender', candidate_row.id::text,
    coalesce(p_properties, '{}'::jsonb), p_user_agent, p_ip_address
  );

  return candidate_row.id;
end;
$$;

create or replace function public.list_mattermost_sender_metadata()
returns table (
  id uuid,
  generation integer,
  status text,
  login_id_hint text,
  sender_username_hint text,
  verified_at timestamp with time zone,
  last_tested_at timestamp with time zone,
  last_test_target_kind text,
  last_error_code text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    sender.id,
    sender.generation,
    sender.status,
    sender.login_id_hint,
    sender.sender_username_hint,
    sender.verified_at,
    sender.last_tested_at,
    sender.last_test_target_kind,
    sender.last_error_code,
    sender.expires_at,
    sender.created_at,
    sender.updated_at
  from public.mattermost_sender_credentials sender
  order by sender.generation desc, sender.updated_at desc;
$$;

create or replace function public.get_mattermost_sender_candidate_for_test(
  p_candidate_id uuid
)
returns table (
  id uuid,
  generation integer,
  status text,
  login_id_hint text,
  encrypted_ciphertext text,
  encrypted_nonce text,
  encrypted_auth_tag text,
  key_version integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    sender.id,
    sender.generation,
    sender.status,
    sender.login_id_hint,
    sender.encrypted_ciphertext,
    sender.encrypted_nonce,
    sender.encrypted_auth_tag,
    sender.key_version
  from public.mattermost_sender_credentials sender
  where sender.id = p_candidate_id
    and sender.status = 'pending'
    and sender.expires_at > now();
$$;

create or replace function public.get_active_mattermost_sender_credentials(
  p_generation integer
)
returns table (
  id uuid,
  generation integer,
  encrypted_ciphertext text,
  encrypted_nonce text,
  encrypted_auth_tag text,
  key_version integer,
  sender_mm_user_id text,
  sender_username_hint text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    sender.id,
    sender.generation,
    sender.encrypted_ciphertext,
    sender.encrypted_nonce,
    sender.encrypted_auth_tag,
    sender.key_version,
    sender.sender_mm_user_id,
    sender.sender_username_hint
  from public.mattermost_sender_credentials sender
  where sender.generation = p_generation
    and sender.status = 'active';
$$;

create or replace function public.get_mattermost_sender_test_context(
  p_generation integer,
  p_admin_member_id uuid
)
returns table (
  previous_generation_sender_user_id text,
  super_admin_mattermost_user_id text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    (
      select sender.sender_mm_user_id
      from public.mattermost_sender_credentials sender
      where sender.generation = p_generation - 1
        and sender.status = 'active'
      limit 1
    ) as previous_generation_sender_user_id,
    (
      select directory.mm_user_id
      from public.members member
      join public.mm_user_directory directory
        on directory.id = member.mattermost_account_id
      where member.id = p_admin_member_id
        and member.deleted_at is null
        and directory.is_active = true
      limit 1
    ) as super_admin_mattermost_user_id;
$$;

revoke all on function public.expire_pending_mattermost_sender_candidates() from public;
revoke all on function public.expire_pending_mattermost_sender_candidates() from anon;
revoke all on function public.expire_pending_mattermost_sender_candidates() from authenticated;
grant execute on function public.expire_pending_mattermost_sender_candidates() to service_role;

revoke all on function public.save_mattermost_sender_candidate_with_audit(integer, text, text, text, text, integer, uuid, text, text, text, text, jsonb) from public;
revoke all on function public.save_mattermost_sender_candidate_with_audit(integer, text, text, text, text, integer, uuid, text, text, text, text, jsonb) from anon;
revoke all on function public.save_mattermost_sender_candidate_with_audit(integer, text, text, text, text, integer, uuid, text, text, text, text, jsonb) from authenticated;
grant execute on function public.save_mattermost_sender_candidate_with_audit(integer, text, text, text, text, integer, uuid, text, text, text, text, jsonb) to service_role;

revoke all on function public.record_mattermost_sender_test_failure_with_audit(uuid, text, uuid, text, text, text, text, jsonb) from public;
revoke all on function public.record_mattermost_sender_test_failure_with_audit(uuid, text, uuid, text, text, text, text, jsonb) from anon;
revoke all on function public.record_mattermost_sender_test_failure_with_audit(uuid, text, uuid, text, text, text, text, jsonb) from authenticated;
grant execute on function public.record_mattermost_sender_test_failure_with_audit(uuid, text, uuid, text, text, text, text, jsonb) to service_role;

revoke all on function public.activate_mattermost_sender_candidate_with_audit(uuid, text, text, text, uuid, text, text, text, text, jsonb) from public;
revoke all on function public.activate_mattermost_sender_candidate_with_audit(uuid, text, text, text, uuid, text, text, text, text, jsonb) from anon;
revoke all on function public.activate_mattermost_sender_candidate_with_audit(uuid, text, text, text, uuid, text, text, text, text, jsonb) from authenticated;
grant execute on function public.activate_mattermost_sender_candidate_with_audit(uuid, text, text, text, uuid, text, text, text, text, jsonb) to service_role;

revoke all on function public.disable_mattermost_sender_with_audit(uuid, integer, uuid, text, text, text, text, jsonb) from public;
revoke all on function public.disable_mattermost_sender_with_audit(uuid, integer, uuid, text, text, text, text, jsonb) from anon;
revoke all on function public.disable_mattermost_sender_with_audit(uuid, integer, uuid, text, text, text, text, jsonb) from authenticated;
grant execute on function public.disable_mattermost_sender_with_audit(uuid, integer, uuid, text, text, text, text, jsonb) to service_role;

revoke all on function public.list_mattermost_sender_metadata() from public;
revoke all on function public.list_mattermost_sender_metadata() from anon;
revoke all on function public.list_mattermost_sender_metadata() from authenticated;
grant execute on function public.list_mattermost_sender_metadata() to service_role;

revoke all on function public.get_mattermost_sender_candidate_for_test(uuid) from public;
revoke all on function public.get_mattermost_sender_candidate_for_test(uuid) from anon;
revoke all on function public.get_mattermost_sender_candidate_for_test(uuid) from authenticated;
grant execute on function public.get_mattermost_sender_candidate_for_test(uuid) to service_role;

revoke all on function public.get_active_mattermost_sender_credentials(integer) from public;
revoke all on function public.get_active_mattermost_sender_credentials(integer) from anon;
revoke all on function public.get_active_mattermost_sender_credentials(integer) from authenticated;
grant execute on function public.get_active_mattermost_sender_credentials(integer) to service_role;

revoke all on function public.get_mattermost_sender_test_context(integer, uuid) from public;
revoke all on function public.get_mattermost_sender_test_context(integer, uuid) from anon;
revoke all on function public.get_mattermost_sender_test_context(integer, uuid) from authenticated;
grant execute on function public.get_mattermost_sender_test_context(integer, uuid) to service_role;
