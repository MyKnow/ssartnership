-- Keep administrator-issued member password actions atomic and singular.
-- A member who has not completed initial setup receives a replacement setup
-- action, while a configured member receives a password reset action.
create or replace function public.issue_admin_member_password_action(
  p_member_id uuid,
  p_purpose text,
  p_delivery_channel text,
  p_expected_email text,
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
  token_id uuid;
begin
  if not (p_purpose in ('manual_initial_setup', 'admin_password_reset')) then
    raise exception 'admin_member_password_action_purpose_invalid';
  end if;
  if not (p_delivery_channel in ('email', 'admin')) then
    raise exception 'admin_member_password_action_delivery_invalid';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'admin_member_password_action_token_invalid';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'admin_member_password_action_expiry_invalid';
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'admin_member_password_action_member_missing';
  end if;
  if p_delivery_channel = 'email' and member_row.email_normalized is null then
    raise exception 'admin_member_password_action_email_missing';
  end if;
  if p_delivery_channel = 'email'
    and member_row.email_normalized is distinct from p_expected_email then
    raise exception 'admin_member_password_action_email_changed';
  end if;
  if member_row.must_change_password <> (p_purpose = 'manual_initial_setup') then
    raise exception 'admin_member_password_action_state_changed';
  end if;
  if exists (
    select 1
    from public.member_email_login_transitions transition
    where transition.member_id = member_row.id
      and transition.status in ('pending_delivery', 'email_sent')
  ) then
    raise exception 'admin_member_password_action_transition_pending';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = member_row.id
    and consumed_at is null;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    delivery_channel,
    token_hash,
    expires_at
  ) values (
    member_row.id,
    p_purpose,
    p_delivery_channel,
    p_token_hash,
    p_expires_at
  )
  returning id into token_id;

  return token_id;
end;
$$;

revoke all on function public.issue_admin_member_password_action(uuid, text, text, text, text, timestamp with time zone) from public;
revoke all on function public.issue_admin_member_password_action(uuid, text, text, text, text, timestamp with time zone) from anon;
revoke all on function public.issue_admin_member_password_action(uuid, text, text, text, text, timestamp with time zone) from authenticated;
grant execute on function public.issue_admin_member_password_action(uuid, text, text, text, text, timestamp with time zone) to service_role;
