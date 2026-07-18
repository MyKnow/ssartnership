-- Sender lifecycle (active/disabled) is intentionally separate from runtime
-- health. A sender can remain active in the registry while a temporary
-- Mattermost access failure prevents new requests from using it.
alter table public.mattermost_sender_credentials
  add column if not exists health_status text not null default 'unknown',
  add column if not exists health_checked_at timestamp with time zone,
  add column if not exists health_failure_count integer not null default 0,
  add column if not exists health_blocked_until timestamp with time zone,
  add column if not exists health_last_error_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mattermost_sender_credentials_health_status_check'
      and conrelid = 'public.mattermost_sender_credentials'::regclass
  ) then
    alter table public.mattermost_sender_credentials
      add constraint mattermost_sender_credentials_health_status_check
      check (health_status in ('unknown', 'healthy', 'cooldown', 'blocked'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'mattermost_sender_credentials_health_failure_count_check'
      and conrelid = 'public.mattermost_sender_credentials'::regclass
  ) then
    alter table public.mattermost_sender_credentials
      add constraint mattermost_sender_credentials_health_failure_count_check
      check (health_failure_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'mattermost_sender_credentials_health_error_check'
      and conrelid = 'public.mattermost_sender_credentials'::regclass
  ) then
    alter table public.mattermost_sender_credentials
      add constraint mattermost_sender_credentials_health_error_check
      check (
        health_last_error_code is null
        or health_last_error_code in (
          'test_target_unavailable', 'unauthorized', 'forbidden',
          'rate_limited', 'not_found', 'unavailable', 'timeout',
          'invalid_response', 'request_rejected', 'configuration_invalid'
        )
      );
  end if;
end;
$$;

create index if not exists mattermost_sender_credentials_health_blocked_until_idx
  on public.mattermost_sender_credentials(status, health_blocked_until)
  where status = 'active';

-- The return type changes, so the old function must be dropped before it is
-- recreated. It remains service-role-only below.
drop function if exists public.list_mattermost_sender_metadata();

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
  health_status text,
  health_checked_at timestamp with time zone,
  health_failure_count integer,
  health_blocked_until timestamp with time zone,
  health_last_error_code text,
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
    sender.health_status,
    sender.health_checked_at,
    sender.health_failure_count,
    sender.health_blocked_until,
    sender.health_last_error_code,
    sender.expires_at,
    sender.created_at,
    sender.updated_at
  from public.mattermost_sender_credentials sender
  order by sender.generation desc, sender.updated_at desc;
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
    and sender.status = 'active'
    and (
      sender.health_blocked_until is null
      or sender.health_blocked_until <= now()
    );
$$;

create or replace function public.list_active_mattermost_sender_credentials_for_health_check()
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
  where sender.status = 'active'
    and sender.sender_mm_user_id is not null
  order by sender.generation asc;
$$;

create or replace function public.record_mattermost_sender_health_success(
  p_sender_id uuid
)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.mattermost_sender_credentials
  set
    health_status = 'healthy',
    health_checked_at = now(),
    health_failure_count = 0,
    health_blocked_until = null,
    health_last_error_code = null,
    updated_at = now()
  where id = p_sender_id
    and status = 'active';
$$;

create or replace function public.record_mattermost_sender_health_failure(
  p_sender_id uuid,
  p_error_code text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  next_health_status text;
  next_blocked_until timestamp with time zone;
begin
  if coalesce(p_error_code, '') not in (
    'unauthorized', 'forbidden', 'rate_limited', 'unavailable',
    'timeout', 'invalid_response', 'request_rejected'
  ) then
    raise exception 'mattermost_sender_health_error_invalid';
  end if;

  if p_error_code in ('unauthorized', 'forbidden') then
    next_health_status := 'blocked';
    next_blocked_until := now() + interval '1 hour';
  else
    next_health_status := 'cooldown';
    next_blocked_until := now() + interval '5 minutes';
  end if;

  update public.mattermost_sender_credentials
  set
    health_status = next_health_status,
    health_checked_at = now(),
    health_failure_count = health_failure_count + 1,
    health_blocked_until = next_blocked_until,
    health_last_error_code = p_error_code,
    updated_at = now()
  where id = p_sender_id
    and status = 'active';
end;
$$;

revoke all on function public.list_mattermost_sender_metadata() from public;
revoke all on function public.list_mattermost_sender_metadata() from anon;
revoke all on function public.list_mattermost_sender_metadata() from authenticated;
grant execute on function public.list_mattermost_sender_metadata() to service_role;

revoke all on function public.get_active_mattermost_sender_credentials(integer) from public;
revoke all on function public.get_active_mattermost_sender_credentials(integer) from anon;
revoke all on function public.get_active_mattermost_sender_credentials(integer) from authenticated;
grant execute on function public.get_active_mattermost_sender_credentials(integer) to service_role;

revoke all on function public.list_active_mattermost_sender_credentials_for_health_check() from public;
revoke all on function public.list_active_mattermost_sender_credentials_for_health_check() from anon;
revoke all on function public.list_active_mattermost_sender_credentials_for_health_check() from authenticated;
grant execute on function public.list_active_mattermost_sender_credentials_for_health_check() to service_role;

revoke all on function public.record_mattermost_sender_health_success(uuid) from public;
revoke all on function public.record_mattermost_sender_health_success(uuid) from anon;
revoke all on function public.record_mattermost_sender_health_success(uuid) from authenticated;
grant execute on function public.record_mattermost_sender_health_success(uuid) to service_role;

revoke all on function public.record_mattermost_sender_health_failure(uuid, text) from public;
revoke all on function public.record_mattermost_sender_health_failure(uuid, text) from anon;
revoke all on function public.record_mattermost_sender_health_failure(uuid, text) from authenticated;
grant execute on function public.record_mattermost_sender_health_failure(uuid, text) to service_role;
