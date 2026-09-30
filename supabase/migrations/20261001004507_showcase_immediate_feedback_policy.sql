-- Issue #511: allow approved projects to opt out of the 60-second feedback delay.
begin;

alter table public.showcase_projects
  add column if not exists allow_immediate_feedback boolean not null default false;

update public.showcase_projects
set allow_immediate_feedback = project_type in ('app', 'game');

comment on column public.showcase_projects.allow_immediate_feedback is
  'When true, a recorded outbound project-link click immediately unlocks feedback; it does not assert that an app was installed or used.';

create or replace function public.set_showcase_project_default_feedback_policy()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' or new.project_type is distinct from old.project_type then
    new.allow_immediate_feedback := new.project_type in ('app', 'game');
  end if;
  return new;
end;
$$;

drop trigger if exists showcase_project_default_feedback_policy on public.showcase_projects;
create trigger showcase_project_default_feedback_policy
before insert or update of project_type on public.showcase_projects
for each row execute function public.set_showcase_project_default_feedback_policy();

create or replace function public.set_showcase_project_immediate_feedback(
  p_project_id uuid,
  p_allowed boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_allowed is null then
    raise exception 'showcase_feedback_policy_invalid';
  end if;

  update public.showcase_projects
  set allow_immediate_feedback = p_allowed,
      updated_at = now()
  where id = p_project_id and status <> 'withdrawn';
  if not found then
    raise exception 'showcase_project_not_found';
  end if;
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
  if not project_row.allow_immediate_feedback and now() < started + interval '60 seconds' then
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

do $$
begin
  revoke all on function public.set_showcase_project_default_feedback_policy() from public, anon, authenticated;
  grant execute on function public.set_showcase_project_default_feedback_policy() to service_role;
  revoke all on function public.set_showcase_project_immediate_feedback(uuid, boolean) from public, anon, authenticated;
  grant execute on function public.set_showcase_project_immediate_feedback(uuid, boolean) to service_role;
end;
$$;

commit;
