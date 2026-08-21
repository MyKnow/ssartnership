-- Administrators can issue a one-time password reset link for an active
-- member. "admin" is intentionally distinct from email delivery: possessing
-- an administrator-shared link must not verify an email address.
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
      'member_email_login_transition',
      'member_email_recovery_initial_setup',
      'admin_password_reset'
    )
  );

alter table public.member_password_action_tokens
  drop constraint if exists member_password_action_tokens_delivery_channel_check;
alter table public.member_password_action_tokens
  add constraint member_password_action_tokens_delivery_channel_check
  check (delivery_channel in ('mattermost', 'email', 'admin'));

create index if not exists members_admin_email_normalized_trgm_idx
  on public.members using gin (email_normalized extensions.gin_trgm_ops)
  where deleted_at is null and email_normalized is not null;

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
      'member_email_login_transition',
      'admin_password_reset'
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
      'member_email_login_transition',
      'admin_password_reset'
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
  authentication_method text;
begin
  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in (
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition',
      'admin_password_reset'
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

  authentication_method := case token_row.delivery_channel
    when 'mattermost' then 'mattermost'
    when 'email' then 'email'
    else 'manual'
  end;

  return jsonb_build_object(
    'memberId', completed_member_id,
    'deliveryChannel', token_row.delivery_channel,
    'authenticationMethod', authentication_method
  );
end;
$$;

revoke all on function public.complete_member_password_action_with_delivery(text, text, text) from public;
revoke all on function public.complete_member_password_action_with_delivery(text, text, text) from anon;
revoke all on function public.complete_member_password_action_with_delivery(text, text, text) from authenticated;
grant execute on function public.complete_member_password_action_with_delivery(text, text, text) to service_role;
