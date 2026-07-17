create table if not exists public.mattermost_verification_codes (
  id uuid primary key default uuid_generate_v4(),
  purpose text not null,
  challenge_hash text not null unique,
  request_key_hash text not null,
  mm_user_id text,
  subject_generation integer,
  sender_generation integer,
  code_hash text not null,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  attempt_count integer not null default 0,
  resend_available_at timestamp with time zone not null,
  delivery_status text not null default 'pending',
  last_error_code text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint mattermost_verification_codes_purpose_check
    check (purpose in ('signup', 'reset_password')),
  constraint mattermost_verification_codes_challenge_hash_check
    check (challenge_hash ~ '^[0-9a-f]{64}$'),
  constraint mattermost_verification_codes_request_key_hash_check
    check (request_key_hash ~ '^[0-9a-f]{64}$'),
  constraint mattermost_verification_codes_code_hash_check
    check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint mattermost_verification_codes_generation_check
    check (
      (subject_generation is null or subject_generation between 0 and 99)
      and (sender_generation is null or sender_generation between 1 and 99)
    ),
  constraint mattermost_verification_codes_attempt_count_check
    check (attempt_count between 0 and 5),
  constraint mattermost_verification_codes_delivery_status_check
    check (delivery_status in ('pending', 'sent', 'failed')),
  constraint mattermost_verification_codes_safe_error_check
    check (
      last_error_code is null
      or last_error_code in (
        'sender_not_configured', 'configuration_invalid', 'unauthorized',
        'forbidden', 'rate_limited', 'not_found', 'unavailable', 'timeout',
        'invalid_response', 'request_rejected'
      )
    )
);

create index if not exists mattermost_verification_codes_active_target_idx
  on public.mattermost_verification_codes(purpose, mm_user_id, expires_at desc)
  where consumed_at is null and delivery_status = 'sent';

create index if not exists mattermost_verification_codes_active_request_idx
  on public.mattermost_verification_codes(purpose, request_key_hash, expires_at desc)
  where consumed_at is null;

alter table public.mattermost_verification_codes enable row level security;
revoke all on table public.mattermost_verification_codes from public;
revoke all on table public.mattermost_verification_codes from anon;
revoke all on table public.mattermost_verification_codes from authenticated;
grant select, insert, update, delete on table public.mattermost_verification_codes to service_role;

create or replace function public.reserve_mattermost_verification_code(
  p_purpose text,
  p_challenge_hash text,
  p_request_key_hash text,
  p_mm_user_id text,
  p_subject_generation integer,
  p_sender_generation integer,
  p_code_hash text,
  p_expires_at timestamp with time zone,
  p_resend_available_at timestamp with time zone
)
returns table (code_id uuid, accepted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code public.mattermost_verification_codes%rowtype;
  inserted_id uuid;
begin
  if p_purpose not in ('signup', 'reset_password')
    or p_challenge_hash !~ '^[0-9a-f]{64}$'
    or p_request_key_hash !~ '^[0-9a-f]{64}$'
    or p_code_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= now()
    or p_resend_available_at < now()
    or (p_subject_generation is not null and p_subject_generation not between 0 and 99)
    or (p_sender_generation is not null and p_sender_generation not between 1 and 99) then
    raise exception 'mattermost_verification_code_invalid_input';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_purpose),
    hashtext(p_request_key_hash)
  );

  select * into existing_code
  from public.mattermost_verification_codes
  where purpose = p_purpose
    and request_key_hash = p_request_key_hash
    and consumed_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if found and existing_code.resend_available_at > now() then
    return query select existing_code.id, false;
    return;
  end if;

  update public.mattermost_verification_codes
  set consumed_at = now(),
      updated_at = now()
  where purpose = p_purpose
    and request_key_hash = p_request_key_hash
    and consumed_at is null;

  insert into public.mattermost_verification_codes (
    purpose,
    challenge_hash,
    request_key_hash,
    mm_user_id,
    subject_generation,
    sender_generation,
    code_hash,
    expires_at,
    resend_available_at
  ) values (
    p_purpose,
    p_challenge_hash,
    p_request_key_hash,
    p_mm_user_id,
    p_subject_generation,
    p_sender_generation,
    p_code_hash,
    p_expires_at,
    p_resend_available_at
  ) returning id into inserted_id;

  return query select inserted_id, true;
