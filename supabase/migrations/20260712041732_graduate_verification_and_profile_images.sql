-- Graduate members do not necessarily have a Mattermost account. Keep the
-- existing columns for compatibility while allowing an independently verified
-- email identity.
alter table public.members
  alter column mm_user_id drop not null,
  alter column mm_username drop not null;

alter table public.members
  add column if not exists graduate_verified_at timestamp with time zone,
  add column if not exists graduate_completion_stage text,
  add column if not exists verification_source text,
  add column if not exists active_profile_image_id uuid;

alter table public.members
  drop constraint if exists members_graduate_completion_stage_check;
alter table public.members
  add constraint members_graduate_completion_stage_check
  check (
    graduate_completion_stage is null
    or graduate_completion_stage in ('semester_1', 'semester_2')
  );

alter table public.members
  drop constraint if exists members_verification_source_check;
alter table public.members
  add constraint members_verification_source_check
  check (
    verification_source is null
    or verification_source in ('ssafy_verify', 'graduate_certificate', 'legacy_mm')
  );

create table if not exists public.member_auth_identities (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references public.members(id) on delete cascade,
  provider text not null,
  identifier_normalized text not null,
  verified_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint member_auth_identities_provider_check
    check (provider in ('mattermost', 'graduate_email')),
  constraint member_auth_identities_identifier_nonempty_check
    check (char_length(btrim(identifier_normalized)) between 1 and 320),
  unique (provider, identifier_normalized)
);

insert into public.member_auth_identities (
  member_id,
  provider,
  identifier_normalized,
  verified_at
)
select
  member.id,
  'mattermost',
  lower(btrim(member.mm_username)),
  member.ssafy_verified_at
from public.members member
where member.mm_username is not null
  and btrim(member.mm_username) <> ''
on conflict (provider, identifier_normalized) do nothing;

create table if not exists public.graduate_verification_requests (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  email_normalized text not null,
  legal_name text not null,
  completion_stage text not null,
  education_start_year integer not null,
  education_start_month integer not null,
  education_end_year integer not null,
  education_end_month integer not null,
  inferred_cohort integer not null,
  cohort_rule_version text not null default 'ssafy-half-year-v1',
  campus text,
  certificate_storage_path text,
  certificate_sha256 text,
  document_number_hmac text,
  status text not null default 'draft',
  resubmission_targets text[] not null default '{}',
  reviewer_admin_id uuid references public.admin_accounts(id) on delete set null,
  review_note text,
  rejection_reason text,
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  decided_at timestamp with time zone,
  certificate_delete_after timestamp with time zone,
  certificate_deleted_at timestamp with time zone,
  resubmission_email_sent_at timestamp with time zone,
  resubmission_email_last_error_at timestamp with time zone,
  setup_email_sent_at timestamp with time zone,
  setup_email_last_error_at timestamp with time zone,
  privacy_photo_consented_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint graduate_verification_requests_email_check
    check (email_normalized = lower(btrim(email))),
  constraint graduate_verification_requests_name_check
    check (char_length(btrim(legal_name)) between 1 and 100),
  constraint graduate_verification_requests_completion_stage_check
    check (completion_stage in ('semester_1', 'semester_2')),
  constraint graduate_verification_requests_start_month_check
    check (education_start_month between 1 and 12),
  constraint graduate_verification_requests_end_month_check
    check (education_end_month between 1 and 12),
  constraint graduate_verification_requests_period_check
    check (
      education_end_year * 12 + education_end_month
      >= education_start_year * 12 + education_start_month
    ),
  constraint graduate_verification_requests_cohort_check
    check (inferred_cohort between 1 and 99),
  constraint graduate_verification_requests_status_check
    check (status in ('draft', 'submitted', 'in_review', 'needs_resubmission', 'approved', 'rejected', 'withdrawn')),
  constraint graduate_verification_requests_consent_check
    check (status = 'draft' or privacy_photo_consented_at is not null),
  constraint graduate_verification_requests_resubmission_targets_check
    check (resubmission_targets <@ array['education_period', 'certificate', 'profile_image']::text[])
);

create unique index if not exists graduate_verification_requests_open_email_idx
  on public.graduate_verification_requests(email_normalized)
  where status in ('draft', 'submitted', 'in_review', 'needs_resubmission');
