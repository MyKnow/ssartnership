create table if not exists member_auth_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index if not exists member_auth_attempts_identifier_idx
  on member_auth_attempts(identifier);

alter table member_auth_attempts enable row level security;

revoke all on table member_auth_attempts from anon;
revoke all on table member_auth_attempts from authenticated;