end;
$$;

create or replace function public.mark_mattermost_verification_code_delivery(
  p_code_id uuid,
  p_sent boolean,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_error_code is not null and p_error_code not in (
    'sender_not_configured', 'configuration_invalid', 'unauthorized',
    'forbidden', 'rate_limited', 'not_found', 'unavailable', 'timeout',
    'invalid_response', 'request_rejected'
  ) then
    raise exception 'mattermost_verification_code_invalid_error';
  end if;

  update public.mattermost_verification_codes
  set delivery_status = case when p_sent then 'sent' else 'failed' end,
      last_error_code = case when p_sent then null else p_error_code end,
      consumed_at = consumed_at,
      updated_at = now()
  where id = p_code_id
    and consumed_at is null;

  return found;
end;
$$;

create or replace function public.consume_mattermost_verification_code(
  p_purpose text,
  p_challenge_hash text,
  p_code_hash text
)
returns table (
  verified boolean,
  mm_user_id text,
  subject_generation integer,
  sender_generation integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.mattermost_verification_codes%rowtype;
begin
  if p_purpose not in ('signup', 'reset_password')
    or p_challenge_hash !~ '^[0-9a-f]{64}$'
    or p_code_hash !~ '^[0-9a-f]{64}$' then
    return query select false, null::text, null::integer, null::integer;
    return;
  end if;

  select * into code_row
  from public.mattermost_verification_codes
  where purpose = p_purpose
    and challenge_hash = p_challenge_hash
  for update;

  if not found
    or code_row.consumed_at is not null
    or code_row.delivery_status <> 'sent'
    or code_row.expires_at <= now()
    or code_row.attempt_count >= 5
    or code_row.mm_user_id is null
    or code_row.subject_generation is null
    or code_row.sender_generation is null then
    if found and code_row.consumed_at is null then
      update public.mattermost_verification_codes
      set consumed_at = now(), updated_at = now()
      where id = code_row.id;
    end if;
    return query select false, null::text, null::integer, null::integer;
    return;
  end if;

  if code_row.code_hash = p_code_hash then
    update public.mattermost_verification_codes
    set consumed_at = now(), updated_at = now()
    where id = code_row.id;
    return query select true, code_row.mm_user_id, code_row.subject_generation, code_row.sender_generation;
    return;
  end if;

  update public.mattermost_verification_codes
  set attempt_count = attempt_count + 1,
      consumed_at = case when attempt_count + 1 >= 5 then now() else null end,
      updated_at = now()
  where id = code_row.id;
  return query select false, null::text, null::integer, null::integer;
end;
$$;

revoke all on function public.reserve_mattermost_verification_code(text, text, text, text, integer, integer, text, timestamp with time zone, timestamp with time zone) from public;
revoke all on function public.reserve_mattermost_verification_code(text, text, text, text, integer, integer, text, timestamp with time zone, timestamp with time zone) from anon;
revoke all on function public.reserve_mattermost_verification_code(text, text, text, text, integer, integer, text, timestamp with time zone, timestamp with time zone) from authenticated;
grant execute on function public.reserve_mattermost_verification_code(text, text, text, text, integer, integer, text, timestamp with time zone, timestamp with time zone) to service_role;

revoke all on function public.mark_mattermost_verification_code_delivery(uuid, boolean, text) from public;
revoke all on function public.mark_mattermost_verification_code_delivery(uuid, boolean, text) from anon;
revoke all on function public.mark_mattermost_verification_code_delivery(uuid, boolean, text) from authenticated;
grant execute on function public.mark_mattermost_verification_code_delivery(uuid, boolean, text) to service_role;

revoke all on function public.consume_mattermost_verification_code(text, text, text) from public;
revoke all on function public.consume_mattermost_verification_code(text, text, text) from anon;
revoke all on function public.consume_mattermost_verification_code(text, text, text) from authenticated;
grant execute on function public.consume_mattermost_verification_code(text, text, text) to service_role;