create unique index if not exists graduate_verification_requests_document_number_hmac_idx
  on public.graduate_verification_requests(document_number_hmac)
  where document_number_hmac is not null and status = 'approved';
create unique index if not exists graduate_verification_requests_active_certificate_sha256_idx
  on public.graduate_verification_requests(certificate_sha256)
  where certificate_sha256 is not null
    and status in ('submitted', 'in_review', 'needs_resubmission', 'approved');
create index if not exists graduate_verification_requests_status_created_at_idx
  on public.graduate_verification_requests(status, created_at desc);

create table if not exists public.member_profile_images (
  id uuid primary key default uuid_generate_v4(),
  graduate_verification_request_id uuid references public.graduate_verification_requests(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  storage_path text not null unique,
  sha256 text not null,
  content_type text not null default 'image/webp',
  width integer not null default 640,
  height integer not null default 640,
  status text not null default 'pending',
  reviewer_admin_id uuid references public.admin_accounts(id) on delete set null,
  review_reason text,
  reviewed_at timestamp with time zone,
  delete_after timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint member_profile_images_owner_check
    check (graduate_verification_request_id is not null or member_id is not null),
  constraint member_profile_images_content_type_check
    check (content_type = 'image/webp'),
  constraint member_profile_images_dimensions_check
    check (width = 640 and height = 640),
  constraint member_profile_images_status_check
    check (status in ('pending', 'approved', 'rejected', 'superseded'))
);

create index if not exists member_profile_images_request_status_idx
  on public.member_profile_images(graduate_verification_request_id, status, created_at desc);
create index if not exists member_profile_images_member_status_idx
  on public.member_profile_images(member_id, status, created_at desc);

alter table public.graduate_verification_requests
  add column if not exists profile_image_id uuid references public.member_profile_images(id) on delete set null;

alter table public.members
  drop constraint if exists members_active_profile_image_id_fkey;
alter table public.members
  add constraint members_active_profile_image_id_fkey
  foreign key (active_profile_image_id)
  references public.member_profile_images(id)
  on delete set null;

create table if not exists public.graduate_email_challenges (
  id uuid primary key default uuid_generate_v4(),
  email_normalized text not null,
  purpose text not null,
  code_hash text not null,
  request_id uuid references public.graduate_verification_requests(id) on delete cascade,
  expires_at timestamp with time zone not null,
  verified_at timestamp with time zone,
  consumed_at timestamp with time zone,
  attempt_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint graduate_email_challenges_purpose_check
    check (purpose in ('application', 'account_setup', 'password_reset')),
  constraint graduate_email_challenges_attempt_count_check
    check (attempt_count between 0 and 10)
);

create index if not exists graduate_email_challenges_lookup_idx
  on public.graduate_email_challenges(email_normalized, purpose, expires_at desc);

create table if not exists public.graduate_verification_uploads (
  id uuid primary key default uuid_generate_v4(),
  challenge_id uuid references public.graduate_email_challenges(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  kind text not null,
  storage_bucket text not null,
  storage_path text not null unique,
  content_type text not null,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint graduate_verification_uploads_kind_check
    check (kind in ('certificate', 'profile_image')),
  constraint graduate_verification_uploads_bucket_check
    check (storage_bucket in ('graduate-certificates', 'member-profile-images')),
  constraint graduate_verification_uploads_content_type_check
    check (
      (kind = 'certificate' and content_type = 'application/pdf')
      or (kind = 'profile_image' and content_type in ('image/jpeg', 'image/png', 'image/webp'))
    ),
  constraint graduate_verification_uploads_owner_check
    check (challenge_id is not null or member_id is not null)
);

create index if not exists graduate_verification_uploads_challenge_idx
  on public.graduate_verification_uploads(challenge_id, kind, expires_at desc);
create index if not exists graduate_verification_uploads_member_idx
  on public.graduate_verification_uploads(member_id, kind, expires_at desc);

create table if not exists public.member_password_action_tokens (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references public.members(id) on delete cascade,
  purpose text not null,
  token_hash text not null unique,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint member_password_action_tokens_purpose_check
    check (purpose in ('graduate_initial_setup', 'graduate_password_reset'))
);

create unique index if not exists member_password_action_tokens_active_member_purpose_idx
  on public.member_password_action_tokens(member_id, purpose)
  where consumed_at is null;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'graduate-certificates',
    'graduate-certificates',
    false,
    10485760,
    array['application/pdf']
  ),
  (
    'member-profile-images',
    'member-profile-images',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.member_auth_identities enable row level security;
alter table public.graduate_verification_requests enable row level security;
alter table public.member_profile_images enable row level security;
alter table public.graduate_email_challenges enable row level security;
alter table public.graduate_verification_uploads enable row level security;
alter table public.member_password_action_tokens enable row level security;

revoke all on table public.member_auth_identities from anon;
revoke all on table public.member_auth_identities from authenticated;
revoke all on table public.graduate_verification_requests from anon;
revoke all on table public.graduate_verification_requests from authenticated;
revoke all on table public.member_profile_images from anon;
revoke all on table public.member_profile_images from authenticated;
revoke all on table public.graduate_email_challenges from anon;
revoke all on table public.graduate_email_challenges from authenticated;
revoke all on table public.graduate_verification_uploads from anon;
revoke all on table public.graduate_verification_uploads from authenticated;
revoke all on table public.member_password_action_tokens from anon;
revoke all on table public.member_password_action_tokens from authenticated;

drop trigger if exists member_auth_identities_set_partnership_updated_at on public.member_auth_identities;
create trigger member_auth_identities_set_partnership_updated_at
  before update on public.member_auth_identities
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists graduate_verification_requests_set_partnership_updated_at on public.graduate_verification_requests;
create trigger graduate_verification_requests_set_partnership_updated_at
  before update on public.graduate_verification_requests
  for each row
  execute function public.set_partnership_updated_at();

create or replace function public.enforce_graduate_verification_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status in ('submitted', 'withdrawn'))
    or (old.status = 'submitted' and new.status in ('in_review', 'withdrawn'))
    or (old.status = 'in_review' and new.status in ('needs_resubmission', 'approved', 'rejected'))
    or (old.status = 'needs_resubmission' and new.status in ('submitted', 'withdrawn'))
  ) then
    raise exception 'invalid_graduate_verification_status_transition';
  end if;

  return new;
