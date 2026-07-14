-- Preserve the canonical Mattermost relation for history, but allow an
-- operator-approved transition to an email credential when MM access ends.
alter table public.members
  add column if not exists auth_session_version integer not null default 1,
  add column if not exists mattermost_login_disabled_at timestamp with time zone,
  add column if not exists mattermost_login_disabled_reason text;

alter table public.members
  drop constraint if exists members_auth_session_version_check;
alter table public.members
  add constraint members_auth_session_version_check
  check (auth_session_version >= 1);

alter table public.members
  drop constraint if exists members_mattermost_login_disabled_reason_check;
alter table public.members
  add constraint members_mattermost_login_disabled_reason_check
  check (
    mattermost_login_disabled_reason is null
    or mattermost_login_disabled_reason in (
      'generation_completed',
      'member_departed',
      'provider_not_found'
    )
  );

alter table public.members
  drop constraint if exists members_mattermost_login_disabled_state_check;
alter table public.members
  add constraint members_mattermost_login_disabled_state_check
  check (
    (mattermost_login_disabled_at is null and mattermost_login_disabled_reason is null)
    or (mattermost_login_disabled_at is not null and mattermost_login_disabled_reason is not null)
  );

alter table public.member_password_action_tokens
  drop constraint if exists member_password_action_tokens_purpose_check;
