create or replace function public.reserve_member_email_recovery_challenge(
  p_member_id uuid,
  p_email_normalized text,
  p_code_hash text,
  p_expires_at timestamp with time zone,
  p_resend_available_at timestamp with time zone
)
returns table (
  challenge_id uuid,
  accepted boolean,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  member_row public.members%rowtype;
  existing_challenge public.member_email_challenges%rowtype;
  reservation_time timestamp with time zone;
  inserted_challenge_id uuid;
begin
  reservation_time := pg_catalog.clock_timestamp();
  if p_member_id is null
    or p_email_normalized is null
    or p_email_normalized = ''
    or pg_catalog.lower(pg_catalog.btrim(p_email_normalized)) <> p_email_normalized
    or p_code_hash is null
    or p_code_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at is null
    or p_expires_at <= reservation_time
    or p_resend_available_at is null
    or p_resend_available_at <= reservation_time
    or p_resend_available_at > p_expires_at then
    raise exception using
      errcode = '22023',
      message = 'member_email_recovery_challenge_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_member_id::text || ':email_recovery', 0)
  );

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'member_email_recovery_challenge_member_missing';
  end if;

  select * into existing_challenge
  from public.member_email_challenges
  where member_id = p_member_id
    and purpose = 'email_recovery'
    and consumed_at is null
    and expires_at > reservation_time
  order by created_at desc, id desc
  limit 1
  for update;

  if found and existing_challenge.resend_available_at > reservation_time then
    return query select
      existing_challenge.id,
      false,
      greatest(
        1,
        pg_catalog.ceil(
          extract(
            epoch from existing_challenge.resend_available_at - reservation_time
          )
        )::integer
      );
    return;
  end if;

  update public.member_email_challenges
  set consumed_at = reservation_time
  where member_id = p_member_id
    and purpose = 'email_recovery'
    and consumed_at is null;

  insert into public.member_email_challenges (
    member_id,
    email_normalized,
    purpose,
    code_hash,
    expires_at,
    resend_available_at,
    delivery_status
  ) values (
    p_member_id,
    p_email_normalized,
    'email_recovery',
    p_code_hash,
    p_expires_at,
    p_resend_available_at,
    'pending'
  )
  returning id into inserted_challenge_id;

  return query select inserted_challenge_id, true, 0;
end;
$$;