end;
$$;

drop trigger if exists graduate_verification_requests_status_transition on public.graduate_verification_requests;
create trigger graduate_verification_requests_status_transition
  before update on public.graduate_verification_requests
  for each row
  execute function public.enforce_graduate_verification_status_transition();

drop trigger if exists member_profile_images_set_partnership_updated_at on public.member_profile_images;
create trigger member_profile_images_set_partnership_updated_at
  before update on public.member_profile_images
  for each row
  execute function public.set_partnership_updated_at();

create or replace function public.enforce_member_profile_image_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'superseded'))
    or (old.status = 'approved' and new.status = 'superseded')
  ) then
    raise exception 'invalid_member_profile_image_status_transition';
  end if;

  return new;
end;
$$;

drop trigger if exists member_profile_images_status_transition on public.member_profile_images;
create trigger member_profile_images_status_transition
  before update on public.member_profile_images
  for each row
  execute function public.enforce_member_profile_image_status_transition();

alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;
alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'members', 'reviews', 'logs', 'brands', 'companies', 'notifications',
    'home_ads', 'events', 'cycles', 'admin_management', 'graduate_verifications'
  ));

insert into public.admin_permissions (admin_id, resource, action, granted)
select permission.admin_id, 'graduate_verifications', permission.action, true
from public.admin_permissions permission
where permission.resource = 'members'
  and permission.action in ('read', 'update')
  and permission.granted = true
on conflict (admin_id, resource, action) do update set granted = excluded.granted;

update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{graduate_verifications}',
  '{"create":false,"read":true,"update":true,"delete":false}'::jsonb,
  true
), updated_at = now()
where key in ('super_admin', 'operations_manager', 'support');

update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{graduate_verifications}',
  '{"create":false,"read":true,"update":false,"delete":false}'::jsonb,
  true
), updated_at = now()
where key = 'readonly';

