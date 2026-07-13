-- Phase 1 / expand: keep legacy member columns until every application reader
-- has moved to the normalized model in a later contract migration.
alter table public.members
  add column if not exists generation integer,
  add column if not exists staff_source_generation integer,
  add column if not exists email text,
  add column if not exists email_normalized text,
  add column if not exists email_verified_at timestamp with time zone,
  add column if not exists mattermost_account_id uuid,
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists anonymized_at timestamp with time zone;

alter table public.members
  drop constraint if exists members_generation_check;
alter table public.members
  add constraint members_generation_check
  check (generation is null or generation between 0 and 99);

alter table public.members
  drop constraint if exists members_staff_source_generation_check;
alter table public.members
  add constraint members_staff_source_generation_check
  check (staff_source_generation is null or staff_source_generation between 1 and 99);

alter table public.members
  drop constraint if exists members_email_normalized_check;
alter table public.members
  add constraint members_email_normalized_check
  check (
    (email is null and email_normalized is null)
    or (email is not null and email_normalized = lower(btrim(email)))
  );

create unique index if not exists members_email_normalized_key
  on public.members(email_normalized)
  where email_normalized is not null;
create index if not exists members_active_generation_campus_idx
  on public.members(generation, campus, created_at desc)
  where deleted_at is null;
create index if not exists members_deleted_at_idx
  on public.members(deleted_at)
  where deleted_at is not null;

-- Reuse the directory as the canonical Mattermost account table. The old
-- snapshot column names remain temporarily so deployed code can coexist.
alter table public.mm_user_directory
  add column if not exists legacy_ssafy_mattermost_user_id text,
  add column if not exists display_name_snapshot text,
  add column if not exists campus_snapshot text,
  add column if not exists source_generations integer[] not null default '{}',
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamp with time zone;

create unique index if not exists mm_user_directory_legacy_ssafy_mattermost_user_id_key
  on public.mm_user_directory(legacy_ssafy_mattermost_user_id)
  where legacy_ssafy_mattermost_user_id is not null;
create index if not exists mm_user_directory_active_username_idx
  on public.mm_user_directory(mm_username)
  where is_active = true;

alter table public.members
  drop constraint if exists members_mattermost_account_id_fkey;
alter table public.members
  add constraint members_mattermost_account_id_fkey
  foreign key (mattermost_account_id)
  references public.mm_user_directory(id)
  on delete restrict;
create unique index if not exists members_mattermost_account_id_key
  on public.members(mattermost_account_id)
  where mattermost_account_id is not null;

