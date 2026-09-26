-- The showcase submission form stages its cover image through the common upload
-- flow, but reserve_image_upload_sessions still carried the purpose allowlist from
-- 20260831093232 and rejected 'showcase-project' with image_upload_reservation_invalid.
-- Redefine the RPC with the same body plus the new purpose; the table constraint
-- already allows it since 20260925200437.
create or replace function public.reserve_image_upload_sessions(
  p_owner_kind text,
  p_owner_id text,
  p_purpose text,
  p_quota_identifiers text[],
  p_sessions jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamp with time zone := pg_catalog.statement_timestamp();
  v_window_started_at timestamp with time zone;
  v_session_count integer;
  v_distinct_session_count integer;
  v_total_quota_size_bytes bigint;
  v_active_object_count bigint;
  v_active_quota_size_bytes bigint;
  v_identifier_count integer;
  v_distinct_identifier_count integer;
  v_sessions_valid boolean;
  lock_record record;
  quota_record record;
begin
  if p_owner_kind is null
    or p_owner_kind not in (
      'admin',
      'member',
      'partner',
      'graduate_challenge',
      'guest',
      'signup'
    )
    or p_owner_id is null
    or pg_catalog.char_length(pg_catalog.btrim(p_owner_id)) not between 1 and 256
    or p_purpose is null
    or p_purpose not in (
      'partner',
      'partner-registration',
      'partner-change-request',
      'review',
      'profile',
      'member-signup-profile',
      'graduate-verification',
      'manual-member-import',
      'promotion',
      'showcase-project'
    )
    or p_quota_identifiers is null
    or p_sessions is null
    or pg_catalog.jsonb_typeof(p_sessions) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'image_upload_reservation_invalid';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct identifier_hash)::integer
  into v_identifier_count, v_distinct_identifier_count
  from pg_catalog.unnest(p_quota_identifiers) as quota(identifier_hash);

  if v_identifier_count not between 1 and 4
    or v_distinct_identifier_count <> v_identifier_count
    or exists (
      select 1
      from pg_catalog.unnest(p_quota_identifiers) as quota(identifier_hash)
      where quota.identifier_hash is null
        or quota.identifier_hash !~ '^[0-9a-f]{64}$'
    ) then
    raise exception using
      errcode = '22023',
      message = 'image_upload_reservation_invalid';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct session.id)::integer,
    coalesce(pg_catalog.sum(session.quota_size_bytes), 0)::bigint,
    pg_catalog.bool_and(coalesce(
      session.id is not null
      and session.role is not null
      and pg_catalog.char_length(pg_catalog.btrim(session.role)) between 1 and 64
      and session.role ~ '^[a-z][a-z0-9-]*$'
      and session.storage_path is not null
      and session.storage_path like 'staging/' || session.id::text || '.%'
      and pg_catalog.char_length(session.storage_path) between 46 and 320
      and session.source_content_type is not null
      and pg_catalog.char_length(pg_catalog.btrim(session.source_content_type)) between 1 and 128
      and session.source_size_bytes between 1 and 10485760
      and session.quota_size_bytes between session.source_size_bytes and 10485760
      and session.signed_url_expires_at > v_now
      and session.signed_url_expires_at <= v_now + interval '15 minutes'
      and session.expires_at > session.signed_url_expires_at
      and session.expires_at <= v_now + interval '3 hours',
      false
    ))
  into
    v_session_count,
    v_distinct_session_count,
    v_total_quota_size_bytes,
    v_sessions_valid
  from pg_catalog.jsonb_to_recordset(p_sessions) as session(
    id uuid,
    role text,
    storage_path text,
    source_content_type text,
    source_size_bytes integer,
    quota_size_bytes bigint,
    signed_url_expires_at timestamp with time zone,
    expires_at timestamp with time zone
  );

  if v_session_count not between 1 and 20
    or v_distinct_session_count <> v_session_count
    or v_sessions_valid is not true
    or v_total_quota_size_bytes > 209715200 then
    raise exception using
      errcode = '22023',
      message = 'image_upload_reservation_invalid';
  end if;

  -- Lock in globally sorted advisory-key order so overlapping owner and quota
  -- reservations cannot acquire the same locks in opposite order.
  for lock_record in
    select distinct
      pg_catalog.hashtextextended(lock_source.lock_name, 0) as advisory_key
    from (
      select 'image-upload-owner:' || p_owner_kind || ':' || p_owner_id as lock_name
      union all
      select 'image-upload-quota:' || quota.identifier_hash
      from pg_catalog.unnest(p_quota_identifiers) as quota(identifier_hash)
    ) as lock_source
    order by advisory_key
  loop
    perform pg_catalog.pg_advisory_xact_lock(lock_record.advisory_key);
  end loop;

  select
    pg_catalog.count(*),
    coalesce(pg_catalog.sum(quota_size_bytes), 0)
  into v_active_object_count, v_active_quota_size_bytes
  from public.image_upload_sessions
  where owner_kind = p_owner_kind
    and owner_id = p_owner_id
    and status in ('signed', 'processing', 'ready', 'attaching')
    and expires_at > v_now;

  if v_active_object_count + v_session_count > 40
    or v_active_quota_size_bytes + v_total_quota_size_bytes > 209715200 then
    raise exception using
      errcode = 'P0001',
      message = 'image_upload_quota_exceeded';
  end if;

  v_window_started_at := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from v_now) / 600) * 600
  );

  for quota_record in
    select
      requested.identifier_hash,
      coalesce(existing.request_count, 0) as request_count,
      coalesce(existing.object_count, 0) as object_count,
      coalesce(existing.reserved_size_bytes, 0) as reserved_size_bytes
    from pg_catalog.unnest(p_quota_identifiers) as requested(identifier_hash)
    left join public.image_upload_quota_windows as existing
      on existing.identifier_hash = requested.identifier_hash
     and existing.window_started_at = v_window_started_at
    order by requested.identifier_hash
  loop
    if quota_record.request_count + 1 > 20
      or quota_record.object_count + v_session_count > 60
      or quota_record.reserved_size_bytes + v_total_quota_size_bytes > 209715200 then
      raise exception using
        errcode = 'P0001',
        message = 'image_upload_quota_exceeded';
    end if;

    insert into public.image_upload_quota_windows (
      identifier_hash,
      window_started_at,
      request_count,
      object_count,
      reserved_size_bytes,
      updated_at
    ) values (
      quota_record.identifier_hash,
      v_window_started_at,
      1,
      v_session_count,
      v_total_quota_size_bytes,
      v_now
    )
    on conflict (identifier_hash, window_started_at) do update
    set request_count = public.image_upload_quota_windows.request_count + 1,
        object_count = public.image_upload_quota_windows.object_count + excluded.object_count,
        reserved_size_bytes = public.image_upload_quota_windows.reserved_size_bytes
          + excluded.reserved_size_bytes,
        updated_at = excluded.updated_at;
  end loop;

  insert into public.image_upload_sessions (
    id,
    owner_kind,
    owner_id,
    purpose,
    role,
    storage_bucket,
    storage_path,
    source_storage_path,
    source_content_type,
    source_size_bytes,
    quota_size_bytes,
    signed_url_expires_at,
    expires_at
  )
  select
    session.id,
    p_owner_kind,
    p_owner_id,
    p_purpose,
    session.role,
    'image-upload-staging',
    session.storage_path,
    session.storage_path,
    session.source_content_type,
    session.source_size_bytes,
    session.quota_size_bytes,
    session.signed_url_expires_at,
    session.expires_at
  from pg_catalog.jsonb_to_recordset(p_sessions) as session(
    id uuid,
    role text,
    storage_path text,
    source_content_type text,
    source_size_bytes integer,
    quota_size_bytes bigint,
    signed_url_expires_at timestamp with time zone,
    expires_at timestamp with time zone
  );

  return v_session_count;
end;
$$;

revoke all on function public.reserve_image_upload_sessions(text, text, text, text[], jsonb) from public;
revoke all on function public.reserve_image_upload_sessions(text, text, text, text[], jsonb) from anon;
revoke all on function public.reserve_image_upload_sessions(text, text, text, text[], jsonb) from authenticated;
grant execute on function public.reserve_image_upload_sessions(text, text, text, text[], jsonb) to service_role;
