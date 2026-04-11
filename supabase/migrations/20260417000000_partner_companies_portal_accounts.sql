create table if not exists partner_companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  contact_name text,
  contact_email text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table partners
  add column if not exists company_id uuid references partner_companies(id) on delete set null;

comment on column partners.company_id is 'Company grouping for partner portal; one company can own multiple service rows.';

create table if not exists partner_accounts (
  id uuid primary key default uuid_generate_v4(),
  login_id text not null unique,
  display_name text not null,
  password_hash text not null,
  password_salt text not null,
  email text,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists partner_account_companies (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references partner_accounts(id) on delete cascade,
  company_id uuid not null references partner_companies(id) on delete cascade,
  role text not null default 'owner',
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  constraint partner_account_companies_role_check
    check (role in ('owner', 'admin', 'manager', 'viewer')),
  constraint partner_account_companies_account_company_key
    unique (account_id, company_id)
);

create table if not exists partner_auth_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index if not exists partners_company_id_idx on partners(company_id);
create index if not exists partner_companies_name_idx on partner_companies(name);
create index if not exists partner_accounts_login_id_idx on partner_accounts(login_id);
create index if not exists partner_account_companies_account_id_idx on partner_account_companies(account_id);
create index if not exists partner_account_companies_company_id_idx on partner_account_companies(company_id);
create index if not exists partner_auth_attempts_identifier_idx on partner_auth_attempts(identifier);

alter table partner_companies enable row level security;
alter table partner_accounts enable row level security;
alter table partner_account_companies enable row level security;
alter table partner_auth_attempts enable row level security;

revoke all on table partner_companies from anon;
revoke all on table partner_companies from authenticated;
revoke all on table partner_accounts from anon;
revoke all on table partner_accounts from authenticated;
revoke all on table partner_account_companies from anon;
revoke all on table partner_account_companies from authenticated;
revoke all on table partner_auth_attempts from anon;
revoke all on table partner_auth_attempts from authenticated;