create or replace function public.mark_member_email_recovery_challenge_sent(
  p_challenge_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  updated_count integer;
begin
  if p_challenge_id is null then
    return false;
  end if;

  update public.member_email_challenges
  set delivery_status = 'sent'
  where id = p_challenge_id
    and purpose = 'email_recovery'
    and delivery_status = 'pending'
    and consumed_at is null;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

create or replace function public.delete_pending_member_email_recovery_challenge(
  p_challenge_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  deleted_count integer;
begin
  if p_challenge_id is null then
    return false;
  end if;

  delete from public.member_email_challenges
  where id = p_challenge_id
    and purpose = 'email_recovery'
    and delivery_status = 'pending';
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

create or replace function public.complete_member_email_recovery(
  p_member_id uuid,
  p_email_normalized text,
  p_email_reservation_hash text,
  p_code_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  member_row public.members%rowtype;
  challenge_row public.member_email_challenges%rowtype;
  completion_time timestamp with time zone;
begin
  if p_member_id is null
    or p_email_normalized is null
    or p_email_normalized = ''
    or pg_catalog.lower(pg_catalog.btrim(p_email_normalized)) <> p_email_normalized
    or p_email_reservation_hash is null
    or p_email_reservation_hash !~ '^[0-9a-f]{64}$'
    or p_code_hash is null
    or p_code_hash !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'invalid_request'
    );
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'member_missing'
    );
  end if;

  select * into challenge_row
  from public.member_email_challenges
  where member_id = p_member_id
    and purpose = 'email_recovery'
  order by created_at desc, id desc
  limit 1
  for update;
  if not found then
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'challenge_missing'
    );
  end if;

  completion_time := pg_catalog.clock_timestamp();

  if challenge_row.email_normalized <> p_email_normalized
    or challenge_row.delivery_status <> 'sent' then
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'challenge_missing'
    );
  end if;

  if challenge_row.consumed_at is not null
    or challenge_row.verified_at is not null then
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'challenge_consumed'
    );
  end if;

  if challenge_row.expires_at <= completion_time then
    update public.member_email_challenges
    set consumed_at = completion_time
    where id = challenge_row.id
      and consumed_at is null;
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'challenge_expired'
    );
  end if;

  if challenge_row.attempt_count >= 5 then
    update public.member_email_challenges
    set consumed_at = completion_time
    where id = challenge_row.id
      and consumed_at is null;
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'attempts_exhausted'
    );
  end if;

  if challenge_row.code_hash <> p_code_hash then
    update public.member_email_challenges
    set attempt_count = least(5, challenge_row.attempt_count + 1),
        consumed_at = case
          when challenge_row.attempt_count + 1 >= 5 then completion_time
          else consumed_at
        end
    where id = challenge_row.id
      and consumed_at is null;
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'invalid_code'
    );
  end if;

  if exists (
    select 1
    from public.members member
    where member.email_normalized = p_email_normalized
      and member.id <> p_member_id
      and member.deleted_at is null
  ) then
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'email_conflict'
    );
  end if;

  if exists (
    select 1
    from public.member_identifier_reservations reservation
    where reservation.identifier_kind = 'email'
      and reservation.identifier_hash = p_email_reservation_hash
  ) then
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'email_reserved'
    );
  end if;

  begin
    update public.members
    set email = p_email_normalized,
        email_normalized = p_email_normalized,
        email_verified_at = completion_time,
        auth_session_version = auth_session_version + 1,
        updated_at = completion_time
    where id = p_member_id
      and deleted_at is null;

    update public.member_email_challenges
    set verified_at = completion_time,
        consumed_at = completion_time,
        attempt_count = least(
          5,
          challenge_row.attempt_count + 1
        )
    where id = challenge_row.id
      and consumed_at is null
      and verified_at is null;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'member_email_recovery_challenge_state_conflict';
    end if;
  exception
    when unique_violation then
      return pg_catalog.jsonb_build_object(
        'verified', false,
        'reason', 'email_conflict'
      );
  end;

  return pg_catalog.jsonb_build_object(
    'verified', true,
    'mustChangePassword',
    coalesce(member_row.must_change_password, false)
  );
end;
$$;

revoke all on function public.reserve_member_email_recovery_challenge(uuid, text, text, timestamp with time zone, timestamp with time zone) from public;
revoke all on function public.reserve_member_email_recovery_challenge(uuid, text, text, timestamp with time zone, timestamp with time zone) from anon;
revoke all on function public.reserve_member_email_recovery_challenge(uuid, text, text, timestamp with time zone, timestamp with time zone) from authenticated;
grant execute on function public.reserve_member_email_recovery_challenge(uuid, text, text, timestamp with time zone, timestamp with time zone) to service_role;

revoke all on function public.mark_member_email_recovery_challenge_sent(uuid) from public;
revoke all on function public.mark_member_email_recovery_challenge_sent(uuid) from anon;
revoke all on function public.mark_member_email_recovery_challenge_sent(uuid) from authenticated;
grant execute on function public.mark_member_email_recovery_challenge_sent(uuid) to service_role;

revoke all on function public.delete_pending_member_email_recovery_challenge(uuid) from public;
revoke all on function public.delete_pending_member_email_recovery_challenge(uuid) from anon;
revoke all on function public.delete_pending_member_email_recovery_challenge(uuid) from authenticated;
grant execute on function public.delete_pending_member_email_recovery_challenge(uuid) to service_role;

revoke all on function public.complete_member_email_recovery(uuid, text, text, text) from public;
revoke all on function public.complete_member_email_recovery(uuid, text, text, text) from anon;
revoke all on function public.complete_member_email_recovery(uuid, text, text, text) from authenticated;
grant execute on function public.complete_member_email_recovery(uuid, text, text, text) to service_role;
