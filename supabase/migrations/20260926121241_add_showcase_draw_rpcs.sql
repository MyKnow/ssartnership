-- Project showcase verification, prize draws, delivery, settlement and the
-- post-settlement purge. Random selection happens on the server with a CSPRNG;
-- these service-role functions re-check phase, order, eligibility and the
-- one-prize-per-person rule before anything is recorded.

create or replace function public.showcase_assert_draw_open(p_event_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.showcase_events event_row
    where event_row.id = p_event_id
      and event_row.is_active
      and event_row.experience_end_at <= now()
      and event_row.settled_at is null
  ) then
    raise exception 'showcase_draw_closed';
  end if;
end;
$$;

create or replace function public.create_showcase_candidate_exclusion(
  p_event_id uuid,
  p_candidate_group text,
  p_project_id uuid,
  p_member_id uuid,
  p_reason text,
  p_admin_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  exclusion_id uuid;
begin
  perform public.showcase_assert_draw_open(p_event_id);
  if char_length(btrim(coalesce(p_reason, ''))) not between 2 and 500 then
    raise exception 'showcase_exclusion_invalid';
  end if;
  if p_candidate_group = 'submitter' then
    if p_project_id is null or not exists (
      select 1 from public.showcase_projects
      where id = p_project_id and event_id = p_event_id and status = 'approved'
    ) then
      raise exception 'showcase_exclusion_invalid';
    end if;
  elsif p_candidate_group = 'experiencer' then
    if p_member_id is null or not exists (
      select 1 from public.showcase_registrations
      where event_id = p_event_id and member_id = p_member_id
    ) then
      raise exception 'showcase_exclusion_invalid';
    end if;
  else
    raise exception 'showcase_exclusion_invalid';
  end if;

  begin
    insert into public.showcase_candidate_exclusions (
      event_id, candidate_group, project_id, member_id, reason, excluded_by_admin_id
    ) values (
      p_event_id, p_candidate_group,
      case when p_candidate_group = 'submitter' then p_project_id end,
      case when p_candidate_group = 'experiencer' then p_member_id end,
      btrim(p_reason), p_admin_id
    ) returning id into exclusion_id;
  exception when unique_violation then
    raise exception 'showcase_exclusion_exists';
  end;
  return exclusion_id;
end;
$$;

create or replace function public.restore_showcase_candidate_exclusion(
  p_exclusion_id uuid,
  p_admin_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  exclusion_row public.showcase_candidate_exclusions%rowtype;
begin
  select * into exclusion_row
  from public.showcase_candidate_exclusions
  where id = p_exclusion_id and restored_at is null
  for update;
  if not found then
    raise exception 'showcase_exclusion_not_found';
  end if;
  perform public.showcase_assert_draw_open(exclusion_row.event_id);
  update public.showcase_candidate_exclusions
  set restored_at = now(), restored_by_admin_id = p_admin_id
  where id = p_exclusion_id;
end;
$$;

create or replace function public.create_showcase_draw(
  p_event_id uuid,
  p_candidate_group text,
  p_draw_kind text,
  p_replaces_winner_id uuid,
  p_admin_id uuid,
  p_requested_count integer,
  p_candidate_count integer,
  p_ticket_count integer,
  p_winners jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  draw_id uuid;
  replaced public.showcase_winners%rowtype;
  item record;
  project_row public.showcase_projects%rowtype;
  next_position integer;
begin
  perform public.showcase_assert_draw_open(p_event_id);
  if p_candidate_group not in ('submitter', 'experiencer')
    or p_draw_kind not in ('initial', 'redraw')
    or p_requested_count not between 1 and 500
    or p_candidate_count < 0
    or p_ticket_count < p_candidate_count
    or p_winners is null or jsonb_typeof(p_winners) <> 'array'
    or jsonb_array_length(p_winners) > least(p_requested_count, p_candidate_count) then
    raise exception 'showcase_draw_invalid';
  end if;

  -- 출품 추첨이 먼저, 체험 추첨이 나중이다.
  if p_draw_kind = 'initial' and p_candidate_group = 'experiencer' and not exists (
    select 1 from public.showcase_draws
    where event_id = p_event_id and candidate_group = 'submitter' and draw_kind = 'initial'
  ) then
    raise exception 'showcase_draw_order_invalid';
  end if;

  if p_draw_kind = 'redraw' then
    select * into replaced
    from public.showcase_winners
    where id = p_replaces_winner_id and event_id = p_event_id
    for update;
    if not found or replaced.status <> 'voided' or replaced.candidate_group <> p_candidate_group
      or p_requested_count <> 1
      or exists (select 1 from public.showcase_draws where replaces_winner_id = p_replaces_winner_id) then
      raise exception 'showcase_redraw_invalid';
    end if;
  elsif p_replaces_winner_id is not null then
    raise exception 'showcase_draw_invalid';
  end if;

  begin
    insert into public.showcase_draws (
      event_id, candidate_group, draw_kind, requested_count, candidate_count,
      ticket_count, replaces_winner_id, admin_id
    ) values (
      p_event_id, p_candidate_group, p_draw_kind, p_requested_count, p_candidate_count,
      p_ticket_count, p_replaces_winner_id, p_admin_id
    ) returning id into draw_id;
  exception when unique_violation then
    raise exception 'showcase_draw_exists';
  end;

  next_position := case when p_draw_kind = 'redraw' then replaced.position else 1 end;
  for item in
    select * from jsonb_to_recordset(p_winners) as winner(
      member_id uuid, project_id uuid, masked_name text, masked_student_number text
    )
  loop
    if item.member_id is null then
      raise exception 'showcase_winner_ineligible';
    end if;
    if exists (
      select 1 from public.showcase_winners previous
      where previous.event_id = p_event_id and previous.member_id = item.member_id
    ) then
      raise exception 'showcase_winner_duplicate';
    end if;
    if exists (
      select 1 from public.showcase_candidate_exclusions exclusion
      where exclusion.event_id = p_event_id and exclusion.restored_at is null
        and ((exclusion.candidate_group = 'submitter' and exclusion.project_id = item.project_id)
          or (exclusion.candidate_group = 'experiencer' and exclusion.member_id = item.member_id))
    ) then
      raise exception 'showcase_winner_ineligible';
    end if;

    if p_candidate_group = 'submitter' then
      select * into project_row
      from public.showcase_projects
      where id = item.project_id and event_id = p_event_id and status = 'approved'
        and owner_member_id = item.member_id;
      if not found then
        raise exception 'showcase_winner_ineligible';
      end if;
    elsif not exists (
      select 1 from public.showcase_registrations
      where event_id = p_event_id and member_id = item.member_id
    ) or not exists (
      select 1 from public.showcase_feedback
      where event_id = p_event_id and member_id = item.member_id
    ) then
      raise exception 'showcase_winner_ineligible';
    end if;

    begin
      insert into public.showcase_winners (
        event_id, draw_id, candidate_group, member_id, project_id, project_title,
        masked_name, masked_student_number, position
      ) values (
        p_event_id, draw_id, p_candidate_group, item.member_id,
        case when p_candidate_group = 'submitter' then item.project_id end,
        case when p_candidate_group = 'submitter' then project_row.title end,
        item.masked_name, item.masked_student_number, next_position
      );
    exception when unique_violation then
      raise exception 'showcase_winner_duplicate';
    end;
    next_position := next_position + 1;
  end loop;

  return draw_id;
end;
$$;

create or replace function public.void_showcase_winner(
  p_winner_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  winner_row public.showcase_winners%rowtype;
begin
  select * into winner_row
  from public.showcase_winners
  where id = p_winner_id and status = 'active'
  for update;
  if not found then
    raise exception 'showcase_winner_not_found';
  end if;
  perform public.showcase_assert_draw_open(winner_row.event_id);
  if p_reason not in ('duplicate', 'unreachable', 'verification_failed') then
    raise exception 'showcase_void_invalid';
  end if;
  update public.showcase_winners
  set status = 'voided', void_reason = p_reason, voided_at = now(), voided_by_admin_id = p_admin_id
  where id = p_winner_id;
end;
$$;

create or replace function public.set_showcase_winner_delivered(
  p_winner_id uuid,
  p_admin_id uuid,
  p_delivered boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  winner_row public.showcase_winners%rowtype;
begin
  select * into winner_row
  from public.showcase_winners
  where id = p_winner_id and status = 'active'
  for update;
  if not found then
    raise exception 'showcase_winner_not_found';
  end if;
  perform public.showcase_assert_draw_open(winner_row.event_id);
  update public.showcase_winners
  set delivered_at = case when coalesce(p_delivered, false) then now() else null end,
      delivered_by_admin_id = case when coalesce(p_delivered, false) then p_admin_id else null end
  where id = p_winner_id;
end;
$$;

create or replace function public.settle_showcase_event(
  p_event_id uuid,
  p_admin_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  settled timestamptz;
begin
  update public.showcase_events
  set settled_at = now(), settled_by_admin_id = p_admin_id
  where id = p_event_id
    and settled_at is null
    and announcement_start_at <= now()
  returning settled_at into settled;
  if settled is null then
    raise exception 'showcase_settlement_invalid';
  end if;
  return settled;
end;
$$;

-- Detaches identities 30 days after settlement. Anonymous aggregates, feedback
-- bodies and masked draw snapshots remain as evidence.
create or replace function public.purge_showcase_personal_data(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.showcase_events
    where id = p_event_id
      and settled_at is not null
      and settled_at <= now() - interval '30 days'
      and purged_at is null
  ) then
    return false;
  end if;

  delete from public.showcase_project_participants where event_id = p_event_id;
  update public.showcase_registrations set member_id = null, student_number = null where event_id = p_event_id;
  update public.showcase_project_views set member_id = null where event_id = p_event_id;
  update public.showcase_experiences set member_id = null where event_id = p_event_id;
  update public.showcase_feedback set member_id = null where event_id = p_event_id;
  update public.showcase_interests set member_id = null where event_id = p_event_id;
  update public.showcase_candidate_exclusions set member_id = null where event_id = p_event_id;
  update public.showcase_winners set member_id = null where event_id = p_event_id;
  update public.showcase_projects set owner_member_id = null where event_id = p_event_id;
  update public.showcase_events set purged_at = now() where id = p_event_id;
  return true;
end;
$$;

do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.showcase_assert_draw_open(uuid)',
    'public.create_showcase_candidate_exclusion(uuid, text, uuid, uuid, text, uuid)',
    'public.restore_showcase_candidate_exclusion(uuid, uuid)',
    'public.create_showcase_draw(uuid, text, text, uuid, uuid, integer, integer, integer, jsonb)',
    'public.void_showcase_winner(uuid, uuid, text)',
    'public.set_showcase_winner_delivered(uuid, uuid, boolean)',
    'public.settle_showcase_event(uuid, uuid)',
    'public.purge_showcase_personal_data(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end;
$$;
