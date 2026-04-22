create table if not exists password_reset_codes (
  id uuid primary key default uuid_generate_v4(),
  code_hash text not null,
  expires_at timestamp with time zone not null,
  mm_user_id text not null unique,
  mm_username text not null,
  display_name text,
  year integer not null,
  campus text,
  created_at timestamp with time zone default now()
);

alter table password_reset_codes drop constraint if exists password_reset_codes_year_check;
alter table password_reset_codes
  add constraint password_reset_codes_year_check check (year between 0 and 99);
comment on column password_reset_codes.year is 'SSAFY year; 0 indicates staff';

create index if not exists password_reset_codes_created_at_idx
  on password_reset_codes(created_at desc);

alter table password_reset_codes enable row level security;

revoke all on table password_reset_codes from anon;
revoke all on table password_reset_codes from authenticated;
