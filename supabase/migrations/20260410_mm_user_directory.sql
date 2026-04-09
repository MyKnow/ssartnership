create table if not exists mm_user_directory (
  id uuid primary key default uuid_generate_v4(),
  mm_user_id text not null unique,
  mm_username text not null unique,
  display_name text not null,
  campus text,
  is_staff boolean not null default false,
  source_years integer[] not null default '{}',
  synced_at timestamp with time zone not null default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists mm_user_directory_source_years_idx
  on mm_user_directory using gin(source_years);

alter table mm_user_directory enable row level security;

revoke all on table mm_user_directory from anon;
revoke all on table mm_user_directory from authenticated;
