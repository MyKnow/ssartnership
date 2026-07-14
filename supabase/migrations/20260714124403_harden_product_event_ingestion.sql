-- Product telemetry remains best-effort, but a repeated client delivery must
-- never create a second raw event or a second trigger-driven metric rollup.
alter table public.event_logs
  add column if not exists event_id uuid,
  add column if not exists schema_version integer,
  add column if not exists occurred_at timestamp with time zone,
  add column if not exists recorded_at timestamp with time zone,
  add column if not exists request_id text;

alter table public.event_logs
  drop constraint if exists event_logs_schema_version_check;
alter table public.event_logs
  add constraint event_logs_schema_version_check
  check (schema_version is null or schema_version >= 1);

alter table public.admin_audit_logs
  add column if not exists request_id text;

alter table public.auth_security_logs
  add column if not exists request_id text;

create unique index if not exists event_logs_event_id_key
  on public.event_logs(event_id)
  where event_id is not null;

create or replace function public.ingest_product_event(
  input_event_id uuid,
  input_schema_version integer,
  input_occurred_at timestamp with time zone,
  input_request_id text,
  input_session_id text,
  input_actor_type text,
  input_actor_id text,
  input_event_name text,
  input_path text,
  input_referrer text,
  input_target_type text,
  input_target_id text,
  input_properties jsonb,
  input_user_agent text,
  input_ip_address text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  recorded_at_value timestamp with time zone := now();
begin
  if input_event_id is null then
    raise exception 'product_event_id_required';
  end if;

  if input_schema_version is null or input_schema_version < 1 then
    raise exception 'product_event_schema_version_invalid';
  end if;

  insert into public.event_logs (
    event_id,
    schema_version,
    occurred_at,
    recorded_at,
    request_id,
    session_id,
    actor_type,
    actor_id,
    event_name,
    path,
    referrer,
    target_type,
    target_id,
    properties,
    user_agent,
    ip_address,
    created_at
  )
  values (
    input_event_id,
    input_schema_version,
    coalesce(input_occurred_at, recorded_at_value),
    recorded_at_value,
    input_request_id,
    input_session_id,
    input_actor_type,
    input_actor_id,
    input_event_name,
    input_path,
    input_referrer,
    input_target_type,
    input_target_id,
    coalesce(input_properties, '{}'::jsonb),
    input_user_agent,
    input_ip_address,
    recorded_at_value
  )
  on conflict (event_id) where event_id is not null do nothing;

  return found;
end;
$$;

revoke all on function public.ingest_product_event(uuid, integer, timestamp with time zone, text, text, text, text, text, text, text, text, text, jsonb, text, text) from public;
revoke all on function public.ingest_product_event(uuid, integer, timestamp with time zone, text, text, text, text, text, text, text, text, text, jsonb, text, text) from anon;
revoke all on function public.ingest_product_event(uuid, integer, timestamp with time zone, text, text, text, text, text, text, text, text, text, jsonb, text, text) from authenticated;
grant execute on function public.ingest_product_event(uuid, integer, timestamp with time zone, text, text, text, text, text, text, text, text, text, jsonb, text, text) to service_role;
