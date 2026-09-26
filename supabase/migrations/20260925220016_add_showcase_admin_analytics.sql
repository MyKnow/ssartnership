-- Aggregate and activity reads for the showcase admin screens. Both functions
-- are service-role only and return no member IDs, student numbers, IP
-- addresses, user agents or feedback authors.

create or replace function public.get_showcase_admin_metrics(p_event_id uuid)
returns table(
  status_counts jsonb,
  type_counts jsonb,
  total_unique_views bigint,
  total_experience_starts bigint,
  total_valid_experiences bigint,
  total_interests bigint,
  registered_experiencers bigint,
  completed_draws bigint,
  active_winners bigint,
  project_stats jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    coalesce((
      select jsonb_object_agg(status_row.status, status_row.total)
      from (
        select project.status, count(*) as total
        from public.showcase_projects project
        where project.event_id = p_event_id
        group by project.status
      ) status_row
    ), '{}'::jsonb),
    coalesce((
      select jsonb_object_agg(type_row.project_type, type_row.total)
      from (
        select project.project_type, count(*) as total
        from public.showcase_projects project
        where project.event_id = p_event_id and project.status <> 'withdrawn'
        group by project.project_type
      ) type_row
    ), '{}'::jsonb),
    (select count(*) from public.showcase_project_views v where v.event_id = p_event_id),
    (select count(*) from public.showcase_experiences e where e.event_id = p_event_id),
    (select count(*) from public.showcase_feedback f where f.event_id = p_event_id),
    (select count(*) from public.showcase_interests i where i.event_id = p_event_id),
    (select count(*) from public.showcase_registrations r where r.event_id = p_event_id),
    (select count(*) from public.showcase_draws d where d.event_id = p_event_id and d.draw_kind = 'initial'),
    (select count(*) from public.showcase_winners w where w.event_id = p_event_id and w.status = 'active'),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', counts.project_id,
        'title', project.title,
        'project_type', project.project_type,
        'view_count', counts.view_count,
        'experience_count', counts.experience_count,
        'valid_experience_count', counts.valid_experience_count,
        'interest_count', counts.interest_count
      ) order by project.title)
      from public.get_showcase_project_counts(p_event_id) counts
      join public.showcase_projects project on project.id = counts.project_id
      where project.status = 'approved'
    ), '[]'::jsonb);
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
    'feedback_submitted', 'project_reviewed', 'event_settings_updated', 'draw_created'
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
      case audit.action when 'showcase_project_review' then 'project_reviewed' else 'event_settings_updated' end,
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
    'public.get_showcase_admin_metrics(uuid)',
    'public.list_showcase_admin_activity(uuid, integer, timestamptz, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end;
$$;
