begin;

alter table public.mattermost_sender_credentials
  drop constraint if exists mattermost_sender_credentials_test_target_check;

alter table public.mattermost_sender_credentials
  add constraint mattermost_sender_credentials_test_target_check
  check (
    last_test_target_kind is null
    or last_test_target_kind in ('self', 'previous_generation_sender', 'super_admin_bootstrap')
  );

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
  if coalesce(p_test_target_kind, '') not in (
    'self', 'previous_generation_sender', 'super_admin_bootstrap'
  ) then
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

commit;