create or replace function public.approve_graduate_verification(
  p_request_id uuid,
  p_admin_id uuid,
  p_document_number_hmac text,
  p_setup_token_hash text,
  p_setup_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_row public.graduate_verification_requests%rowtype;
  photo_row public.member_profile_images%rowtype;
  new_member_id uuid;
begin
  select * into request_row
    from public.graduate_verification_requests
   where id = p_request_id
   for update;

  if not found or request_row.status <> 'in_review' then
    raise exception 'graduate_verification_not_reviewable';
  end if;

  if request_row.profile_image_id is null then
    raise exception 'graduate_verification_profile_image_missing';
  end if;

  select * into photo_row
    from public.member_profile_images
   where id = request_row.profile_image_id
   for update;

  if not found or photo_row.status <> 'pending' then
    raise exception 'graduate_verification_profile_image_not_pending';
  end if;

  if exists (
    select 1 from public.member_auth_identities
     where provider = 'graduate_email'
       and identifier_normalized = request_row.email_normalized
  ) then
    raise exception 'graduate_verification_email_exists';
  end if;

  if exists (
    select 1 from public.graduate_verification_requests
     where document_number_hmac = p_document_number_hmac
       and id <> p_request_id
       and status = 'approved'
  ) then
    raise exception 'graduate_verification_document_exists';
  end if;

  insert into public.members (
    mm_user_id,
    mm_username,
    display_name,
    year,
    campus,
    must_change_password,
    graduate_verified_at,
    graduate_completion_stage,
    verification_source
  ) values (
    null,
    null,
    request_row.legal_name,
    request_row.inferred_cohort,
    request_row.campus,
    true,
    now(),
    request_row.completion_stage,
    'graduate_certificate'
  ) returning id into new_member_id;

  insert into public.member_auth_identities (
    member_id, provider, identifier_normalized, verified_at
  ) values (
    new_member_id, 'graduate_email', request_row.email_normalized, now()
  );

  update public.member_profile_images
     set member_id = new_member_id,
         status = 'approved',
         reviewer_admin_id = p_admin_id,
         reviewed_at = now(),
         updated_at = now()
   where id = photo_row.id;

  update public.members
     set active_profile_image_id = photo_row.id,
         updated_at = now()
   where id = new_member_id;

  update public.graduate_verification_requests
     set status = 'approved',
         document_number_hmac = p_document_number_hmac,
         reviewer_admin_id = p_admin_id,
         reviewed_at = now(),
         decided_at = now(),
         certificate_delete_after = now() + interval '30 days',
         resubmission_targets = '{}',
         updated_at = now()
   where id = p_request_id;

  insert into public.member_password_action_tokens (
    member_id, purpose, token_hash, expires_at
  ) values (
    new_member_id, 'graduate_initial_setup', p_setup_token_hash, p_setup_expires_at
  );

  return new_member_id;
end;
$$;

revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from public;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from anon;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from authenticated;
grant execute on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) to service_role;

create or replace function public.complete_graduate_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.member_password_action_tokens%rowtype;
begin
  select * into token_row
    from public.member_password_action_tokens
   where token_hash = p_token_hash
     and purpose in ('graduate_initial_setup', 'graduate_password_reset')
     and consumed_at is null
     and expires_at > now()
   for update;

  if not found then
    raise exception 'graduate_password_action_invalid';
  end if;

  update public.members
     set password_hash = p_password_hash,
         password_salt = p_password_salt,
         must_change_password = false,
         updated_at = now()
   where id = token_row.member_id;

  update public.member_password_action_tokens
     set consumed_at = now()
   where id = token_row.id;

  return token_row.member_id;
end;
$$;

revoke all on function public.complete_graduate_password_action(text, text, text) from public;
revoke all on function public.complete_graduate_password_action(text, text, text) from anon;
revoke all on function public.complete_graduate_password_action(text, text, text) from authenticated;
grant execute on function public.complete_graduate_password_action(text, text, text) to service_role;

