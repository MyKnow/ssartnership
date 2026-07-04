create table if not exists public.partner_registration_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.partner_registration_requests (
  id uuid primary key default uuid_generate_v4(),
  status text not null default 'pending',
  service_mode text not null,
  benefit_action_type text not null,
  brand_name text not null,
  category_id uuid references public.categories(id) on delete set null,
  category_label text not null,
  period_start date,
  period_end date,
  inquiry_link text,
  brand_phone text,
  detail_description text,
  company_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  company_description text,
  benefits text[] not null default '{}',
  conditions text[] not null default '{}',
  tags text[] not null default '{}',
  location text not null,
  map_url text,
  site_link text,
  benefit_action_link text,
  memo text,
  reviewed_by_admin_id text,
  reviewed_at timestamp with time zone,
  admin_note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_registration_requests_status_check
    check (status in ('pending', 'in_review', 'converted', 'rejected', 'archived')),
  constraint partner_registration_requests_service_mode_check
    check (service_mode in ('offline', 'online')),
  constraint partner_registration_requests_benefit_action_type_check
    check (benefit_action_type in ('certification', 'external_link', 'onsite', 'none')),
  constraint partner_registration_requests_detail_description_length_check
    check (
      detail_description is null
      or char_length(detail_description) <= 1200
    )
);

create index if not exists partner_registration_attempts_identifier_idx
  on public.partner_registration_attempts(identifier);

create index if not exists partner_registration_requests_status_created_idx
  on public.partner_registration_requests(status, created_at desc);

create index if not exists partner_registration_requests_category_created_idx
  on public.partner_registration_requests(category_id, created_at desc);

drop trigger if exists partner_registration_requests_set_updated_at
  on public.partner_registration_requests;
create trigger partner_registration_requests_set_updated_at
  before update on public.partner_registration_requests
  for each row
  execute function public.set_partnership_updated_at();

alter table public.partner_registration_attempts enable row level security;
alter table public.partner_registration_requests enable row level security;

revoke all on table public.partner_registration_attempts from anon;
revoke all on table public.partner_registration_attempts from authenticated;
revoke all on table public.partner_registration_requests from anon;
revoke all on table public.partner_registration_requests from authenticated;
