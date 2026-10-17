-- OAuth credentials are opaque random values; only SHA-256 hashes are stored.
create table public.mcp_oauth_clients (
  id uuid primary key,
  value jsonb not null,
  created_at timestamptz not null default now()
);
create table public.mcp_oauth_records (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint mcp_record_key_check check (key ~ '^(grant|code|access|refresh|review|quota):[a-zA-Z0-9_-]{1,128}$')
);
create index mcp_oauth_records_expiry_idx on public.mcp_oauth_records(expires_at);
alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_records enable row level security;
revoke all on table public.mcp_oauth_clients from public, anon, authenticated;
revoke all on table public.mcp_oauth_records from public, anon, authenticated;
grant select, insert, update, delete on public.mcp_oauth_clients, public.mcp_oauth_records to service_role;

create function public.mcp_create_grant(p_grant jsonb, p_code jsonb)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_code->>'grantId' is distinct from p_grant->>'id' then raise exception 'mcp_invalid_grant'; end if;
  insert into public.mcp_oauth_records(key,value,expires_at) values
    ('grant:'||(p_grant->>'id'),p_grant,to_timestamp((p_grant->>'expiresAt')::numeric/1000)),
    ('code:'||(p_code->>'hash'),p_code,to_timestamp((p_code->>'expiresAt')::numeric/1000));
  -- Bound expired auth material retention; refresh tombstones outlive the token family.
  delete from public.mcp_oauth_records where key in
    (select key from public.mcp_oauth_records where expires_at < now()-interval '30 days' order by expires_at limit 500);
end;
$$;

