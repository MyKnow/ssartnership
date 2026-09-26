-- Issue #491: member-based multiple submissions, no student numbers or team rosters.
-- Legacy RPC parameters/empty storage columns remain solely for rolling app compatibility.
-- They are ignored by every write and constrained against collecting identifiers again.
begin;

drop index if exists public.showcase_projects_one_active_per_owner_idx;
create index if not exists showcase_projects_owner_list_idx
  on public.showcase_projects(event_id, owner_member_id, created_at desc);

delete from public.showcase_project_participants;
alter table public.showcase_project_participants
  add constraint showcase_project_participants_retired check (false);
update public.showcase_registrations set student_number = null;
alter table public.showcase_registrations
  add constraint showcase_registration_no_student_number check (student_number is null);
alter table public.showcase_winners drop constraint showcase_winners_masked_check;
update public.showcase_winners set masked_student_number = '';
alter table public.showcase_winners
  add constraint showcase_winners_masked_check
    check (char_length(masked_name) between 2 and 40 and masked_student_number = '');

-- Older app instances can still call this helper, but it no longer records a roster.
create or replace function public.showcase_replace_participants(
  p_event_id uuid, p_project_id uuid, p_owner_name text,
  p_owner_student_number text, p_teammates jsonb
)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  return;
end;
$$;

create or replace function public.create_showcase_project(
  p_event_id uuid,
  p_project_id uuid,
  p_owner_member_id uuid,
  p_owner_name text,
  p_project_type text,
  p_title text,
  p_team_name text,
  p_summary text,
  p_description text,
  p_service_url text,
  p_image_url text,
  p_image_upload_id uuid,
  p_owner_student_number text default null,
  p_teammates jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.showcase_assert_submission_open(p_event_id);

  insert into public.showcase_projects (
      id, event_id, owner_member_id, project_type, title, team_name, summary,
      description, service_url, image_url, image_upload_id, announcement_consented_at
    ) values (
      p_project_id, p_event_id, p_owner_member_id, p_project_type, btrim(p_title),
      nullif(btrim(coalesce(p_team_name, '')), ''), btrim(p_summary), btrim(p_description),
      btrim(p_service_url), p_image_url, p_image_upload_id, now()
    );

  return p_project_id;
end;
$$;

create or replace function public.update_showcase_project(
  p_project_id uuid,
  p_owner_member_id uuid,
  p_owner_name text,
  p_project_type text,
  p_title text,
  p_team_name text,
  p_summary text,
  p_description text,
  p_service_url text,
  p_image_url text,
  p_image_upload_id uuid,
  p_owner_student_number text default null,
  p_teammates jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.showcase_projects%rowtype;
begin
  select * into project_row
  from public.showcase_projects
  where id = p_project_id and owner_member_id = p_owner_member_id
  for update;
  if not found then
    raise exception 'showcase_project_not_found';
  end if;
  perform public.showcase_assert_submission_open(project_row.event_id);
  if project_row.status not in ('pending', 'changes_requested') then
    raise exception 'showcase_project_not_editable';
  end if;

  update public.showcase_projects
  set project_type = p_project_type,
      title = btrim(p_title),
      team_name = nullif(btrim(coalesce(p_team_name, '')), ''),
      summary = btrim(p_summary),
      description = btrim(p_description),
      service_url = btrim(p_service_url),
      image_url = coalesce(p_image_url, image_url),
      image_upload_id = coalesce(p_image_upload_id, image_upload_id),
      announcement_consented_at = now(),
      status = 'pending'
  where id = p_project_id;

end;
$$;

create or replace function public.register_showcase_participant(
  p_event_id uuid,
  p_member_id uuid,
  p_student_number text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.showcase_assert_experience_open(p_event_id);
  if p_member_id is null then
    raise exception 'showcase_registration_invalid';
  end if;
  if exists (
    select 1 from public.showcase_registrations
    where event_id = p_event_id and member_id = p_member_id
  ) then
    raise exception 'showcase_registration_exists';
  end if;

  begin
    insert into public.showcase_registrations (event_id, member_id, student_number, consented_at)
    values (p_event_id, p_member_id, null, now());
  exception when unique_violation then
    raise exception 'showcase_registration_exists';
  end;
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
  actual_candidates integer;
  actual_tickets integer;
begin
  perform 1 from public.showcase_events where id = p_event_id for update;
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

  -- Each project contributes one ticket; only distinct members can receive prizes.
  if p_candidate_group = 'submitter' then
    select count(distinct project.owner_member_id)::integer, count(*)::integer
      into actual_candidates, actual_tickets
    from public.showcase_projects project
    where project.event_id = p_event_id and project.status = 'approved'
      and project.owner_member_id is not null
      and not exists (select 1 from public.showcase_winners w
        where w.event_id = p_event_id and w.member_id = project.owner_member_id)
      and not exists (select 1 from public.showcase_candidate_exclusions e
        where e.event_id = p_event_id and e.candidate_group = 'submitter'
          and e.project_id = project.id and e.restored_at is null);
  else
    select count(distinct feedback.member_id)::integer, count(*)::integer
      into actual_candidates, actual_tickets
    from public.showcase_feedback feedback
    where feedback.event_id = p_event_id and feedback.member_id is not null
      and exists (select 1 from public.showcase_registrations r
        where r.event_id = p_event_id and r.member_id = feedback.member_id)
      and not exists (select 1 from public.showcase_winners w
        where w.event_id = p_event_id and w.member_id = feedback.member_id)
      and not exists (select 1 from public.showcase_candidate_exclusions e
        where e.event_id = p_event_id and e.candidate_group = 'experiencer'
          and e.member_id = feedback.member_id and e.restored_at is null);
  end if;
  if p_candidate_count <> actual_candidates or p_ticket_count <> actual_tickets
    or jsonb_array_length(p_winners) <> least(p_requested_count, actual_candidates) then
    raise exception 'showcase_winner_ineligible';
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
      member_id uuid, project_id uuid, masked_name text
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
        and exclusion.candidate_group = p_candidate_group
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
        item.masked_name, '', next_position
      );
    exception when unique_violation then
      raise exception 'showcase_winner_duplicate';
    end;
    next_position := next_position + 1;
  end loop;

  return draw_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
