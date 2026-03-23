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
  contact text not null,
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

create index if not exists partners_category_id_idx on partners(category_id);
create index if not exists admin_login_attempts_identifier_idx on admin_login_attempts(identifier);
create index if not exists suggestion_attempts_identifier_idx on suggestion_attempts(identifier);

alter table categories enable row level security;
alter table partners enable row level security;
alter table admin_login_attempts enable row level security;
alter table suggestion_attempts enable row level security;

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