create function public.mcp_exchange_credential(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare c public.mcp_oauth_records%rowtype; g public.mcp_oauth_records%rowtype; k text;
begin
  if p_input->>'kind' not in ('code','refresh') then return null; end if;
  k := (p_input->>'kind')||':'||(p_input->>'hash');
  select * into c from public.mcp_oauth_records where key=k for update;
  if not found or c.expires_at <= now() then return null; end if;
  select * into g from public.mcp_oauth_records where key='grant:'||(c.value->>'grantId') for update;
  if not found or g.expires_at <= now() or coalesce((g.value->>'revoked')::boolean,false)
    or g.value->>'clientId' is distinct from p_input->>'clientId'
    or g.value->>'resource' is distinct from p_input->>'resource' then return null; end if;
  if p_input->>'kind'='code' and (c.value->>'challenge' is distinct from p_input->>'challenge'
    or c.value->>'redirectUri' is distinct from p_input->>'redirectUri') then return null; end if;
  if coalesce((c.value->>'consumed')::boolean,false) then
    if p_input->>'kind'='refresh' then
      update public.mcp_oauth_records set value=jsonb_set(value,'{revoked}','true') where key=g.key;
    end if;
    return null;
  end if;
  if p_input->'access'->>'grantId' is distinct from g.value->>'id'
    or p_input->'refresh'->>'grantId' is distinct from g.value->>'id' then return null; end if;
  update public.mcp_oauth_records set value=jsonb_set(value,'{consumed}','true') where key=k;
  insert into public.mcp_oauth_records(key,value,expires_at) values
    ('access:'||(p_input->'access'->>'hash'),p_input->'access',least(g.expires_at,to_timestamp((p_input->'access'->>'expiresAt')::numeric/1000))),
    ('refresh:'||(p_input->'refresh'->>'hash'),p_input->'refresh',g.expires_at);
  return g.value;
end;
$$;

create function public.mcp_revoke_grant(p_admin_id uuid,p_id uuid)
returns void language sql security invoker set search_path = pg_catalog, public as $$
  update public.mcp_oauth_records set value=jsonb_set(value,'{revoked}','true')
  where key='grant:'||p_id::text and value->>'adminId'=p_admin_id::text;
$$;

create function public.mcp_approve_review(p_admin_id uuid,p_id uuid)
returns boolean language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  update public.mcp_oauth_records set value=jsonb_set(value,'{approved}','true')
  where key='review:'||p_id::text and value->>'adminId'=p_admin_id::text and expires_at>now();
  return found;
end;
$$;

create function public.mcp_commit_review(p_admin_id uuid,p_grant_id uuid,p_client_id uuid,p_id uuid)
returns text language plpgsql security invoker set search_path = pg_catalog, public as $$
declare g public.mcp_oauth_records%rowtype; r public.mcp_oauth_records%rowtype;
  f public.showcase_feedback%rowtype; a public.admin_profiles%rowtype; snapshot jsonb;
begin
  select * into g from public.mcp_oauth_records where key='grant:'||p_grant_id::text for update;
  if not found or g.expires_at<=now() or coalesce((g.value->>'revoked')::boolean,false)
    or g.value->>'adminId' is distinct from p_admin_id::text or g.value->>'clientId' is distinct from p_client_id::text
    or not coalesce((g.value->'scopes' ? 'showcase:moderate'),false) then return 'forbidden'; end if;
  select * into a from public.admin_profiles where member_id=p_admin_id for share;
  if not found or not a.is_active or a.permission_template_key='regional_partner_manager'
    or a.permission_version is distinct from (g.value->>'permissionVersion')::integer then return 'forbidden'; end if;
  perform 1 from public.admin_permission_templates where key=a.permission_template_key
    and coalesce((permissions #>> '{events,update}')::boolean,false) for share;
  if not found then return 'forbidden'; end if;
  snapshot := public.get_admin_session_snapshot(p_admin_id);
  if snapshot is null or not coalesce((snapshot->>'is_active')::boolean,false)
    or coalesce((snapshot->>'must_change_password')::boolean,true) then return 'forbidden'; end if;
  select * into r from public.mcp_oauth_records where key='review:'||p_id::text for update;
  if not found or r.expires_at<=now() or r.value->>'adminId' is distinct from p_admin_id::text
    or r.value->>'grantId' is distinct from p_grant_id::text or r.value->>'clientId' is distinct from p_client_id::text
    or not coalesce((r.value->>'approved')::boolean,false) then return 'forbidden'; end if;
  if coalesce((r.value->>'executed')::boolean,false) then return 'replayed'; end if;
  select * into f from public.showcase_feedback where id=(r.value->>'feedbackId')::uuid for update;
  if not found or (f.hidden_at is not null) is distinct from (r.value->>'previousHidden')::boolean
    or encode(sha256(convert_to(f.body,'UTF8')),'hex') is distinct from r.value->>'previousBodyHash' then return 'conflict'; end if;
  -- Reuse the existing business RPC. Mutation, receipt and audit share one transaction.
  perform public.set_showcase_feedback_hidden(f.id,p_admin_id,(r.value->>'hidden')::boolean);
  insert into public.admin_audit_logs(actor_type,actor_id,action,path,target_type,target_id,properties)
    values ('admin',p_admin_id::text,'showcase_feedback_visibility_update','/api/mcp','showcase_feedback',f.id::text,
      jsonb_build_object('hidden',(r.value->>'hidden')::boolean,'channel','mcp','reviewId',p_id));
  update public.mcp_oauth_records set value=jsonb_set(value,'{executed}','true') where key=r.key;
  return 'executed';
end;
$$;

revoke all on function public.mcp_create_grant(jsonb,jsonb), public.mcp_exchange_credential(jsonb), public.mcp_revoke_grant(uuid,uuid), public.mcp_approve_review(uuid,uuid), public.mcp_commit_review(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.mcp_create_grant(jsonb,jsonb), public.mcp_exchange_credential(jsonb), public.mcp_revoke_grant(uuid,uuid), public.mcp_approve_review(uuid,uuid), public.mcp_commit_review(uuid,uuid,uuid,uuid) to service_role;

-- Atomic, cross-worker minute quota; keys contain SHA-256 digests, never addresses/tokens.
create function public.mcp_consume_quota(p_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.mcp_oauth_records%rowtype; n integer; allowed boolean;
begin
  if p_key is null or p_limit is null or p_key !~ '^[a-f0-9]{64}$' or p_limit not between 1 and 1000 then return false; end if;
  insert into public.mcp_oauth_records(key,value,expires_at)
    values ('quota:'||p_key,jsonb_build_object('count',0),now()+interval '1 minute') on conflict (key) do nothing;
  select * into r from public.mcp_oauth_records where key='quota:'||p_key for update;
  n := case when r.expires_at<=now() then 0 else (r.value->>'count')::integer end;
  allowed := n<p_limit;
  if allowed then
    update public.mcp_oauth_records set value=jsonb_build_object('count',n+1),
      expires_at=case when r.expires_at<=now() then now()+interval '1 minute' else r.expires_at end where key=r.key;
  end if;
  -- Lock the current bucket first; the expiry index bounds each concurrent sweep.
  -- Credential/review records and refresh-replay tombstones have separate retention.
  delete from public.mcp_oauth_records stale using (
    select expired.key from public.mcp_oauth_records expired
    where expired.expires_at<=now() and expired.key like 'quota:%'
    order by expired.expires_at limit 500 for update skip locked
  ) garbage where stale.key=garbage.key;
  return allowed;
end;
$$;
revoke all on function public.mcp_consume_quota(text,integer) from public, anon, authenticated;
grant execute on function public.mcp_consume_quota(text,integer) to service_role;
