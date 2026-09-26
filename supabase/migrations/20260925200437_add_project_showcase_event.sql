-- SSAFY project showcase event («내 프로젝트를 소개합니다!»).
-- Data model for submission, experience/feedback, weighted prize draws and
-- post-settlement purge. Every table is service-role only; the server
-- repository mediates all reads and writes. Member links are nullable so the
-- purge job can detach identities while keeping anonymous aggregates.

create table if not exists public.showcase_events (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  hero_image_src text not null default '/ads/project-showcase-banner.png',
  submission_start_at timestamptz,
  submission_end_at timestamptz,
  experience_start_at timestamptz,
  experience_end_at timestamptz,
  announcement_start_at timestamptz,
  announcement_end_at timestamptz,
  submitter_selection_count integer not null default 20,
  experiencer_selection_count integer not null default 25,
  is_active boolean not null default false,
  settled_at timestamptz,
  settled_by_admin_id uuid references public.admin_accounts(id) on delete set null,
  purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint showcase_events_slug_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint showcase_events_timeline_check
    check (
      submission_start_at is null or submission_end_at is null
      or experience_start_at is null or experience_end_at is null
      or announcement_start_at is null
      or (
        submission_start_at < submission_end_at
        and submission_end_at <= experience_start_at
        and experience_start_at < experience_end_at
        and experience_end_at <= announcement_start_at
        and (announcement_end_at is null or announcement_start_at < announcement_end_at)
      )
    ),
  constraint showcase_events_selection_count_check
    check (submitter_selection_count between 0 and 500 and experiencer_selection_count between 0 and 500)
);

insert into public.showcase_events (slug, title, description)
values (
  'project-showcase',
  '내 프로젝트를 소개합니다!',
  'SSAFY 구성원이 직접 개발·배포한 서비스를 소개하고 함께 체험하는 이벤트예요.'
)
on conflict (slug) do nothing;

create table if not exists public.showcase_projects (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.showcase_events(id) on delete cascade,
  owner_member_id uuid references public.members(id) on delete set null,
  project_type text not null,
  title text not null,
  team_name text,
  summary text not null,
  description text not null,
  image_url text not null,
  image_upload_id uuid references public.image_upload_sessions(id) on delete set null,
  service_url text not null,
  announcement_consented_at timestamptz not null,
  status text not null default 'pending',
  review_note text,
  reviewed_by_admin_id uuid references public.admin_accounts(id) on delete set null,
  reviewed_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint showcase_projects_type_check
    check (project_type in ('web', 'app', 'game', 'embedded')),
  constraint showcase_projects_status_check
    check (status in ('pending', 'approved', 'changes_requested', 'rejected', 'hidden', 'withdrawn')),
  constraint showcase_projects_title_check
    check (char_length(btrim(title)) between 2 and 100),
  constraint showcase_projects_team_name_check
    check (team_name is null or char_length(btrim(team_name)) between 1 and 60),
  constraint showcase_projects_summary_check
    check (char_length(btrim(summary)) between 5 and 240),
  constraint showcase_projects_description_check
    check (char_length(btrim(description)) between 20 and 8000),
  constraint showcase_projects_service_url_check
    check (service_url ~ '^https://' and char_length(service_url) <= 2048),
  constraint showcase_projects_review_note_check
    check (review_note is null or char_length(review_note) <= 2000),
  constraint showcase_projects_withdrawn_check
    check ((status = 'withdrawn') = (withdrawn_at is not null))
);

create index if not exists showcase_projects_public_list_idx
  on public.showcase_projects(event_id, status, project_type, created_at desc);
-- 참가자 1인당 출품 1개: a member may own one non-withdrawn project per event.
create unique index if not exists showcase_projects_one_active_per_owner_idx
  on public.showcase_projects(event_id, owner_member_id)
  where status <> 'withdrawn' and owner_member_id is not null;

create table if not exists public.showcase_project_participants (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.showcase_events(id) on delete cascade,
  project_id uuid not null references public.showcase_projects(id) on delete cascade,
  position smallint not null,
  name text not null,
  student_number text not null,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  constraint showcase_project_participants_position_check check (position between 0 and 19),
  constraint showcase_project_participants_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint showcase_project_participants_student_number_check check (student_number ~ '^[0-9]{7}$'),
  constraint showcase_project_participants_owner_position_check check (is_owner = (position = 0)),
  unique (project_id, position)
);
-- The same student may appear in only one project roster per event.
-- Withdrawing a project deletes its roster, freeing the student numbers.
create unique index if not exists showcase_project_participants_student_idx
  on public.showcase_project_participants(event_id, student_number);

