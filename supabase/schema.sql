create extension if not exists "uuid-ossp";

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  label text not null,
  description text,
  color text,
  created_at timestamp with time zone default now()
);

alter table categories add column if not exists color text;

create table if not exists partners (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  location text not null,
  map_url text,
  reservation_link text,
  inquiry_link text,
  period_start date,
  period_end date,
  benefits text[] not null default '{}',
  conditions text[] not null default '{}',
  images text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamp with time zone default now()
);

alter table partners add column if not exists conditions text[] not null default '{}';
alter table partners add column if not exists images text[] not null default '{}';
alter table partners add column if not exists reservation_link text;
alter table partners add column if not exists inquiry_link text;
alter table partners drop column if exists contact;

create table if not exists admin_login_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists suggestion_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists members (
  id uuid primary key default uuid_generate_v4(),
  mm_user_id text not null unique,
  mm_username text not null,
  password_hash text,
  password_salt text,
  must_change_password boolean not null default false,
  display_name text,
  campus text,
  class_number integer,
  avatar_content_type text,
  avatar_base64 text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table members drop column if exists email;
alter table members drop column if exists region;

create table if not exists mm_verification_codes (
  id uuid primary key default uuid_generate_v4(),
  code_hash text not null,
  expires_at timestamp with time zone not null,
  mm_user_id text not null,
  mm_username text not null,
  display_name text,
  campus text,
  class_number integer,
  avatar_content_type text,
  avatar_base64 text,
  created_at timestamp with time zone default now()
);

alter table mm_verification_codes drop column if exists email;
alter table mm_verification_codes drop column if exists region;

create table if not exists mm_verification_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists password_reset_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists push_preferences (
  member_id uuid primary key references members(id) on delete cascade,
  enabled boolean not null default false,
  announcement_enabled boolean not null default true,
  new_partner_enabled boolean not null default true,
  expiring_partner_enabled boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references members(id) on delete cascade,
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

create table if not exists push_message_logs (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  source text not null default 'automatic',
  target_scope text not null default 'all',
  target_label text not null default '전체',
  target_campus text,
  target_class_number integer,
  target_member_id uuid references members(id) on delete set null,
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

create table if not exists push_delivery_logs (
  id uuid primary key default uuid_generate_v4(),
  message_log_id uuid references push_message_logs(id) on delete set null,
  member_id uuid references members(id) on delete set null,
  subscription_id uuid references push_subscriptions(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  url text,
  status text not null,
  error_message text,
  created_at timestamp with time zone default now()
);

create index if not exists partners_category_id_idx on partners(category_id);
create index if not exists admin_login_attempts_identifier_idx on admin_login_attempts(identifier);
create index if not exists suggestion_attempts_identifier_idx on suggestion_attempts(identifier);
create index if not exists mm_verification_attempts_identifier_idx on mm_verification_attempts(identifier);
create index if not exists password_reset_attempts_identifier_idx on password_reset_attempts(identifier);
create index if not exists push_subscriptions_member_id_idx on push_subscriptions(member_id);
create index if not exists push_subscriptions_active_idx on push_subscriptions(is_active);
create index if not exists push_message_logs_created_at_idx on push_message_logs(created_at desc);
create index if not exists push_message_logs_type_idx on push_message_logs(type);
create index if not exists push_message_logs_status_idx on push_message_logs(status);
create index if not exists push_delivery_logs_member_id_idx on push_delivery_logs(member_id);
create index if not exists push_delivery_logs_created_at_idx on push_delivery_logs(created_at desc);

drop index if exists mm_verification_codes_email_idx;

alter table categories enable row level security;
alter table partners enable row level security;
alter table admin_login_attempts enable row level security;
alter table suggestion_attempts enable row level security;
alter table members enable row level security;
alter table mm_verification_codes enable row level security;
alter table mm_verification_attempts enable row level security;
alter table password_reset_attempts enable row level security;
alter table push_preferences enable row level security;
alter table push_subscriptions enable row level security;
alter table push_message_logs enable row level security;
alter table push_delivery_logs enable row level security;

create policy "Public read categories" on categories
  for select
  using (true);

create policy "Public read partners" on partners
  for select
  using (true);

revoke all on table admin_login_attempts from anon;
revoke all on table admin_login_attempts from authenticated;
revoke all on table suggestion_attempts from anon;
revoke all on table suggestion_attempts from authenticated;
revoke all on table members from anon;
revoke all on table members from authenticated;
revoke all on table mm_verification_codes from anon;
revoke all on table mm_verification_codes from authenticated;
revoke all on table mm_verification_attempts from anon;
revoke all on table mm_verification_attempts from authenticated;
revoke all on table password_reset_attempts from anon;
revoke all on table password_reset_attempts from authenticated;
revoke all on table push_preferences from anon;
revoke all on table push_preferences from authenticated;
revoke all on table push_subscriptions from anon;
revoke all on table push_subscriptions from authenticated;
revoke all on table push_message_logs from anon;
revoke all on table push_message_logs from authenticated;
revoke all on table push_delivery_logs from anon;
revoke all on table push_delivery_logs from authenticated;
