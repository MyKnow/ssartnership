create or replace function public.reissue_manual_member_initial_setup(
  p_member_id uuid,
  p_delivery_channel text,
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
begin
  if p_delivery_channel not in ('mattermost', 'email') then
    raise exception 'manual_member_reissue_delivery_channel_invalid';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'manual_member_reissue_token_hash_invalid';
  end if;
  if p_expires_at <= now() then
    raise exception 'manual_member_reissue_expiry_invalid';
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
    and must_change_password = true
  for update;
  if not found then
    raise exception 'manual_member_reissue_not_required';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = member_row.id
    and purpose = 'manual_initial_setup'
    and consumed_at is null;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    delivery_channel,
    token_hash,
    expires_at
  ) values (
    member_row.id,
    'manual_initial_setup',
    p_delivery_channel,
    p_token_hash,
    p_expires_at
  );

  return member_row.id;
end;
$$;

revoke all on function public.reissue_manual_member_initial_setup(uuid, text, text, timestamp with time zone) from public;
revoke all on function public.reissue_manual_member_initial_setup(uuid, text, text, timestamp with time zone) from anon;
revoke all on function public.reissue_manual_member_initial_setup(uuid, text, text, timestamp with time zone) from authenticated;
grant execute on function public.reissue_manual_member_initial_setup(uuid, text, text, timestamp with time zone) to service_role;