create table if not exists public.member_ssafy_verifications (
  member_id uuid primary key references public.members(id) on delete cascade,
  ssafy_sub text not null unique,
  verified_at timestamp with time zone not null,
  auth_time timestamp with time zone,
  verification_id text,
  track text,
  track_name text,
  last_scope text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.graduate_profiles (
  member_id uuid primary key references public.members(id) on delete cascade,
  verification_request_id uuid unique references public.graduate_verification_requests(id) on delete set null,
  verified_at timestamp with time zone not null,
  verification_source text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint graduate_profiles_verification_source_check
    check (verification_source in ('graduate_certificate', 'legacy_migration'))
);

create table if not exists public.admin_profiles (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  permission_template_key text not null references public.admin_permission_templates(key) on delete restrict,
  managed_campus_slugs text[] not null default '{}',
  is_active boolean not null default true,
  permission_version integer not null default 1,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint admin_profiles_permission_version_check check (permission_version > 0)
);

-- Permission templates may be shared by multiple active administrators. The
-- existing privileged-admin guard remains responsible for ensuring that at
-- least one administrator can manage access.
drop index if exists public.admin_profiles_single_super_admin_idx;
create index if not exists admin_profiles_active_permission_template_idx
  on public.admin_profiles(permission_template_key)
  where is_active = true;

create table if not exists public.member_identifier_reservations (
  id uuid primary key default uuid_generate_v4(),
  identifier_kind text not null,
  identifier_hash text not null,
  reserved_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint member_identifier_reservations_kind_check
    check (identifier_kind in ('email', 'mm_user_id', 'mm_username', 'ssafy_sub')),
  constraint member_identifier_reservations_hash_check
    check (identifier_hash ~ '^[0-9a-f]{64}$'),
  unique (identifier_kind, identifier_hash)
);

create table if not exists public.member_email_challenges (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid references public.members(id) on delete cascade,
  graduate_verification_request_id uuid references public.graduate_verification_requests(id) on delete cascade,
  email_normalized text not null,
  purpose text not null,
  code_hash text not null,
  expires_at timestamp with time zone not null,
  verified_at timestamp with time zone,
  consumed_at timestamp with time zone,
  attempt_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint member_email_challenges_owner_check
    check (num_nonnulls(member_id, graduate_verification_request_id) = 1),
  constraint member_email_challenges_purpose_check
    check (purpose in ('email_verify', 'email_change')),
  constraint member_email_challenges_attempt_count_check
    check (attempt_count between 0 and 10)
);

create index if not exists member_email_challenges_lookup_idx
  on public.member_email_challenges(member_id, email_normalized, purpose, expires_at desc);

alter table public.graduate_verification_requests
  add column if not exists inferred_generation integer,
  add column if not exists reviewer_admin_profile_id uuid references public.admin_profiles(id) on delete set null;

-- Graduation semester is legacy history only. New verification uses the
-- inferred generation calculated from the education start period.
alter table public.graduate_verification_requests
  alter column completion_stage drop not null;

alter table public.graduate_verification_requests
  drop constraint if exists graduate_verification_requests_inferred_generation_check;
alter table public.graduate_verification_requests
  add constraint graduate_verification_requests_inferred_generation_check
  check (inferred_generation is null or inferred_generation between 1 and 99);

alter table public.member_profile_images
  add column if not exists source text not null default 'legacy',
  add column if not exists reviewer_admin_profile_id uuid references public.admin_profiles(id) on delete set null;

alter table public.member_profile_images
  drop constraint if exists member_profile_images_source_check;
alter table public.member_profile_images
  add constraint member_profile_images_source_check
  check (source in ('legacy', 'mattermost', 'graduate_verification', 'member_upload'));

-- Consent records must outlive policy activation changes. Existing rows remain
-- service-role only; new tables are explicitly not exposed to Data API users.
alter table public.member_policy_consents
  drop constraint if exists member_policy_consents_policy_document_id_fkey;
alter table public.member_policy_consents
  add constraint member_policy_consents_policy_document_id_fkey
  foreign key (policy_document_id)
  references public.policy_documents(id)
  on delete restrict;

create or replace function public.prevent_policy_document_content_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind is distinct from old.kind
    or new.version is distinct from old.version
    or new.title is distinct from old.title
    or new.summary is distinct from old.summary
    or new.content is distinct from old.content
    or new.created_at is distinct from old.created_at then
    raise exception 'policy_document_version_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists policy_documents_prevent_content_mutation on public.policy_documents;
create trigger policy_documents_prevent_content_mutation
  before update on public.policy_documents
  for each row execute function public.prevent_policy_document_content_mutation();

alter table public.mm_user_directory enable row level security;
alter table public.member_ssafy_verifications enable row level security;
alter table public.graduate_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.member_identifier_reservations enable row level security;
alter table public.member_email_challenges enable row level security;

revoke all on table public.mm_user_directory from anon;
revoke all on table public.mm_user_directory from authenticated;
revoke all on table public.member_ssafy_verifications from anon;
revoke all on table public.member_ssafy_verifications from authenticated;
revoke all on table public.graduate_profiles from anon;
revoke all on table public.graduate_profiles from authenticated;
revoke all on table public.admin_profiles from anon;
revoke all on table public.admin_profiles from authenticated;
revoke all on table public.member_identifier_reservations from anon;
revoke all on table public.member_identifier_reservations from authenticated;
revoke all on table public.member_email_challenges from anon;
revoke all on table public.member_email_challenges from authenticated;

create or replace function public.soft_delete_member(
  p_member_id uuid,
  p_identifier_reservations jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  reservation record;
begin
  select * into member_row
  from public.members
  where id = p_member_id
  for update;

  if not found or member_row.deleted_at is not null then
    return false;
  end if;

  for reservation in
    select identifier_kind, identifier_hash
    from jsonb_to_recordset(coalesce(p_identifier_reservations, '[]'::jsonb))
      as value(identifier_kind text, identifier_hash text)
  loop
    insert into public.member_identifier_reservations (
      identifier_kind,
      identifier_hash
    )
    values (reservation.identifier_kind, reservation.identifier_hash)
    on conflict (identifier_kind, identifier_hash) do nothing;
  end loop;

  update public.members
  set deleted_at = now(), updated_at = now()
  where id = p_member_id;

  update public.admin_profiles
  set is_active = false,
      permission_version = permission_version + 1,
      updated_at = now()
  where member_id = p_member_id;

  delete from public.push_subscriptions
  where member_id = p_member_id;

  return true;
end;
$$;

revoke all on function public.soft_delete_member(uuid, jsonb) from public;
revoke all on function public.soft_delete_member(uuid, jsonb) from anon;
revoke all on function public.soft_delete_member(uuid, jsonb) from authenticated;
grant execute on function public.soft_delete_member(uuid, jsonb) to service_role;

create or replace function public.anonymize_deleted_member(p_member_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  mattermost_account_uuid uuid;
  verification_request_uuid uuid;
begin
  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is not null
    and deleted_at <= now() - interval '30 days'
    and anonymized_at is null
  for update;

  if not found then
    return false;
  end if;

  mattermost_account_uuid := member_row.mattermost_account_id;
  select verification_request_id into verification_request_uuid
  from public.graduate_profiles
  where member_id = p_member_id;

  delete from public.member_profile_images where member_id = p_member_id;
  delete from public.member_ssafy_verifications where member_id = p_member_id;
  delete from public.member_email_challenges where member_id = p_member_id;
  delete from public.member_password_action_tokens where member_id = p_member_id;
  delete from public.member_auth_identities where member_id = p_member_id;
  delete from public.graduate_profiles where member_id = p_member_id;

  if verification_request_uuid is not null then
    update public.graduate_verification_requests
    set email = concat('deleted+', verification_request_uuid::text, '@deleted.invalid'),
        email_normalized = concat('deleted+', verification_request_uuid::text, '@deleted.invalid'),
        legal_name = '탈퇴한 수료생',
        document_number_hmac = null,
        certificate_storage_path = null,
        certificate_sha256 = null,
        certificate_deleted_at = coalesce(certificate_deleted_at, now()),
        review_note = null,
        rejection_reason = null,
        updated_at = now()
    where id = verification_request_uuid;
  end if;

  update public.members
  set email = null,
      email_normalized = null,
      email_verified_at = null,
      password_hash = null,
      password_salt = null,
      must_change_password = false,
      display_name = '탈퇴한 회원',
      campus = null,
      staff_source_generation = null,
      mattermost_account_id = null,
      mm_user_id = null,
      mm_username = null,
      ssafy_sub = null,
      ssafy_verified_at = null,
      ssafy_auth_time = null,
      ssafy_verification_id = null,
      ssafy_mattermost_user_id = null,
      ssafy_track = null,
      ssafy_track_name = null,
      ssafy_last_scope = null,
      avatar_content_type = null,
      avatar_base64 = null,
      avatar_url = null,
      graduate_verified_at = null,
      graduate_completion_stage = null,
      verification_source = null,
      admin_permission_id = null,
      admin_managed_campus_slugs = '{}',
      service_policy_version = null,
      service_policy_consented_at = null,
      privacy_policy_version = null,
      privacy_policy_consented_at = null,
      marketing_policy_version = null,
      marketing_policy_consented_at = null,
      active_profile_image_id = null,
      profile_photo_review_status = 'approved',
      anonymized_at = now(),
      updated_at = now()
  where id = p_member_id;

  if mattermost_account_uuid is not null then
    delete from public.mm_user_directory directory
    where directory.id = mattermost_account_uuid
      and not exists (
        select 1
        from public.members linked_member
        where linked_member.mattermost_account_id = directory.id
      );
  end if;

  return true;
end;
$$;

revoke all on function public.anonymize_deleted_member(uuid) from public;
revoke all on function public.anonymize_deleted_member(uuid) from anon;
revoke all on function public.anonymize_deleted_member(uuid) from authenticated;
grant execute on function public.anonymize_deleted_member(uuid) to service_role;
