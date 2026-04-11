create table if not exists partner_change_requests (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references partner_companies(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete cascade,
  requested_by_account_id uuid references partner_accounts(id) on delete set null,
  status text not null default 'pending',
  current_conditions text[] not null default '{}',
  current_benefits text[] not null default '{}',
  current_applies_to text[] not null default '{staff,student,graduate}',
  current_tags text[] not null default '{}',
  current_thumbnail text,
  current_images text[] not null default '{}',
  current_reservation_link text,
  current_inquiry_link text,
  current_period_start date,
  current_period_end date,
  requested_conditions text[] not null default '{}',
  requested_benefits text[] not null default '{}',
  requested_applies_to text[] not null default '{staff,student,graduate}',
  requested_tags text[] not null default '{}',
  requested_thumbnail text,
  requested_images text[] not null default '{}',
  requested_reservation_link text,
  requested_inquiry_link text,
  requested_period_start date,
  requested_period_end date,
  reviewed_by_admin_id text,
  reviewed_at timestamp with time zone,
  cancelled_by_account_id uuid references partner_accounts(id) on delete set null,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_change_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

alter table partner_change_requests add column if not exists current_thumbnail text;
alter table partner_change_requests add column if not exists current_images text[] not null default '{}';
alter table partner_change_requests add column if not exists current_reservation_link text;
alter table partner_change_requests add column if not exists current_inquiry_link text;
alter table partner_change_requests add column if not exists current_period_start date;
alter table partner_change_requests add column if not exists current_period_end date;
alter table partner_change_requests add column if not exists current_tags text[] not null default '{}';
alter table partner_change_requests add column if not exists requested_thumbnail text;
alter table partner_change_requests add column if not exists requested_images text[] not null default '{}';
alter table partner_change_requests add column if not exists requested_reservation_link text;
alter table partner_change_requests add column if not exists requested_inquiry_link text;
alter table partner_change_requests add column if not exists requested_period_start date;
alter table partner_change_requests add column if not exists requested_period_end date;
alter table partner_change_requests add column if not exists requested_tags text[] not null default '{}';

create index if not exists partner_change_requests_company_id_idx on partner_change_requests(company_id);
create index if not exists partner_change_requests_partner_id_idx on partner_change_requests(partner_id);
create index if not exists partner_change_requests_status_idx on partner_change_requests(status);
create index if not exists partner_change_requests_created_at_idx on partner_change_requests(created_at desc);
create unique index if not exists partner_change_requests_pending_partner_idx
  on partner_change_requests(partner_id)
  where status = 'pending';

alter table partner_change_requests enable row level security;

revoke all on table partner_change_requests from anon;
revoke all on table partner_change_requests from authenticated;
