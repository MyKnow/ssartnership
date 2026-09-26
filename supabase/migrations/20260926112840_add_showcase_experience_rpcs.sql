-- Project showcase experience phase: participation registration, experience
-- start, 60-second feedback gate, interest toggles and feedback moderation.
-- Every function is service-role only and enforces the phase, ownership and
-- uniqueness rules at the database boundary.

create or replace function public.showcase_assert_experience_open(p_event_id uuid)
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
      and event_row.experience_start_at <= now()
      and now() < event_row.experience_end_at
  ) then
    raise exception 'showcase_experience_closed';
  end if;
end;
$$;

-- Resolves an approved project and asserts that the experience phase is open.
create or replace function public.showcase_open_project(p_project_id uuid)
returns public.showcase_projects
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.showcase_projects%rowtype;
begin
  select * into project_row
  from public.showcase_projects
  where id = p_project_id and status = 'approved';
  if not found then
    raise exception 'showcase_project_not_found';
  end if;
  perform public.showcase_assert_experience_open(project_row.event_id);
  return project_row;
end;
$$;

create or replace function public.register_showcase_participant(
  p_event_id uuid,
  p_member_id uuid,
  p_student_number text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.showcase_assert_experience_open(p_event_id);
  if p_member_id is null or btrim(coalesce(p_student_number, '')) !~ '^[0-9]{7}$' then
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
    values (p_event_id, p_member_id, btrim(p_student_number), now());
  exception when unique_violation then
    raise exception 'showcase_student_number_taken';
  end;
end;
$$;

create or replace function public.start_showcase_experience(
  p_project_id uuid,
  p_member_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.showcase_projects%rowtype;
  started timestamptz;
begin
  project_row := public.showcase_open_project(p_project_id);
  if p_member_id is null or project_row.owner_member_id = p_member_id then
    raise exception 'showcase_own_project';
  end if;
  if not exists (
    select 1 from public.showcase_registrations
    where event_id = project_row.event_id and member_id = p_member_id
  ) then
    raise exception 'showcase_registration_required';
  end if;

  insert into public.showcase_experiences (event_id, project_id, member_id)
  values (project_row.event_id, project_row.id, p_member_id)
  on conflict (event_id, project_id, member_id) do nothing;

  select started_at into started
  from public.showcase_experiences
  where event_id = project_row.event_id and project_id = project_row.id and member_id = p_member_id;
  return started;
end;
$$;

create or replace function public.submit_showcase_feedback(
  p_project_id uuid,
  p_member_id uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.showcase_projects%rowtype;
  started timestamptz;
begin
  project_row := public.showcase_open_project(p_project_id);
  if char_length(btrim(coalesce(p_body, ''))) not between 10 and 300 then
    raise exception 'showcase_feedback_invalid';
  end if;

  select started_at into started
  from public.showcase_experiences
  where event_id = project_row.event_id and project_id = project_row.id and member_id = p_member_id;
  if started is null then
    raise exception 'showcase_experience_not_started';
  end if;
  if now() < started + interval '60 seconds' then
    raise exception 'showcase_feedback_too_early';
  end if;

  begin
    insert into public.showcase_feedback (event_id, project_id, member_id, body)
    values (project_row.event_id, project_row.id, p_member_id, btrim(p_body));
  exception when unique_violation then
    raise exception 'showcase_feedback_exists';
  end;
end;
$$;

create or replace function public.set_showcase_interest(
  p_project_id uuid,
  p_member_id uuid,
  p_interested boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  project_row public.showcase_projects%rowtype;
begin
  project_row := public.showcase_open_project(p_project_id);
  if p_member_id is null or project_row.owner_member_id = p_member_id then
    raise exception 'showcase_own_project';
  end if;

  if coalesce(p_interested, false) then
    insert into public.showcase_interests (event_id, project_id, member_id)
    values (project_row.event_id, project_row.id, p_member_id)
    on conflict (event_id, project_id, member_id) do nothing;
  else
    delete from public.showcase_interests
    where event_id = project_row.event_id and project_id = project_row.id and member_id = p_member_id;
  end if;
  return coalesce(p_interested, false);
end;
$$;

create or replace function public.set_showcase_feedback_hidden(
  p_feedback_id uuid,
  p_admin_id uuid,
  p_hidden boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.showcase_feedback
  set hidden_at = case when coalesce(p_hidden, false) then now() else null end,
      hidden_by_admin_id = case when coalesce(p_hidden, false) then p_admin_id else null end
  where id = p_feedback_id;
  if not found then
    raise exception 'showcase_feedback_not_found';
  end if;
end;
$$;

do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.showcase_assert_experience_open(uuid)',
    'public.showcase_open_project(uuid)',
    'public.register_showcase_participant(uuid, uuid, text)',
    'public.start_showcase_experience(uuid, uuid)',
    'public.submit_showcase_feedback(uuid, uuid, text)',
    'public.set_showcase_interest(uuid, uuid, boolean)',
    'public.set_showcase_feedback_hidden(uuid, uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end;
$$;
