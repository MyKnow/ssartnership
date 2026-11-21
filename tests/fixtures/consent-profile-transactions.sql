-- Synthetic schema for transactional regression tests; no application data.
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.members (id uuid primary key, deleted_at timestamptz, updated_at timestamptz not null default now());
create table public.push_preferences (
  member_id uuid primary key references members(id), enabled boolean not null default false,
  announcement_enabled boolean not null default true, new_partner_enabled boolean not null default true,
  expiring_partner_enabled boolean not null default true, review_enabled boolean not null default true,
  mm_enabled boolean not null default true, marketing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.push_subscriptions (member_id uuid references members(id), is_active boolean not null);
create table public.policy_documents (id uuid primary key, kind text not null, version integer not null, is_active boolean not null);
create unique index policy_documents_active_kind_idx on policy_documents(kind) where is_active;
create table public.member_policy_consents (
  member_id uuid references members(id), policy_document_id uuid references policy_documents(id),
  kind text, version integer, agreed_at timestamptz, ip_address text, user_agent text,
  primary key(member_id, policy_document_id)
);
create table public.admin_profiles (id uuid primary key, member_id uuid references members(id), is_active boolean not null);
create table public.member_profile_images (
  id uuid primary key, member_id uuid references members(id), graduate_verification_request_id uuid,
  source text not null, status text not null check(status in ('pending','approved','rejected','superseded')),
  storage_path text not null unique, deleted_at timestamptz, delete_after timestamptz,
  updated_at timestamptz not null default now(), reviewed_at timestamptz, review_reason text,
  reviewer_admin_id uuid, reviewer_admin_profile_id uuid references admin_profiles(id)
);
create unique index member_profile_images_one_approved_per_member_idx on member_profile_images(member_id)
  where member_id is not null and status = 'approved' and deleted_at is null;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public;
