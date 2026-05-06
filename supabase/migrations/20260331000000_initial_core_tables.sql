-- Backfill the missing initial schema baseline for branch databases that replay
-- migrations from an empty database. Existing production/preview databases keep
-- their current objects because every statement is idempotent.

create extension if not exists "uuid-ossp";

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  label text not null,
  description text,
  color text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.partner_companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.partners (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.partner_companies(id) on delete set null,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  visibility text not null default 'public',
  location text not null,
  map_url text,
  reservation_link text,
  inquiry_link text,
  period_start date,
  period_end date,
  conditions text[] not null default '{}',
  benefits text[] not null default '{}',
  applies_to text[] not null default '{staff,student,graduate}',
  thumbnail text,
  images text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.admin_login_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.suggestion_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.members (
  id uuid primary key default uuid_generate_v4(),
  mm_user_id text not null unique,
  mm_username text not null,
  password_hash text,
  password_salt text,
  must_change_password boolean not null default false,
  display_name text,
  year integer not null,
  staff_source_year integer,
  campus text,
  service_policy_version integer,
  service_policy_consented_at timestamp with time zone,
  privacy_policy_version integer,
  privacy_policy_consented_at timestamp with time zone,
  marketing_policy_version integer,
  marketing_policy_consented_at timestamp with time zone,
  avatar_content_type text,
  avatar_base64 text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.mm_verification_codes (
  id uuid primary key default uuid_generate_v4(),
  code_hash text not null,
  expires_at timestamp with time zone not null,
  mm_user_id text not null,
  mm_username text not null,
  display_name text,
  year integer not null,
  campus text,
  avatar_content_type text,
  avatar_base64 text,
  created_at timestamp with time zone default now()
);

create table if not exists public.mm_verification_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.password_reset_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.push_preferences (
  member_id uuid primary key references public.members(id) on delete cascade,
  enabled boolean not null default false,
  announcement_enabled boolean not null default true,
  new_partner_enabled boolean not null default true,
  expiring_partner_enabled boolean not null default true,
  review_enabled boolean not null default true,
  mm_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references public.members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamp with time zone,
  user_agent text,
  is_active boolean not null default true,
  failure_reason text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_success_at timestamp with time zone,
  last_failure_at timestamp with time zone
);

create table if not exists public.push_message_logs (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  source text not null default 'automatic',
  target_scope text not null default 'all',
  target_label text not null default '전체',
  target_year integer,
  target_campus text,
  target_member_id uuid references public.members(id) on delete set null,
  title text not null,
  body text not null,
  url text,
  status text not null default 'pending',
  targeted integer not null default 0,
  delivered integer not null default 0,
  failed integer not null default 0,
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

create table if not exists public.push_delivery_logs (
  id uuid primary key default uuid_generate_v4(),
  message_log_id uuid references public.push_message_logs(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  url text,
  status text not null,
  error_message text,
  created_at timestamp with time zone default now()
);

create table if not exists public.event_logs (
  id uuid primary key default uuid_generate_v4(),
  session_id text,
  actor_type text not null,
  actor_id text,
  event_name text not null,
  path text,
  referrer text,
  target_type text,
  target_id text,
  properties jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_address text,
  created_at timestamp with time zone default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id text,
  action text not null,
  path text,
  target_type text,
  target_id text,
  properties jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_address text,
  created_at timestamp with time zone default now()
);

create table if not exists public.auth_security_logs (
  id uuid primary key default uuid_generate_v4(),
  event_name text not null,
  status text not null,
  actor_type text not null,
  actor_id text,
  identifier text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_address text,
  created_at timestamp with time zone default now()
);