alter table public.member_password_action_tokens
  add constraint member_password_action_tokens_purpose_check
  check (
    purpose in (
      'graduate_initial_setup',
      'graduate_password_reset',
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
  );

create table if not exists public.member_email_login_transitions (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  candidate_email text not null,
  candidate_email_normalized text not null,
  candidate_email_reservation_hash text not null,
  reason text not null,
  status text not null default 'pending_delivery',
  initiated_by_admin_id uuid not null references public.members(id) on delete restrict,
  password_action_token_id uuid unique references public.member_password_action_tokens(id) on delete set null,
  email_sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint member_email_login_transitions_email_check
    check (candidate_email_normalized = lower(btrim(candidate_email))),
  constraint member_email_login_transitions_email_reservation_hash_check
    check (candidate_email_reservation_hash ~ '^[0-9a-f]{64}$'),
  constraint member_email_login_transitions_reason_check
    check (reason in ('generation_completed', 'member_departed', 'provider_not_found')),
  constraint member_email_login_transitions_status_check
    check (status in ('pending_delivery', 'email_sent', 'completed', 'cancelled')),
  constraint member_email_login_transitions_completion_check
    check (
      (status = 'completed' and completed_at is not null)
      or (status <> 'completed' and completed_at is null)
    )
);

create index if not exists member_email_login_transitions_pending_idx
  on public.member_email_login_transitions(status, updated_at desc)
  where status in ('pending_delivery', 'email_sent');

-- Keep an email claimed through completion as well.  If this only covered
-- pending rows, a concurrent new transition could wait for a completion,
-- then send a setup link for an email the completed transition now owns.
create unique index if not exists member_email_login_transitions_email_unique
  on public.member_email_login_transitions(candidate_email_normalized)
  where status <> 'cancelled';

alter table public.member_email_login_transitions enable row level security;
revoke all on table public.member_email_login_transitions from anon;
revoke all on table public.member_email_login_transitions from authenticated;

drop trigger if exists member_email_login_transitions_set_partnership_updated_at on public.member_email_login_transitions;
create trigger member_email_login_transitions_set_partnership_updated_at
  before update on public.member_email_login_transitions
  for each row execute function public.set_partnership_updated_at();

create or replace function public.disable_member_mattermost_login(
  p_member_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
begin
  if p_reason not in ('generation_completed', 'member_departed', 'provider_not_found') then
    raise exception 'mattermost_login_disable_reason_invalid';
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'mattermost_login_disable_member_missing';
  end if;
  if member_row.mattermost_account_id is null then
    raise exception 'mattermost_login_disable_member_not_linked';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = p_member_id
    and delivery_channel = 'mattermost'
    and consumed_at is null;

  if member_row.mattermost_login_disabled_at is null then
    update public.members
    set mattermost_login_disabled_at = now(),
        mattermost_login_disabled_reason = p_reason,
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where id = p_member_id;
  end if;

  return p_member_id;
end;
$$;

revoke all on function public.disable_member_mattermost_login(uuid, text) from public;
revoke all on function public.disable_member_mattermost_login(uuid, text) from anon;
revoke all on function public.disable_member_mattermost_login(uuid, text) from authenticated;
grant execute on function public.disable_member_mattermost_login(uuid, text) to service_role;

create table if not exists public.member_mattermost_disabled_generations (
  generation integer primary key,
  disabled_at timestamp with time zone not null default now(),
  constraint member_mattermost_disabled_generations_generation_check
    check (generation between 1 and 99)
);

alter table public.member_mattermost_disabled_generations enable row level security;
revoke all on table public.member_mattermost_disabled_generations from anon;
revoke all on table public.member_mattermost_disabled_generations from authenticated;

create or replace function public.enforce_completed_generation_mattermost_login_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generation_is_disabled boolean;
begin
  if new.generation is null
    or new.mattermost_account_id is null
    or new.mattermost_login_disabled_at is not null then
    return new;
  end if;

  -- Serialize with disable_generation_mattermost_logins so an in-flight
  -- member insert cannot slip through a completed generation.
  perform pg_advisory_xact_lock(741515, new.generation);

  select exists (
    select 1
    from public.member_mattermost_disabled_generations
    where generation = new.generation
  ) into generation_is_disabled;
  if not generation_is_disabled then
    return new;
  end if;

  new.mattermost_login_disabled_at := now();
  new.mattermost_login_disabled_reason := 'generation_completed';
  if tg_op = 'UPDATE' then
    new.auth_session_version := greatest(
      coalesce(new.auth_session_version, 1),
      coalesce(old.auth_session_version, 1) + 1
    );
  else
    new.auth_session_version := greatest(coalesce(new.auth_session_version, 1), 1);
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_completed_generation_mattermost_login_block() from public;
revoke all on function public.enforce_completed_generation_mattermost_login_block() from anon;
revoke all on function public.enforce_completed_generation_mattermost_login_block() from authenticated;

drop trigger if exists members_enforce_completed_generation_mattermost_login_block on public.members;
create trigger members_enforce_completed_generation_mattermost_login_block
  before insert or update of generation, mattermost_account_id, mattermost_login_disabled_at
  on public.members
  for each row execute function public.enforce_completed_generation_mattermost_login_block();

create or replace function public.disable_generation_mattermost_logins(
  p_generation integer
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_count integer;
begin
  if p_generation < 1 or p_generation > 99 then
    raise exception 'mattermost_login_disable_generation_invalid';
  end if;

  -- Triggers on normal member writes acquire the generation advisory lock
  -- after a row lock. EXCLUSIVE also conflicts with SELECT FOR UPDATE's
  -- ROW SHARE lock, so this batch cannot hold the advisory lock while
  -- waiting for a member row that later needs to update.
  lock table public.members in exclusive mode;
  perform pg_advisory_xact_lock(741515, p_generation);

  insert into public.member_mattermost_disabled_generations (generation)
  values (p_generation)
  on conflict (generation) do nothing;

  with updated_members as (
    update public.members
    set mattermost_login_disabled_at = now(),
        mattermost_login_disabled_reason = 'generation_completed',
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where generation = p_generation
      and deleted_at is null
      and mattermost_account_id is not null
      and mattermost_login_disabled_at is null
    returning id
  )
  select count(*)::integer into updated_count from updated_members;

  update public.member_password_action_tokens token
  set consumed_at = now()
  where token.delivery_channel = 'mattermost'
    and token.consumed_at is null
    and exists (
      select 1
      from public.members member
      where member.id = token.member_id
        and member.generation = p_generation
        and member.deleted_at is null
        and member.mattermost_account_id is not null
    );

  return updated_count;
end;
$$;

revoke all on function public.disable_generation_mattermost_logins(integer) from public;
revoke all on function public.disable_generation_mattermost_logins(integer) from anon;
revoke all on function public.disable_generation_mattermost_logins(integer) from authenticated;
grant execute on function public.disable_generation_mattermost_logins(integer) to service_role;

create or replace function public.begin_member_email_login_transition(
  p_member_id uuid,
  p_candidate_email text,
  p_email_reservation_hash text,
  p_reason text,
  p_initiated_by_admin_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  transition_row public.member_email_login_transitions%rowtype;
  token_id uuid;
  normalized_email text;
begin
  normalized_email := lower(btrim(p_candidate_email));
  if normalized_email is null or normalized_email = '' or normalized_email <> p_candidate_email then
    raise exception 'member_email_login_transition_email_invalid';
  end if;
  if p_email_reservation_hash is null
    or p_email_reservation_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'member_email_login_transition_email_reservation_invalid';
  end if;
  if p_reason not in ('generation_completed', 'member_departed', 'provider_not_found') then
    raise exception 'member_email_login_transition_reason_invalid';
  end if;
  if p_token_hash is null or btrim(p_token_hash) = '' or p_expires_at <= now() then
    raise exception 'member_email_login_transition_token_invalid';
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'member_email_login_transition_member_missing';
  end if;
  if member_row.mattermost_account_id is null then
    raise exception 'member_email_login_transition_member_not_linked';
  end if;
  if member_row.email_normalized is not null
    and member_row.email_normalized <> normalized_email then
    raise exception 'member_email_login_transition_email_mismatch';
  end if;
  if exists (
    select 1
    from public.members member
    where member.email_normalized = normalized_email
      and member.id <> p_member_id
  ) then
    raise exception 'member_email_login_transition_email_exists';
  end if;
  if exists (
    select 1
    from public.member_identifier_reservations reservation
    where reservation.identifier_kind = 'email'
      and reservation.identifier_hash = p_email_reservation_hash
  ) then
    raise exception 'member_email_login_transition_email_reserved';
  end if;

  select * into transition_row
  from public.member_email_login_transitions
  where member_id = p_member_id
  for update;
  if found and transition_row.status = 'completed' then
    raise exception 'member_email_login_transition_already_completed';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = p_member_id
    and consumed_at is null;

  begin
    insert into public.member_email_login_transitions (
      member_id,
      candidate_email,
      candidate_email_normalized,
      candidate_email_reservation_hash,
      reason,
      status,
      initiated_by_admin_id,
      password_action_token_id,
      email_sent_at,
      completed_at,
      updated_at
    ) values (
      p_member_id,
      normalized_email,
      normalized_email,
      p_email_reservation_hash,
      p_reason,
      'pending_delivery',
      p_initiated_by_admin_id,
      null,
      null,
      null,
      now()
    )
    on conflict (member_id) do update
    set candidate_email = excluded.candidate_email,
        candidate_email_normalized = excluded.candidate_email_normalized,
        candidate_email_reservation_hash = excluded.candidate_email_reservation_hash,
        reason = excluded.reason,
        status = 'pending_delivery',
        initiated_by_admin_id = excluded.initiated_by_admin_id,
        password_action_token_id = null,
        email_sent_at = null,
        completed_at = null,
        updated_at = now();
  exception
    when unique_violation then
      raise exception 'member_email_login_transition_email_exists';
  end;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    delivery_channel,
    token_hash,
    expires_at
  ) values (
    p_member_id,
    'member_email_login_transition',
    'email',
    p_token_hash,
    p_expires_at
  ) returning id into token_id;

  update public.member_email_login_transitions
  set password_action_token_id = token_id,
      updated_at = now()
  where member_id = p_member_id;

  update public.members
  set mattermost_login_disabled_at = coalesce(mattermost_login_disabled_at, now()),
      mattermost_login_disabled_reason = coalesce(mattermost_login_disabled_reason, p_reason),
      must_change_password = true,
      auth_session_version = auth_session_version + 1,
      updated_at = now()
  where id = p_member_id;

  return token_id;
end;
$$;

revoke all on function public.begin_member_email_login_transition(uuid, text, text, text, uuid, text, timestamp with time zone) from public;
revoke all on function public.begin_member_email_login_transition(uuid, text, text, text, uuid, text, timestamp with time zone) from anon;
revoke all on function public.begin_member_email_login_transition(uuid, text, text, text, uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.begin_member_email_login_transition(uuid, text, text, text, uuid, text, timestamp with time zone) to service_role;

create or replace function public.mark_member_email_login_transition_sent(
  p_token_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.member_email_login_transitions
  set status = 'email_sent',
      email_sent_at = now(),
      updated_at = now()
  where password_action_token_id = p_token_id
    and status = 'pending_delivery';
end;
$$;

revoke all on function public.mark_member_email_login_transition_sent(uuid) from public;
revoke all on function public.mark_member_email_login_transition_sent(uuid) from anon;
revoke all on function public.mark_member_email_login_transition_sent(uuid) from authenticated;
grant execute on function public.mark_member_email_login_transition_sent(uuid) to service_role;

create or replace function public.update_member_password_credentials(
  p_member_id uuid,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
begin
  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'member_password_action_member_missing';
  end if;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      auth_session_version = auth_session_version + 1,
      updated_at = now()
  where id = p_member_id;

  return p_member_id;
end;
$$;

revoke all on function public.update_member_password_credentials(uuid, text, text) from public;
revoke all on function public.update_member_password_credentials(uuid, text, text) from anon;
revoke all on function public.update_member_password_credentials(uuid, text, text) from authenticated;
grant execute on function public.update_member_password_credentials(uuid, text, text) to service_role;

create or replace function public.update_member_mattermost_password_credentials(
  p_member_id uuid,
  p_expected_mattermost_account_id uuid,
  p_expected_updated_at timestamp with time zone,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
begin
  if p_expected_mattermost_account_id is null
    or p_expected_updated_at is null then
    raise exception 'member_mattermost_password_update_invalid';
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'member_mattermost_password_update_member_missing';
  end if;
  if member_row.mattermost_account_id is distinct from p_expected_mattermost_account_id
    or member_row.mattermost_login_disabled_at is not null
    or member_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'member_mattermost_password_update_not_allowed';
  end if;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      auth_session_version = auth_session_version + 1,
      updated_at = now()
  where id = p_member_id;

  return p_member_id;
end;
$$;

revoke all on function public.update_member_mattermost_password_credentials(uuid, uuid, timestamp with time zone, text, text) from public;
revoke all on function public.update_member_mattermost_password_credentials(uuid, uuid, timestamp with time zone, text, text) from anon;
revoke all on function public.update_member_mattermost_password_credentials(uuid, uuid, timestamp with time zone, text, text) from authenticated;
grant execute on function public.update_member_mattermost_password_credentials(uuid, uuid, timestamp with time zone, text, text) to service_role;

create or replace function public.complete_member_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.member_password_action_tokens%rowtype;
  transition_row public.member_email_login_transitions%rowtype;
  member_row public.members%rowtype;
  token_id uuid;
  member_id uuid;
begin
  -- Lock the member first, matching begin_member_email_login_transition.
  -- The token is re-read after that lock so a concurrent resend safely wins.
  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in (
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'member_password_action_invalid_or_expired';
  end if;
  token_id := token_row.id;
  member_id := token_row.member_id;

  select * into member_row
  from public.members
  where id = member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'member_password_action_member_missing';
  end if;

  select * into token_row
  from public.member_password_action_tokens
  where id = token_id
    and token_hash = p_token_hash
    and purpose in (
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'member_password_action_invalid_or_expired';
  end if;

  if member_row.mattermost_login_disabled_at is not null
    and token_row.delivery_channel = 'mattermost' then
    raise exception 'member_password_action_mattermost_login_disabled';
  end if;

  if token_row.purpose = 'member_email_login_transition' then
    select * into transition_row
    from public.member_email_login_transitions
    where member_id = token_row.member_id
      and password_action_token_id = token_row.id
      and status in ('pending_delivery', 'email_sent')
    for update;
    if not found then
      raise exception 'member_email_login_transition_invalid';
    end if;
    if exists (
      select 1
      from public.members member
      where member.email_normalized = transition_row.candidate_email_normalized
        and member.id <> token_row.member_id
    ) then
      raise exception 'member_email_login_transition_email_exists';
    end if;
    if exists (
      select 1
      from public.member_identifier_reservations reservation
      where reservation.identifier_kind = 'email'
        and reservation.identifier_hash = transition_row.candidate_email_reservation_hash
    ) then
      raise exception 'member_email_login_transition_email_reserved';
    end if;
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where id = token_row.id;

  if token_row.purpose = 'member_email_login_transition' then
    update public.members
    set password_hash = p_password_hash,
        password_salt = p_password_salt,
        email = transition_row.candidate_email,
        email_normalized = transition_row.candidate_email_normalized,
        email_verified_at = now(),
        must_change_password = false,
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where id = token_row.member_id
      and deleted_at is null;
    if not found then
      raise exception 'member_password_action_member_missing';
    end if;

    update public.member_email_login_transitions
    set status = 'completed',
        completed_at = now(),
        updated_at = now()
    where id = transition_row.id;
  else
    update public.members
    set password_hash = p_password_hash,
        password_salt = p_password_salt,
        must_change_password = false,
        email_verified_at = case
          when token_row.delivery_channel = 'email' then coalesce(email_verified_at, now())
          else email_verified_at
        end,
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where id = token_row.member_id
      and deleted_at is null;
    if not found then
      raise exception 'member_password_action_member_missing';
    end if;
  end if;

  return token_row.member_id;
end;
$$;

revoke all on function public.complete_member_password_action(text, text, text) from public;
revoke all on function public.complete_member_password_action(text, text, text) from anon;
revoke all on function public.complete_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_member_password_action(text, text, text) to service_role;

create or replace function public.complete_member_password_action_with_delivery(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.member_password_action_tokens%rowtype;
  completed_member_id uuid;
begin
  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in (
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'member_password_action_invalid_or_expired';
  end if;

  completed_member_id := public.complete_member_password_action(
    p_token_hash,
    p_password_hash,
    p_password_salt
  );
  return jsonb_build_object(
    'memberId', completed_member_id,
    'deliveryChannel', token_row.delivery_channel
  );
end;
$$;

revoke all on function public.complete_member_password_action_with_delivery(text, text, text) from public;
revoke all on function public.complete_member_password_action_with_delivery(text, text, text) from anon;
revoke all on function public.complete_member_password_action_with_delivery(text, text, text) from authenticated;
grant execute on function public.complete_member_password_action_with_delivery(text, text, text) to service_role;

create or replace function public.complete_manual_member_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  return public.complete_member_password_action(
    p_token_hash,
    p_password_hash,
    p_password_salt
  );
end;
$$;

revoke all on function public.complete_manual_member_password_action(text, text, text) from public;
revoke all on function public.complete_manual_member_password_action(text, text, text) from anon;
revoke all on function public.complete_manual_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_manual_member_password_action(text, text, text) to service_role;

create or replace function public.complete_graduate_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.member_password_action_tokens%rowtype;
  member_row public.members%rowtype;
  token_id uuid;
  member_id uuid;
begin
  -- Keep the same member-first lock order as every transition action.
  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in ('graduate_initial_setup', 'graduate_password_reset')
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'graduate_password_action_invalid';
  end if;
  token_id := token_row.id;
  member_id := token_row.member_id;

  select * into member_row
  from public.members
  where id = member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'graduate_password_action_member_missing';
  end if;

  select * into token_row
  from public.member_password_action_tokens
  where id = token_id
    and token_hash = p_token_hash
    and purpose in ('graduate_initial_setup', 'graduate_password_reset')
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'graduate_password_action_invalid';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where id = token_row.id;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      auth_session_version = auth_session_version + 1,
      updated_at = now()
  where id = token_row.member_id
    and deleted_at is null;
  if not found then
    raise exception 'graduate_password_action_member_missing';
  end if;

  return token_row.member_id;
end;
$$;

revoke all on function public.complete_graduate_password_action(text, text, text) from public;
revoke all on function public.complete_graduate_password_action(text, text, text) from anon;
revoke all on function public.complete_graduate_password_action(text, text, text) from authenticated;
grant execute on function public.complete_graduate_password_action(text, text, text) to service_role;
