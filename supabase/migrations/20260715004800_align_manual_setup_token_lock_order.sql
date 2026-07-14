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
declare
  candidate_member_id uuid;
  member_row public.members%rowtype;
  token_row public.member_password_action_tokens%rowtype;
begin
  -- Identify the member without locking the token. All mutations below lock
  -- the member first, then the token, matching the reissue RPC.
  select member_id into candidate_member_id
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in ('manual_initial_setup', 'manual_password_reset')
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'manual_password_action_invalid_or_expired';
  end if;

  select * into member_row
  from public.members
  where id = candidate_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'manual_password_action_member_missing';
  end if;

  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in ('manual_initial_setup', 'manual_password_reset')
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found or token_row.member_id <> member_row.id then
    raise exception 'manual_password_action_invalid_or_expired';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where id = token_row.id;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      email_verified_at = case
        when token_row.delivery_channel = 'email' then coalesce(email_verified_at, now())
        else email_verified_at
      end,
      updated_at = now()
  where id = member_row.id;

  return member_row.id;
end;
$$;

revoke all on function public.complete_manual_member_password_action(text, text, text) from public;
revoke all on function public.complete_manual_member_password_action(text, text, text) from anon;
revoke all on function public.complete_manual_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_manual_member_password_action(text, text, text) to service_role;
