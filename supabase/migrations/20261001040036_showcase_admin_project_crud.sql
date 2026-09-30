-- Admin-managed project CRUD. Project mutations and their audit records are
-- committed in one transaction; deleting a project cascades its experience data.
begin;

-- #511 introduces this field first in the normal release flow. Keeping the
-- column creation idempotent also lets this migration validate independently.
alter table public.showcase_projects
  add column if not exists allow_immediate_feedback boolean not null default false;

create or replace function public.admin_create_showcase_project(
  p_event_id uuid,
  p_project_id uuid,
  p_admin_id uuid,
  p_owner_member_id uuid,
  p_project_type text,
  p_title text,
  p_team_name text,
  p_summary text,
  p_description text,
  p_image_url text,
  p_image_upload_id uuid,
  p_service_url text,
  p_status text,
  p_review_note text,
  p_allow_immediate_feedback boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  event_slug text;
  now_at timestamptz := now();
begin
  select slug into event_slug from public.showcase_events where id = p_event_id;
  if event_slug is distinct from 'project-showcase' then
    raise exception 'showcase_event_not_found';
  end if;
  if not exists (
    select 1 from public.members
    where id = p_owner_member_id and deleted_at is null and nullif(btrim(display_name), '') is not null
  ) then
    raise exception 'showcase_owner_not_found';
  end if;
  if p_status not in ('pending', 'approved', 'changes_requested', 'rejected', 'hidden', 'withdrawn') then
    raise exception 'showcase_status_invalid';
  end if;
  if p_status in ('changes_requested', 'rejected') and nullif(btrim(p_review_note), '') is null then
    raise exception 'showcase_review_note_required';
  end if;
  if p_allow_immediate_feedback is null then
    raise exception 'showcase_feedback_policy_invalid';
  end if;

  insert into public.showcase_projects (
    id, event_id, owner_member_id, project_type, title, team_name, summary,
    description, image_url, image_upload_id, service_url, announcement_consented_at,
    status, review_note, reviewed_by_admin_id, reviewed_at, withdrawn_at
  ) values (
    p_project_id, p_event_id, p_owner_member_id, p_project_type, btrim(p_title),
    nullif(btrim(p_team_name), ''), btrim(p_summary), btrim(p_description),
    p_image_url, p_image_upload_id, btrim(p_service_url), now_at, p_status,
    nullif(btrim(p_review_note), ''),
    case when p_status = 'pending' then null else p_admin_id end,
    case when p_status = 'pending' then null else now_at end,
    case when p_status = 'withdrawn' then now_at else null end
  );

  -- The #511 insert trigger applies the category default; admins can override it.
  update public.showcase_projects
  set allow_immediate_feedback = p_allow_immediate_feedback
  where id = p_project_id;

  insert into public.admin_audit_logs (
    actor_type, actor_id, action, path, target_type, target_id, properties
  ) values (
    'admin', p_admin_id::text, 'showcase_project_create',
    '/admin/events/project-showcase', 'showcase_project', p_project_id::text,
    jsonb_build_object(
      'event_id', p_event_id::text, 'project_title', btrim(p_title),
      'project_type', p_project_type, 'status', p_status,
      'allow_immediate_feedback', p_allow_immediate_feedback, 'operation', 'created'
    )
  );
  return p_project_id;
end;
$function$;

create or replace function public.admin_update_showcase_project(
  p_event_id uuid,
  p_project_id uuid,
  p_admin_id uuid,
  p_project_type text,
  p_title text,
  p_team_name text,
  p_summary text,
  p_description text,
  p_image_url text,
  p_image_upload_id uuid,
  p_service_url text,
  p_status text,
  p_review_note text,
  p_allow_immediate_feedback boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  project_row public.showcase_projects%rowtype;
  now_at timestamptz := now();
begin
  select * into project_row
  from public.showcase_projects
  where id = p_project_id and event_id = p_event_id
  for update;
  if not found then raise exception 'showcase_project_not_found'; end if;
  if p_status not in ('pending', 'approved', 'changes_requested', 'rejected', 'hidden', 'withdrawn') then
    raise exception 'showcase_status_invalid';
  end if;
  if p_status in ('changes_requested', 'rejected') and nullif(btrim(p_review_note), '') is null then
    raise exception 'showcase_review_note_required';
  end if;
  if p_allow_immediate_feedback is null then
    raise exception 'showcase_feedback_policy_invalid';
  end if;

  update public.showcase_projects set
    project_type = p_project_type,
    title = btrim(p_title),
    team_name = nullif(btrim(p_team_name), ''),
    summary = btrim(p_summary),
    description = btrim(p_description),
    image_url = coalesce(p_image_url, project_row.image_url),
    image_upload_id = case when p_image_url is null then project_row.image_upload_id else p_image_upload_id end,
    service_url = btrim(p_service_url),
    status = p_status,
    review_note = nullif(btrim(p_review_note), ''),
    reviewed_by_admin_id = case when p_status = 'pending' then null else p_admin_id end,
    reviewed_at = case when p_status = 'pending' then null else now_at end,
    withdrawn_at = case when p_status = 'withdrawn' then now_at else null end
  where id = p_project_id;

  -- Updating project_type can reapply the #511 category default in its trigger.
  update public.showcase_projects
  set allow_immediate_feedback = p_allow_immediate_feedback
  where id = p_project_id;

  insert into public.admin_audit_logs (
    actor_type, actor_id, action, path, target_type, target_id, properties
  ) values (
    'admin', p_admin_id::text, 'showcase_project_update',
    '/admin/events/project-showcase', 'showcase_project', p_project_id::text,
    jsonb_build_object(
      'event_id', p_event_id::text, 'project_title', btrim(p_title),
      'project_type', p_project_type, 'status', p_status,
      'allow_immediate_feedback', p_allow_immediate_feedback, 'operation', 'updated'
    )
  );
  return p_project_id;
end;
$function$;

create or replace function public.admin_delete_showcase_project(
  p_project_id uuid,
  p_admin_id uuid
)
returns table(project_id uuid, event_id uuid, title text, owner_member_id uuid, project_type text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  project_row public.showcase_projects%rowtype;
begin
  select project.* into project_row
  from public.showcase_projects project
  join public.showcase_events event on event.id = project.event_id
  where project.id = p_project_id and event.slug = 'project-showcase'
  for update of project;
  if not found then raise exception 'showcase_project_not_found'; end if;

  insert into public.admin_audit_logs (
    actor_type, actor_id, action, path, target_type, target_id, properties
  ) values (
    'admin', p_admin_id::text, 'showcase_project_delete',
    '/admin/events/project-showcase', 'showcase_project', p_project_id::text,
    jsonb_build_object(
      'event_id', project_row.event_id::text, 'project_title', project_row.title,
      'project_type', project_row.project_type, 'status', project_row.status, 'operation', 'deleted'
    )
  );

  -- The FK detaches winners on project deletion; fill a missing title snapshot
  -- first so the historical winner record remains readable.
  update public.showcase_winners
  set project_title = project_row.title
  where project_id = project_row.id and project_title is null;

  delete from public.showcase_projects where id = p_project_id;
  return query select project_row.id, project_row.event_id, project_row.title,
    project_row.owner_member_id, project_row.project_type;
end;
$function$;

create or replace function public.list_showcase_admin_activity(
  p_event_id uuid,
  p_limit integer default 51,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_activity_type text default null
)
returns table(
  activity_id uuid,
  occurred_at timestamptz,
  activity_type text,
  project_id uuid,
  project_title text,
  actor_type text,
  details jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_limit is null or p_limit < 1 or p_limit > 101 then
    raise exception 'showcase_activity_limit_invalid';
  end if;
  if (p_before_at is null) <> (p_before_id is null) then
    raise exception 'showcase_activity_cursor_invalid';
  end if;
  if p_activity_type is not null and p_activity_type not in (
    'project_submitted', 'project_withdrawn', 'project_viewed', 'experience_started',
    'feedback_submitted', 'project_reviewed', 'event_settings_updated', 'draw_created',
    'project_admin_changed'
  ) then
    raise exception 'showcase_activity_type_invalid';
  end if;

  return query
  with event_info as (
    select event_row.id, event_row.slug, event_row.title
    from public.showcase_events event_row
    where event_row.id = p_event_id
  ), activity as (
    select project.id as activity_id, project.created_at as occurred_at,
      'project_submitted'::text as activity_type, project.id as project_id,
      project.title as project_title, 'member'::text as actor_type,
      jsonb_build_object('project_type', project.project_type) as details
    from public.showcase_projects project
    where project.event_id = p_event_id
      and not exists (
        select 1 from public.admin_audit_logs audit
        where audit.action = 'showcase_project_create'
          and audit.target_type = 'showcase_project' and audit.target_id = project.id::text
      )

    union all
    select project.id, project.withdrawn_at, 'project_withdrawn', project.id, project.title,
      'member', '{}'::jsonb
    from public.showcase_projects project
    where project.event_id = p_event_id and project.withdrawn_at is not null

    union all
    select v.id, v.created_at, 'project_viewed', project.id, project.title, 'member', '{}'::jsonb
    from public.showcase_project_views v
    join public.showcase_projects project on project.id = v.project_id
    where v.event_id = p_event_id

    union all
    select e.id, e.started_at, 'experience_started', project.id, project.title, 'member', '{}'::jsonb
    from public.showcase_experiences e
    join public.showcase_projects project on project.id = e.project_id
    where e.event_id = p_event_id

    union all
    select f.id, f.created_at, 'feedback_submitted', project.id, project.title, 'member', '{}'::jsonb
    from public.showcase_feedback f
    join public.showcase_projects project on project.id = f.project_id
    where f.event_id = p_event_id

    union all
    select d.id, d.created_at, 'draw_created', null::uuid, event_info.title, 'admin',
      jsonb_build_object(
        'candidate_group', d.candidate_group,
        'candidate_count', d.candidate_count,
        'selected_count', (select count(*) from public.showcase_winners w where w.draw_id = d.id)
      )
    from public.showcase_draws d
    join event_info on event_info.id = d.event_id

    union all
    select audit.id, audit.created_at,
      case audit.action
        when 'showcase_project_review' then 'project_reviewed'
        else 'event_settings_updated'
      end,
      project.id, coalesce(project.title, event_info.title), 'admin',
      jsonb_strip_nulls(jsonb_build_object(
        'status', audit.properties ->> 'status',
        'is_active', audit.properties -> 'is_active'
      ))
    from public.admin_audit_logs audit
    cross join event_info
    left join public.showcase_projects project
      on audit.target_type = 'showcase_project'
      and audit.target_id = project.id::text
      and project.event_id = event_info.id
    where (
        (audit.action = 'showcase_event_settings_update'
          and audit.target_type = 'showcase_event' and audit.target_id = event_info.slug)
        or (audit.action = 'showcase_project_review'
          and audit.target_type = 'showcase_project' and project.id is not null)
      )
      and audit.created_at is not null

    union all
    select audit.id, audit.created_at, 'project_admin_changed',
      case when audit.action = 'showcase_project_delete' or project.id is null then null::uuid else project.id end,
      coalesce(audit.properties ->> 'project_title', project.title, event_info.title),
      'admin',
      jsonb_strip_nulls(jsonb_build_object(
        'operation', audit.properties ->> 'operation',
        'status', audit.properties ->> 'status',
        'project_type', audit.properties ->> 'project_type'
      ))
    from public.admin_audit_logs audit
    cross join event_info
    left join public.showcase_projects project
      on audit.target_type = 'showcase_project'
      and audit.target_id = project.id::text
      and project.event_id = event_info.id
    where audit.action in ('showcase_project_create', 'showcase_project_update', 'showcase_project_delete')
      and audit.target_type = 'showcase_project'
      and audit.properties ->> 'event_id' = event_info.id::text
      and audit.created_at is not null
  )
  select activity.activity_id, activity.occurred_at, activity.activity_type, activity.project_id,
    activity.project_title, activity.actor_type, activity.details
  from activity
  where (p_activity_type is null or activity.activity_type = p_activity_type)
    and (p_before_at is null or (activity.occurred_at, activity.activity_id) < (p_before_at, p_before_id))
  order by activity.occurred_at desc, activity.activity_id desc
  limit p_limit;
end;
$function$;

do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.admin_create_showcase_project(uuid, uuid, uuid, uuid, text, text, text, text, text, text, uuid, text, text, text, boolean)',
    'public.admin_update_showcase_project(uuid, uuid, uuid, text, text, text, text, text, text, uuid, text, text, text, boolean)',
    'public.admin_delete_showcase_project(uuid, uuid)',
    'public.list_showcase_admin_activity(uuid, integer, timestamptz, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end;
$$;

commit;
