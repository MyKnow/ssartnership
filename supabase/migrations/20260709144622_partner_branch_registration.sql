create table if not exists public.partner_brand_profiles (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.partner_companies(id) on delete cascade,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  category_label text,
  description text,
  inquiry_link text,
  brand_phone text,
  thumbnail_url text,
  image_urls text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_brand_profiles_description_length_check
    check (description is null or char_length(description) <= 1200)
);

alter table public.partners
  add column if not exists brand_profile_id uuid references public.partner_brand_profiles(id) on delete set null,
  add column if not exists branch_scope_type text not null default 'single_location',
  add column if not exists branch_scope_note text;

alter table public.partners
  drop constraint if exists partners_branch_scope_type_check;
alter table public.partners
  add constraint partners_branch_scope_type_check
  check (
    branch_scope_type in (
      'single_location',
      'selected_direct_branches',
      'many_direct_branches',
      'all_direct_branches',
      'selected_franchise_branches',
      'mixed_selected_branches',
      'online'
    )
  );

create table if not exists public.partner_company_branches (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.partner_companies(id) on delete cascade,
  brand_profile_id uuid references public.partner_brand_profiles(id) on delete set null,
  branch_key text not null,
  branch_code text,
  name text not null,
  address text not null,
  branch_type text not null default 'unknown',
  campus_slugs text[] not null default '{}',
  map_url text,
  phone text,
  memo text,
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_company_branches_type_check
    check (branch_type in ('direct', 'franchise', 'unknown')),
  constraint partner_company_branches_campus_slugs_check
    check (
      campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
    )
);

create unique index if not exists partner_company_branches_company_brand_key_idx
  on public.partner_company_branches(company_id, coalesce(brand_profile_id, '00000000-0000-0000-0000-000000000000'::uuid), branch_key);

create table if not exists public.partner_offer_branches (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  branch_id uuid not null references public.partner_company_branches(id) on delete cascade,
  status text not null default 'active',
  source text not null default 'registration',
  memo text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_offer_branches_status_check
    check (status in ('active', 'inactive', 'pending', 'excluded')),
  constraint partner_offer_branches_source_check
    check (source in ('registration', 'admin', 'partner_portal', 'system')),
  constraint partner_offer_branches_partner_branch_key
    unique (partner_id, branch_id)
);

alter table public.partner_registration_requests
  add column if not exists registration_mode text not null default 'full_new',
  add column if not exists branch_scope_type text not null default 'single_location',
  add column if not exists branch_scope_note text;

alter table public.partner_registration_requests
  drop constraint if exists partner_registration_requests_registration_mode_check;
alter table public.partner_registration_requests
  add constraint partner_registration_requests_registration_mode_check
  check (registration_mode in ('full_new', 'add_benefit_group', 'add_branches'));

alter table public.partner_registration_requests
  drop constraint if exists partner_registration_requests_branch_scope_type_check;
alter table public.partner_registration_requests
  add constraint partner_registration_requests_branch_scope_type_check
  check (
    branch_scope_type in (
      'single_location',
      'selected_direct_branches',
      'many_direct_branches',
      'all_direct_branches',
      'selected_franchise_branches',
      'mixed_selected_branches',
      'online'
    )
  );

create table if not exists public.partner_registration_benefit_groups (
  id uuid primary key default uuid_generate_v4(),
  registration_request_id uuid not null references public.partner_registration_requests(id) on delete cascade,
  group_key text not null,
  label text not null,
  benefit_action_type text not null default 'none',
  benefit_action_link text,
  benefits text[] not null default '{}',
  conditions text[] not null default '{}',
  period_start date,
  period_end date,
  tags text[] not null default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_registration_benefit_groups_action_type_check
    check (benefit_action_type in ('certification', 'external_link', 'onsite', 'none')),
  constraint partner_registration_benefit_groups_request_key
    unique (registration_request_id, group_key)
);

create table if not exists public.partner_registration_branches (
  id uuid primary key default uuid_generate_v4(),
  registration_request_id uuid not null references public.partner_registration_requests(id) on delete cascade,
  benefit_group_key text not null default 'default',
  branch_key text not null,
  branch_code text,
  name text not null,
  address text not null,
  branch_type text not null default 'unknown',
  campus_slugs text[] not null default '{}',
  map_url text,
  phone text,
  memo text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_registration_branches_type_check
    check (branch_type in ('direct', 'franchise', 'unknown')),
  constraint partner_registration_branches_campus_slugs_check
    check (
      campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
    ),
  constraint partner_registration_branches_request_branch_key
    unique (registration_request_id, benefit_group_key, branch_key)
);

drop trigger if exists partner_brand_profiles_set_updated_at
  on public.partner_brand_profiles;
create trigger partner_brand_profiles_set_updated_at
  before update on public.partner_brand_profiles
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partner_company_branches_set_updated_at
  on public.partner_company_branches;
create trigger partner_company_branches_set_updated_at
  before update on public.partner_company_branches
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partner_offer_branches_set_updated_at
  on public.partner_offer_branches;
create trigger partner_offer_branches_set_updated_at
  before update on public.partner_offer_branches
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partner_registration_benefit_groups_set_updated_at
  on public.partner_registration_benefit_groups;
create trigger partner_registration_benefit_groups_set_updated_at
  before update on public.partner_registration_benefit_groups
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partner_registration_branches_set_updated_at
  on public.partner_registration_branches;
create trigger partner_registration_branches_set_updated_at
  before update on public.partner_registration_branches
  for each row
  execute function public.set_partnership_updated_at();

create index if not exists partner_brand_profiles_company_idx
  on public.partner_brand_profiles(company_id, created_at desc);
create index if not exists partners_brand_profile_idx
  on public.partners(brand_profile_id)
  where brand_profile_id is not null;
create index if not exists partner_company_branches_company_idx
  on public.partner_company_branches(company_id, is_active, created_at desc);
create index if not exists partner_company_branches_brand_idx
  on public.partner_company_branches(brand_profile_id, is_active, created_at desc)
  where brand_profile_id is not null;
create index if not exists partner_company_branches_campus_slugs_idx
  on public.partner_company_branches using gin(campus_slugs);
create index if not exists partner_offer_branches_partner_idx
  on public.partner_offer_branches(partner_id, status);
create index if not exists partner_offer_branches_branch_idx
  on public.partner_offer_branches(branch_id, status);
create index if not exists partner_registration_benefit_groups_request_idx
  on public.partner_registration_benefit_groups(registration_request_id);
create index if not exists partner_registration_branches_request_idx
  on public.partner_registration_branches(registration_request_id);
create index if not exists partner_registration_branches_campus_slugs_idx
  on public.partner_registration_branches using gin(campus_slugs);

alter table public.partner_brand_profiles enable row level security;
alter table public.partner_company_branches enable row level security;
alter table public.partner_offer_branches enable row level security;
alter table public.partner_registration_benefit_groups enable row level security;
alter table public.partner_registration_branches enable row level security;

revoke all on table public.partner_brand_profiles from anon;
revoke all on table public.partner_brand_profiles from authenticated;
revoke all on table public.partner_company_branches from anon;
revoke all on table public.partner_company_branches from authenticated;
revoke all on table public.partner_offer_branches from anon;
revoke all on table public.partner_offer_branches from authenticated;
revoke all on table public.partner_registration_benefit_groups from anon;
revoke all on table public.partner_registration_benefit_groups from authenticated;
revoke all on table public.partner_registration_branches from anon;
revoke all on table public.partner_registration_branches from authenticated;
