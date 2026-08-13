create or replace function public.complete_member_email_verification(
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
    and email_normalized = p_email_normalized
    and purpose = 'email_verify'
  order by created_at desc, id desc
  limit 1
  for update;
  if not found then
    return pg_catalog.jsonb_build_object(
      'verified', false,
      'reason', 'challenge_missing'
    );
  end if;

  -- Capture time only after both row locks are held. A request waiting behind
  -- another verifier must not accept a challenge that expired while waiting or
  -- move members.updated_at backwards.
  completion_time := pg_catalog.clock_timestamp();

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

  if challenge_row.attempt_count >= 10 then
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
    set attempt_count = least(10, challenge_row.attempt_count + 1),
        consumed_at = case
          when challenge_row.attempt_count + 1 >= 10 then completion_time
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
        updated_at = completion_time
    where id = p_member_id
      and deleted_at is null;

    update public.member_email_challenges
    set verified_at = completion_time,
        consumed_at = completion_time,
        attempt_count = least(10, challenge_row.attempt_count + 1)
    where id = challenge_row.id
      and consumed_at is null
      and verified_at is null;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'member_email_challenge_state_conflict';
    end if;
  exception
    when unique_violation then
      return pg_catalog.jsonb_build_object(
        'verified', false,
        'reason', 'email_conflict'
      );
  end;

  return pg_catalog.jsonb_build_object('verified', true);
end;
$$;

revoke all on function public.complete_member_email_verification(uuid, text, text, text) from public;
revoke all on function public.complete_member_email_verification(uuid, text, text, text) from anon;
revoke all on function public.complete_member_email_verification(uuid, text, text, text) from authenticated;
grant execute on function public.complete_member_email_verification(uuid, text, text, text) to service_role;