create or replace function public.reissue_graduate_initial_setup(
  p_request_id uuid,
  p_setup_token_hash text,
  p_setup_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_row public.graduate_verification_requests%rowtype;
  identity_row public.member_auth_identities%rowtype;
  member_row public.members%rowtype;
begin
  select * into request_row
    from public.graduate_verification_requests
   where id = p_request_id
     and status = 'approved'
   for update;

  if not found then
    raise exception 'graduate_initial_setup_request_invalid';
  end if;

  select * into identity_row
    from public.member_auth_identities
   where provider = 'graduate_email'
     and identifier_normalized = request_row.email_normalized
   for update;

  if not found then
    raise exception 'graduate_initial_setup_identity_missing';
  end if;

  select * into member_row
    from public.members
   where id = identity_row.member_id
     and must_change_password = true
   for update;

  if not found then
    raise exception 'graduate_initial_setup_already_completed';
  end if;

  update public.member_password_action_tokens
     set consumed_at = now()
   where member_id = member_row.id
     and purpose = 'graduate_initial_setup'
     and consumed_at is null;

  insert into public.member_password_action_tokens (
    member_id, purpose, token_hash, expires_at
  ) values (
    member_row.id, 'graduate_initial_setup', p_setup_token_hash, p_setup_expires_at
  );

  return member_row.id;
end;
$$;

revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from public;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from anon;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) to service_role;

create or replace function public.issue_graduate_password_reset(
  p_challenge_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  challenge_row public.graduate_email_challenges%rowtype;
  identity_row public.member_auth_identities%rowtype;
  member_row public.members%rowtype;
begin
  select * into challenge_row
    from public.graduate_email_challenges
   where id = p_challenge_id
     and purpose = 'password_reset'
     and verified_at is not null
     and consumed_at is null
     and expires_at > now()
   for update;

  if not found then
    raise exception 'graduate_password_reset_challenge_invalid';
  end if;

  select * into identity_row
    from public.member_auth_identities
   where provider = 'graduate_email'
     and identifier_normalized = challenge_row.email_normalized
   for update;

  if not found then
    update public.graduate_email_challenges
       set consumed_at = now()
     where id = challenge_row.id;
    return null;
  end if;

  select * into member_row
    from public.members
   where id = identity_row.member_id
     and graduate_verified_at is not null
   for update;

  if not found then
    update public.graduate_email_challenges
       set consumed_at = now()
     where id = challenge_row.id;
    return null;
  end if;

  update public.member_password_action_tokens
     set consumed_at = now()
   where member_id = member_row.id
     and purpose = 'graduate_password_reset'
     and consumed_at is null;

  insert into public.member_password_action_tokens (
    member_id, purpose, token_hash, expires_at
  ) values (
    member_row.id, 'graduate_password_reset', p_token_hash, p_expires_at
  );

  update public.graduate_email_challenges
     set consumed_at = now()
   where id = challenge_row.id;

  return member_row.id;
end;
$$;

revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from public;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from anon;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) to service_role;

create or replace function public.approve_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
begin
  select * into image_row
    from public.member_profile_images
   where id = p_image_id
     and member_id is not null
     and status = 'pending'
   for update;

  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;

  select * into member_row
    from public.members
   where id = image_row.member_id
   for update;

  if not found then
    raise exception 'profile_image_member_missing';
  end if;

  if member_row.active_profile_image_id is not null then
    update public.member_profile_images
       set status = 'superseded',
           delete_after = now() + interval '30 days',
           updated_at = now()
     where id = member_row.active_profile_image_id;
  end if;

  update public.member_profile_images
     set status = 'approved',
         reviewer_admin_id = p_admin_id,
         reviewed_at = now(),
         updated_at = now()
   where id = image_row.id;

  update public.members
     set active_profile_image_id = image_row.id,
         updated_at = now()
   where id = member_row.id;

  return member_row.id;
end;
$$;

revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from public;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from anon;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from authenticated;
grant execute on function public.approve_member_profile_image_replacement(uuid, uuid) to service_role;

create or replace function public.ensure_single_member_super_admin()
returns trigger
language plpgsql
as $$
declare
  super_admin_count integer;
begin
  if new.admin_permission_id = 'super_admin' and coalesce(new.mm_username, '') <> 'myknow' then
    raise exception 'only myknow member can hold super_admin permission';
  end if;

  select count(*)
    into super_admin_count
    from public.members
   where admin_permission_id = 'super_admin';

  if super_admin_count > 1 then
    raise exception 'only one super_admin member is allowed';
  end if;

  return new;
end;
$$;