create table if not exists public.showcase_registrations (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.showcase_events(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  student_number text,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint showcase_registrations_student_number_check
    check (student_number is null or student_number ~ '^[0-9]{7}$')
);
create unique index if not exists showcase_registrations_member_idx
  on public.showcase_registrations(event_id, member_id) where member_id is not null;
create unique index if not exists showcase_registrations_student_idx
  on public.showcase_registrations(event_id, student_number) where student_number is not null;

create table if not exists public.showcase_project_views (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.showcase_events(id) on delete cascade,
  project_id uuid not null references public.showcase_projects(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, project_id, member_id)
);
create index if not exists showcase_project_views_project_idx
  on public.showcase_project_views(event_id, project_id);

create table if not exists public.showcase_experiences (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.showcase_events(id) on delete cascade,
  project_id uuid not null references public.showcase_projects(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  started_at timestamptz not null default now(),
  unique (event_id, project_id, member_id)
);
create index if not exists showcase_experiences_member_idx
  on public.showcase_experiences(event_id, member_id);

-- A submitted feedback row is the proof of one valid experience (60 seconds
-- after the experience start). Hiding moderates the text only.
create table if not exists public.showcase_feedback (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.showcase_events(id) on delete cascade,
  project_id uuid not null references public.showcase_projects(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  hidden_at timestamptz,
  hidden_by_admin_id uuid references public.admin_accounts(id) on delete set null,
  constraint showcase_feedback_body_check check (char_length(btrim(body)) between 10 and 300),
  unique (event_id, project_id, member_id)
);
create index if not exists showcase_feedback_project_idx
  on public.showcase_feedback(event_id, project_id, created_at desc);
create index if not exists showcase_feedback_member_idx
  on public.showcase_feedback(event_id, member_id);

create table if not exists public.showcase_interests (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.showcase_events(id) on delete cascade,
  project_id uuid not null references public.showcase_projects(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, project_id, member_id)
);
create index if not exists showcase_interests_project_idx
  on public.showcase_interests(event_id, project_id);

create table if not exists public.showcase_candidate_exclusions (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.showcase_events(id) on delete cascade,
  candidate_group text not null,
  project_id uuid references public.showcase_projects(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  reason text not null,
  excluded_by_admin_id uuid references public.admin_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by_admin_id uuid references public.admin_accounts(id) on delete set null,
  constraint showcase_candidate_exclusions_group_check
    check (candidate_group in ('submitter', 'experiencer')),
  -- Experiencer exclusions keep their row (with a detached member) after purge.
  constraint showcase_candidate_exclusions_target_check
    check (candidate_group <> 'submitter' or project_id is not null),
  constraint showcase_candidate_exclusions_reason_check
    check (char_length(btrim(reason)) between 2 and 500)
);
create unique index if not exists showcase_candidate_exclusions_active_project_idx
  on public.showcase_candidate_exclusions(event_id, project_id)
  where restored_at is null and candidate_group = 'submitter';
create unique index if not exists showcase_candidate_exclusions_active_member_idx
  on public.showcase_candidate_exclusions(event_id, member_id)
  where restored_at is null and candidate_group = 'experiencer' and member_id is not null;

create table if not exists public.showcase_draws (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.showcase_events(id) on delete cascade,
  candidate_group text not null,
  draw_kind text not null,
  requested_count integer not null,
  candidate_count integer not null,
  ticket_count integer not null,
  replaces_winner_id uuid,
  admin_id uuid references public.admin_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint showcase_draws_group_check check (candidate_group in ('submitter', 'experiencer')),
  constraint showcase_draws_kind_check check (draw_kind in ('initial', 'redraw')),
  constraint showcase_draws_count_check
    check (requested_count between 1 and 500 and candidate_count >= 0 and ticket_count >= candidate_count),
  constraint showcase_draws_redraw_check check ((draw_kind = 'redraw') = (replaces_winner_id is not null))
);
create unique index if not exists showcase_draws_initial_idx
  on public.showcase_draws(event_id, candidate_group) where draw_kind = 'initial';

create table if not exists public.showcase_winners (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.showcase_events(id) on delete cascade,
  draw_id uuid not null references public.showcase_draws(id) on delete cascade,
  candidate_group text not null,
  member_id uuid references public.members(id) on delete set null,
  project_id uuid references public.showcase_projects(id) on delete set null,
  project_title text,
  masked_name text not null,
  masked_student_number text not null,
  position smallint not null,
  status text not null default 'active',
  void_reason text,
  voided_at timestamptz,
  voided_by_admin_id uuid references public.admin_accounts(id) on delete set null,
  delivered_at timestamptz,
  delivered_by_admin_id uuid references public.admin_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint showcase_winners_group_check check (candidate_group in ('submitter', 'experiencer')),
  constraint showcase_winners_status_check check (status in ('active', 'voided')),
  constraint showcase_winners_void_check
    check (
      (status = 'active' and void_reason is null and voided_at is null)
      or (status = 'voided' and void_reason in ('duplicate', 'unreachable', 'verification_failed') and voided_at is not null)
    ),
  constraint showcase_winners_masked_check
    check (char_length(masked_name) between 2 and 40 and masked_student_number ~ '^[0-9]{2}\*{4}[0-9]{2}$'),
  constraint showcase_winners_submitter_project_check
    check (candidate_group <> 'submitter' or project_title is not null),
  constraint showcase_winners_position_check check (position between 1 and 500)
);
alter table public.showcase_draws
  drop constraint if exists showcase_draws_replaces_winner_fkey;
alter table public.showcase_draws
  add constraint showcase_draws_replaces_winner_fkey
  foreign key (replaces_winner_id) references public.showcase_winners(id) on delete set null;
-- 1인 1경품 across both groups, and one prize per submitted project.
create unique index if not exists showcase_winners_active_member_idx
  on public.showcase_winners(event_id, member_id) where status = 'active' and member_id is not null;
create unique index if not exists showcase_winners_active_project_idx
  on public.showcase_winners(event_id, project_id)
  where status = 'active' and candidate_group = 'submitter' and project_id is not null;
create index if not exists showcase_winners_public_idx
  on public.showcase_winners(event_id, candidate_group, status, position);

drop trigger if exists showcase_events_set_updated_at on public.showcase_events;
create trigger showcase_events_set_updated_at
  before update on public.showcase_events
  for each row execute function public.set_partnership_updated_at();

drop trigger if exists showcase_projects_set_updated_at on public.showcase_projects;
create trigger showcase_projects_set_updated_at
  before update on public.showcase_projects
  for each row execute function public.set_partnership_updated_at();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'showcase_events', 'showcase_projects', 'showcase_project_participants',
    'showcase_registrations', 'showcase_project_views', 'showcase_experiences',
    'showcase_feedback', 'showcase_interests', 'showcase_candidate_exclusions',
    'showcase_draws', 'showcase_winners'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end;
$$;

comment on table public.showcase_project_participants is
  'Private roster names and 7-digit student numbers. Service-role only; deleted on withdrawal and by the post-settlement purge.';
comment on table public.showcase_registrations is
  'Experience participation registration (student number + announcement consent). Service-role only.';
comment on table public.showcase_feedback is
  'One-line feedback; a row is one valid experience. Owners see body text only, never the author.';
comment on table public.showcase_winners is
  'Draw results with masked display snapshots. Member links are detached by the post-settlement purge.';

alter table public.image_upload_sessions
  drop constraint if exists image_upload_sessions_purpose_check;
alter table public.image_upload_sessions
  add constraint image_upload_sessions_purpose_check
  check (purpose in (
    'partner', 'partner-registration', 'partner-change-request', 'review',
    'profile', 'member-signup-profile', 'graduate-verification',
    'manual-member-import', 'promotion', 'showcase-project'
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'showcase-projects', 'showcase-projects', true, 10485760,
  array['image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Submission writes ---------------------------------------------------------

create or replace function public.showcase_assert_submission_open(p_event_id uuid)
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
      and event_row.submission_start_at <= now()
      and now() < event_row.submission_end_at
  ) then
    raise exception 'showcase_submission_closed';
  end if;
end;
$$;

create or replace function public.showcase_replace_participants(
  p_event_id uuid,
  p_project_id uuid,
  p_owner_name text,
  p_owner_student_number text,
  p_teammates jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_teammates is null or jsonb_typeof(p_teammates) <> 'array'
    or jsonb_array_length(p_teammates) > 19 then
    raise exception 'showcase_participants_invalid';
  end if;

  delete from public.showcase_project_participants where project_id = p_project_id;

  begin
    insert into public.showcase_project_participants (
      event_id, project_id, position, name, student_number, is_owner
    ) values (
      p_event_id, p_project_id, 0, btrim(p_owner_name), btrim(p_owner_student_number), true
    );

    insert into public.showcase_project_participants (
      event_id, project_id, position, name, student_number, is_owner
    )
    select p_event_id, p_project_id, (teammate.ordinality)::smallint,
      btrim(teammate.value ->> 'name'), btrim(teammate.value ->> 'student_number'), false
    from jsonb_array_elements(p_teammates) with ordinality as teammate(value, ordinality);
  exception when unique_violation then
    raise exception 'showcase_student_number_taken';
  end;
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
  p_owner_student_number text,
  p_teammates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.showcase_assert_submission_open(p_event_id);

  begin
    insert into public.showcase_projects (
      id, event_id, owner_member_id, project_type, title, team_name, summary,
      description, service_url, image_url, image_upload_id, announcement_consented_at
    ) values (
      p_project_id, p_event_id, p_owner_member_id, p_project_type, btrim(p_title),
      nullif(btrim(coalesce(p_team_name, '')), ''), btrim(p_summary), btrim(p_description),
      btrim(p_service_url), p_image_url, p_image_upload_id, now()
    );
  exception when unique_violation then
    raise exception 'showcase_owner_already_submitted';
  end;

  perform public.showcase_replace_participants(
    p_event_id, p_project_id, p_owner_name, p_owner_student_number, p_teammates
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
  p_owner_student_number text,
  p_teammates jsonb
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

  perform public.showcase_replace_participants(
    project_row.event_id, p_project_id, p_owner_name, p_owner_student_number, p_teammates
  );
end;
$$;

create or replace function public.withdraw_showcase_project(
  p_project_id uuid,
  p_owner_member_id uuid
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
  if project_row.status = 'withdrawn' then
    raise exception 'showcase_project_not_editable';
  end if;

  update public.showcase_projects
  set status = 'withdrawn', withdrawn_at = now()
  where id = p_project_id;
  delete from public.showcase_project_participants where project_id = p_project_id;
end;
$$;

create or replace function public.review_showcase_project(
  p_project_id uuid,
  p_admin_id uuid,
  p_status text,
  p_review_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_status not in ('approved', 'changes_requested', 'rejected', 'hidden')
    or char_length(coalesce(p_review_note, '')) > 2000 then
    raise exception 'showcase_review_invalid';
  end if;

  update public.showcase_projects
  set status = p_status,
      review_note = nullif(btrim(coalesce(p_review_note, '')), ''),
      reviewed_by_admin_id = p_admin_id,
      reviewed_at = now()
  where id = p_project_id and status <> 'withdrawn';
  if not found then
    raise exception 'showcase_project_not_found';
  end if;
end;
$$;

-- Experience-phase reads/writes ------------------------------------------------

create or replace function public.record_showcase_project_view(
  p_project_id uuid,
  p_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  inserted_count integer;
begin
  if p_project_id is null or p_member_id is null then
    return false;
  end if;

  insert into public.showcase_project_views (event_id, project_id, member_id)
  select event_row.id, project_row.id, p_member_id
  from public.showcase_projects project_row
  join public.showcase_events event_row on event_row.id = project_row.event_id
  where project_row.id = p_project_id
    and project_row.status = 'approved'
    and project_row.owner_member_id is distinct from p_member_id
    and event_row.is_active
    and event_row.experience_start_at <= now()
    and now() < event_row.experience_end_at
  on conflict (event_id, project_id, member_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

create or replace function public.get_showcase_project_counts(p_event_id uuid)
returns table(
  project_id uuid,
  view_count bigint,
  experience_count bigint,
  valid_experience_count bigint,
  interest_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select project.id,
    (select count(*) from public.showcase_project_views v where v.project_id = project.id),
    (select count(*) from public.showcase_experiences e where e.project_id = project.id),
    (select count(*) from public.showcase_feedback f where f.project_id = project.id),
    (select count(*) from public.showcase_interests i where i.project_id = project.id)
  from public.showcase_projects project
  where project.event_id = p_event_id;
$$;

do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.showcase_assert_submission_open(uuid)',
    'public.showcase_replace_participants(uuid, uuid, text, text, jsonb)',
    'public.create_showcase_project(uuid, uuid, uuid, text, text, text, text, text, text, text, text, uuid, text, jsonb)',
    'public.update_showcase_project(uuid, uuid, text, text, text, text, text, text, text, text, uuid, text, jsonb)',
    'public.withdraw_showcase_project(uuid, uuid)',
    'public.review_showcase_project(uuid, uuid, text, text)',
    'public.record_showcase_project_view(uuid, uuid)',
    'public.get_showcase_project_counts(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end;
$$;

insert into public.promotion_slides (
  id, display_order, title, subtitle, image_src, image_alt, href,
  is_active, audiences, allowed_campuses, event_slug, sponsor_label
)
values (
  'be48d541-6e8f-45d3-a50d-04baf4bf4801'::uuid,
  1,
  '내 프로젝트를 소개합니다!',
  'SSAFY 구성원이 만든 서비스를 소개하고 함께 체험해 보세요.',
  '/ads/project-showcase.png',
  'SSAFY가 만든 프로젝트를 직접 둘러보고 체험해 보세요',
  '/events/project-showcase',
  false,
  array['guest', 'student', 'graduate', 'staff']::text[],
  '{}'::text[],
  null,
  ''
)
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  image_src = excluded.image_src,
  image_alt = excluded.image_alt,
  href = excluded.href,
  audiences = excluded.audiences,
  allowed_campuses = excluded.allowed_campuses,
  event_slug = excluded.event_slug,
  sponsor_label = excluded.sponsor_label;
