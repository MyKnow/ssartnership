create extension if not exists "uuid-ossp";

insert into storage.buckets (id, name, public)
values ('review-media', 'review-media', true)
on conflict (id) do update set public = excluded.public;

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  label text not null,
  description text,
  color text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
);

alter table categories add column if not exists color text;
alter table categories add column if not exists updated_at timestamp with time zone default now();

create table if not exists public_cache_versions (
  scope text primary key,
  version bigint not null default 1,
  updated_at timestamp with time zone not null default now()
);

insert into public_cache_versions (scope, version, updated_at)
values
  ('partners', 1, now()),
  ('categories', 1, now())
on conflict (scope) do nothing;

create table if not exists partner_companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  managed_campus_slugs text[] not null default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists partner_brand_profiles (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references partner_companies(id) on delete cascade,
  name text not null,
  category_id uuid references categories(id) on delete set null,
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

create table if not exists partners (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references partner_companies(id) on delete set null,
  brand_profile_id uuid references partner_brand_profiles(id) on delete set null,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  visibility text not null default 'public',
  benefit_visibility text not null default 'public',
  location text not null,
  detail_description text,
  campus_slugs text[] not null default '{}',
  managed_campus_slugs text[] not null default '{}',
  map_url text,
  benefit_action_type text not null default 'none',
  benefit_action_link text,
  reservation_link text,
  inquiry_link text,
  period_start date,
  period_end date,
  plan_tier text not null default 'basic',
  plan_started_at timestamp with time zone,
  plan_expires_at timestamp with time zone,
  plan_updated_at timestamp with time zone not null default now(),
  conditions text[] not null default '{}',
  benefits text[] not null default '{}',
  applies_to text[] not null default '{staff,student,graduate}',
  thumbnail text,
  images text[] not null default '{}',
  tags text[] not null default '{}',
  branch_scope_type text not null default 'single_location',
  branch_scope_note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
  constraint partners_plan_tier_check
    check (plan_tier in ('basic', 'partner', 'boost'))
);

create or replace function public.infer_partner_campus_slugs(input_location text)
returns text[]
language sql
immutable
as $$
  with location_source as (
    select trim(coalesce(input_location, '')) as value
  ),
  matched_slugs as (
    select array_remove(array[
      case when value ~ '(서울|강남|역삼|역삼역|선릉|테헤란|봉은사|논현)' then 'seoul' end,
      case when value ~ '(구미|경북|경상북도)' then 'gumi' end,
      case when value ~ '(대전|유성|둔산)' then 'daejeon' end,
      case when value ~ '(부산|울산|경남|창원|김해|양산|해운대|서면)' then 'busan-ulsan-gyeongnam' end,
      case when value ~ '(광주|전남)' then 'gwangju' end
    ]::text[], null) as slugs
    from location_source
  )
  select case
    when value ~ '(전국|전\s*지점|전체\s*지점|모든\s*지점|전\s*매장|전체\s*매장|모든\s*매장)'
      then array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
    when cardinality(slugs) > 0
      then slugs
    else array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
  end
  from location_source
  cross join matched_slugs;
$$;

alter table partners add column if not exists visibility text not null default 'public';
alter table partners add column if not exists benefit_visibility text not null default 'public';
alter table partners add column if not exists detail_description text;
alter table partners add column if not exists campus_slugs text[] not null default '{}';
alter table partners add column if not exists managed_campus_slugs text[] not null default '{}';
update partners
set visibility = case lower(trim(coalesce(visibility, 'public')))
  when 'public' then 'public'
  when 'confidential' then 'confidential'
  when 'private' then 'private'
  else 'public'
end;
alter table partners alter column visibility set default 'public';
alter table partners alter column visibility set not null;
alter table partners drop constraint if exists partners_visibility_check;
alter table partners add constraint partners_visibility_check
  check (visibility in ('public', 'confidential', 'private'));
update partners
set benefit_visibility = case lower(trim(coalesce(benefit_visibility, 'public')))
  when 'eligible_only' then 'eligible_only'
  else 'public'
end;
alter table partners alter column benefit_visibility set default 'public';
alter table partners alter column benefit_visibility set not null;
alter table partners drop constraint if exists partners_benefit_visibility_check;
alter table partners add constraint partners_benefit_visibility_check
  check (benefit_visibility in ('public', 'eligible_only'));
alter table partners drop constraint if exists partners_detail_description_length_check;
alter table partners add constraint partners_detail_description_length_check
  check (
    detail_description is null
    or char_length(detail_description) <= 1200
  );
update partners
set campus_slugs = public.infer_partner_campus_slugs(location)
where cardinality(campus_slugs) = 0;
alter table partners drop constraint if exists partners_campus_slugs_check;
alter table partners add constraint partners_campus_slugs_check
  check (
    cardinality(campus_slugs) > 0
    and campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
  );
update partners
set managed_campus_slugs = case
  when cardinality(managed_campus_slugs) > 0 then managed_campus_slugs
  when cardinality(campus_slugs) > 0 then campus_slugs
  else public.infer_partner_campus_slugs(location)
end
where cardinality(managed_campus_slugs) = 0;
alter table partners drop constraint if exists partners_managed_campus_slugs_check;
alter table partners add constraint partners_managed_campus_slugs_check
  check (
    cardinality(managed_campus_slugs) > 0
    and managed_campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
  );

alter table partner_companies add column if not exists managed_campus_slugs text[] not null default '{}';
with company_managed_campuses as (
  select
    company_id,
    array_agg(distinct campus_slug order by campus_slug) as managed_campus_slugs
  from partners
  cross join lateral unnest(
    case
      when cardinality(partners.managed_campus_slugs) > 0
        then partners.managed_campus_slugs
      when cardinality(partners.campus_slugs) > 0
        then partners.campus_slugs
      else public.infer_partner_campus_slugs(partners.location)
    end
  ) as campus_slug
  where company_id is not null
  group by company_id
)
update partner_companies
set managed_campus_slugs = company_managed_campuses.managed_campus_slugs
from company_managed_campuses
where partner_companies.id = company_managed_campuses.company_id
  and cardinality(partner_companies.managed_campus_slugs) = 0;
update partner_companies
set managed_campus_slugs = array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
where cardinality(managed_campus_slugs) = 0;
alter table partner_companies drop constraint if exists partner_companies_managed_campus_slugs_check;
alter table partner_companies add constraint partner_companies_managed_campus_slugs_check
  check (
    cardinality(managed_campus_slugs) > 0
    and managed_campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
  );

alter table partners add column if not exists applies_to text[] not null default '{staff,student,graduate}';
update partners
set applies_to = case
  when coalesce(cardinality(applies_to), 0) = 0 then array['staff', 'student', 'graduate']
  else applies_to
end;
alter table partners alter column applies_to set default '{staff,student,graduate}';
alter table partners alter column applies_to set not null;
alter table partners drop constraint if exists partners_applies_to_check;
alter table partners add constraint partners_applies_to_check
  check (
    cardinality(applies_to) > 0
    and applies_to <@ array['staff', 'student', 'graduate']::text[]
  );
alter table partners add column if not exists company_id uuid references partner_companies(id) on delete set null;
alter table partners add column if not exists thumbnail text;
alter table partners add column if not exists conditions text[] not null default '{}';
alter table partners add column if not exists images text[] not null default '{}';
alter table partners add column if not exists benefit_action_type text not null default 'none';
alter table partners add column if not exists benefit_action_link text;
alter table partners add column if not exists reservation_link text;
alter table partners add column if not exists inquiry_link text;
alter table partners add column if not exists plan_tier text not null default 'basic';
alter table partners add column if not exists plan_started_at timestamp with time zone;
alter table partners add column if not exists plan_expires_at timestamp with time zone;
alter table partners add column if not exists plan_updated_at timestamp with time zone not null default now();
alter table partners add column if not exists brand_profile_id uuid references partner_brand_profiles(id) on delete set null;
alter table partners add column if not exists branch_scope_type text not null default 'single_location';
alter table partners add column if not exists branch_scope_note text;
alter table partners add column if not exists updated_at timestamp with time zone default now();
alter table partners drop column if exists contact;
alter table partners drop constraint if exists partners_plan_tier_check;
alter table partners add constraint partners_plan_tier_check
  check (plan_tier in ('basic', 'partner', 'boost'));
alter table partners drop constraint if exists partners_branch_scope_type_check;
alter table partners add constraint partners_branch_scope_type_check
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

update partners
set
  benefit_action_type = case
    when reservation_link is not null and trim(reservation_link) <> ''
      then 'external_link'
    when benefit_action_type in ('certification', 'external_link', 'onsite', 'none')
      then benefit_action_type
    else 'none'
  end,
  benefit_action_link = case
    when benefit_action_link is not null and trim(benefit_action_link) <> ''
      then benefit_action_link
    when reservation_link is not null and trim(reservation_link) <> ''
      then reservation_link
    else null
  end;

update partners
set benefit_action_link = null
where benefit_action_type <> 'external_link';

alter table partners drop constraint if exists partners_benefit_action_type_check;
alter table partners
  add constraint partners_benefit_action_type_check
  check (benefit_action_type in ('certification', 'external_link', 'onsite', 'none'));

update partners
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update categories
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

create or replace function set_partnership_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_basic_partner_plan_dates()
returns trigger
language plpgsql
as $$
begin
  if new.plan_tier = 'basic' then
    new.plan_started_at = case
      when new.period_start is null then null
      else (new.period_start::text || 'T00:00:00+09:00')::timestamp with time zone
    end;
    new.plan_expires_at = case
      when new.period_end is null then null
      else (new.period_end::text || 'T23:59:59+09:00')::timestamp with time zone
    end;
  end if;

  if TG_OP = 'UPDATE' then
    new.plan_updated_at = now();
  else
    new.plan_updated_at = coalesce(new.plan_updated_at, now());
  end if;
  return new;
end;
$$;

create or replace function bump_public_cache_version(cache_scope text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public_cache_versions (scope, version, updated_at)
  values (cache_scope, 1, now())
  on conflict (scope) do update
    set version = public_cache_versions.version + 1,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function bump_partners_public_cache_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform bump_public_cache_version('partners');
  return coalesce(new, old);
end;
$$;

create or replace function bump_categories_public_cache_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform bump_public_cache_version('categories');
  perform bump_public_cache_version('partners');
  return coalesce(new, old);
end;
$$;

drop trigger if exists partners_set_partnership_updated_at on partners;
create trigger partners_set_partnership_updated_at
  before update on partners
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partners_sync_basic_plan_dates on partners;
create trigger partners_sync_basic_plan_dates
  before insert or update of plan_tier, period_start, period_end, plan_started_at, plan_expires_at on partners
  for each row
  execute function public.sync_basic_partner_plan_dates();

drop trigger if exists categories_set_partnership_updated_at on categories;
create trigger categories_set_partnership_updated_at
  before update on categories
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partners_bump_public_cache_version on partners;
create trigger partners_bump_public_cache_version
  after insert or update or delete on partners
  for each row
  execute function bump_partners_public_cache_version();

drop trigger if exists categories_bump_public_cache_version on categories;
create trigger categories_bump_public_cache_version
  after insert or update or delete on categories
  for each row
  execute function bump_categories_public_cache_version();

create table if not exists partner_accounts (
  id uuid primary key default uuid_generate_v4(),
  login_id text not null unique,
  display_name text not null,
  password_hash text not null,
  password_salt text not null,
  email text,
  email_verified_at timestamp with time zone,
  initial_setup_completed_at timestamp with time zone,
  initial_setup_token_hash text,
  initial_setup_link_sent_at timestamp with time zone,
  initial_setup_expires_at timestamp with time zone,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists partner_accounts_initial_setup_token_hash_key
  on partner_accounts(initial_setup_token_hash);

create table if not exists partner_account_companies (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references partner_accounts(id) on delete cascade,
  company_id uuid not null references partner_companies(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
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

create table if not exists partner_change_requests (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references partner_companies(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete cascade,
  requested_by_account_id uuid references partner_accounts(id) on delete set null,
  status text not null default 'pending',
  current_partner_name text not null default '',
  current_partner_location text not null default '',
  current_detail_description text,
  current_map_url text,
  current_conditions text[] not null default '{}',
  current_benefits text[] not null default '{}',
  current_applies_to text[] not null default '{staff,student,graduate}',
  current_campus_slugs text[] not null default '{}',
  current_tags text[] not null default '{}',
  current_thumbnail text,
  current_images text[] not null default '{}',
  current_reservation_link text,
  current_inquiry_link text,
  current_period_start date,
  current_period_end date,
  requested_partner_name text not null default '',
  requested_partner_location text not null default '',
  requested_detail_description text,
  requested_map_url text,
  requested_conditions text[] not null default '{}',
  requested_benefits text[] not null default '{}',
  requested_applies_to text[] not null default '{staff,student,graduate}',
  requested_campus_slugs text[] not null default '{}',
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

alter table partner_change_requests add column if not exists current_partner_name text not null default '';
alter table partner_change_requests add column if not exists current_partner_location text not null default '';
alter table partner_change_requests add column if not exists current_detail_description text;
alter table partner_change_requests add column if not exists current_map_url text;
alter table partner_change_requests add column if not exists current_campus_slugs text[] not null default '{}';
alter table partner_change_requests add column if not exists current_tags text[] not null default '{}';
alter table partner_change_requests add column if not exists requested_partner_name text not null default '';
alter table partner_change_requests add column if not exists requested_partner_location text not null default '';
alter table partner_change_requests add column if not exists requested_detail_description text;
alter table partner_change_requests add column if not exists requested_map_url text;
alter table partner_change_requests add column if not exists requested_campus_slugs text[] not null default '{}';
alter table partner_change_requests add column if not exists requested_tags text[] not null default '{}';
update partner_change_requests as request
set
  current_campus_slugs = case
    when cardinality(request.current_campus_slugs) > 0
      then request.current_campus_slugs
    when cardinality(partners.campus_slugs) > 0
      then partners.campus_slugs
    else public.infer_partner_campus_slugs(request.current_partner_location)
  end,
  requested_campus_slugs = case
    when cardinality(request.requested_campus_slugs) > 0
      then request.requested_campus_slugs
    when cardinality(partners.campus_slugs) > 0
      then partners.campus_slugs
    else public.infer_partner_campus_slugs(request.requested_partner_location)
  end
from partners
where partners.id = request.partner_id;
update partner_change_requests
set
  current_campus_slugs = public.infer_partner_campus_slugs(current_partner_location),
  requested_campus_slugs = public.infer_partner_campus_slugs(requested_partner_location)
where cardinality(current_campus_slugs) = 0
   or cardinality(requested_campus_slugs) = 0;
alter table partner_change_requests drop constraint if exists partner_change_requests_current_campus_slugs_check;
alter table partner_change_requests add constraint partner_change_requests_current_campus_slugs_check
  check (
    cardinality(current_campus_slugs) > 0
    and current_campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
  );
alter table partner_change_requests drop constraint if exists partner_change_requests_requested_campus_slugs_check;
alter table partner_change_requests add constraint partner_change_requests_requested_campus_slugs_check
  check (
    cardinality(requested_campus_slugs) > 0
    and requested_campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
  );
alter table partner_change_requests drop constraint if exists partner_change_requests_current_detail_description_length_check;
alter table partner_change_requests add constraint partner_change_requests_current_detail_description_length_check
  check (
    current_detail_description is null
    or char_length(current_detail_description) <= 1200
  );
alter table partner_change_requests drop constraint if exists partner_change_requests_requested_detail_description_length_check;
alter table partner_change_requests add constraint partner_change_requests_requested_detail_description_length_check
  check (
    requested_detail_description is null
    or char_length(requested_detail_description) <= 1200
  );

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

create table if not exists partner_registration_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists partner_registration_requests (
  id uuid primary key default uuid_generate_v4(),
  status text not null default 'pending',
  source text not null default 'public_web',
  company_id uuid references partner_companies(id) on delete set null,
  requested_by_partner_account_id uuid references partner_accounts(id) on delete set null,
  registration_mode text not null default 'full_new',
  service_mode text not null,
  benefit_action_type text not null,
  branch_scope_type text not null default 'single_location',
  branch_scope_note text,
  brand_name text not null,
  category_id uuid references categories(id) on delete set null,
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
  thumbnail_url text,
  image_urls text[] not null default '{}',
  memo text,
  reviewed_by_admin_id text,
  reviewed_at timestamp with time zone,
  admin_note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_registration_requests_status_check
    check (status in ('pending', 'in_review', 'converted', 'rejected', 'archived')),
  constraint partner_registration_requests_source_check
    check (source in ('public_web', 'public_excel', 'partner_portal')),
  constraint partner_registration_requests_registration_mode_check
    check (registration_mode in ('full_new', 'add_benefit_group', 'add_branches')),
  constraint partner_registration_requests_service_mode_check
    check (service_mode in ('offline', 'online')),
  constraint partner_registration_requests_branch_scope_type_check
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
    ),
  constraint partner_registration_requests_benefit_action_type_check
    check (benefit_action_type in ('certification', 'external_link', 'onsite', 'none')),
  constraint partner_registration_requests_detail_description_length_check
    check (
      detail_description is null
      or char_length(detail_description) <= 1200
    )
);

drop trigger if exists partner_registration_requests_set_updated_at
  on partner_registration_requests;
create trigger partner_registration_requests_set_updated_at
  before update on partner_registration_requests
  for each row
  execute function set_partnership_updated_at();

alter table partner_registration_requests add column if not exists registration_mode text not null default 'full_new';
alter table partner_registration_requests add column if not exists branch_scope_type text not null default 'single_location';
alter table partner_registration_requests add column if not exists branch_scope_note text;
alter table partner_registration_requests drop constraint if exists partner_registration_requests_registration_mode_check;
alter table partner_registration_requests add constraint partner_registration_requests_registration_mode_check
  check (registration_mode in ('full_new', 'add_benefit_group', 'add_branches'));
alter table partner_registration_requests drop constraint if exists partner_registration_requests_branch_scope_type_check;
alter table partner_registration_requests add constraint partner_registration_requests_branch_scope_type_check
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

create table if not exists partner_registration_benefit_groups (
  id uuid primary key default uuid_generate_v4(),
  registration_request_id uuid not null references partner_registration_requests(id) on delete cascade,
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

create table if not exists partner_registration_branches (
  id uuid primary key default uuid_generate_v4(),
  registration_request_id uuid not null references partner_registration_requests(id) on delete cascade,
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

create table if not exists partner_company_branches (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references partner_companies(id) on delete cascade,
  brand_profile_id uuid references partner_brand_profiles(id) on delete set null,
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

create table if not exists partner_offer_branches (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  branch_id uuid not null references partner_company_branches(id) on delete cascade,
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

drop trigger if exists partner_brand_profiles_set_updated_at
  on partner_brand_profiles;
create trigger partner_brand_profiles_set_updated_at
  before update on partner_brand_profiles
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_registration_benefit_groups_set_updated_at
  on partner_registration_benefit_groups;
create trigger partner_registration_benefit_groups_set_updated_at
  before update on partner_registration_benefit_groups
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_registration_branches_set_updated_at
  on partner_registration_branches;
create trigger partner_registration_branches_set_updated_at
  before update on partner_registration_branches
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_company_branches_set_updated_at
  on partner_company_branches;
create trigger partner_company_branches_set_updated_at
  before update on partner_company_branches
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_offer_branches_set_updated_at
  on partner_offer_branches;
create trigger partner_offer_branches_set_updated_at
  before update on partner_offer_branches
  for each row
  execute function set_partnership_updated_at();

create table if not exists member_auth_attempts (
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
  manual_login_id text,
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
  admin_permission_id text,
  admin_managed_campus_slugs text[] not null default '{}',
  avatar_content_type text,
  avatar_base64 text,
  avatar_url text,
  ssafy_sub text,
  ssafy_verified_at timestamp with time zone,
  ssafy_auth_time timestamp with time zone,
  ssafy_verification_id text,
  ssafy_mattermost_user_id text,
  ssafy_track text,
  ssafy_track_name text,
  ssafy_last_scope text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint members_manual_login_id_check
    check (
      manual_login_id is null
      or (
        manual_login_id = lower(btrim(manual_login_id))
        and manual_login_id ~ '^manual-[a-z0-9._-]{1,57}$'
      )
    )
);

create unique index if not exists members_manual_login_id_key
  on members(manual_login_id)
  where manual_login_id is not null;

create table if not exists partner_reviews (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  rating integer not null,
  title text not null,
  body text not null,
  images text[] not null default '{}',
  deleted_at timestamp with time zone,
  deleted_by_member_id uuid references members(id) on delete set null,
  hidden_at timestamp with time zone,
  hidden_by_admin_id text,
  hidden_by_partner_account_id uuid references partner_accounts(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists partner_review_reactions (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references partner_reviews(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  reaction text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_review_reactions_reaction_check check (reaction in ('recommend', 'disrecommend')),
  constraint partner_review_reactions_review_id_member_id_key unique (review_id, member_id)
);

create table if not exists partner_favorites (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_favorites_partner_id_member_id_key unique (partner_id, member_id)
);

create index if not exists partner_favorites_partner_id_idx
  on partner_favorites(partner_id);
create index if not exists partner_favorites_member_id_created_at_idx
  on partner_favorites(member_id, created_at desc);

create or replace function public.get_admin_review_counts()
returns table (
  total_count bigint,
  visible_count bigint,
  hidden_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    count(*) filter (where deleted_at is null)::bigint as total_count,
    count(*) filter (where deleted_at is null and hidden_at is null)::bigint as visible_count,
    count(*) filter (where deleted_at is null and hidden_at is not null)::bigint as hidden_count
  from public.partner_reviews;
$$;

create or replace function public.get_admin_dashboard_counts()
returns table (
  member_count bigint,
  company_count bigint,
  partner_count bigint,
  category_count bigint,
  account_count bigint,
  review_count bigint,
  active_push_subscription_count bigint,
  product_log_count bigint,
  audit_log_count bigint,
  security_log_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    (select count(*)::bigint from public.members) as member_count,
    (select count(*)::bigint from public.partner_companies) as company_count,
    (select count(*)::bigint from public.partners) as partner_count,
    (select count(*)::bigint from public.categories) as category_count,
    (select count(*)::bigint from public.partner_accounts) as account_count,
    (
      select count(*)::bigint
      from public.partner_reviews
      where deleted_at is null
    ) as review_count,
    (
      select count(*)::bigint
      from public.push_subscriptions
      where is_active = true
    ) as active_push_subscription_count,
    greatest(
      coalesce((select reltuples::bigint from pg_class where oid = 'public.event_logs'::regclass), 0),
      0
    ) as product_log_count,
    greatest(
      coalesce((select reltuples::bigint from pg_class where oid = 'public.admin_audit_logs'::regclass), 0),
      0
    ) as audit_log_count,
    greatest(
      coalesce((select reltuples::bigint from pg_class where oid = 'public.auth_security_logs'::regclass), 0),
      0
    ) as security_log_count;
$$;

create or replace function public.get_admin_logs_page(
  input_start timestamp with time zone,
  input_end timestamp with time zone,
  input_page integer,
  input_page_size integer,
  input_group text default 'all',
  input_search text default '',
  input_name text default 'all',
  input_actor text default 'all',
  input_status text default 'all'
)
returns table (
  group_name text,
  id uuid,
  name text,
  status text,
  actor_type text,
  actor_id text,
  actor_name text,
  actor_mm_username text,
  identifier text,
  ip_address text,
  path text,
  referrer text,
  target_type text,
  target_id text,
  properties jsonb,
  created_at timestamp with time zone,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with params as (
    select
      greatest(coalesce(input_page, 1), 1) as page,
      greatest(coalesce(input_page_size, 100), 1) as page_size,
      lower(coalesce(nullif(input_search, ''), '')) as search_query,
      coalesce(nullif(input_group, ''), 'all') as group_filter,
      coalesce(nullif(input_name, ''), 'all') as name_filter,
      coalesce(nullif(input_actor, ''), 'all') as actor_filter,
      coalesce(nullif(input_status, ''), 'all') as status_filter
  ),
  base_logs as (
    select
      'product'::text as group_name,
      event_logs.id,
      event_logs.event_name::text as name,
      null::text as status,
      event_logs.actor_type::text as actor_type,
      event_logs.actor_id,
      members.display_name as actor_name,
      members.mm_username as actor_mm_username,
      null::text as identifier,
      event_logs.ip_address,
      event_logs.path,
      event_logs.referrer,
      event_logs.target_type,
      event_logs.target_id,
      event_logs.properties,
      event_logs.created_at,
      lower(
        concat_ws(
          ' ',
          event_logs.event_name,
          members.display_name,
          members.mm_username,
          event_logs.actor_type,
          event_logs.actor_id,
          event_logs.ip_address,
          event_logs.path,
          event_logs.referrer,
          event_logs.target_type,
          event_logs.target_id,
          event_logs.properties::text
        )
      ) as search_text
    from public.event_logs
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    where event_logs.created_at >= input_start
      and event_logs.created_at <= input_end

    union all

    select
      'audit'::text as group_name,
      admin_audit_logs.id,
      admin_audit_logs.action::text as name,
      null::text as status,
      'admin'::text as actor_type,
      admin_audit_logs.actor_id,
      null::text as actor_name,
      null::text as actor_mm_username,
      null::text as identifier,
      admin_audit_logs.ip_address,
      admin_audit_logs.path,
      null::text as referrer,
      admin_audit_logs.target_type,
      admin_audit_logs.target_id,
      admin_audit_logs.properties,
      admin_audit_logs.created_at,
      lower(
        concat_ws(
          ' ',
          admin_audit_logs.action,
          admin_audit_logs.actor_id,
          admin_audit_logs.ip_address,
          admin_audit_logs.path,
          admin_audit_logs.target_type,
          admin_audit_logs.target_id,
          admin_audit_logs.properties::text
        )
      ) as search_text
    from public.admin_audit_logs
    where admin_audit_logs.created_at >= input_start
      and admin_audit_logs.created_at <= input_end

    union all

    select
      'security'::text as group_name,
      auth_security_logs.id,
      auth_security_logs.event_name::text as name,
      auth_security_logs.status::text as status,
      auth_security_logs.actor_type::text as actor_type,
      auth_security_logs.actor_id,
      members.display_name as actor_name,
      members.mm_username as actor_mm_username,
      auth_security_logs.identifier,
      auth_security_logs.ip_address,
      auth_security_logs.path,
      null::text as referrer,
      null::text as target_type,
      null::text as target_id,
      auth_security_logs.properties,
      auth_security_logs.created_at,
      lower(
        concat_ws(
          ' ',
          auth_security_logs.event_name,
          auth_security_logs.status,
          members.display_name,
          members.mm_username,
          auth_security_logs.actor_type,
          auth_security_logs.actor_id,
          auth_security_logs.identifier,
          auth_security_logs.ip_address,
          auth_security_logs.path,
          auth_security_logs.properties::text
        )
      ) as search_text
    from public.auth_security_logs
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    where auth_security_logs.created_at >= input_start
      and auth_security_logs.created_at <= input_end
  ),
  filtered_logs as (
    select base_logs.*
    from base_logs
    cross join params
    where (params.group_filter = 'all' or base_logs.group_name = params.group_filter)
      and (params.name_filter = 'all' or base_logs.name = params.name_filter)
      and (params.actor_filter = 'all' or coalesce(base_logs.actor_type, '') = params.actor_filter)
      and (params.status_filter = 'all' or coalesce(base_logs.status, '') = params.status_filter)
      and (
        params.search_query = ''
        or base_logs.search_text like '%' || params.search_query || '%'
      )
  ),
  counted_logs as (
    select
      filtered_logs.*,
      count(*) over () as total_count
    from filtered_logs
  ),
  paged_logs as (
    select
      counted_logs.*,
      row_number() over (order by counted_logs.created_at desc, counted_logs.id desc) as row_num
    from counted_logs
  )
  select
    paged_logs.group_name,
    paged_logs.id,
    paged_logs.name,
    paged_logs.status,
    paged_logs.actor_type,
    paged_logs.actor_id,
    paged_logs.actor_name,
    paged_logs.actor_mm_username,
    paged_logs.identifier,
    paged_logs.ip_address,
    paged_logs.path,
    paged_logs.referrer,
    paged_logs.target_type,
    paged_logs.target_id,
    paged_logs.properties,
    paged_logs.created_at,
    paged_logs.total_count
  from paged_logs
  cross join params
  where paged_logs.row_num > ((params.page - 1) * params.page_size)
    and paged_logs.row_num <= (params.page * params.page_size)
  order by paged_logs.created_at desc, paged_logs.id desc;
$$;

create or replace function public.get_partner_review_visibility_counts(input_partner_id uuid)
returns table (
  total_count bigint,
  visible_count bigint,
  hidden_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    count(*) filter (where deleted_at is null)::bigint as total_count,
    count(*) filter (where deleted_at is null and hidden_at is null)::bigint as visible_count,
    count(*) filter (where deleted_at is null and hidden_at is not null)::bigint as hidden_count
  from public.partner_reviews
  where partner_id = input_partner_id;
$$;

create or replace function public.get_member_visible_review_count_in_range(
  input_member_id uuid,
  input_start timestamp with time zone,
  input_end timestamp with time zone
)
returns bigint
language sql
stable
set search_path = public
as $$
  select count(*)::bigint
  from public.partner_reviews
  where member_id = input_member_id
    and deleted_at is null
    and hidden_at is null
    and created_at >= input_start
    and created_at <= input_end;
$$;

alter table partner_reviews
  drop constraint if exists partner_reviews_rating_check;
alter table partner_reviews
  add constraint partner_reviews_rating_check
  check (rating between 1 and 5);

alter table members drop column if exists email;
alter table members drop column if exists region;
alter table members add column if not exists year integer;
update members set year = 15 where year is null;
alter table members alter column year set not null;
alter table members alter column year drop default;
alter table members drop constraint if exists members_year_check;
alter table members add constraint members_year_check check (year between 0 and 99);
comment on column members.year is 'SSAFY year; 0 indicates staff';
comment on column members.staff_source_year is 'Original staff lookup year when members.year is 0';
comment on column members.ssafy_sub is 'SSAFY Verify pairwise subject for this partner service.';
comment on column members.ssafy_verified_at is 'Timestamp when SSAFY Verify last confirmed this member.';
comment on column members.ssafy_auth_time is 'verification_token auth_time converted from JWT NumericDate seconds.';
comment on column members.ssafy_verification_id is 'Last SSAFY Verify transaction identifier from /verify/token result.';
comment on column members.ssafy_mattermost_user_id is 'Mattermost raw user.id returned by ssafy.mattermost_id for legacy account mapping.';
comment on column members.ssafy_track is 'Canonical track slug returned by SSAFY Verify ssafy.track scope. Nullable when no track rule matches or scope is unavailable.';
comment on column members.ssafy_track_name is 'Display track name returned by SSAFY Verify ssafy.track scope. Nullable and not used as a stable key.';
comment on column members.ssafy_last_scope is 'Last approved SSAFY Verify scope string used during member verification.';

create table if not exists ssafy_cycle_settings (
  id integer primary key default 1,
  anchor_year integer not null default 14,
  anchor_calendar_year integer not null default 2025,
  anchor_month integer not null default 7,
  manual_current_year integer,
  manual_reason text,
  manual_applied_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint ssafy_cycle_settings_singleton_check check (id = 1)
);

alter table ssafy_cycle_settings add column if not exists anchor_year integer not null default 14;
alter table ssafy_cycle_settings add column if not exists anchor_calendar_year integer not null default 2025;
alter table ssafy_cycle_settings add column if not exists anchor_month integer not null default 7;
alter table ssafy_cycle_settings add column if not exists manual_current_year integer;
alter table ssafy_cycle_settings add column if not exists manual_reason text;
alter table ssafy_cycle_settings add column if not exists manual_applied_at timestamp with time zone;
alter table ssafy_cycle_settings add column if not exists created_at timestamp with time zone default now();
alter table ssafy_cycle_settings add column if not exists updated_at timestamp with time zone default now();
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_singleton_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_singleton_check check (id = 1);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_anchor_year_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_anchor_year_check check (anchor_year between 1 and 99);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_anchor_calendar_year_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_anchor_calendar_year_check check (anchor_calendar_year between 2000 and 3000);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_anchor_month_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_anchor_month_check check (anchor_month between 1 and 12);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_manual_current_year_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_manual_current_year_check
  check (manual_current_year is null or manual_current_year between 0 and 99);

insert into ssafy_cycle_settings (
  id,
  anchor_year,
  anchor_calendar_year,
  anchor_month
)
values (1, 14, 2025, 7)
on conflict (id) do update set
  anchor_year = excluded.anchor_year,
  anchor_calendar_year = excluded.anchor_calendar_year,
  anchor_month = excluded.anchor_month,
  updated_at = now();

create table if not exists public.ssafy_cohort_card_themes (
  cohort_year integer primary key,
  display_name text,
  background_from text not null,
  background_via text not null,
  background_to text not null,
  accent_color text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint ssafy_cohort_card_themes_year_check check (cohort_year between 1 and 99),
  constraint ssafy_cohort_card_themes_display_name_check check (
    display_name is null or char_length(btrim(display_name)) between 1 and 40
  ),
  constraint ssafy_cohort_card_themes_background_from_check check (background_from ~ '^#[0-9a-f]{6}$'),
  constraint ssafy_cohort_card_themes_background_via_check check (background_via ~ '^#[0-9a-f]{6}$'),
  constraint ssafy_cohort_card_themes_background_to_check check (background_to ~ '^#[0-9a-f]{6}$'),
  constraint ssafy_cohort_card_themes_accent_color_check check (accent_color ~ '^#[0-9a-f]{6}$')
);

comment on table public.ssafy_cohort_card_themes is 'Admin-managed SSAFY cohort certification card palette values.';
comment on column public.ssafy_cohort_card_themes.cohort_year is 'SSAFY cohort number such as 16.';
comment on column public.ssafy_cohort_card_themes.display_name is 'Optional admin display label for the card theme.';
comment on column public.ssafy_cohort_card_themes.background_from is 'Certification card gradient start color in normalized #rrggbb format.';
comment on column public.ssafy_cohort_card_themes.background_via is 'Certification card gradient middle color in normalized #rrggbb format.';
comment on column public.ssafy_cohort_card_themes.background_to is 'Certification card gradient end color in normalized #rrggbb format.';
comment on column public.ssafy_cohort_card_themes.accent_color is 'Certification card accent color in normalized #rrggbb format.';

alter table public.ssafy_cohort_card_themes enable row level security;

revoke all on table public.ssafy_cohort_card_themes from anon;
revoke all on table public.ssafy_cohort_card_themes from authenticated;

insert into public.ssafy_cohort_card_themes (
  cohort_year,
  display_name,
  background_from,
  background_via,
  background_to,
  accent_color
)
values
  (14, '14기', '#07120d', '#0a1a15', '#111827', '#34d399'),
  (15, '15기', '#110c1f', '#1a1430', '#111827', '#a78bfa'),
  (16, '16기', '#062a3a', '#0f3b66', '#111827', '#38bdf8')
on conflict (cohort_year) do nothing;

create table if not exists policy_documents (
  id uuid primary key default uuid_generate_v4(),
  kind text not null,
  version integer not null,
  title text not null,
  summary text,
  content text not null,
  is_active boolean not null default false,
  effective_at timestamp with time zone not null default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table policy_documents drop constraint if exists policy_documents_kind_check;
alter table policy_documents add constraint policy_documents_kind_check
  check (kind in ('service', 'privacy', 'marketing'));
alter table policy_documents drop constraint if exists policy_documents_version_check;
alter table policy_documents add constraint policy_documents_version_check
  check (version > 0);
alter table policy_documents drop constraint if exists policy_documents_kind_version_key;
alter table policy_documents add constraint policy_documents_kind_version_key
  unique (kind, version);
create unique index if not exists policy_documents_active_kind_idx
  on policy_documents(kind)
  where is_active = true;

create table if not exists member_policy_consents (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references members(id) on delete cascade,
  policy_document_id uuid not null references policy_documents(id) on delete cascade,
  kind text not null,
  version integer not null,
  agreed_at timestamp with time zone not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamp with time zone default now()
);

alter table member_policy_consents
  drop constraint if exists member_policy_consents_kind_check;
alter table member_policy_consents
  add constraint member_policy_consents_kind_check
  check (kind in ('service', 'privacy', 'marketing'));
alter table member_policy_consents
  drop constraint if exists member_policy_consents_version_check;
alter table member_policy_consents
  add constraint member_policy_consents_version_check
  check (version > 0);
alter table member_policy_consents
  drop constraint if exists member_policy_consents_member_policy_key;
alter table member_policy_consents
  add constraint member_policy_consents_member_policy_key
  unique (member_id, policy_document_id);

insert into policy_documents (
  kind,
  version,
  title,
  summary,
  content,
  is_active,
  effective_at
)
values
  (
    'service',
    1,
    '서비스 이용약관',
    '싸트너십 회원가입, 로그인, 제휴 정보 이용에 필요한 기본 약관입니다.',
    $$## 제1조 목적
본 약관은 싸트너십(SSARTNERSHIP) 서비스의 이용 조건, 회원의 권리와 의무, 운영 기준을 정하는 것을 목적으로 합니다.

## 제2조 서비스 대상
서비스는 삼성 청년 SW·AI 아카데미(SSAFY) 교육생 및 운영진을 대상으로 제공합니다.

## 제3조 제공 기능
- 제휴 업체와 혜택 정보 조회
- 회원 인증 및 로그인
- 교육생/운영진 인증 카드 제공
- 제휴 관련 공지 및 알림 제공

## 제4조 회원가입과 계정 관리
- 회원가입 시 사실과 다른 정보를 제공해서는 안 됩니다.
- 회원은 본인 계정을 직접 관리해야 하며, 계정 공유나 타인 사칭을 해서는 안 됩니다.
- 비밀번호 유출 또는 계정 오남용이 의심되는 경우 즉시 운영자에게 알려야 합니다.

## 제5조 금지행위
- 타인의 정보를 도용하거나 허위 정보를 입력하는 행위
- 서비스, 제휴처, 다른 회원에게 피해를 주는 행위
- 비정상적인 방식으로 인증, 로그인, 제휴 정보 접근을 시도하는 행위
- 서비스 운영을 방해하거나 취약점을 악용하는 행위

## 제6조 서비스 변경 및 중단
운영자는 서비스 개선, 점검, 정책 변경, 제휴 종료 등의 사유로 서비스 일부 또는 전부를 변경하거나 중단할 수 있습니다.

## 제7조 외부 링크
서비스에는 제휴 업체의 외부 사이트 또는 랜딩 페이지 링크가 포함될 수 있으며, 해당 외부 서비스의 운영과 정책은 각 제공 주체가 따릅니다.

## 제8조 회원 자격의 제한
운영자는 약관 위반, 부정 이용, 보안 위협, 서비스 목적에 맞지 않는 사용이 확인될 경우 회원 자격을 제한하거나 이용을 중지할 수 있습니다.

## 제9조 책임 제한
운영자는 무료로 제공되는 서비스 범위 안에서 안정적인 운영을 위해 노력하지만, 천재지변, 외부 서비스 장애, 이용자 귀책 사유로 인한 손해에 대해서는 법령이 허용하는 범위에서 책임이 제한될 수 있습니다.

## 제10조 문의처
서비스 운영 및 약관 관련 문의는 아래 연락처로 접수합니다.
- 책임자: 정민호
- 이메일: myknow00@naver.com$$,
    true,
    now()
  ),
  (
    'privacy',
    1,
    '개인정보 수집·이용 및 처리방침',
    '회원 인증, 계정 운영, 보안 대응에 필요한 개인정보 처리 기준을 안내합니다.',
    $$## 1. 수집 목적
싸트너십은 회원 식별, 본인 확인, 로그인, 비밀번호 재설정, 인증 카드 제공, 제휴 정보 제공, 보안 대응과 서비스 운영을 위해 개인정보를 처리합니다.

## 2. 수집 항목
- 필수: Mattermost user_id, Mattermost username, 이름, 기수 또는 운영진 여부, 캠퍼스, 프로필 사진
- 서비스 운영 과정에서 생성되는 정보: 비밀번호 해시, 세션 정보, 인증코드 발급 및 인증 이력, 보안 로그, 접속 기록, 푸시 설정 및 구독 정보

## 3. 보유 및 이용 기간
- 회원 정보: 회원 탈퇴 시까지
- 다만 관계 법령 또는 분쟁 대응, 보안 대응이 필요한 경우에는 관련 법령이 허용하는 최소한의 기간 동안 보관할 수 있습니다.

## 4. 개인정보 제3자 제공
싸트너십은 원칙적으로 이용자의 개인정보를 외부 제휴 업체를 포함한 제3자에게 제공하지 않습니다. 법령상 의무가 있거나 이용자가 별도로 동의한 경우에만 예외적으로 제공할 수 있습니다.

## 5. 처리 위탁
서비스는 운영을 위해 Supabase, Vercel 등 클라우드 인프라를 사용할 수 있으며, 해당 범위 안에서 필요한 개인정보가 처리될 수 있습니다.

## 6. 이용자의 권리
이용자는 언제든지 개인정보 처리 관련 문의, 정정, 삭제, 탈퇴를 요청할 수 있습니다.

## 7. 안전성 확보 조치
싸트너십은 비밀번호 해시 저장, 접근 통제, 인증 로그 기록 등 합리적인 보호 조치를 적용합니다.

## 8. 문의처
개인정보 처리 관련 문의는 아래 연락처로 접수합니다.
- 책임자: 정민호
- 이메일: myknow00@naver.com$$,
    true,
    now()
  )
  ,
  (
    'marketing',
    1,
    '마케팅 정보 수신 동의',
    '제휴 소식, 혜택 안내, 이벤트 등 알림 수신 동의입니다.',
    $$## 1. 목적
싸트너십은 제휴 혜택, 신규 제휴, 종료 임박, 운영 공지와 같은 서비스 관련 정보와 함께, 이용자가 동의한 경우 마케팅성 안내를 전송할 수 있습니다.

## 2. 수신 범위
- 제휴 소식
- 혜택 안내
- 이벤트 및 캠페인 안내
- 기타 서비스 관련 소식

## 3. 동의 및 철회
이 동의는 선택 사항이며, 회원은 언제든지 알림 설정에서 동의를 변경할 수 있습니다.

## 4. 문의
마케팅 정보 수신 관련 문의는 아래 연락처로 접수합니다.
- 책임자: 정민호
- 이메일: myknow00@naver.com$$,
    true,
    now()
  )
on conflict (kind, version) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  is_active = excluded.is_active,
  effective_at = excluded.effective_at,
  updated_at = now();

update policy_documents
set is_active = false,
    updated_at = now()
where kind in ('service', 'privacy')
  and is_active = true;

insert into policy_documents (
  kind,
  version,
  title,
  summary,
  content,
  is_active,
  effective_at
)
values
  (
    'service',
    2,
    '서비스 이용약관',
    '싸트너십 서비스 이용, 회원 계정, 리뷰, 알림, 제휴 정보 이용 기준을 안내합니다.',
    $$## 제1조 목적
본 약관은 싸트너십(SSARTNERSHIP)의 이용 조건, 회원과 운영자의 권리·의무, 서비스 운영 기준을 정합니다.

## 제2조 서비스의 성격
싸트너십은 SSAFY 구성원이 제휴 혜택을 탐색하고 비교한 뒤 문의, 예약, 리뷰 작성 등 후속 행동을 할 수 있도록 돕는 혜택 정보 플랫폼입니다. 서비스는 무료로 제공되며, 제휴 내용은 운영 상황에 따라 변경될 수 있습니다.

## 제3조 이용 대상
서비스는 SSAFY 교육생, 수료생, 운영진 및 운영자가 승인한 협력사 계정을 대상으로 합니다. 운영자는 인증 상태, 소속 정보, 서비스 목적에 따라 일부 기능 이용 범위를 달리할 수 있습니다.

## 제4조 주요 기능
- 제휴 업체, 브랜드, 혜택, 위치, 적용 대상 정보 조회
- 회원가입, 로그인, 비밀번호 변경 및 계정 관리
- 알림 수신함, 푸시 알림, Mattermost 알림 등 알림 기능
- 리뷰 작성, 수정, 삭제 및 사진 업로드
- 협력사 계정의 브랜드 정보 관리, 변경 요청, 리뷰 확인
- 운영자 관리, 통계, 공지 및 알림 발송

## 제5조 회원 계정 관리
회원은 본인의 실제 정보를 바탕으로 가입해야 하며, 계정을 타인과 공유하거나 타인을 사칭해서는 안 됩니다. 비밀번호, 인증 코드, 세션 등 계정 접근 수단을 안전하게 관리해야 하며, 유출이나 오남용이 의심되면 즉시 운영자에게 알려야 합니다.

## 제6조 리뷰와 게시 콘텐츠
회원은 실제 이용 경험에 기반해 리뷰를 작성해야 합니다. 허위 사실, 욕설, 비방, 개인정보 노출, 광고성 내용, 제휴처 또는 다른 이용자에게 피해를 줄 수 있는 내용은 제한될 수 있습니다. 운영자는 서비스 안정성, 법적 위험, 커뮤니티 보호를 위해 리뷰를 비공개 처리하거나 삭제할 수 있습니다.

## 제7조 알림
서비스는 운영 공지, 새 제휴, 종료 임박, 리뷰 관련 안내 등 서비스 이용에 필요한 알림을 제공할 수 있습니다. 회원은 알림 설정에서 수신 채널과 받을 항목을 조정할 수 있습니다. 단, 계정 보안이나 필수 운영 안내는 서비스 제공을 위해 별도로 안내될 수 있습니다.

## 제8조 금지행위
- 허위 정보 입력, 타인 정보 도용, 계정 공유 또는 사칭
- 비정상적인 방식의 인증, 로그인, 데이터 접근 시도
- 서비스, 제휴처, 다른 회원에게 피해를 주는 행위
- 악성 코드, 자동화 도구, 과도한 요청 등 서비스 운영 방해 행위
- 운영자가 제공하지 않은 방식으로 데이터를 수집하거나 재배포하는 행위
- 법령, 본 약관, 서비스 목적에 반하는 행위

## 제9조 서비스 변경 및 중단
운영자는 기능 개선, 보안 점검, 제휴 변경, 인프라 장애, 정책 변경 등의 사유로 서비스 일부 또는 전부를 변경하거나 중단할 수 있습니다. 가능한 경우 사전에 안내하되, 긴급한 보안·장애 대응은 사후 안내할 수 있습니다.

## 제10조 외부 서비스와 제휴처
서비스에는 제휴처의 외부 링크, 지도, 예약, 문의 수단이 포함될 수 있습니다. 외부 서비스에서 발생하는 거래, 예약, 결제, 상담, 분쟁은 해당 제공 주체의 정책을 따르며, 싸트너십은 정보 연결을 보조합니다.

## 제11조 이용 제한
운영자는 약관 위반, 부정 이용, 보안 위협, 서비스 목적에 맞지 않는 사용이 확인될 경우 계정 이용을 제한하거나 필요한 조치를 취할 수 있습니다.

## 제12조 책임 제한
운영자는 정확하고 안정적인 서비스 제공을 위해 노력하지만, 무료 서비스의 특성상 제휴 정보의 변경, 외부 서비스 장애, 이용자 귀책 사유, 불가항력으로 발생한 손해에 대해서는 법령이 허용하는 범위에서 책임이 제한될 수 있습니다.

## 제13조 문의처
서비스 운영 및 약관 관련 문의는 아래 연락처로 접수합니다.
- 책임자: 정민호
- 이메일: myknow00@naver.com$$,
    true,
    now()
  ),
  (
    'privacy',
    2,
    '개인정보 수집·이용 및 처리방침',
    '회원 인증, 알림, 리뷰, 협력사 관리, 보안 대응을 위한 개인정보 처리 기준을 안내합니다.',
    $$## 1. 처리 목적
싸트너십은 회원 식별, 본인 확인, 계정 운영, 제휴 정보 제공, 리뷰 기능, 알림 발송, 보안 대응, 서비스 개선 및 운영 문의 처리를 위해 개인정보를 처리합니다.

## 2. 수집 항목
- 회원 인증 정보: Mattermost user_id, Mattermost username, 이름, 기수 또는 운영진 여부, 캠퍼스, 프로필 사진
- 계정 정보: 로그인 식별자, 비밀번호 해시, 세션 정보, 비밀번호 변경 이력
- 서비스 이용 정보: 제휴 조회, 클릭, 리뷰 작성·수정·삭제, 알림 읽음·삭제 상태, 설정 변경 이력
- 알림 정보: 푸시 구독 endpoint, 브라우저/기기 정보, 알림 선호 설정, Mattermost 알림 설정
- 리뷰 사진: 회원이 직접 업로드한 리뷰 이미지
- 보안 및 운영 로그: 접속 기록, 인증 코드 발급·검증 이력, IP, user-agent, 오류 및 감사 로그
- 협력사 계정 정보: 협력사 로그인 이메일, 담당 계정, 관리 브랜드, 변경 요청 및 처리 이력

## 3. 보유 및 이용 기간
- 회원 정보: 회원 탈퇴 또는 계정 삭제 요청 시까지
- 리뷰 및 리뷰 사진: 회원이 삭제 요청하거나 운영상 보존 필요성이 종료될 때까지. soft delete된 리뷰의 사진은 감사와 복구 가능성을 위해 보존될 수 있습니다.
- 알림 수신함: 사용자가 삭제하거나 운영상 보관 필요성이 종료될 때까지
- 보안·감사 로그: 분쟁 대응, 부정 이용 방지, 보안 대응에 필요한 기간 동안 보관
- 법령상 보관 의무가 있는 경우 해당 기간 동안 보관

## 4. 개인정보 제3자 제공
싸트너십은 원칙적으로 개인정보를 외부 제휴 업체에 제공하지 않습니다. 다만 법령상 의무가 있거나 이용자가 별도로 동의한 경우에는 필요한 범위에서 제공할 수 있습니다.

## 5. 처리 위탁 및 외부 인프라
서비스 운영을 위해 Supabase, Vercel, Mattermost, 이미지 저장소 등 외부 인프라와 도구를 사용할 수 있습니다. 이 경우 서비스 제공에 필요한 범위에서 개인정보가 저장·처리될 수 있습니다.

## 6. 이용자의 권리
이용자는 개인정보 열람, 정정, 삭제, 처리 정지, 탈퇴를 요청할 수 있습니다. 요청은 서비스 내 기능 또는 문의처를 통해 접수할 수 있으며, 운영자는 본인 확인 후 필요한 조치를 진행합니다.

## 7. 안전성 확보 조치
싸트너십은 비밀번호 해시 저장, 접근 권한 제한, 인증 로그 기록, 서버 측 권한 검증, 보안 이벤트 기록 등 합리적인 보호 조치를 적용합니다.

## 8. 문의처
개인정보 처리 관련 문의는 아래 연락처로 접수합니다.
- 책임자: 정민호
- 이메일: myknow00@naver.com$$,
    true,
    now()
  )
on conflict (kind, version) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  is_active = excluded.is_active,
  effective_at = excluded.effective_at,
  updated_at = now();

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

alter table mm_user_directory add column if not exists campus text;
alter table mm_user_directory add column if not exists is_staff boolean not null default false;
alter table mm_user_directory add column if not exists source_years integer[] not null default '{}';
alter table mm_user_directory add column if not exists synced_at timestamp with time zone not null default now();
update mm_user_directory set synced_at = coalesce(synced_at, now());
alter table mm_user_directory alter column synced_at set not null;
alter table mm_user_directory alter column synced_at set default now();
create index if not exists mm_user_directory_source_years_idx on mm_user_directory using gin(source_years);

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
  review_enabled boolean not null default true,
  mm_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  title text not null,
  body text not null,
  target_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_member_id uuid references members(id) on delete set null,
  created_at timestamp with time zone default now()
);

create table if not exists member_notifications (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references notifications(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  read_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (notification_id, member_id)
);

create table if not exists notification_deliveries (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references notifications(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  channel text not null,
  status text not null,
  error_message text,
  provider text,
  provider_notification_id text,
  provider_campaign_id text,
  provider_idempotency_key text,
  provider_status text,
  delivered_at timestamp with time zone,
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
  target_year integer,
  target_campus text,
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

alter table push_message_logs add column if not exists target_year integer;

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

create table if not exists event_logs (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid,
  schema_version integer,
  occurred_at timestamp with time zone,
  recorded_at timestamp with time zone,
  request_id text,
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
  created_at timestamp with time zone default now(),
  constraint event_logs_schema_version_check
    check (schema_version is null or schema_version >= 1)
);

create table if not exists partner_metric_rollups (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  metric_name text not null,
  metric_kind text not null default 'pv',
  granularity text not null,
  bucket_timezone text not null default 'Asia/Seoul',
  bucket_local_start timestamp without time zone,
  bucket_local_date date,
  bucket_local_dow smallint,
  metric_count integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_metric_rollups_metric_kind_check
    check (metric_kind in ('pv', 'uv')),
  constraint partner_metric_rollups_granularity_check
    check (granularity in ('total', 'hour', 'day', 'weekday')),
  constraint partner_metric_rollups_bucket_shape_check
    check (
      (
        granularity = 'total'
        and bucket_local_start is null
        and bucket_local_date is null
        and bucket_local_dow is null
      )
      or (
        granularity = 'hour'
        and bucket_local_start is not null
        and bucket_local_date is null
        and bucket_local_dow is null
      )
      or (
        granularity = 'day'
        and bucket_local_start is null
        and bucket_local_date is not null
        and bucket_local_dow is null
      )
      or (
        granularity = 'weekday'
        and bucket_local_start is null
        and bucket_local_date is null
        and bucket_local_dow is not null
      )
    ),
  constraint partner_metric_rollups_weekday_check
    check (bucket_local_dow is null or bucket_local_dow between 1 and 7)
);

comment on table partner_metric_rollups is
  'Derived brand metric rollups. Raw event_logs remain the source of truth.';

comment on column partner_metric_rollups.bucket_timezone is
  'Local aggregation timezone used for bucket columns. Stored in Asia/Seoul for now.';

create or replace function is_partner_metric_event(event_name text)
returns boolean
language sql
immutable
as $$
  select event_name = any (
    array[
      'partner_detail_view',
      'partner_card_click',
      'partner_map_click',
      'reservation_click',
      'inquiry_click'
    ]
  )
$$;

create table if not exists partner_metric_unique_visitors (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  metric_name text not null,
  granularity text not null,
  bucket_timezone text not null default 'Asia/Seoul',
  bucket_local_start timestamp without time zone,
  bucket_local_date date,
  bucket_local_dow smallint,
  visitor_key text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_metric_unique_visitors_granularity_check
    check (granularity in ('total', 'hour', 'day', 'weekday')),
  constraint partner_metric_unique_visitors_bucket_shape_check
    check (
      (
        granularity = 'total'
        and bucket_local_start is null
        and bucket_local_date is null
        and bucket_local_dow is null
      )
      or (
        granularity = 'hour'
        and bucket_local_start is not null
        and bucket_local_date is null
        and bucket_local_dow is null
      )
      or (
        granularity = 'day'
        and bucket_local_start is null
        and bucket_local_date is not null
        and bucket_local_dow is null
      )
      or (
        granularity = 'weekday'
        and bucket_local_start is null
        and bucket_local_date is null
        and bucket_local_dow is not null
      )
    ),
  constraint partner_metric_unique_visitors_weekday_check
    check (bucket_local_dow is null or bucket_local_dow between 1 and 7)
);

comment on table partner_metric_unique_visitors is
  'Unique visitor buckets for partner detail UV rollups. Raw event_logs remain the source of truth.';

create or replace function public.get_partner_favorite_counts(input_partner_ids uuid[])
returns table (
  partner_id uuid,
  favorite_count bigint
)
language sql
stable
set search_path = public
as $$
  with requested as (
    select unnest(coalesce(input_partner_ids, '{}'::uuid[])) as partner_id
  ),
  aggregated as (
    select
      partner_favorites.partner_id,
      count(*)::bigint as favorite_count
    from public.partner_favorites
    where partner_favorites.partner_id = any(coalesce(input_partner_ids, '{}'::uuid[]))
    group by partner_favorites.partner_id
  )
  select
    requested.partner_id,
    coalesce(aggregated.favorite_count, 0)::bigint as favorite_count
  from requested
  left join aggregated using (partner_id);
$$;

create or replace function public.get_partner_review_counts(input_partner_ids uuid[])
returns table (
  partner_id uuid,
  review_count bigint
)
language sql
stable
set search_path = public
as $$
  with requested as (
    select unnest(coalesce(input_partner_ids, '{}'::uuid[])) as partner_id
  ),
  aggregated as (
    select
      partner_reviews.partner_id,
      count(*)::bigint as review_count
    from public.partner_reviews
    where partner_reviews.partner_id = any(coalesce(input_partner_ids, '{}'::uuid[]))
      and partner_reviews.deleted_at is null
    group by partner_reviews.partner_id
  )
  select
    requested.partner_id,
    coalesce(aggregated.review_count, 0)::bigint as review_count
  from requested
  left join aggregated using (partner_id);
$$;

create or replace function partner_metric_visitor_key(
  actor_type text,
  actor_id text,
  session_id text
)
returns text
language sql
immutable
as $$
  select coalesce(
    session_id,
    case when actor_id is not null then actor_type || ':' || actor_id end
  )
$$;

create or replace function apply_partner_metric_event_rollups(
  input_partner_id uuid,
  input_event_name text,
  input_actor_type text,
  input_actor_id text,
  input_session_id text,
  input_created_at timestamp with time zone default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  local_created_at timestamp without time zone;
  resolved_visitor_key text;
  inserted_count integer;
begin
  if input_partner_id is null or not is_partner_metric_event(input_event_name) then
    return;
  end if;

  local_created_at := date_trunc(
    'hour',
    timezone('Asia/Seoul', coalesce(input_created_at, now()))
  );

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    metric_kind,
    granularity,
    bucket_timezone,
    metric_count
  )
  values (
    input_partner_id,
    input_event_name,
    'pv',
    'total',
    'Asia/Seoul',
    1
  )
  on conflict (partner_id, metric_name, metric_kind, bucket_timezone)
    where granularity = 'total'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    metric_kind,
    granularity,
    bucket_timezone,
    bucket_local_start,
    metric_count
  )
  values (
    input_partner_id,
    input_event_name,
    'pv',
    'hour',
    'Asia/Seoul',
    local_created_at,
    1
  )
  on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_start)
    where granularity = 'hour'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    metric_kind,
    granularity,
    bucket_timezone,
    bucket_local_date,
    metric_count
  )
  values (
    input_partner_id,
    input_event_name,
    'pv',
    'day',
    'Asia/Seoul',
    local_created_at::date,
    1
  )
  on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_date)
    where granularity = 'day'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  insert into partner_metric_rollups (
    partner_id,
    metric_name,
    metric_kind,
    granularity,
    bucket_timezone,
    bucket_local_dow,
    metric_count
  )
  values (
    input_partner_id,
    input_event_name,
    'pv',
    'weekday',
    'Asia/Seoul',
    extract(isodow from local_created_at)::smallint,
    1
  )
  on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_dow)
    where granularity = 'weekday'
  do update set
    metric_count = partner_metric_rollups.metric_count + 1,
    updated_at = now();

  if input_event_name = 'partner_detail_view' then
    resolved_visitor_key := partner_metric_visitor_key(
      input_actor_type,
      input_actor_id,
      input_session_id
    );

    if resolved_visitor_key is not null then
      insert into partner_metric_unique_visitors (
        partner_id,
        metric_name,
        granularity,
        bucket_timezone,
        visitor_key
      )
      values (
        input_partner_id,
        input_event_name,
        'total',
        'Asia/Seoul',
        resolved_visitor_key
      )
      on conflict (partner_id, metric_name, bucket_timezone, visitor_key)
        where granularity = 'total'
      do nothing;
      get diagnostics inserted_count = row_count;
      if inserted_count > 0 then
        insert into partner_metric_rollups (
          partner_id,
          metric_name,
          metric_kind,
          granularity,
          bucket_timezone,
          metric_count
        )
        values (
          input_partner_id,
          input_event_name,
          'uv',
          'total',
          'Asia/Seoul',
          1
        )
        on conflict (partner_id, metric_name, metric_kind, bucket_timezone)
          where granularity = 'total'
        do update set
          metric_count = partner_metric_rollups.metric_count + 1,
          updated_at = now();
      end if;

      insert into partner_metric_unique_visitors (
        partner_id,
        metric_name,
        granularity,
        bucket_timezone,
        bucket_local_start,
        visitor_key
      )
      values (
        input_partner_id,
        input_event_name,
        'hour',
        'Asia/Seoul',
        local_created_at,
        resolved_visitor_key
      )
      on conflict (partner_id, metric_name, bucket_timezone, bucket_local_start, visitor_key)
        where granularity = 'hour'
      do nothing;
      get diagnostics inserted_count = row_count;
      if inserted_count > 0 then
        insert into partner_metric_rollups (
          partner_id,
          metric_name,
          metric_kind,
          granularity,
          bucket_timezone,
          bucket_local_start,
          metric_count
        )
        values (
          input_partner_id,
          input_event_name,
          'uv',
          'hour',
          'Asia/Seoul',
          local_created_at,
          1
        )
        on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_start)
          where granularity = 'hour'
        do update set
          metric_count = partner_metric_rollups.metric_count + 1,
          updated_at = now();
      end if;

      insert into partner_metric_unique_visitors (
        partner_id,
        metric_name,
        granularity,
        bucket_timezone,
        bucket_local_date,
        visitor_key
      )
      values (
        input_partner_id,
        input_event_name,
        'day',
        'Asia/Seoul',
        local_created_at::date,
        resolved_visitor_key
      )
      on conflict (partner_id, metric_name, bucket_timezone, bucket_local_date, visitor_key)
        where granularity = 'day'
      do nothing;
      get diagnostics inserted_count = row_count;
      if inserted_count > 0 then
        insert into partner_metric_rollups (
          partner_id,
          metric_name,
          metric_kind,
          granularity,
          bucket_timezone,
          bucket_local_date,
          metric_count
        )
        values (
          input_partner_id,
          input_event_name,
          'uv',
          'day',
          'Asia/Seoul',
          local_created_at::date,
          1
        )
        on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_date)
          where granularity = 'day'
        do update set
          metric_count = partner_metric_rollups.metric_count + 1,
          updated_at = now();
      end if;

      insert into partner_metric_unique_visitors (
        partner_id,
        metric_name,
        granularity,
        bucket_timezone,
        bucket_local_dow,
        visitor_key
      )
      values (
        input_partner_id,
        input_event_name,
        'weekday',
        'Asia/Seoul',
        extract(isodow from local_created_at)::smallint,
        resolved_visitor_key
      )
      on conflict (partner_id, metric_name, bucket_timezone, bucket_local_dow, visitor_key)
        where granularity = 'weekday'
      do nothing;
      get diagnostics inserted_count = row_count;
      if inserted_count > 0 then
        insert into partner_metric_rollups (
          partner_id,
          metric_name,
          metric_kind,
          granularity,
          bucket_timezone,
          bucket_local_dow,
          metric_count
        )
        values (
          input_partner_id,
          input_event_name,
          'uv',
          'weekday',
          'Asia/Seoul',
          extract(isodow from local_created_at)::smallint,
          1
        )
        on conflict (partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_dow)
          where granularity = 'weekday'
        do update set
          metric_count = partner_metric_rollups.metric_count + 1,
          updated_at = now();
      end if;
    end if;
  end if;
end;
$$;

create or replace function apply_partner_metric_event(
  input_partner_id uuid,
  input_event_name text,
  input_actor_type text,
  input_actor_id text default null,
  input_session_id text default null,
  input_created_at timestamp with time zone default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform apply_partner_metric_event_rollups(
    input_partner_id,
    input_event_name,
    input_actor_type,
    input_actor_id,
    input_session_id,
    input_created_at
  );
end;
$$;

create or replace function reconcile_partner_metric_rollups(
  input_partner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row record;
begin
  if input_partner_id is null then
    return;
  end if;

  delete from partner_metric_rollups
  where partner_id = input_partner_id
    and is_partner_metric_event(metric_name);

  delete from partner_metric_unique_visitors
  where partner_id = input_partner_id
    and metric_name = 'partner_detail_view';

  for event_row in
    select
      target_id::uuid as partner_id,
      event_name,
      actor_type,
      actor_id,
      session_id,
      created_at
    from event_logs
    where target_type = 'partner'
      and target_id = input_partner_id::text
      and target_id is not null
      and is_partner_metric_event(event_name)
    order by created_at asc nulls last
  loop
    perform apply_partner_metric_event_rollups(
      event_row.partner_id,
      event_row.event_name,
      event_row.actor_type,
      event_row.actor_id,
      event_row.session_id,
      event_row.created_at
    );
  end loop;
end;
$$;

create or replace function sync_partner_metric_rollups_from_event_logs()
returns trigger
language plpgsql
as $$
begin
  if new.target_type <> 'partner' or new.target_id is null then
    return new;
  end if;

  perform apply_partner_metric_event_rollups(
    new.target_id::uuid,
    new.event_name,
    new.actor_type,
    new.actor_id,
    new.session_id,
    new.created_at
  );

  return new;
end;
$$;

drop trigger if exists partner_metric_rollups_from_event_logs on event_logs;
create trigger partner_metric_rollups_from_event_logs
  after insert on event_logs
  for each row
  execute function sync_partner_metric_rollups_from_event_logs();

create or replace function public.ingest_product_event(
  input_event_id uuid,
  input_schema_version integer,
  input_occurred_at timestamp with time zone,
  input_request_id text,
  input_session_id text,
  input_actor_type text,
  input_actor_id text,
  input_event_name text,
  input_path text,
  input_referrer text,
  input_target_type text,
  input_target_id text,
  input_properties jsonb,
  input_user_agent text,
  input_ip_address text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  recorded_at_value timestamp with time zone := now();
begin
  if input_event_id is null then
    raise exception 'product_event_id_required';
  end if;

  if input_schema_version is null or input_schema_version < 1 then
    raise exception 'product_event_schema_version_invalid';
  end if;

  insert into public.event_logs (
    event_id,
    schema_version,
    occurred_at,
    recorded_at,
    request_id,
    session_id,
    actor_type,
    actor_id,
    event_name,
    path,
    referrer,
    target_type,
    target_id,
    properties,
    user_agent,
    ip_address,
    created_at
  )
  values (
    input_event_id,
    input_schema_version,
    coalesce(input_occurred_at, recorded_at_value),
    recorded_at_value,
    input_request_id,
    input_session_id,
    input_actor_type,
    input_actor_id,
    input_event_name,
    input_path,
    input_referrer,
    input_target_type,
    input_target_id,
    coalesce(input_properties, '{}'::jsonb),
    input_user_agent,
    input_ip_address,
    recorded_at_value
  )
  on conflict (event_id) where event_id is not null do nothing;

  return found;
end;
$$;

revoke all on function public.ingest_product_event(uuid, integer, timestamp with time zone, text, text, text, text, text, text, text, text, text, jsonb, text, text) from public;
revoke all on function public.ingest_product_event(uuid, integer, timestamp with time zone, text, text, text, text, text, text, text, text, text, jsonb, text, text) from anon;
revoke all on function public.ingest_product_event(uuid, integer, timestamp with time zone, text, text, text, text, text, text, text, text, text, jsonb, text, text) from authenticated;
grant execute on function public.ingest_product_event(uuid, integer, timestamp with time zone, text, text, text, text, text, text, text, text, text, jsonb, text, text) to service_role;

create table if not exists admin_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  request_id text,
  actor_type text,
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

create table if not exists admin_accounts (
  id uuid primary key default uuid_generate_v4(),
  login_id text not null unique,
  display_name text not null,
  email text,
  password_hash text,
  password_salt text,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  initial_setup_token_hash text unique,
  initial_setup_expires_at timestamp with time zone,
  initial_setup_completed_at timestamp with time zone,
  last_login_at timestamp with time zone,
  permission_version integer not null default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint admin_accounts_login_id_check
    check (login_id ~ '^[A-Za-z0-9._-]{3,64}$'),
  constraint admin_accounts_password_pair_check
    check (
      (password_hash is null and password_salt is null)
      or (password_hash is not null and password_salt is not null)
    )
);

create table if not exists admin_permissions (
  admin_id uuid not null references admin_accounts(id) on delete cascade,
  resource text not null,
  action text not null,
  granted boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (admin_id, resource, action),
  constraint admin_permissions_resource_check
    check (resource in (
      'members',
      'reviews',
      'logs',
      'brands',
      'companies',
      'notifications',
      'home_ads',
      'events',
      'cycles',
      'admin_management'
    )),
  constraint admin_permissions_action_check
    check (action in ('create', 'read', 'update', 'delete')),
  constraint admin_permissions_logs_read_only_check
    check (resource <> 'logs' or action = 'read' or granted = false)
);

create table if not exists admin_permission_templates (
  key text primary key,
  name text not null,
  description text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists partner_plan_upgrade_requests (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid references partners(id) on delete cascade,
  company_id uuid not null references partner_companies(id) on delete cascade,
  requested_by_account_id uuid not null references partner_accounts(id) on delete cascade,
  current_plan_tier text not null,
  requested_plan_tier text not null,
  status text not null default 'pending',
  payment_amount_krw integer not null default 0,
  payer_name text not null default '',
  memo text not null default '',
  admin_note text not null default '',
  reviewed_by_admin_id uuid references members(id) on delete set null,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_plan_upgrade_requests_current_plan_check
    check (current_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_plan_upgrade_requests_requested_plan_check
    check (requested_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_plan_upgrade_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint partner_plan_upgrade_requests_amount_check
    check (payment_amount_krw >= 0)
);

create table if not exists partner_brand_plan_events (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid references partners(id) on delete cascade,
  company_id uuid not null references partner_companies(id) on delete cascade,
  upgrade_request_id uuid references partner_plan_upgrade_requests(id) on delete set null,
  previous_plan_tier text,
  next_plan_tier text not null,
  source text not null default 'admin',
  actor_admin_id uuid references members(id) on delete set null,
  actor_partner_account_id uuid references partner_accounts(id) on delete set null,
  plan_started_at timestamp with time zone,
  plan_expires_at timestamp with time zone,
  note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint partner_brand_plan_events_previous_plan_check
    check (previous_plan_tier is null or previous_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_brand_plan_events_next_plan_check
    check (next_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_brand_plan_events_source_check
    check (source in ('admin', 'partner_upgrade', 'expiration', 'system'))
);

create table if not exists partner_billing_profiles (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references partner_companies(id) on delete cascade,
  account_id uuid references partner_accounts(id) on delete cascade,
  label text not null default '기본 세금계산서 정보',
  payer_name text not null default '',
  business_registration_number text not null,
  business_name text not null,
  representative_name text not null,
  business_address text not null,
  business_type text not null,
  business_item text not null,
  tax_invoice_email text not null,
  tax_document_type text not null default 'tax_invoice',
  is_default boolean not null default false,
  last_used_at timestamp with time zone,
  archived_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_billing_profiles_label_check
    check (char_length(label) between 1 and 80),
  constraint partner_billing_profiles_payer_name_check
    check (char_length(payer_name) between 1 and 80),
  constraint partner_billing_profiles_brn_check
    check (business_registration_number ~ '^[0-9]{10}$'),
  constraint partner_billing_profiles_email_check
    check (position('@' in tax_invoice_email) > 1),
  constraint partner_billing_profiles_tax_document_type_check
    check (tax_document_type in ('tax_invoice'))
);

create table if not exists partner_billing_invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique,
  company_id uuid not null references partner_companies(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete cascade,
  upgrade_request_id uuid references partner_plan_upgrade_requests(id) on delete set null,
  requested_by_account_id uuid references partner_accounts(id) on delete set null,
  billing_reason text not null default 'plan_upgrade',
  billing_policy text not null,
  payment_method text not null default 'manual_bank_transfer',
  status text not null default 'pending_payment',
  current_plan_tier text not null,
  requested_plan_tier text not null,
  remaining_days integer not null default 30,
  service_period_start timestamp with time zone,
  service_period_end timestamp with time zone,
  supply_amount_krw integer not null,
  vat_amount_krw integer not null,
  total_amount_krw integer not null,
  issue_date date not null default current_date,
  due_at timestamp with time zone not null,
  paid_at timestamp with time zone,
  overdue_marked_at timestamp with time zone,
  downgraded_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_billing_invoices_reason_check
    check (billing_reason in ('plan_upgrade', 'recurring_plan', 'manual_adjustment', 'overdue_downgrade')),
  constraint partner_billing_invoices_policy_check
    check (billing_policy in ('first_month_full_amount', 'remaining_period_difference')),
  constraint partner_billing_invoices_payment_method_check
    check (payment_method in ('manual_bank_transfer')),
  constraint partner_billing_invoices_status_check
    check (status in ('pending_payment', 'paid', 'overdue', 'cancelled')),
  constraint partner_billing_invoices_current_plan_check
    check (current_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_billing_invoices_requested_plan_check
    check (requested_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_billing_invoices_remaining_days_check
    check (remaining_days > 0),
  constraint partner_billing_invoices_amount_check
    check (
      supply_amount_krw >= 0
      and vat_amount_krw >= 0
      and total_amount_krw >= 0
      and total_amount_krw = supply_amount_krw + vat_amount_krw
    )
);

create table if not exists partner_billing_payments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references partner_billing_invoices(id) on delete cascade,
  method text not null default 'manual_bank_transfer',
  status text not null default 'awaiting_transfer',
  amount_krw integer not null,
  payer_name text not null default '',
  memo text not null default '',
  confirmed_by_admin_id uuid references members(id) on delete set null,
  confirmed_at timestamp with time zone,
  failure_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_billing_payments_method_check
    check (method in ('manual_bank_transfer')),
  constraint partner_billing_payments_status_check
    check (status in ('awaiting_transfer', 'confirmed', 'cancelled', 'failed')),
  constraint partner_billing_payments_amount_check
    check (amount_krw >= 0)
);

create table if not exists partner_tax_documents (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null unique references partner_billing_invoices(id) on delete cascade,
  type text not null default 'tax_invoice',
  status text not null default 'requested',
  business_registration_number text not null,
  business_name text not null,
  representative_name text not null,
  business_address text not null,
  business_type text not null,
  business_item text not null,
  tax_invoice_email text not null,
  provider text not null default 'manual_hometax',
  external_document_id text,
  issued_by_admin_id uuid references members(id) on delete set null,
  issued_at timestamp with time zone,
  sent_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  failure_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_tax_documents_type_check
    check (type in ('tax_invoice')),
  constraint partner_tax_documents_status_check
    check (status in ('requested', 'pending_issue', 'issued', 'cancelled')),
  constraint partner_tax_documents_brn_check
    check (business_registration_number ~ '^[0-9]{10}$')
);

alter table partner_plan_upgrade_requests
  add column if not exists billing_invoice_id uuid references partner_billing_invoices(id) on delete set null;

create table if not exists admin_notification_preferences (
  admin_id uuid primary key references members(id) on delete cascade,
  enabled boolean not null default true,
  portal_enabled boolean not null default true,
  push_enabled boolean not null default true,
  security_enabled boolean not null default true,
  partner_request_enabled boolean not null default true,
  expiring_partner_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists admin_push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid not null references members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamp with time zone,
  user_agent text,
  is_active boolean not null default true,
  failure_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_success_at timestamp with time zone,
  last_failure_at timestamp with time zone
);

create table if not exists admin_notifications (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  title text not null,
  body text not null,
  target_url text not null default '/admin',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint admin_notifications_type_check
    check (type in ('partner_change_request', 'partner_immediate_update', 'expiring_partner', 'security_alert'))
);

create table if not exists admin_notification_recipients (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references admin_notifications(id) on delete cascade,
  admin_id uuid not null references members(id) on delete cascade,
  read_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (notification_id, admin_id)
);

create table if not exists admin_notification_deliveries (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references admin_notifications(id) on delete cascade,
  admin_id uuid references members(id) on delete cascade,
  channel text not null,
  status text not null,
  error_message text,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint admin_notification_deliveries_channel_check
    check (channel in ('portal', 'push')),
  constraint admin_notification_deliveries_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped'))
);

create table if not exists partner_notification_preferences (
  account_id uuid primary key references partner_accounts(id) on delete cascade,
  enabled boolean not null default true,
  portal_enabled boolean not null default true,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  plan_enabled boolean not null default true,
  expiring_partner_enabled boolean not null default true,
  metrics_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists partner_push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references partner_accounts(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamp with time zone,
  user_agent text,
  is_active boolean not null default true,
  failure_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_success_at timestamp with time zone,
  last_failure_at timestamp with time zone
);

create table if not exists partner_notifications (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references partner_companies(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  target_url text not null default '/partner/notifications',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint partner_notifications_type_check
    check (type in ('expiring_partner', 'plan_changed', 'plan_upgrade_requested', 'plan_upgrade_approved', 'plan_upgrade_rejected', 'metrics_digest'))
);

create table if not exists partner_notification_recipients (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references partner_notifications(id) on delete cascade,
  account_id uuid not null references partner_accounts(id) on delete cascade,
  read_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (notification_id, account_id)
);

create table if not exists partner_notification_deliveries (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references partner_notifications(id) on delete cascade,
  account_id uuid references partner_accounts(id) on delete cascade,
  channel text not null,
  status text not null,
  error_message text,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint partner_notification_deliveries_channel_check
    check (channel in ('portal', 'push', 'email')),
  constraint partner_notification_deliveries_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped'))
);

create table if not exists operational_notification_dedupes (
  dedupe_key text primary key,
  audience text not null,
  notification_type text not null,
  target_id text not null,
  created_at timestamp with time zone not null default now(),
  constraint operational_notification_dedupes_audience_check
    check (audience in ('admin', 'partner'))
);

alter table members
  drop constraint if exists members_admin_permission_id_fkey;
alter table members add column if not exists admin_managed_campus_slugs text[] not null default '{}';
alter table members
  drop constraint if exists members_admin_managed_campus_slugs_check;
alter table members
  add constraint members_admin_managed_campus_slugs_check
  check (
    admin_managed_campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
  );
alter table members
  add constraint members_admin_permission_id_fkey
  foreign key (admin_permission_id)
  references admin_permission_templates(key)
  on update cascade
  on delete set null;

create table if not exists auth_security_logs (
  id uuid primary key default uuid_generate_v4(),
  request_id text,
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

create index if not exists partners_category_id_idx on partners(category_id);
create index if not exists partners_company_id_idx on partners(company_id);
create index if not exists partners_brand_profile_idx
  on partners(brand_profile_id)
  where brand_profile_id is not null;
create index if not exists partners_updated_at_idx on partners(updated_at desc);
create index if not exists categories_updated_at_idx on categories(updated_at desc);
create index if not exists partner_companies_name_idx on partner_companies(name);
create index if not exists partner_brand_profiles_company_idx
  on partner_brand_profiles(company_id, created_at desc);
create unique index if not exists partner_company_branches_company_brand_key_idx
  on partner_company_branches(company_id, coalesce(brand_profile_id, '00000000-0000-0000-0000-000000000000'::uuid), branch_key);
create index if not exists partner_company_branches_company_idx
  on partner_company_branches(company_id, is_active, created_at desc);
create index if not exists partner_company_branches_brand_idx
  on partner_company_branches(brand_profile_id, is_active, created_at desc)
  where brand_profile_id is not null;
create index if not exists partner_company_branches_campus_slugs_idx
  on partner_company_branches using gin(campus_slugs);
create index if not exists partner_offer_branches_partner_idx
  on partner_offer_branches(partner_id, status);
create index if not exists partner_offer_branches_branch_idx
  on partner_offer_branches(branch_id, status);
create index if not exists admin_login_attempts_identifier_idx on admin_login_attempts(identifier);
create index if not exists suggestion_attempts_identifier_idx on suggestion_attempts(identifier);
create index if not exists partner_registration_attempts_identifier_idx on partner_registration_attempts(identifier);
create index if not exists partner_registration_requests_status_created_idx
  on partner_registration_requests(status, created_at desc);
create index if not exists partner_registration_requests_category_created_idx
  on partner_registration_requests(category_id, created_at desc);
create index if not exists partner_registration_requests_source_created_idx
  on partner_registration_requests(source, created_at desc);
create index if not exists partner_registration_requests_company_created_idx
  on partner_registration_requests(company_id, created_at desc)
  where company_id is not null;
create index if not exists partner_registration_requests_requested_account_created_idx
  on partner_registration_requests(requested_by_partner_account_id, created_at desc)
  where requested_by_partner_account_id is not null;
create index if not exists partner_registration_benefit_groups_request_idx
  on partner_registration_benefit_groups(registration_request_id);
create index if not exists partner_registration_branches_request_idx
  on partner_registration_branches(registration_request_id);
create index if not exists partner_registration_branches_campus_slugs_idx
  on partner_registration_branches using gin(campus_slugs);
create index if not exists member_auth_attempts_identifier_idx on member_auth_attempts(identifier);
create index if not exists partner_accounts_login_id_idx on partner_accounts(login_id);
create index if not exists partner_account_companies_account_id_idx on partner_account_companies(account_id);
create index if not exists partner_account_companies_company_id_idx on partner_account_companies(company_id);
create unique index if not exists partner_plan_upgrade_requests_pending_partner_idx
  on partner_plan_upgrade_requests(partner_id)
  where status = 'pending' and partner_id is not null;
create index if not exists partner_plan_upgrade_requests_partner_created_idx
  on partner_plan_upgrade_requests(partner_id, created_at desc);
create index if not exists partner_plan_upgrade_requests_company_created_idx
  on partner_plan_upgrade_requests(company_id, created_at desc);
create index if not exists partner_plan_upgrade_requests_account_created_idx
  on partner_plan_upgrade_requests(requested_by_account_id, created_at desc);
create index if not exists partner_brand_plan_events_partner_created_idx
  on partner_brand_plan_events(partner_id, created_at desc);
create index if not exists partner_brand_plan_events_company_created_idx
  on partner_brand_plan_events(company_id, created_at desc);
create index if not exists partner_brand_plan_events_upgrade_request_idx
  on partner_brand_plan_events(upgrade_request_id);
create unique index if not exists partner_plan_upgrade_requests_billing_invoice_idx
  on partner_plan_upgrade_requests(billing_invoice_id)
  where billing_invoice_id is not null;
create index if not exists partner_billing_profiles_company_idx
  on partner_billing_profiles(company_id);
create index if not exists partner_billing_profiles_account_company_idx
  on partner_billing_profiles(account_id, company_id, archived_at, updated_at desc);
create index if not exists partner_billing_profiles_company_active_idx
  on partner_billing_profiles(company_id, archived_at, updated_at desc);
create unique index if not exists partner_billing_profiles_default_account_company_idx
  on partner_billing_profiles(account_id, company_id)
  where is_default
    and archived_at is null
    and account_id is not null;
create index if not exists partner_billing_invoices_company_status_due_idx
  on partner_billing_invoices(company_id, status, due_at);
create index if not exists partner_billing_invoices_partner_created_idx
  on partner_billing_invoices(partner_id, created_at desc);
create index if not exists partner_billing_invoices_upgrade_request_idx
  on partner_billing_invoices(upgrade_request_id);
create index if not exists partner_billing_payments_invoice_idx
  on partner_billing_payments(invoice_id, created_at desc);
create index if not exists partner_tax_documents_status_created_idx
  on partner_tax_documents(status, created_at desc);
create index if not exists partner_auth_attempts_identifier_idx on partner_auth_attempts(identifier);
create index if not exists partner_change_requests_company_id_idx on partner_change_requests(company_id);
create index if not exists partner_change_requests_partner_id_idx on partner_change_requests(partner_id);
create index if not exists partner_change_requests_status_idx on partner_change_requests(status);
create index if not exists partner_change_requests_created_at_idx on partner_change_requests(created_at desc);
create unique index if not exists partner_change_requests_pending_partner_idx
  on partner_change_requests(partner_id)
  where status = 'pending';
create index if not exists password_reset_attempts_identifier_idx on password_reset_attempts(identifier);
create index if not exists push_subscriptions_member_id_idx on push_subscriptions(member_id);
create index if not exists push_subscriptions_active_idx on push_subscriptions(is_active);
create index if not exists push_message_logs_created_at_idx on push_message_logs(created_at desc);
create index if not exists push_message_logs_type_idx on push_message_logs(type);
create index if not exists push_message_logs_status_idx on push_message_logs(status);
create index if not exists push_delivery_logs_member_id_idx on push_delivery_logs(member_id);
create index if not exists push_delivery_logs_created_at_idx on push_delivery_logs(created_at desc);
create index if not exists notifications_created_at_idx on notifications(created_at desc);
create index if not exists notifications_type_idx on notifications(type);
create index if not exists member_notifications_member_id_created_at_idx
  on member_notifications(member_id, deleted_at, created_at desc);
create index if not exists member_notifications_notification_id_idx
  on member_notifications(notification_id);
create index if not exists member_notifications_member_read_idx
  on member_notifications(member_id, read_at, deleted_at);
create index if not exists notification_deliveries_notification_id_idx
  on notification_deliveries(notification_id);
create index if not exists notification_deliveries_member_id_idx
  on notification_deliveries(member_id);
create index if not exists notification_deliveries_created_at_idx
  on notification_deliveries(created_at desc);
create index if not exists notification_deliveries_provider_notification_idx
  on notification_deliveries(provider, provider_notification_id)
  where provider_notification_id is not null;
create index if not exists notification_deliveries_provider_campaign_idx
  on notification_deliveries(provider, provider_campaign_id, created_at desc)
  where provider_campaign_id is not null;
create index if not exists notification_deliveries_provider_pending_idx
  on notification_deliveries(provider, channel, status, created_at desc)
  where provider is not null;
drop trigger if exists notification_deliveries_set_updated_at
  on notification_deliveries;
create trigger notification_deliveries_set_updated_at
  before update on notification_deliveries
  for each row
  execute function set_partnership_updated_at();
create index if not exists admin_push_subscriptions_admin_active_idx
  on admin_push_subscriptions(admin_id)
  where is_active = true;
create index if not exists admin_notification_recipients_admin_created_idx
  on admin_notification_recipients(admin_id, created_at desc);
create index if not exists admin_notification_deliveries_notification_idx
  on admin_notification_deliveries(notification_id);
create index if not exists partner_push_subscriptions_account_active_idx
  on partner_push_subscriptions(account_id)
  where is_active = true;
create index if not exists partner_notifications_company_created_idx
  on partner_notifications(company_id, created_at desc);
create index if not exists partner_notification_recipients_account_created_idx
  on partner_notification_recipients(account_id, created_at desc);
create index if not exists partner_notification_deliveries_notification_idx
  on partner_notification_deliveries(notification_id);
create index if not exists members_year_created_at_idx
  on members(year desc, created_at desc);
create index if not exists members_created_at_idx
  on members(created_at desc);
create index if not exists members_display_name_idx
  on members(display_name);
create index if not exists members_year_campus_display_name_idx
  on members(year, campus, display_name);
create index if not exists members_campus_display_name_idx
  on members(campus, display_name);
create index if not exists members_admin_permission_id_idx
  on members(admin_permission_id)
  where admin_permission_id is not null;
create index if not exists members_admin_managed_campus_slugs_idx
  on members using gin(admin_managed_campus_slugs)
  where cardinality(admin_managed_campus_slugs) > 0;
create unique index if not exists members_ssafy_sub_key
  on members(ssafy_sub)
  where ssafy_sub is not null;
create unique index if not exists members_ssafy_mattermost_user_id_key
  on members(ssafy_mattermost_user_id)
  where ssafy_mattermost_user_id is not null;
create index if not exists members_ssafy_track_idx
  on members(ssafy_track)
  where ssafy_track is not null;
create index if not exists partner_companies_managed_campus_slugs_idx
  on partner_companies using gin(managed_campus_slugs);
create index if not exists partners_managed_campus_slugs_idx
  on partners using gin(managed_campus_slugs);
create index if not exists event_logs_created_at_idx on event_logs(created_at desc);
create index if not exists event_logs_created_at_id_idx
  on event_logs(created_at desc, id desc);
create index if not exists event_logs_event_name_idx on event_logs(event_name);
create index if not exists event_logs_name_created_at_idx
  on event_logs(event_name, created_at desc);
create index if not exists event_logs_actor_id_idx on event_logs(actor_id);
create index if not exists event_logs_actor_type_created_at_idx
  on event_logs(actor_type, created_at desc);
create index if not exists event_logs_target_idx on event_logs(target_type, target_id);
create index if not exists event_logs_partner_metric_idx
  on event_logs(target_type, target_id, event_name, created_at)
  where target_id is not null;
create index if not exists event_logs_path_idx on event_logs(path);
create index if not exists event_logs_path_prefix_idx
  on event_logs(path text_pattern_ops)
  where path is not null;
create index if not exists event_logs_session_id_idx on event_logs(session_id);
create unique index if not exists event_logs_event_id_key
  on event_logs(event_id)
  where event_id is not null;
create unique index if not exists partner_metric_rollups_total_unique_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone)
  where granularity = 'total';
create unique index if not exists partner_metric_rollups_hour_unique_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_start)
  where granularity = 'hour';
create unique index if not exists partner_metric_rollups_day_unique_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_date)
  where granularity = 'day';
create unique index if not exists partner_metric_rollups_weekday_unique_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_dow)
  where granularity = 'weekday';
create index if not exists partner_metric_rollups_partner_metric_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, granularity);
create index if not exists partner_metric_rollups_hour_lookup_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_start desc)
  where granularity = 'hour';
create index if not exists partner_metric_rollups_day_lookup_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_date desc)
  where granularity = 'day';
create index if not exists partner_metric_rollups_weekday_lookup_idx
  on partner_metric_rollups(partner_id, metric_name, metric_kind, bucket_timezone, bucket_local_dow)
  where granularity = 'weekday';
create unique index if not exists partner_metric_unique_visitors_total_unique_idx
  on partner_metric_unique_visitors(partner_id, metric_name, bucket_timezone, visitor_key)
  where granularity = 'total';
create unique index if not exists partner_metric_unique_visitors_hour_unique_idx
  on partner_metric_unique_visitors(partner_id, metric_name, bucket_timezone, bucket_local_start, visitor_key)
  where granularity = 'hour';
create unique index if not exists partner_metric_unique_visitors_day_unique_idx
  on partner_metric_unique_visitors(partner_id, metric_name, bucket_timezone, bucket_local_date, visitor_key)
  where granularity = 'day';
create unique index if not exists partner_metric_unique_visitors_weekday_unique_idx
  on partner_metric_unique_visitors(partner_id, metric_name, bucket_timezone, bucket_local_dow, visitor_key)
  where granularity = 'weekday';
create index if not exists partner_metric_unique_visitors_partner_metric_idx
  on partner_metric_unique_visitors(partner_id, metric_name, granularity);
create index if not exists admin_audit_logs_created_at_idx on admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_created_at_id_idx
  on admin_audit_logs(created_at desc, id desc);
create index if not exists admin_audit_logs_action_idx on admin_audit_logs(action);
create index if not exists admin_audit_logs_action_created_at_idx
  on admin_audit_logs(action, created_at desc);
create index if not exists admin_audit_logs_actor_id_idx on admin_audit_logs(actor_id);
create index if not exists admin_audit_logs_actor_created_at_idx
  on admin_audit_logs(actor_id, created_at desc);
create index if not exists admin_audit_logs_target_idx on admin_audit_logs(target_type, target_id);
create index if not exists admin_audit_logs_path_prefix_idx
  on admin_audit_logs(path text_pattern_ops)
  where path is not null;
create index if not exists admin_accounts_login_id_idx
  on admin_accounts(login_id);
create index if not exists admin_accounts_is_active_idx
  on admin_accounts(is_active);
create index if not exists admin_permissions_admin_id_idx
  on admin_permissions(admin_id);
create index if not exists admin_permissions_resource_action_idx
  on admin_permissions(resource, action)
  where granted = true;
create index if not exists auth_security_logs_created_at_idx on auth_security_logs(created_at desc);
create index if not exists auth_security_logs_created_at_id_idx
  on auth_security_logs(created_at desc, id desc);
create index if not exists auth_security_logs_event_name_idx on auth_security_logs(event_name);
create index if not exists auth_security_logs_status_idx on auth_security_logs(status);
create index if not exists auth_security_logs_name_status_created_at_idx
  on auth_security_logs(event_name, status, created_at desc);
create index if not exists auth_security_logs_actor_id_idx on auth_security_logs(actor_id);
create index if not exists auth_security_logs_actor_status_created_at_idx
  on auth_security_logs(actor_type, status, created_at desc);
create index if not exists auth_security_logs_identifier_idx on auth_security_logs(identifier);
create index if not exists auth_security_logs_path_prefix_idx
  on auth_security_logs(path text_pattern_ops)
  where path is not null;
create index if not exists auth_security_logs_member_policy_consent_idx
  on auth_security_logs(actor_type, event_name, status, actor_id, created_at desc)
  where actor_id is not null;
create index if not exists member_policy_consents_member_id_idx on member_policy_consents(member_id);
create index if not exists member_policy_consents_policy_document_id_idx on member_policy_consents(policy_document_id);
create index if not exists push_subscriptions_active_member_idx
  on push_subscriptions(member_id)
  where is_active = true;
create index if not exists partner_reviews_partner_id_created_at_idx
  on partner_reviews(partner_id, deleted_at, hidden_at, created_at desc);
create index if not exists partner_reviews_partner_id_rating_desc_idx
  on partner_reviews(partner_id, deleted_at, hidden_at, rating desc, created_at desc);
create index if not exists partner_reviews_partner_id_rating_asc_idx
  on partner_reviews(partner_id, deleted_at, hidden_at, rating asc, created_at desc);
create index if not exists partner_reviews_member_id_partner_id_created_at_idx
  on partner_reviews(member_id, partner_id, deleted_at, hidden_at, created_at desc);
create index if not exists partner_reviews_member_id_deleted_hidden_created_at_idx
  on partner_reviews(member_id, deleted_at, hidden_at, created_at desc);
create index if not exists partner_reviews_admin_created_at_idx
  on partner_reviews(created_at desc)
  where deleted_at is null;
create index if not exists partner_reviews_admin_hidden_created_at_idx
  on partner_reviews(hidden_at, created_at desc)
  where deleted_at is null;
create index if not exists partner_reviews_admin_rating_created_at_idx
  on partner_reviews(rating, created_at desc)
  where deleted_at is null;
create index if not exists partner_review_reactions_review_id_idx
  on partner_review_reactions(review_id, reaction);
create index if not exists partner_review_reactions_member_id_idx
  on partner_review_reactions(member_id, review_id);

create table if not exists ad_campaigns (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  package_tier text not null default 'basic',
  title text not null,
  description text not null default '',
  sponsor_label text not null default '',
  status text not null default 'draft',
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  channels text[] not null default array['coupon']::text[],
  monthly_price_krw integer not null default 0,
  notes text not null default '',
  created_by_admin_id text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint ad_campaigns_package_tier_check
    check (package_tier in ('basic', 'partner', 'boost')),
  constraint ad_campaigns_status_check
    check (status in ('draft', 'active', 'paused', 'ended')),
  constraint ad_campaigns_period_check
    check (starts_at <= ends_at),
  constraint ad_campaigns_price_check
    check (monthly_price_krw >= 0),
  constraint ad_campaigns_channels_check
    check (
      channels <@ array['coupon', 'home_banner', 'push', 'mm', 'ad_banner']::text[]
      and array_length(channels, 1) is not null
    )
);

comment on table ad_campaigns is
  'Direct-sold sponsorship and advertising packages for partner monetization.';

create index if not exists ad_campaigns_partner_status_period_idx
  on ad_campaigns(partner_id, status, starts_at desc, ends_at desc);
create index if not exists ad_campaigns_updated_at_idx
  on ad_campaigns(updated_at desc);

create table if not exists ad_coupons (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references ad_campaigns(id) on delete set null,
  partner_id uuid not null references partners(id) on delete cascade,
  title text not null,
  description text not null default '',
  code text not null default '',
  redemption_type text not null default 'onsite',
  discount_label text not null default '',
  terms text[] not null default '{}'::text[],
  status text not null default 'draft',
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  usage_limit integer,
  per_member_limit integer not null default 1,
  external_url text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint ad_coupons_status_check
    check (status in ('draft', 'active', 'paused', 'ended')),
  constraint ad_coupons_redemption_type_check
    check (redemption_type in ('onsite', 'code', 'external')),
  constraint ad_coupons_period_check
    check (starts_at <= ends_at),
  constraint ad_coupons_usage_limit_check
    check (usage_limit is null or usage_limit >= 0),
  constraint ad_coupons_per_member_limit_check
    check (per_member_limit >= 1)
);

comment on table ad_coupons is
  'Coupons attached to advertising packages and partner sponsorship campaigns.';

create index if not exists ad_coupons_partner_status_period_idx
  on ad_coupons(partner_id, status, starts_at desc, ends_at desc);
create index if not exists ad_coupons_campaign_idx
  on ad_coupons(campaign_id);
create index if not exists ad_coupons_updated_at_idx
  on ad_coupons(updated_at desc);

create table if not exists ad_coupon_redemptions (
  id uuid primary key default uuid_generate_v4(),
  coupon_id uuid not null references ad_coupons(id) on delete cascade,
  campaign_id uuid references ad_campaigns(id) on delete set null,
  partner_id uuid not null references partners(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  session_id text,
  status text not null default 'redeemed',
  redemption_code text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint ad_coupon_redemptions_status_check
    check (status in ('redeemed', 'cancelled')),
  constraint ad_coupon_redemptions_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table ad_coupon_redemptions is
  'Member coupon redemption intents and onsite use confirmations for ad package reporting.';

create index if not exists ad_coupon_redemptions_coupon_created_idx
  on ad_coupon_redemptions(coupon_id, created_at desc);
create index if not exists ad_coupon_redemptions_campaign_created_idx
  on ad_coupon_redemptions(campaign_id, created_at desc);
create index if not exists ad_coupon_redemptions_partner_created_idx
  on ad_coupon_redemptions(partner_id, created_at desc);
create index if not exists ad_coupon_redemptions_member_coupon_idx
  on ad_coupon_redemptions(member_id, coupon_id)
  where member_id is not null and status = 'redeemed';

create table if not exists promotion_events (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  page_path text not null default '',
  target_audiences text[] not null default array['guest', 'student', 'graduate', 'staff']::text[],
  title text not null,
  short_title text not null,
  description text not null,
  period_label text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  hero_image_src text not null,
  hero_image_alt text not null,
  conditions jsonb not null default '[]'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint promotion_events_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint promotion_events_period_check
    check (starts_at <= ends_at),
  constraint promotion_events_conditions_array_check
    check (jsonb_typeof(conditions) = 'array'),
  constraint promotion_events_rules_array_check
    check (jsonb_typeof(rules) = 'array')
);

comment on table promotion_events is
  'Admin-managed public event landing pages and home promotion carousel event entries.';

create index if not exists promotion_events_active_period_idx
  on promotion_events(is_active, starts_at desc, ends_at desc);
create index if not exists promotion_events_updated_at_idx
  on promotion_events(updated_at desc);

create table if not exists promotion_slides (
  id uuid primary key default uuid_generate_v4(),
  display_order integer not null,
  title text not null,
  subtitle text not null,
  image_src text not null,
  image_alt text not null,
  href text not null,
  is_active boolean not null default true,
  requires_login boolean not null default false,
  allowed_years integer[] not null default '{}'::integer[],
  allowed_campuses text[] not null default '{}'::text[],
  audiences text[] not null default array['guest', 'student', 'graduate', 'staff']::text[],
  event_slug text references promotion_events(slug) on delete set null,
  ad_campaign_id uuid references ad_campaigns(id) on delete set null,
  sponsor_label text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists promotion_slides_active_order_idx
  on promotion_slides(is_active, display_order, created_at);
create index if not exists promotion_slides_event_slug_idx
  on promotion_slides(event_slug);
create index if not exists promotion_slides_ad_campaign_idx
  on promotion_slides(ad_campaign_id);

create table if not exists event_reward_draws (
  id uuid primary key default uuid_generate_v4(),
  event_slug text not null references promotion_events(slug) on delete cascade,
  status text not null default 'draft',
  seed text not null,
  winner_count integer not null,
  candidate_count integer not null default 0,
  total_tickets integer not null default 0,
  google_form_url text not null,
  guide_path text not null,
  sent_notification_id uuid references notifications(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_admin_id text,
  created_at timestamp with time zone not null default now(),
  finalized_at timestamp with time zone,
  sent_at timestamp with time zone,
  updated_at timestamp with time zone not null default now(),
  constraint event_reward_draws_status_check
    check (status in ('draft', 'finalized', 'sent', 'partial_failed', 'failed')),
  constraint event_reward_draws_winner_count_check
    check (winner_count > 0),
  constraint event_reward_draws_candidate_count_check
    check (candidate_count >= 0),
  constraint event_reward_draws_total_tickets_check
    check (total_tickets >= 0),
  constraint event_reward_draws_google_form_url_check
    check (google_form_url like 'https://%'),
  constraint event_reward_draws_guide_path_check
    check (guide_path like '/%' and guide_path not like '//%')
);

comment on table event_reward_draws is
  'Admin-created weighted reward event draws. One finalized draw is allowed per event.';

create unique index if not exists event_reward_draws_one_finalized_per_event_idx
  on event_reward_draws(event_slug)
  where status in ('finalized', 'sent', 'partial_failed', 'failed');
create index if not exists event_reward_draws_event_created_at_idx
  on event_reward_draws(event_slug, created_at desc);

create table if not exists event_reward_winners (
  id uuid primary key default uuid_generate_v4(),
  draw_id uuid not null references event_reward_draws(id) on delete cascade,
  event_slug text not null references promotion_events(slug) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  winner_rank integer not null,
  ticket_count integer not null,
  display_name text,
  mm_username text,
  year integer,
  campus text,
  notification_status text not null default 'pending',
  notification_sent_at timestamp with time zone,
  notification_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint event_reward_winners_rank_check
    check (winner_rank > 0),
  constraint event_reward_winners_ticket_count_check
    check (ticket_count > 0),
  constraint event_reward_winners_notification_status_check
    check (notification_status in ('pending', 'sent', 'partial_failed', 'failed', 'skipped')),
  constraint event_reward_winners_draw_member_key unique (draw_id, member_id),
  constraint event_reward_winners_draw_rank_key unique (draw_id, winner_rank)
);

comment on table event_reward_winners is
  'Persisted winners for reward event draws and notification delivery status.';

create index if not exists event_reward_winners_event_member_idx
  on event_reward_winners(event_slug, member_id);
create index if not exists event_reward_winners_draw_rank_idx
  on event_reward_winners(draw_id, winner_rank);

create or replace function set_event_reward_draws_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_reward_draws_set_updated_at on event_reward_draws;
create trigger event_reward_draws_set_updated_at
  before update on event_reward_draws
  for each row
  execute function set_event_reward_draws_updated_at();

create or replace function set_event_reward_winners_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_reward_winners_set_updated_at on event_reward_winners;
create trigger event_reward_winners_set_updated_at
  before update on event_reward_winners
  for each row
  execute function set_event_reward_winners_updated_at();

drop trigger if exists admin_accounts_set_partnership_updated_at on admin_accounts;
create trigger admin_accounts_set_partnership_updated_at
  before update on admin_accounts
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists admin_permissions_set_partnership_updated_at on admin_permissions;
create trigger admin_permissions_set_partnership_updated_at
  before update on admin_permissions
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists admin_permission_templates_set_partnership_updated_at on admin_permission_templates;
create trigger admin_permission_templates_set_partnership_updated_at
  before update on admin_permission_templates
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_plan_upgrade_requests_set_updated_at on partner_plan_upgrade_requests;
create trigger partner_plan_upgrade_requests_set_updated_at
  before update on partner_plan_upgrade_requests
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_billing_profiles_set_updated_at on partner_billing_profiles;
create trigger partner_billing_profiles_set_updated_at
  before update on partner_billing_profiles
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_billing_invoices_set_updated_at on partner_billing_invoices;
create trigger partner_billing_invoices_set_updated_at
  before update on partner_billing_invoices
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_billing_payments_set_updated_at on partner_billing_payments;
create trigger partner_billing_payments_set_updated_at
  before update on partner_billing_payments
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_tax_documents_set_updated_at on partner_tax_documents;
create trigger partner_tax_documents_set_updated_at
  before update on partner_tax_documents
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists admin_notification_preferences_set_updated_at on admin_notification_preferences;
create trigger admin_notification_preferences_set_updated_at
  before update on admin_notification_preferences
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists admin_push_subscriptions_set_updated_at on admin_push_subscriptions;
create trigger admin_push_subscriptions_set_updated_at
  before update on admin_push_subscriptions
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists admin_notification_recipients_set_updated_at on admin_notification_recipients;
create trigger admin_notification_recipients_set_updated_at
  before update on admin_notification_recipients
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_notification_preferences_set_updated_at on partner_notification_preferences;
create trigger partner_notification_preferences_set_updated_at
  before update on partner_notification_preferences
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_push_subscriptions_set_updated_at on partner_push_subscriptions;
create trigger partner_push_subscriptions_set_updated_at
  before update on partner_push_subscriptions
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists partner_notification_recipients_set_updated_at on partner_notification_recipients;
create trigger partner_notification_recipients_set_updated_at
  before update on partner_notification_recipients
  for each row
  execute function set_partnership_updated_at();

create or replace function bump_admin_permission_version()
returns trigger
language plpgsql
as $$
begin
  update admin_accounts
     set permission_version = permission_version + 1,
         updated_at = now()
   where id = coalesce(new.admin_id, old.admin_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists admin_permissions_bump_permission_version on admin_permissions;
create trigger admin_permissions_bump_permission_version
  after insert or update or delete on admin_permissions
  for each row
  execute function bump_admin_permission_version();

create or replace function ensure_active_privileged_admin_exists()
returns trigger
language plpgsql
as $$
declare
  privileged_count integer;
begin
  select count(*)
    into privileged_count
    from admin_accounts account
    where account.is_active = true
      and exists (
        select 1
          from admin_permissions permission
         where permission.admin_id = account.id
           and permission.resource = 'admin_management'
           and permission.action = 'update'
           and permission.granted = true
      )
      and exists (
        select 1
          from admin_permissions permission
         where permission.admin_id = account.id
           and permission.resource = 'admin_management'
           and permission.action = 'delete'
           and permission.granted = true
      );

  if privileged_count < 1 then
    raise exception 'at least one active privileged admin account is required';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists admin_accounts_keep_privileged_admin on admin_accounts;
create trigger admin_accounts_keep_privileged_admin
  after update of is_active on admin_accounts
  for each row
  when (old.is_active is distinct from new.is_active)
  execute function ensure_active_privileged_admin_exists();

drop trigger if exists admin_permissions_keep_privileged_admin on admin_permissions;
create trigger admin_permissions_keep_privileged_admin
  after update or delete on admin_permissions
  for each row
  execute function ensure_active_privileged_admin_exists();

create or replace function ensure_single_member_super_admin()
returns trigger
language plpgsql
as $$
declare
  super_admin_count integer;
begin
  if new.admin_permission_id = 'super_admin' and new.mm_username <> 'myknow' then
    raise exception 'only myknow member can hold super_admin permission';
  end if;

  select count(*)
    into super_admin_count
    from members
   where admin_permission_id = 'super_admin';

  if super_admin_count > 1 then
    raise exception 'only one super_admin member is allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists members_keep_single_super_admin on members;
create trigger members_keep_single_super_admin
  after insert or update of admin_permission_id, mm_username on members
  for each row
  execute function ensure_single_member_super_admin();

create or replace function set_ad_campaigns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ad_campaigns_set_updated_at on ad_campaigns;
create trigger ad_campaigns_set_updated_at
  before update on ad_campaigns
  for each row
  execute function set_ad_campaigns_updated_at();

create or replace function set_ad_coupons_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ad_coupons_set_updated_at on ad_coupons;
create trigger ad_coupons_set_updated_at
  before update on ad_coupons
  for each row
  execute function set_ad_coupons_updated_at();

insert into admin_permission_templates (key, name, description, permissions)
values
  ('super_admin', 'Super Admin', '멤버 관리자 권한과 전체 운영 권한을 관리합니다.', '{"members":{"create":true,"read":true,"update":true,"delete":true},"reviews":{"create":true,"read":true,"update":true,"delete":true},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":true,"read":true,"update":true,"delete":true},"notifications":{"create":true,"read":true,"update":true,"delete":true},"home_ads":{"create":true,"read":true,"update":true,"delete":true},"events":{"create":true,"read":true,"update":true,"delete":true},"cycles":{"create":true,"read":true,"update":true,"delete":true},"admin_management":{"create":true,"read":true,"update":true,"delete":true}}'::jsonb),
  ('operations_manager', '운영 관리자', '회원, 협력사, 알림, 이벤트, 기수 운영을 담당합니다.', '{"members":{"create":true,"read":true,"update":true,"delete":true},"reviews":{"create":false,"read":true,"update":true,"delete":true},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":true,"read":true,"update":true,"delete":true},"notifications":{"create":true,"read":true,"update":true,"delete":true},"home_ads":{"create":true,"read":true,"update":true,"delete":true},"events":{"create":true,"read":true,"update":true,"delete":true},"cycles":{"create":false,"read":true,"update":true,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb),
  ('regional_partner_manager', '지역 제휴 관리자', '배정된 지역의 제휴처와 파트너사 운영을 담당합니다.', '{"members":{"create":false,"read":false,"update":false,"delete":false},"reviews":{"create":false,"read":true,"update":false,"delete":false},"logs":{"create":false,"read":false,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":false},"companies":{"create":true,"read":true,"update":true,"delete":false},"notifications":{"create":false,"read":false,"update":false,"delete":false},"home_ads":{"create":false,"read":false,"update":false,"delete":false},"events":{"create":false,"read":false,"update":false,"delete":false},"cycles":{"create":false,"read":false,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb),
  ('content_manager', '콘텐츠 관리자', '브랜드, 홈광고, 이벤트 노출 콘텐츠를 관리합니다.', '{"members":{"create":false,"read":false,"update":false,"delete":false},"reviews":{"create":false,"read":true,"update":true,"delete":false},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":false,"read":false,"update":false,"delete":false},"notifications":{"create":false,"read":false,"update":false,"delete":false},"home_ads":{"create":true,"read":true,"update":true,"delete":true},"events":{"create":true,"read":true,"update":true,"delete":true},"cycles":{"create":false,"read":false,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb),
  ('support', '고객지원', '회원과 리뷰 상태를 확인하고 필요한 조치를 수행합니다.', '{"members":{"create":false,"read":true,"update":true,"delete":false},"reviews":{"create":false,"read":true,"update":true,"delete":false},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":false,"read":true,"update":false,"delete":false},"companies":{"create":false,"read":true,"update":false,"delete":false},"notifications":{"create":false,"read":true,"update":false,"delete":false},"home_ads":{"create":false,"read":false,"update":false,"delete":false},"events":{"create":false,"read":true,"update":false,"delete":false},"cycles":{"create":false,"read":false,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb),
  ('readonly', '조회 전용', '운영 데이터를 조회만 할 수 있습니다.', '{"members":{"create":false,"read":true,"update":false,"delete":false},"reviews":{"create":false,"read":true,"update":false,"delete":false},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":false,"read":true,"update":false,"delete":false},"companies":{"create":false,"read":true,"update":false,"delete":false},"notifications":{"create":false,"read":true,"update":false,"delete":false},"home_ads":{"create":false,"read":true,"update":false,"delete":false},"events":{"create":false,"read":true,"update":false,"delete":false},"cycles":{"create":false,"read":true,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb)
on conflict (key) do update
   set name = excluded.name,
       description = excluded.description,
       permissions = excluded.permissions,
       updated_at = now();

update members
   set admin_permission_id = 'super_admin',
       updated_at = now()
 where mm_username = 'myknow'
   and admin_permission_id is distinct from 'super_admin';

alter table categories enable row level security;
alter table public_cache_versions enable row level security;
alter table partner_companies enable row level security;
alter table partner_brand_profiles enable row level security;
alter table partners enable row level security;
alter table partner_company_branches enable row level security;
alter table partner_offer_branches enable row level security;
alter table partner_accounts enable row level security;
alter table partner_account_companies enable row level security;
alter table partner_plan_upgrade_requests enable row level security;
alter table partner_brand_plan_events enable row level security;
alter table partner_billing_profiles enable row level security;
alter table partner_billing_invoices enable row level security;
alter table partner_billing_payments enable row level security;
alter table partner_tax_documents enable row level security;
alter table partner_auth_attempts enable row level security;
alter table admin_login_attempts enable row level security;
alter table suggestion_attempts enable row level security;
alter table partner_registration_attempts enable row level security;
alter table partner_registration_requests enable row level security;
alter table partner_registration_benefit_groups enable row level security;
alter table partner_registration_branches enable row level security;
alter table member_auth_attempts enable row level security;
alter table members enable row level security;
alter table policy_documents enable row level security;
alter table member_policy_consents enable row level security;
alter table mm_user_directory enable row level security;
alter table password_reset_attempts enable row level security;
alter table partner_change_requests enable row level security;
alter table partner_reviews enable row level security;
alter table partner_review_reactions enable row level security;
alter table partner_favorites enable row level security;
alter table push_preferences enable row level security;
alter table notifications enable row level security;
alter table member_notifications enable row level security;
alter table notification_deliveries enable row level security;
alter table push_subscriptions enable row level security;
alter table push_message_logs enable row level security;
alter table push_delivery_logs enable row level security;
alter table event_logs enable row level security;
alter table partner_metric_rollups enable row level security;
alter table partner_metric_unique_visitors enable row level security;
alter table ad_campaigns enable row level security;
alter table ad_coupons enable row level security;
alter table ad_coupon_redemptions enable row level security;
alter table promotion_events enable row level security;
alter table promotion_slides enable row level security;
alter table event_reward_draws enable row level security;
alter table event_reward_winners enable row level security;
alter table admin_accounts enable row level security;
alter table admin_permissions enable row level security;
alter table admin_permission_templates enable row level security;
alter table admin_notification_preferences enable row level security;
alter table admin_push_subscriptions enable row level security;
alter table admin_notifications enable row level security;
alter table admin_notification_recipients enable row level security;
alter table admin_notification_deliveries enable row level security;
alter table partner_notification_preferences enable row level security;
alter table partner_push_subscriptions enable row level security;
alter table partner_notifications enable row level security;
alter table partner_notification_recipients enable row level security;
alter table partner_notification_deliveries enable row level security;
alter table operational_notification_dedupes enable row level security;
alter table admin_audit_logs enable row level security;
alter table auth_security_logs enable row level security;

create policy "Public read categories" on categories
  for select
  using (true);

comment on column partners.company_id is 'Company grouping for partner portal; one company can own multiple service rows.';

drop policy if exists "Public read partners" on partners;
create policy "Public read partners" on partners
  for select
  using (visibility = 'public');

revoke all on table admin_login_attempts from anon;
revoke all on table admin_login_attempts from authenticated;
revoke all on table suggestion_attempts from anon;
revoke all on table suggestion_attempts from authenticated;
revoke all on table partner_registration_attempts from anon;
revoke all on table partner_registration_attempts from authenticated;
revoke all on table partner_registration_requests from anon;
revoke all on table partner_registration_requests from authenticated;
revoke all on table member_auth_attempts from anon;
revoke all on table member_auth_attempts from authenticated;
revoke all on table public_cache_versions from anon;
revoke all on table public_cache_versions from authenticated;
revoke all on table partner_companies from anon;
revoke all on table partner_companies from authenticated;
revoke all on table partner_brand_profiles from anon;
revoke all on table partner_brand_profiles from authenticated;
revoke all on table partner_company_branches from anon;
revoke all on table partner_company_branches from authenticated;
revoke all on table partner_offer_branches from anon;
revoke all on table partner_offer_branches from authenticated;
revoke all on table partner_accounts from anon;
revoke all on table partner_accounts from authenticated;
revoke all on table partner_account_companies from anon;
revoke all on table partner_account_companies from authenticated;
revoke all on table partner_plan_upgrade_requests from anon;
revoke all on table partner_plan_upgrade_requests from authenticated;
revoke all on table partner_brand_plan_events from anon;
revoke all on table partner_brand_plan_events from authenticated;
revoke all on table partner_billing_profiles from anon;
revoke all on table partner_billing_profiles from authenticated;
revoke all on table partner_billing_invoices from anon;
revoke all on table partner_billing_invoices from authenticated;
revoke all on table partner_billing_payments from anon;
revoke all on table partner_billing_payments from authenticated;
revoke all on table partner_tax_documents from anon;
revoke all on table partner_tax_documents from authenticated;
revoke all on table partner_auth_attempts from anon;
revoke all on table partner_auth_attempts from authenticated;
revoke all on table partner_change_requests from anon;
revoke all on table partner_change_requests from authenticated;
revoke all on table partner_registration_benefit_groups from anon;
revoke all on table partner_registration_benefit_groups from authenticated;
revoke all on table partner_registration_branches from anon;
revoke all on table partner_registration_branches from authenticated;
revoke all on table partner_reviews from anon;
revoke all on table partner_reviews from authenticated;
revoke all on table partner_review_reactions from anon;
revoke all on table partner_review_reactions from authenticated;
revoke all on table partner_favorites from anon;
revoke all on table partner_favorites from authenticated;
revoke all on table members from anon;
revoke all on table members from authenticated;
revoke all on table policy_documents from anon;
revoke all on table policy_documents from authenticated;
revoke all on table member_policy_consents from anon;
revoke all on table member_policy_consents from authenticated;
revoke all on table mm_user_directory from anon;
revoke all on table mm_user_directory from authenticated;
revoke all on table password_reset_attempts from anon;
revoke all on table password_reset_attempts from authenticated;
revoke all on table push_preferences from anon;
revoke all on table push_preferences from authenticated;
revoke all on table notifications from anon;
revoke all on table notifications from authenticated;
revoke all on table member_notifications from anon;
revoke all on table member_notifications from authenticated;
revoke all on table notification_deliveries from anon;
revoke all on table notification_deliveries from authenticated;
revoke all on table push_subscriptions from anon;
revoke all on table push_subscriptions from authenticated;
revoke all on table push_message_logs from anon;
revoke all on table push_message_logs from authenticated;
revoke all on table push_delivery_logs from anon;
revoke all on table push_delivery_logs from authenticated;
revoke all on table event_logs from anon;
revoke all on table event_logs from authenticated;
revoke all on table partner_metric_rollups from anon;
revoke all on table partner_metric_rollups from authenticated;
revoke all on table partner_metric_unique_visitors from anon;
revoke all on table partner_metric_unique_visitors from authenticated;
revoke all on table ad_campaigns from anon;
revoke all on table ad_campaigns from authenticated;
revoke all on table ad_coupons from anon;
revoke all on table ad_coupons from authenticated;
revoke all on table ad_coupon_redemptions from anon;
revoke all on table ad_coupon_redemptions from authenticated;
revoke all on table promotion_events from anon;
revoke all on table promotion_events from authenticated;
revoke all on table promotion_slides from anon;
revoke all on table promotion_slides from authenticated;
revoke all on table event_reward_draws from anon;
revoke all on table event_reward_draws from authenticated;
revoke all on table event_reward_winners from anon;
revoke all on table event_reward_winners from authenticated;
revoke all on table admin_accounts from anon;
revoke all on table admin_accounts from authenticated;
revoke all on table admin_permissions from anon;
revoke all on table admin_permissions from authenticated;
revoke all on table admin_permission_templates from anon;
revoke all on table admin_permission_templates from authenticated;
revoke all on table admin_notification_preferences from anon;
revoke all on table admin_notification_preferences from authenticated;
revoke all on table admin_push_subscriptions from anon;
revoke all on table admin_push_subscriptions from authenticated;
revoke all on table admin_notifications from anon;
revoke all on table admin_notifications from authenticated;
revoke all on table admin_notification_recipients from anon;
revoke all on table admin_notification_recipients from authenticated;
revoke all on table admin_notification_deliveries from anon;
revoke all on table admin_notification_deliveries from authenticated;
revoke all on table partner_notification_preferences from anon;
revoke all on table partner_notification_preferences from authenticated;
revoke all on table partner_push_subscriptions from anon;
revoke all on table partner_push_subscriptions from authenticated;
revoke all on table partner_notifications from anon;
revoke all on table partner_notifications from authenticated;
revoke all on table partner_notification_recipients from anon;
revoke all on table partner_notification_recipients from authenticated;
revoke all on table partner_notification_deliveries from anon;
revoke all on table partner_notification_deliveries from authenticated;
revoke all on table operational_notification_dedupes from anon;
revoke all on table operational_notification_dedupes from authenticated;
revoke all on table admin_audit_logs from anon;
revoke all on table admin_audit_logs from authenticated;
revoke all on table auth_security_logs from anon;
revoke all on table auth_security_logs from authenticated;

-- Graduate certificate and private profile-photo verification baseline.
alter table public.members
  alter column mm_user_id drop not null,
  alter column mm_username drop not null;

alter table public.members
  add column if not exists graduate_verified_at timestamp with time zone,
  add column if not exists graduate_completion_stage text,
  add column if not exists verification_source text,
  add column if not exists active_profile_image_id uuid;

alter table public.members
  drop constraint if exists members_graduate_completion_stage_check;
alter table public.members
  add constraint members_graduate_completion_stage_check
  check (
    graduate_completion_stage is null
    or graduate_completion_stage in ('semester_1', 'semester_2')
  );

alter table public.members
  drop constraint if exists members_verification_source_check;
alter table public.members
  add constraint members_verification_source_check
  check (
    verification_source is null
    or verification_source in ('ssafy_verify', 'graduate_certificate', 'legacy_mm')
  );

create table if not exists public.member_auth_identities (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references public.members(id) on delete cascade,
  provider text not null,
  identifier_normalized text not null,
  verified_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint member_auth_identities_provider_check
    check (provider in ('mattermost', 'graduate_email')),
  constraint member_auth_identities_identifier_nonempty_check
    check (char_length(btrim(identifier_normalized)) between 1 and 320),
  unique (provider, identifier_normalized)
);

create table if not exists public.graduate_verification_requests (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  email_normalized text not null,
  legal_name text not null,
  completion_stage text not null,
  education_start_year integer not null,
  education_start_month integer not null,
  education_end_year integer not null,
  education_end_month integer not null,
  inferred_cohort integer not null,
  cohort_rule_version text not null default 'ssafy-half-year-v1',
  campus text,
  certificate_storage_path text,
  certificate_sha256 text,
  document_number_hmac text,
  status text not null default 'draft',
  resubmission_targets text[] not null default '{}',
  reviewer_admin_id uuid references public.members(id) on delete set null,
  review_note text,
  rejection_reason text,
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  decided_at timestamp with time zone,
  certificate_delete_after timestamp with time zone,
  certificate_deleted_at timestamp with time zone,
  resubmission_email_sent_at timestamp with time zone,
  resubmission_email_last_error_at timestamp with time zone,
  setup_email_sent_at timestamp with time zone,
  setup_email_last_error_at timestamp with time zone,
  privacy_photo_consented_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint graduate_verification_requests_email_check
    check (email_normalized = lower(btrim(email))),
  constraint graduate_verification_requests_name_check
    check (char_length(btrim(legal_name)) between 1 and 100),
  constraint graduate_verification_requests_completion_stage_check
    check (completion_stage in ('semester_1', 'semester_2')),
  constraint graduate_verification_requests_start_month_check
    check (education_start_month between 1 and 12),
  constraint graduate_verification_requests_end_month_check
    check (education_end_month between 1 and 12),
  constraint graduate_verification_requests_period_check
    check (education_end_year * 12 + education_end_month >= education_start_year * 12 + education_start_month),
  constraint graduate_verification_requests_cohort_check
    check (inferred_cohort between 1 and 99),
  constraint graduate_verification_requests_status_check
    check (status in ('draft', 'submitted', 'in_review', 'needs_resubmission', 'approved', 'rejected', 'withdrawn')),
  constraint graduate_verification_requests_consent_check
    check (status = 'draft' or privacy_photo_consented_at is not null),
  constraint graduate_verification_requests_resubmission_targets_check
    check (resubmission_targets <@ array['education_period', 'certificate', 'profile_image']::text[])
);

create unique index if not exists graduate_verification_requests_open_email_idx
  on public.graduate_verification_requests(email_normalized)
  where status in ('draft', 'submitted', 'in_review', 'needs_resubmission');
create unique index if not exists graduate_verification_requests_document_number_hmac_idx
  on public.graduate_verification_requests(document_number_hmac)
  where document_number_hmac is not null and status = 'approved';
create unique index if not exists graduate_verification_requests_active_certificate_sha256_idx
  on public.graduate_verification_requests(certificate_sha256)
  where certificate_sha256 is not null
    and status in ('submitted', 'in_review', 'needs_resubmission', 'approved');
create index if not exists graduate_verification_requests_status_created_at_idx
  on public.graduate_verification_requests(status, created_at desc);

create table if not exists public.member_profile_images (
  id uuid primary key default uuid_generate_v4(),
  graduate_verification_request_id uuid references public.graduate_verification_requests(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  storage_path text not null unique,
  sha256 text not null,
  content_type text not null default 'image/webp',
  width integer not null default 640,
  height integer not null default 640,
  status text not null default 'pending',
  reviewer_admin_id uuid references public.members(id) on delete set null,
  review_reason text,
  reviewed_at timestamp with time zone,
  delete_after timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint member_profile_images_owner_check
    check (graduate_verification_request_id is not null or member_id is not null),
  constraint member_profile_images_content_type_check check (content_type = 'image/webp'),
  constraint member_profile_images_dimensions_check check (width = 640 and height = 640),
  constraint member_profile_images_status_check
    check (status in ('pending', 'approved', 'rejected', 'superseded'))
);

alter table public.graduate_verification_requests
  add column if not exists profile_image_id uuid references public.member_profile_images(id) on delete set null;
alter table public.members
  drop constraint if exists members_active_profile_image_id_fkey;
alter table public.members
  add constraint members_active_profile_image_id_fkey
  foreign key (active_profile_image_id) references public.member_profile_images(id) on delete set null;

create index if not exists member_profile_images_request_status_idx
  on public.member_profile_images(graduate_verification_request_id, status, created_at desc);
create index if not exists member_profile_images_member_status_idx
  on public.member_profile_images(member_id, status, created_at desc);

create table if not exists public.graduate_email_challenges (
  id uuid primary key default uuid_generate_v4(),
  email_normalized text not null,
  purpose text not null,
  code_hash text not null,
  request_id uuid references public.graduate_verification_requests(id) on delete cascade,
  expires_at timestamp with time zone not null,
  verified_at timestamp with time zone,
  consumed_at timestamp with time zone,
  attempt_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint graduate_email_challenges_purpose_check
    check (purpose in ('application', 'account_setup', 'password_reset')),
  constraint graduate_email_challenges_attempt_count_check
    check (attempt_count between 0 and 10)
);
create index if not exists graduate_email_challenges_lookup_idx
  on public.graduate_email_challenges(email_normalized, purpose, expires_at desc);

create table if not exists public.graduate_verification_uploads (
  id uuid primary key default uuid_generate_v4(),
  challenge_id uuid references public.graduate_email_challenges(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  kind text not null,
  storage_bucket text not null,
  storage_path text not null unique,
  content_type text not null,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint graduate_verification_uploads_kind_check
    check (kind in ('certificate', 'profile_image')),
  constraint graduate_verification_uploads_bucket_check
    check (storage_bucket in ('graduate-certificates', 'member-profile-images')),
  constraint graduate_verification_uploads_content_type_check
    check ((kind = 'certificate' and content_type = 'application/pdf') or (kind = 'profile_image' and content_type in ('image/jpeg', 'image/png', 'image/webp'))),
  constraint graduate_verification_uploads_owner_check
    check (challenge_id is not null or member_id is not null)
);
create index if not exists graduate_verification_uploads_challenge_idx
  on public.graduate_verification_uploads(challenge_id, kind, expires_at desc);
create index if not exists graduate_verification_uploads_member_idx
  on public.graduate_verification_uploads(member_id, kind, expires_at desc);

create table if not exists public.member_password_action_tokens (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references public.members(id) on delete cascade,
  purpose text not null,
  token_hash text not null unique,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint member_password_action_tokens_purpose_check
    check (purpose in ('graduate_initial_setup', 'graduate_password_reset'))
);
create unique index if not exists member_password_action_tokens_active_member_purpose_idx
  on public.member_password_action_tokens(member_id, purpose)
  where consumed_at is null;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'graduate-certificates',
    'graduate-certificates',
    false,
    10485760,
    array['application/pdf']
  ),
  (
    'member-profile-images',
    'member-profile-images',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.member_auth_identities enable row level security;
alter table public.graduate_verification_requests enable row level security;
alter table public.member_profile_images enable row level security;
alter table public.graduate_email_challenges enable row level security;
alter table public.graduate_verification_uploads enable row level security;
alter table public.member_password_action_tokens enable row level security;

revoke all on table public.member_auth_identities from anon;
revoke all on table public.member_auth_identities from authenticated;
revoke all on table public.graduate_verification_requests from anon;
revoke all on table public.graduate_verification_requests from authenticated;
revoke all on table public.member_profile_images from anon;
revoke all on table public.member_profile_images from authenticated;
revoke all on table public.graduate_email_challenges from anon;
revoke all on table public.graduate_email_challenges from authenticated;
revoke all on table public.graduate_verification_uploads from anon;
revoke all on table public.graduate_verification_uploads from authenticated;
revoke all on table public.member_password_action_tokens from anon;
revoke all on table public.member_password_action_tokens from authenticated;

drop trigger if exists member_auth_identities_set_partnership_updated_at on public.member_auth_identities;
create trigger member_auth_identities_set_partnership_updated_at
  before update on public.member_auth_identities
  for each row execute function public.set_partnership_updated_at();
drop trigger if exists graduate_verification_requests_set_partnership_updated_at on public.graduate_verification_requests;
create trigger graduate_verification_requests_set_partnership_updated_at
  before update on public.graduate_verification_requests
  for each row execute function public.set_partnership_updated_at();

create or replace function public.enforce_graduate_verification_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;
  if not (
    (old.status = 'draft' and new.status in ('submitted', 'withdrawn'))
    or (old.status = 'submitted' and new.status in ('in_review', 'withdrawn'))
    or (old.status = 'in_review' and new.status in ('needs_resubmission', 'approved', 'rejected'))
    or (old.status = 'needs_resubmission' and new.status in ('submitted', 'withdrawn'))
  ) then
    raise exception 'invalid_graduate_verification_status_transition';
  end if;
  return new;
end;
$$;
drop trigger if exists graduate_verification_requests_status_transition on public.graduate_verification_requests;
create trigger graduate_verification_requests_status_transition
  before update on public.graduate_verification_requests
  for each row execute function public.enforce_graduate_verification_status_transition();

drop trigger if exists member_profile_images_set_partnership_updated_at on public.member_profile_images;
create trigger member_profile_images_set_partnership_updated_at
  before update on public.member_profile_images
  for each row execute function public.set_partnership_updated_at();

create or replace function public.enforce_member_profile_image_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;
  if not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'superseded'))
    or (old.status = 'approved' and new.status = 'superseded')
  ) then
    raise exception 'invalid_member_profile_image_status_transition';
  end if;
  return new;
end;
$$;
drop trigger if exists member_profile_images_status_transition on public.member_profile_images;
create trigger member_profile_images_status_transition
  before update on public.member_profile_images
  for each row execute function public.enforce_member_profile_image_status_transition();

alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;
alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'members', 'reviews', 'logs', 'brands', 'companies', 'notifications',
    'home_ads', 'events', 'cycles', 'admin_management', 'graduate_verifications'
  ));

update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{graduate_verifications}',
  '{"create":false,"read":true,"update":true,"delete":false}'::jsonb,
  true
), updated_at = now()
where key in ('super_admin', 'operations_manager', 'support');
update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{graduate_verifications}',
  '{"create":false,"read":true,"update":false,"delete":false}'::jsonb,
  true
), updated_at = now()
where key = 'readonly';

create or replace function public.approve_graduate_verification(
  p_request_id uuid,
  p_admin_id uuid,
  p_document_number_hmac text,
  p_setup_token_hash text,
  p_setup_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_row public.graduate_verification_requests%rowtype;
  photo_row public.member_profile_images%rowtype;
  new_member_id uuid;
begin
  select * into request_row from public.graduate_verification_requests where id = p_request_id for update;
  if not found or request_row.status <> 'in_review' then
    raise exception 'graduate_verification_not_reviewable';
  end if;
  if request_row.profile_image_id is null then
    raise exception 'graduate_verification_profile_image_missing';
  end if;
  select * into photo_row from public.member_profile_images where id = request_row.profile_image_id for update;
  if not found or photo_row.status <> 'pending' then
    raise exception 'graduate_verification_profile_image_not_pending';
  end if;
  if exists (select 1 from public.member_auth_identities where provider = 'graduate_email' and identifier_normalized = request_row.email_normalized) then
    raise exception 'graduate_verification_email_exists';
  end if;
  if exists (select 1 from public.graduate_verification_requests where document_number_hmac = p_document_number_hmac and id <> p_request_id and status = 'approved') then
    raise exception 'graduate_verification_document_exists';
  end if;

  insert into public.members (
    mm_user_id, mm_username, display_name, year, campus, must_change_password,
    graduate_verified_at, graduate_completion_stage, verification_source
  ) values (
    null, null, request_row.legal_name, request_row.inferred_cohort, request_row.campus, true,
    now(), request_row.completion_stage, 'graduate_certificate'
  ) returning id into new_member_id;

  insert into public.member_auth_identities (member_id, provider, identifier_normalized, verified_at)
  values (new_member_id, 'graduate_email', request_row.email_normalized, now());
  update public.member_profile_images
    set member_id = new_member_id, status = 'approved', reviewer_admin_id = p_admin_id, reviewed_at = now(), updated_at = now()
    where id = photo_row.id;
  update public.members set active_profile_image_id = photo_row.id, updated_at = now() where id = new_member_id;
  update public.graduate_verification_requests
    set status = 'approved', document_number_hmac = p_document_number_hmac,
        reviewer_admin_id = p_admin_id, reviewed_at = now(), decided_at = now(),
        certificate_delete_after = now() + interval '30 days', resubmission_targets = '{}', updated_at = now()
    where id = p_request_id;
  insert into public.member_password_action_tokens (member_id, purpose, token_hash, expires_at)
  values (new_member_id, 'graduate_initial_setup', p_setup_token_hash, p_setup_expires_at);
  return new_member_id;
end;
$$;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from public;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from anon;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from authenticated;
grant execute on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) to service_role;

create or replace function public.complete_graduate_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare token_row public.member_password_action_tokens%rowtype;
begin
  select * into token_row from public.member_password_action_tokens
    where token_hash = p_token_hash
      and purpose in ('graduate_initial_setup', 'graduate_password_reset')
      and consumed_at is null and expires_at > now()
    for update;
  if not found then raise exception 'graduate_password_action_invalid'; end if;
  update public.members set password_hash = p_password_hash, password_salt = p_password_salt, must_change_password = false, updated_at = now()
    where id = token_row.member_id;
  update public.member_password_action_tokens set consumed_at = now() where id = token_row.id;
  return token_row.member_id;
end;
$$;
revoke all on function public.complete_graduate_password_action(text, text, text) from public;
revoke all on function public.complete_graduate_password_action(text, text, text) from anon;
revoke all on function public.complete_graduate_password_action(text, text, text) from authenticated;
grant execute on function public.complete_graduate_password_action(text, text, text) to service_role;

create or replace function public.reissue_graduate_initial_setup(
  p_request_id uuid,
  p_setup_token_hash text,
  p_setup_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_row public.graduate_verification_requests%rowtype;
  identity_row public.member_auth_identities%rowtype;
  member_row public.members%rowtype;
begin
  select * into request_row
    from public.graduate_verification_requests
   where id = p_request_id and status = 'approved'
   for update;
  if not found then
    raise exception 'graduate_initial_setup_request_invalid';
  end if;

  select * into identity_row
    from public.member_auth_identities
   where provider = 'graduate_email'
     and identifier_normalized = request_row.email_normalized
   for update;
  if not found then
    raise exception 'graduate_initial_setup_identity_missing';
  end if;

  select * into member_row
    from public.members
   where id = identity_row.member_id and must_change_password = true
   for update;
  if not found then
    raise exception 'graduate_initial_setup_already_completed';
  end if;

  update public.member_password_action_tokens
     set consumed_at = now()
   where member_id = member_row.id
     and purpose = 'graduate_initial_setup'
     and consumed_at is null;

  insert into public.member_password_action_tokens (member_id, purpose, token_hash, expires_at)
  values (member_row.id, 'graduate_initial_setup', p_setup_token_hash, p_setup_expires_at);
  return member_row.id;
end;
$$;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from public;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from anon;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) to service_role;

create or replace function public.issue_graduate_password_reset(
  p_challenge_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  challenge_row public.graduate_email_challenges%rowtype;
  identity_row public.member_auth_identities%rowtype;
  member_row public.members%rowtype;
begin
  select * into challenge_row from public.graduate_email_challenges
    where id = p_challenge_id and purpose = 'password_reset' and verified_at is not null
      and consumed_at is null and expires_at > now()
    for update;
  if not found then raise exception 'graduate_password_reset_challenge_invalid'; end if;
  select * into identity_row from public.member_auth_identities
    where provider = 'graduate_email' and identifier_normalized = challenge_row.email_normalized
    for update;
  if not found then
    update public.graduate_email_challenges set consumed_at = now() where id = challenge_row.id;
    return null;
  end if;
  select * into member_row from public.members
    where id = identity_row.member_id and graduate_verified_at is not null
    for update;
  if not found then
    update public.graduate_email_challenges set consumed_at = now() where id = challenge_row.id;
    return null;
  end if;
  update public.member_password_action_tokens
    set consumed_at = now()
    where member_id = member_row.id and purpose = 'graduate_password_reset' and consumed_at is null;
  insert into public.member_password_action_tokens (member_id, purpose, token_hash, expires_at)
  values (member_row.id, 'graduate_password_reset', p_token_hash, p_expires_at);
  update public.graduate_email_challenges set consumed_at = now() where id = challenge_row.id;
  return member_row.id;
end;
$$;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from public;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from anon;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) to service_role;

create or replace function public.approve_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
begin
  select * into image_row from public.member_profile_images
    where id = p_image_id and member_id is not null and status = 'pending'
    for update;
  if not found then raise exception 'profile_image_not_reviewable'; end if;
  select * into member_row from public.members where id = image_row.member_id for update;
  if not found then raise exception 'profile_image_member_missing'; end if;
  if member_row.active_profile_image_id is not null then
    update public.member_profile_images
      set status = 'superseded', delete_after = now() + interval '30 days', updated_at = now()
      where id = member_row.active_profile_image_id;
  end if;
  update public.member_profile_images
    set status = 'approved', reviewer_admin_id = p_admin_id, reviewed_at = now(), updated_at = now()
    where id = image_row.id;
  update public.members set active_profile_image_id = image_row.id, updated_at = now() where id = member_row.id;
  return member_row.id;
end;
$$;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from public;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from anon;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from authenticated;
grant execute on function public.approve_member_profile_image_replacement(uuid, uuid) to service_role;

-- Common profile-photo review applies to Mattermost-backed and graduate members.
alter table public.members
  add column if not exists profile_photo_review_status text not null default 'approved';
update public.members
set profile_photo_review_status = 'approved'
where profile_photo_review_status is null;
alter table public.members
  drop constraint if exists members_profile_photo_review_status_check;
alter table public.members
  add constraint members_profile_photo_review_status_check
  check (profile_photo_review_status in ('approved', 'pending', 'rejected'));

create or replace function public.enforce_member_profile_image_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = new.status then return new; end if;
  if not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'superseded'))
    or (old.status = 'approved' and new.status in ('superseded', 'rejected'))
  ) then
    raise exception 'invalid_member_profile_image_status_transition';
  end if;
  return new;
end;
$$;

alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;
alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'members', 'reviews', 'logs', 'brands', 'companies', 'notifications',
    'home_ads', 'events', 'cycles', 'admin_management', 'graduate_verifications',
    'profile_images'
  ));
update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{profile_images}',
  '{"create":false,"read":true,"update":true,"delete":false}'::jsonb,
  true
), updated_at = now()
where key in ('super_admin', 'operations_manager', 'support');
update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{profile_images}',
  '{"create":false,"read":true,"update":false,"delete":false}'::jsonb,
  true
)
where key = 'readonly';

create or replace function public.approve_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
begin
  select * into image_row from public.member_profile_images
    where id = p_image_id and graduate_verification_request_id is null
      and member_id is not null and status = 'pending' for update;
  if not found then raise exception 'profile_image_not_reviewable'; end if;
  select * into member_row from public.members where id = image_row.member_id for update;
  if not found then raise exception 'profile_image_member_missing'; end if;
  if member_row.active_profile_image_id is not null then
    update public.member_profile_images
      set status = 'superseded', delete_after = now() + interval '30 days', updated_at = now()
      where id = member_row.active_profile_image_id;
  end if;
  update public.member_profile_images
    set status = 'approved', reviewer_admin_id = p_admin_id, review_reason = null,
      reviewed_at = now(), updated_at = now()
    where id = image_row.id;
  update public.members
    set active_profile_image_id = image_row.id, profile_photo_review_status = 'approved', updated_at = now()
    where id = member_row.id;
  return member_row.id;
end;
$$;

create or replace function public.reject_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;
  select * into image_row from public.member_profile_images
    where id = p_image_id and graduate_verification_request_id is null
      and member_id is not null and status = 'pending' for update;
  if not found then raise exception 'profile_image_not_reviewable'; end if;
  select * into member_row from public.members where id = image_row.member_id for update;
  if not found then raise exception 'profile_image_member_missing'; end if;
  update public.member_profile_images
    set status = 'rejected', reviewer_admin_id = p_admin_id,
      review_reason = btrim(p_reason), reviewed_at = now(),
      delete_after = now() + interval '30 days', updated_at = now()
    where id = image_row.id;
  update public.members
    set profile_photo_review_status = 'rejected', updated_at = now()
    where id = member_row.id;
  return member_row.id;
end;
$$;

create or replace function public.reject_member_active_profile_photo(
  p_member_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare member_row public.members%rowtype;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;
  select * into member_row from public.members where id = p_member_id for update;
  if not found then raise exception 'profile_image_member_missing'; end if;
  if member_row.active_profile_image_id is not null then
    update public.member_profile_images
      set status = 'rejected', reviewer_admin_id = p_admin_id,
        review_reason = btrim(p_reason), reviewed_at = now(),
        delete_after = now() + interval '30 days', updated_at = now()
      where id = member_row.active_profile_image_id and status = 'approved';
  end if;
  update public.members
    set active_profile_image_id = null, profile_photo_review_status = 'rejected', updated_at = now()
    where id = member_row.id;
  return member_row.id;
end;
$$;

revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from public;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from anon;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_profile_image_replacement(uuid, uuid, text) to service_role;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from public;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from anon;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_active_profile_photo(uuid, uuid, text) to service_role;

alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_actor_type_check;
alter table public.admin_audit_logs
  add constraint admin_audit_logs_actor_type_check
  check (actor_type is null or actor_type in ('admin', 'partner', 'member', 'system'));
create index if not exists admin_audit_logs_request_id_created_at_idx
  on public.admin_audit_logs(request_id, created_at desc)
  where request_id is not null;
create index if not exists admin_audit_logs_actor_type_actor_id_created_at_idx
  on public.admin_audit_logs(actor_type, actor_id, created_at desc);

create or replace function public.resolve_partner_change_request_with_audit(
  p_change_request_id uuid, p_admin_id text, p_decision text,
  p_actor_type text, p_actor_id text, p_request_id text, p_path text,
  p_user_agent text, p_ip_address text, p_properties jsonb
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare request_row public.partner_change_requests%rowtype; partner_row public.partners%rowtype; audit_action text;
begin
  if p_decision not in ('approved', 'rejected') then raise exception 'partner_change_request_invalid_decision'; end if;
  if p_actor_type <> 'admin' or nullif(btrim(coalesce(p_actor_id, '')), '') is null or p_actor_id <> p_admin_id then raise exception 'partner_change_request_invalid_audit_principal'; end if;
  if nullif(btrim(coalesce(p_request_id, '')), '') is null then raise exception 'partner_change_request_missing_request_context'; end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then raise exception 'partner_change_request_invalid_audit_properties'; end if;
  select * into request_row from public.partner_change_requests where id = p_change_request_id for update;
  if not found then raise exception 'partner_change_request_not_found'; end if;
  if request_row.status <> 'pending' then raise exception 'partner_change_request_not_pending'; end if;
  select * into partner_row from public.partners where id = request_row.partner_id for update;
  if not found then raise exception 'partner_change_request_partner_not_found'; end if;
  if p_decision = 'approved' then
    if request_row.current_partner_name is distinct from partner_row.name
      or request_row.current_partner_location is distinct from partner_row.location
      or request_row.current_detail_description is distinct from partner_row.detail_description
      or request_row.current_map_url is distinct from partner_row.map_url
      or request_row.current_campus_slugs is distinct from partner_row.campus_slugs
      or request_row.current_conditions is distinct from partner_row.conditions
      or request_row.current_benefits is distinct from partner_row.benefits
      or request_row.current_applies_to is distinct from partner_row.applies_to
      or request_row.current_tags is distinct from partner_row.tags
      or request_row.current_thumbnail is distinct from partner_row.thumbnail
      or request_row.current_images is distinct from partner_row.images
      or request_row.current_reservation_link is distinct from partner_row.reservation_link
      or request_row.current_inquiry_link is distinct from partner_row.inquiry_link
      or request_row.current_period_start is distinct from partner_row.period_start
      or request_row.current_period_end is distinct from partner_row.period_end then raise exception 'partner_change_request_stale'; end if;
    update public.partners set
      name = request_row.requested_partner_name, location = request_row.requested_partner_location,
      detail_description = request_row.requested_detail_description, campus_slugs = request_row.requested_campus_slugs,
      map_url = request_row.requested_map_url, conditions = request_row.requested_conditions,
      benefits = request_row.requested_benefits, applies_to = request_row.requested_applies_to,
      tags = request_row.requested_tags, thumbnail = request_row.requested_thumbnail,
      images = request_row.requested_images, reservation_link = request_row.requested_reservation_link,
      inquiry_link = request_row.requested_inquiry_link, period_start = request_row.requested_period_start,
      period_end = request_row.requested_period_end, updated_at = now()
    where id = request_row.partner_id;
  end if;
  update public.partner_change_requests set status = p_decision, reviewed_by_admin_id = p_admin_id, reviewed_at = now(), updated_at = now() where id = request_row.id;
  audit_action := case p_decision when 'approved' then 'partner_change_request_approve' else 'partner_change_request_reject' end;
  insert into public.admin_audit_logs (request_id, actor_type, actor_id, action, path, target_type, target_id, properties, user_agent, ip_address)
  values (p_request_id, p_actor_type, p_actor_id, audit_action, p_path, 'partner', request_row.partner_id::text, coalesce(p_properties, '{}'::jsonb), p_user_agent, p_ip_address);
  return request_row.partner_id;
end;
$$;

create or replace function public.update_partner_immediate_fields_with_audit(
  p_partner_id uuid, p_company_ids uuid[], p_thumbnail text, p_images text[],
  p_tags text[], p_benefit_action_type text, p_benefit_action_link text,
  p_reservation_link text, p_inquiry_link text, p_actor_type text, p_actor_id text,
  p_request_id text, p_path text, p_user_agent text, p_ip_address text, p_properties jsonb
)
returns table (company_id uuid, previous_thumbnail text, previous_images text[])
language plpgsql security invoker set search_path = public as $$
declare partner_row public.partners%rowtype;
begin
  if p_actor_type <> 'partner' or nullif(btrim(coalesce(p_actor_id, '')), '') is null then raise exception 'partner_immediate_update_invalid_audit_principal'; end if;
  if nullif(btrim(coalesce(p_request_id, '')), '') is null then raise exception 'partner_immediate_update_missing_request_context'; end if;
  if coalesce(array_length(p_company_ids, 1), 0) = 0 then raise exception 'partner_immediate_update_missing_company_scope'; end if;
  if p_benefit_action_type not in ('certification', 'external_link', 'onsite', 'none') then raise exception 'partner_immediate_update_invalid_benefit_action_type'; end if;
  if p_benefit_action_type = 'external_link' and nullif(btrim(coalesce(p_benefit_action_link, '')), '') is null then raise exception 'partner_immediate_update_missing_benefit_action_link'; end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then raise exception 'partner_immediate_update_invalid_audit_properties'; end if;
  select * into partner_row from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_immediate_update_partner_not_found'; end if;
  if partner_row.company_id is null or not (partner_row.company_id = any(p_company_ids)) or not exists (
    select 1 from public.partner_account_companies access
    where access.account_id::text = p_actor_id and access.company_id = partner_row.company_id and access.is_active = true
  ) then raise exception 'partner_immediate_update_forbidden'; end if;
  if partner_row.thumbnail is not distinct from p_thumbnail and partner_row.images is not distinct from coalesce(p_images, '{}'::text[])
    and partner_row.tags is not distinct from coalesce(p_tags, '{}'::text[]) and partner_row.benefit_action_type is not distinct from p_benefit_action_type
    and partner_row.benefit_action_link is not distinct from p_benefit_action_link and partner_row.reservation_link is not distinct from p_reservation_link
    and partner_row.inquiry_link is not distinct from p_inquiry_link then raise exception 'partner_immediate_update_no_changes'; end if;
  update public.partners set thumbnail = p_thumbnail, images = coalesce(p_images, '{}'::text[]), tags = coalesce(p_tags, '{}'::text[]),
    benefit_action_type = p_benefit_action_type, benefit_action_link = p_benefit_action_link,
    reservation_link = p_reservation_link, inquiry_link = p_inquiry_link, updated_at = now()
  where id = partner_row.id;
  insert into public.admin_audit_logs (request_id, actor_type, actor_id, action, path, target_type, target_id, properties, user_agent, ip_address)
  values (p_request_id, p_actor_type, p_actor_id, 'partner_portal_immediate_update', p_path, 'partner', partner_row.id::text, coalesce(p_properties, '{}'::jsonb), p_user_agent, p_ip_address);
  return query select partner_row.company_id, partner_row.thumbnail, partner_row.images;
end;
$$;

revoke all on function public.resolve_partner_change_request_with_audit(uuid, text, text, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.resolve_partner_change_request_with_audit(uuid, text, text, text, text, text, text, text, text, jsonb) from anon;
revoke all on function public.resolve_partner_change_request_with_audit(uuid, text, text, text, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.resolve_partner_change_request_with_audit(uuid, text, text, text, text, text, text, text, text, jsonb) to service_role;
revoke all on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, text, text, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, text, text, text, text, text, text, text, text, jsonb) from anon;
revoke all on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, text, text, text, text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.update_partner_immediate_fields_with_audit(uuid, uuid[], text, text[], text[], text, text, text, text, text, text, text, text, text, text, jsonb) to service_role;

-- 20260715004318_add_manual_member_reissue_setup_guard.sql
create or replace function public.reissue_manual_member_initial_setup(
  p_member_id uuid,
  p_delivery_channel text,
  p_token_hash text,
  p_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
begin
  if p_delivery_channel not in ('mattermost', 'email') then
    raise exception 'manual_member_reissue_delivery_channel_invalid';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'manual_member_reissue_token_hash_invalid';
  end if;
  if p_expires_at <= now() then
    raise exception 'manual_member_reissue_expiry_invalid';
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
    and must_change_password = true
  for update;
  if not found then
    raise exception 'manual_member_reissue_not_required';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = member_row.id
    and purpose = 'manual_initial_setup'
    and consumed_at is null;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    delivery_channel,
    token_hash,
    expires_at
  ) values (
    member_row.id,
    'manual_initial_setup',
    p_delivery_channel,
    p_token_hash,
    p_expires_at
  );

  return member_row.id;
end;
$$;

revoke all on function public.reissue_manual_member_initial_setup(uuid, text, text, timestamp with time zone) from public;
revoke all on function public.reissue_manual_member_initial_setup(uuid, text, text, timestamp with time zone) from anon;
revoke all on function public.reissue_manual_member_initial_setup(uuid, text, text, timestamp with time zone) from authenticated;
grant execute on function public.reissue_manual_member_initial_setup(uuid, text, text, timestamp with time zone) to service_role;

-- 20260714234606_add_member_email_login_transition.sql
-- Preserve the canonical Mattermost relation for history, but allow an
-- operator-approved transition to an email credential when MM access ends.
alter table public.members
  add column if not exists auth_session_version integer not null default 1,
  add column if not exists mattermost_login_disabled_at timestamp with time zone,
  add column if not exists mattermost_login_disabled_reason text;

alter table public.members
  drop constraint if exists members_auth_session_version_check;
alter table public.members
  add constraint members_auth_session_version_check
  check (auth_session_version >= 1);

alter table public.members
  drop constraint if exists members_mattermost_login_disabled_reason_check;
alter table public.members
  add constraint members_mattermost_login_disabled_reason_check
  check (
    mattermost_login_disabled_reason is null
    or mattermost_login_disabled_reason in (
      'generation_completed',
      'member_departed',
      'provider_not_found'
    )
  );

alter table public.members
  drop constraint if exists members_mattermost_login_disabled_state_check;
alter table public.members
  add constraint members_mattermost_login_disabled_state_check
  check (
    (mattermost_login_disabled_at is null and mattermost_login_disabled_reason is null)
    or (mattermost_login_disabled_at is not null and mattermost_login_disabled_reason is not null)
  );

alter table public.member_password_action_tokens
  drop constraint if exists member_password_action_tokens_purpose_check;
alter table public.member_password_action_tokens
  add constraint member_password_action_tokens_purpose_check
  check (
    purpose in (
      'graduate_initial_setup',
      'graduate_password_reset',
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
  );

create table if not exists public.member_email_login_transitions (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  candidate_email text not null,
  candidate_email_normalized text not null,
  candidate_email_reservation_hash text not null,
  reason text not null,
  status text not null default 'pending_delivery',
  initiated_by_admin_id uuid not null references public.members(id) on delete restrict,
  password_action_token_id uuid unique references public.member_password_action_tokens(id) on delete set null,
  email_sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint member_email_login_transitions_email_check
    check (candidate_email_normalized = lower(btrim(candidate_email))),
  constraint member_email_login_transitions_email_reservation_hash_check
    check (candidate_email_reservation_hash ~ '^[0-9a-f]{64}$'),
  constraint member_email_login_transitions_reason_check
    check (reason in ('generation_completed', 'member_departed', 'provider_not_found')),
  constraint member_email_login_transitions_status_check
    check (status in ('pending_delivery', 'email_sent', 'completed', 'cancelled')),
  constraint member_email_login_transitions_completion_check
    check (
      (status = 'completed' and completed_at is not null)
      or (status <> 'completed' and completed_at is null)
    )
);

create index if not exists member_email_login_transitions_pending_idx
  on public.member_email_login_transitions(status, updated_at desc)
  where status in ('pending_delivery', 'email_sent');

-- Keep an email claimed through completion as well.  If this only covered
-- pending rows, a concurrent new transition could wait for a completion,
-- then send a setup link for an email the completed transition now owns.
create unique index if not exists member_email_login_transitions_email_unique
  on public.member_email_login_transitions(candidate_email_normalized)
  where status <> 'cancelled';

alter table public.member_email_login_transitions enable row level security;
revoke all on table public.member_email_login_transitions from anon;
revoke all on table public.member_email_login_transitions from authenticated;

drop trigger if exists member_email_login_transitions_set_partnership_updated_at on public.member_email_login_transitions;
create trigger member_email_login_transitions_set_partnership_updated_at
  before update on public.member_email_login_transitions
  for each row execute function public.set_partnership_updated_at();

create or replace function public.disable_member_mattermost_login(
  p_member_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
begin
  if p_reason not in ('generation_completed', 'member_departed', 'provider_not_found') then
    raise exception 'mattermost_login_disable_reason_invalid';
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'mattermost_login_disable_member_missing';
  end if;
  if member_row.mattermost_account_id is null then
    raise exception 'mattermost_login_disable_member_not_linked';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = p_member_id
    and delivery_channel = 'mattermost'
    and consumed_at is null;

  if member_row.mattermost_login_disabled_at is null then
    update public.members
    set mattermost_login_disabled_at = now(),
        mattermost_login_disabled_reason = p_reason,
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where id = p_member_id;
  end if;

  return p_member_id;
end;
$$;

revoke all on function public.disable_member_mattermost_login(uuid, text) from public;
revoke all on function public.disable_member_mattermost_login(uuid, text) from anon;
revoke all on function public.disable_member_mattermost_login(uuid, text) from authenticated;
grant execute on function public.disable_member_mattermost_login(uuid, text) to service_role;

create table if not exists public.member_mattermost_disabled_generations (
  generation integer primary key,
  disabled_at timestamp with time zone not null default now(),
  constraint member_mattermost_disabled_generations_generation_check
    check (generation between 1 and 99)
);

alter table public.member_mattermost_disabled_generations enable row level security;
revoke all on table public.member_mattermost_disabled_generations from anon;
revoke all on table public.member_mattermost_disabled_generations from authenticated;

create or replace function public.enforce_completed_generation_mattermost_login_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generation_is_disabled boolean;
begin
  if new.generation is null
    or new.mattermost_account_id is null
    or new.mattermost_login_disabled_at is not null then
    return new;
  end if;

  -- Serialize with disable_generation_mattermost_logins so an in-flight
  -- member insert cannot slip through a completed generation.
  perform pg_advisory_xact_lock(741515, new.generation);

  select exists (
    select 1
    from public.member_mattermost_disabled_generations
    where generation = new.generation
  ) into generation_is_disabled;
  if not generation_is_disabled then
    return new;
  end if;

  new.mattermost_login_disabled_at := now();
  new.mattermost_login_disabled_reason := 'generation_completed';
  if tg_op = 'UPDATE' then
    new.auth_session_version := greatest(
      coalesce(new.auth_session_version, 1),
      coalesce(old.auth_session_version, 1) + 1
    );
  else
    new.auth_session_version := greatest(coalesce(new.auth_session_version, 1), 1);
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_completed_generation_mattermost_login_block() from public;
revoke all on function public.enforce_completed_generation_mattermost_login_block() from anon;
revoke all on function public.enforce_completed_generation_mattermost_login_block() from authenticated;

drop trigger if exists members_enforce_completed_generation_mattermost_login_block on public.members;
create trigger members_enforce_completed_generation_mattermost_login_block
  before insert or update of generation, mattermost_account_id, mattermost_login_disabled_at
  on public.members
  for each row execute function public.enforce_completed_generation_mattermost_login_block();

create or replace function public.disable_generation_mattermost_logins(
  p_generation integer
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_count integer;
begin
  if p_generation < 1 or p_generation > 99 then
    raise exception 'mattermost_login_disable_generation_invalid';
  end if;

  -- Triggers on normal member writes acquire the generation advisory lock
  -- after a row lock. EXCLUSIVE also conflicts with SELECT FOR UPDATE's
  -- ROW SHARE lock, so this batch cannot hold the advisory lock while
  -- waiting for a member row that later needs to update.
  lock table public.members in exclusive mode;
  perform pg_advisory_xact_lock(741515, p_generation);

  insert into public.member_mattermost_disabled_generations (generation)
  values (p_generation)
  on conflict (generation) do nothing;

  with updated_members as (
    update public.members
    set mattermost_login_disabled_at = now(),
        mattermost_login_disabled_reason = 'generation_completed',
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where generation = p_generation
      and deleted_at is null
      and mattermost_account_id is not null
      and mattermost_login_disabled_at is null
    returning id
  )
  select count(*)::integer into updated_count from updated_members;

  update public.member_password_action_tokens token
  set consumed_at = now()
  where token.delivery_channel = 'mattermost'
    and token.consumed_at is null
    and exists (
      select 1
      from public.members member
      where member.id = token.member_id
        and member.generation = p_generation
        and member.deleted_at is null
        and member.mattermost_account_id is not null
    );

  return updated_count;
end;
$$;

revoke all on function public.disable_generation_mattermost_logins(integer) from public;
revoke all on function public.disable_generation_mattermost_logins(integer) from anon;
revoke all on function public.disable_generation_mattermost_logins(integer) from authenticated;
grant execute on function public.disable_generation_mattermost_logins(integer) to service_role;

create or replace function public.begin_member_email_login_transition(
  p_member_id uuid,
  p_candidate_email text,
  p_email_reservation_hash text,
  p_reason text,
  p_initiated_by_admin_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  transition_row public.member_email_login_transitions%rowtype;
  token_id uuid;
  normalized_email text;
begin
  normalized_email := lower(btrim(p_candidate_email));
  if normalized_email is null or normalized_email = '' or normalized_email <> p_candidate_email then
    raise exception 'member_email_login_transition_email_invalid';
  end if;
  if p_email_reservation_hash is null
    or p_email_reservation_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'member_email_login_transition_email_reservation_invalid';
  end if;
  if p_reason not in ('generation_completed', 'member_departed', 'provider_not_found') then
    raise exception 'member_email_login_transition_reason_invalid';
  end if;
  if p_token_hash is null or btrim(p_token_hash) = '' or p_expires_at <= now() then
    raise exception 'member_email_login_transition_token_invalid';
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'member_email_login_transition_member_missing';
  end if;
  if member_row.mattermost_account_id is null then
    raise exception 'member_email_login_transition_member_not_linked';
  end if;
  if member_row.email_normalized is not null
    and member_row.email_normalized <> normalized_email then
    raise exception 'member_email_login_transition_email_mismatch';
  end if;
  if exists (
    select 1
    from public.members member
    where member.email_normalized = normalized_email
      and member.id <> p_member_id
  ) then
    raise exception 'member_email_login_transition_email_exists';
  end if;
  if exists (
    select 1
    from public.member_identifier_reservations reservation
    where reservation.identifier_kind = 'email'
      and reservation.identifier_hash = p_email_reservation_hash
  ) then
    raise exception 'member_email_login_transition_email_reserved';
  end if;

  select * into transition_row
  from public.member_email_login_transitions
  where member_id = p_member_id
  for update;
  if found and transition_row.status = 'completed' then
    raise exception 'member_email_login_transition_already_completed';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = p_member_id
    and consumed_at is null;

  begin
    insert into public.member_email_login_transitions (
      member_id,
      candidate_email,
      candidate_email_normalized,
      candidate_email_reservation_hash,
      reason,
      status,
      initiated_by_admin_id,
      password_action_token_id,
      email_sent_at,
      completed_at,
      updated_at
    ) values (
      p_member_id,
      normalized_email,
      normalized_email,
      p_email_reservation_hash,
      p_reason,
      'pending_delivery',
      p_initiated_by_admin_id,
      null,
      null,
      null,
      now()
    )
    on conflict (member_id) do update
    set candidate_email = excluded.candidate_email,
        candidate_email_normalized = excluded.candidate_email_normalized,
        candidate_email_reservation_hash = excluded.candidate_email_reservation_hash,
        reason = excluded.reason,
        status = 'pending_delivery',
        initiated_by_admin_id = excluded.initiated_by_admin_id,
        password_action_token_id = null,
        email_sent_at = null,
        completed_at = null,
        updated_at = now();
  exception
    when unique_violation then
      raise exception 'member_email_login_transition_email_exists';
  end;
  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    delivery_channel,
    token_hash,
    expires_at
  ) values (
    p_member_id,
    'member_email_login_transition',
    'email',
    p_token_hash,
    p_expires_at
  ) returning id into token_id;

  update public.member_email_login_transitions
  set password_action_token_id = token_id,
      updated_at = now()
  where member_id = p_member_id;

  update public.members
  set mattermost_login_disabled_at = coalesce(mattermost_login_disabled_at, now()),
      mattermost_login_disabled_reason = coalesce(mattermost_login_disabled_reason, p_reason),
      must_change_password = true,
      auth_session_version = auth_session_version + 1,
      updated_at = now()
  where id = p_member_id;

  return token_id;
end;
$$;

revoke all on function public.begin_member_email_login_transition(uuid, text, text, text, uuid, text, timestamp with time zone) from public;
revoke all on function public.begin_member_email_login_transition(uuid, text, text, text, uuid, text, timestamp with time zone) from anon;
revoke all on function public.begin_member_email_login_transition(uuid, text, text, text, uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.begin_member_email_login_transition(uuid, text, text, text, uuid, text, timestamp with time zone) to service_role;

create or replace function public.mark_member_email_login_transition_sent(
  p_token_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.member_email_login_transitions
  set status = 'email_sent',
      email_sent_at = now(),
      updated_at = now()
  where password_action_token_id = p_token_id
    and status = 'pending_delivery';
end;
$$;

revoke all on function public.mark_member_email_login_transition_sent(uuid) from public;
revoke all on function public.mark_member_email_login_transition_sent(uuid) from anon;
revoke all on function public.mark_member_email_login_transition_sent(uuid) from authenticated;
grant execute on function public.mark_member_email_login_transition_sent(uuid) to service_role;

create or replace function public.complete_member_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.member_password_action_tokens%rowtype;
  transition_row public.member_email_login_transitions%rowtype;
  member_row public.members%rowtype;
  token_id uuid;
  member_id uuid;
begin
  -- Lock the member first, matching begin_member_email_login_transition.
  -- The token is re-read after that lock so a concurrent resend safely wins.
  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in (
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'member_password_action_invalid_or_expired';
  end if;
  token_id := token_row.id;
  member_id := token_row.member_id;

  select * into member_row
  from public.members
  where id = member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'member_password_action_member_missing';
  end if;

  select * into token_row
  from public.member_password_action_tokens
  where id = token_id
    and token_hash = p_token_hash
    and purpose in (
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'member_password_action_invalid_or_expired';
  end if;

  if member_row.mattermost_login_disabled_at is not null
    and token_row.delivery_channel = 'mattermost' then
    raise exception 'member_password_action_mattermost_login_disabled';
  end if;

  if token_row.purpose = 'member_email_login_transition' then
    select * into transition_row
    from public.member_email_login_transitions
    where member_id = token_row.member_id
      and password_action_token_id = token_row.id
      and status in ('pending_delivery', 'email_sent')
    for update;
    if not found then
      raise exception 'member_email_login_transition_invalid';
    end if;
    if exists (
      select 1
      from public.members member
      where member.email_normalized = transition_row.candidate_email_normalized
        and member.id <> token_row.member_id
    ) then
      raise exception 'member_email_login_transition_email_exists';
    end if;
    if exists (
      select 1
      from public.member_identifier_reservations reservation
      where reservation.identifier_kind = 'email'
        and reservation.identifier_hash = transition_row.candidate_email_reservation_hash
    ) then
      raise exception 'member_email_login_transition_email_reserved';
    end if;
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where id = token_row.id;

  if token_row.purpose = 'member_email_login_transition' then
    update public.members
    set password_hash = p_password_hash,
        password_salt = p_password_salt,
        email = transition_row.candidate_email,
        email_normalized = transition_row.candidate_email_normalized,
        email_verified_at = now(),
        must_change_password = false,
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where id = token_row.member_id
      and deleted_at is null;
    if not found then
      raise exception 'member_password_action_member_missing';
    end if;

    update public.member_email_login_transitions
    set status = 'completed',
        completed_at = now(),
        updated_at = now()
    where id = transition_row.id;
  else
    update public.members
    set password_hash = p_password_hash,
        password_salt = p_password_salt,
        must_change_password = false,
        email_verified_at = case
          when token_row.delivery_channel = 'email' then coalesce(email_verified_at, now())
          else email_verified_at
        end,
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where id = token_row.member_id
      and deleted_at is null;
    if not found then
      raise exception 'member_password_action_member_missing';
    end if;
  end if;

  return token_row.member_id;
end;
$$;

revoke all on function public.complete_member_password_action(text, text, text) from public;
revoke all on function public.complete_member_password_action(text, text, text) from anon;
revoke all on function public.complete_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_member_password_action(text, text, text) to service_role;

create or replace function public.complete_manual_member_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  return public.complete_member_password_action(
    p_token_hash,
    p_password_hash,
    p_password_salt
  );
end;
$$;

revoke all on function public.complete_manual_member_password_action(text, text, text) from public;
revoke all on function public.complete_manual_member_password_action(text, text, text) from anon;
revoke all on function public.complete_manual_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_manual_member_password_action(text, text, text) to service_role;

-- 20260714234606_add_member_email_login_transition.sql (credential revisions)
create or replace function public.update_member_password_credentials(
  p_member_id uuid,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
begin
  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'member_password_action_member_missing';
  end if;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      auth_session_version = auth_session_version + 1,
      updated_at = now()
  where id = p_member_id;

  return p_member_id;
end;
$$;

revoke all on function public.update_member_password_credentials(uuid, text, text) from public;
revoke all on function public.update_member_password_credentials(uuid, text, text) from anon;
revoke all on function public.update_member_password_credentials(uuid, text, text) from authenticated;
grant execute on function public.update_member_password_credentials(uuid, text, text) to service_role;

create or replace function public.complete_member_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.member_password_action_tokens%rowtype;
  transition_row public.member_email_login_transitions%rowtype;
  member_row public.members%rowtype;
  token_id uuid;
  member_id uuid;
begin
  -- Lock the member first, matching begin_member_email_login_transition.
  -- The token is re-read after that lock so a concurrent resend safely wins.
  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in (
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'member_password_action_invalid_or_expired';
  end if;
  token_id := token_row.id;
  member_id := token_row.member_id;

  select * into member_row
  from public.members
  where id = member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'member_password_action_member_missing';
  end if;

  select * into token_row
  from public.member_password_action_tokens
  where id = token_id
    and token_hash = p_token_hash
    and purpose in (
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'member_password_action_invalid_or_expired';
  end if;

  if member_row.mattermost_login_disabled_at is not null
    and token_row.delivery_channel = 'mattermost' then
    raise exception 'member_password_action_mattermost_login_disabled';
  end if;

  if token_row.purpose = 'member_email_login_transition' then
    select * into transition_row
    from public.member_email_login_transitions
    where member_id = token_row.member_id
      and password_action_token_id = token_row.id
      and status in ('pending_delivery', 'email_sent')
    for update;
    if not found then
      raise exception 'member_email_login_transition_invalid';
    end if;
    if exists (
      select 1
      from public.members member
      where member.email_normalized = transition_row.candidate_email_normalized
        and member.id <> token_row.member_id
    ) then
      raise exception 'member_email_login_transition_email_exists';
    end if;
    if exists (
      select 1
      from public.member_identifier_reservations reservation
      where reservation.identifier_kind = 'email'
        and reservation.identifier_hash = transition_row.candidate_email_reservation_hash
    ) then
      raise exception 'member_email_login_transition_email_reserved';
    end if;
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where id = token_row.id;

  if token_row.purpose = 'member_email_login_transition' then
    update public.members
    set password_hash = p_password_hash,
        password_salt = p_password_salt,
        email = transition_row.candidate_email,
        email_normalized = transition_row.candidate_email_normalized,
        email_verified_at = now(),
        must_change_password = false,
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where id = token_row.member_id
      and deleted_at is null;
    if not found then
      raise exception 'member_password_action_member_missing';
    end if;

    update public.member_email_login_transitions
    set status = 'completed',
        completed_at = now(),
        updated_at = now()
    where id = transition_row.id;
  else
    update public.members
    set password_hash = p_password_hash,
        password_salt = p_password_salt,
        must_change_password = false,
        email_verified_at = case
          when token_row.delivery_channel = 'email' then coalesce(email_verified_at, now())
          else email_verified_at
        end,
        auth_session_version = auth_session_version + 1,
        updated_at = now()
    where id = token_row.member_id
      and deleted_at is null;
    if not found then
      raise exception 'member_password_action_member_missing';
    end if;
  end if;

  return token_row.member_id;
end;
$$;

revoke all on function public.complete_member_password_action(text, text, text) from public;
revoke all on function public.complete_member_password_action(text, text, text) from anon;
revoke all on function public.complete_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_member_password_action(text, text, text) to service_role;

create or replace function public.complete_manual_member_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  return public.complete_member_password_action(
    p_token_hash,
    p_password_hash,
    p_password_salt
  );
end;
$$;

revoke all on function public.complete_manual_member_password_action(text, text, text) from public;
revoke all on function public.complete_manual_member_password_action(text, text, text) from anon;
revoke all on function public.complete_manual_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_manual_member_password_action(text, text, text) to service_role;

create or replace function public.complete_graduate_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.member_password_action_tokens%rowtype;
  member_row public.members%rowtype;
  token_id uuid;
  member_id uuid;
begin
  -- Keep the same member-first lock order as every transition action.
  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in ('graduate_initial_setup', 'graduate_password_reset')
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'graduate_password_action_invalid';
  end if;
  token_id := token_row.id;
  member_id := token_row.member_id;

  select * into member_row
  from public.members
  where id = member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'graduate_password_action_member_missing';
  end if;

  select * into token_row
  from public.member_password_action_tokens
  where id = token_id
    and token_hash = p_token_hash
    and purpose in ('graduate_initial_setup', 'graduate_password_reset')
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'graduate_password_action_invalid';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where id = token_row.id;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      auth_session_version = auth_session_version + 1,
      updated_at = now()
  where id = token_row.member_id
    and deleted_at is null;
  if not found then
    raise exception 'graduate_password_action_member_missing';
  end if;

  return token_row.member_id;
end;
$$;

revoke all on function public.complete_graduate_password_action(text, text, text) from public;
revoke all on function public.complete_graduate_password_action(text, text, text) from anon;
revoke all on function public.complete_graduate_password_action(text, text, text) from authenticated;
grant execute on function public.complete_graduate_password_action(text, text, text) to service_role;

-- 20260714111459_add_manual_member_bulk_import.sql
alter table public.ssafy_cycle_settings
  add column if not exists manual_member_mm_lookup_generations integer[] not null default array[14, 15]::integer[];
alter table public.ssafy_cycle_settings
  drop constraint if exists ssafy_cycle_settings_manual_member_mm_lookup_generations_check;
alter table public.ssafy_cycle_settings
  add constraint ssafy_cycle_settings_manual_member_mm_lookup_generations_check
  check (
    cardinality(manual_member_mm_lookup_generations) between 0 and 99
    and manual_member_mm_lookup_generations <@ array[
      1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
      21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
      41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,
      61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,
      81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99
    ]::integer[]
  );

alter table public.member_profile_images
  drop constraint if exists member_profile_images_source_check;
alter table public.member_profile_images
  add constraint member_profile_images_source_check
  check (source in ('legacy', 'mattermost', 'graduate_verification', 'member_upload', 'manual_admin'));

alter table public.member_password_action_tokens
  add column if not exists delivery_channel text not null default 'email';
alter table public.member_password_action_tokens
  drop constraint if exists member_password_action_tokens_purpose_check;
alter table public.member_password_action_tokens
  add constraint member_password_action_tokens_purpose_check
  check (purpose in ('graduate_initial_setup', 'graduate_password_reset', 'manual_initial_setup', 'manual_password_reset'));
alter table public.member_password_action_tokens
  drop constraint if exists member_password_action_tokens_delivery_channel_check;
alter table public.member_password_action_tokens
  add constraint member_password_action_tokens_delivery_channel_check
  check (delivery_channel in ('mattermost', 'email'));

create table if not exists public.manual_member_import_batches (
  id uuid primary key default uuid_generate_v4(),
  created_by_admin_id uuid not null references public.members(id) on delete restrict,
  status text not null default 'staging',
  expires_at timestamp with time zone not null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint manual_member_import_batches_status_check check (status in ('staging', 'ready', 'processing', 'completed', 'expired'))
);
create table if not exists public.manual_member_import_rows (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null references public.manual_member_import_batches(id) on delete cascade,
  row_number integer not null,
  generation integer not null,
  display_name text,
  campus text,
  mm_username text,
  email text,
  email_normalized text,
  photo_filename text,
  staging_bucket text,
  staging_path text,
  staging_deleted_at timestamp with time zone,
  photo_content_type text,
  photo_size_bytes integer,
  member_id uuid references public.members(id) on delete set null,
  status text not null default 'staged',
  error_code text,
  error_message text,
  delivery_channel text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint manual_member_import_rows_generation_check check (generation between 0 and 99),
  constraint manual_member_import_rows_status_check check (status in ('staged', 'processing', 'created', 'failed')),
  constraint manual_member_import_rows_delivery_channel_check check (delivery_channel is null or delivery_channel in ('mattermost', 'email')),
  constraint manual_member_import_rows_photo_check check ((photo_filename is null and staging_bucket is null and staging_path is null and photo_content_type is null and photo_size_bytes is null) or (photo_filename is not null and staging_bucket = 'manual-member-import-staging' and staging_path is not null and photo_content_type in ('image/jpeg', 'image/png', 'image/webp') and photo_size_bytes between 1 and 5242880)),
  unique (batch_id, row_number),
  unique (batch_id, staging_path)
);
create index if not exists manual_member_import_batches_expiry_idx on public.manual_member_import_batches(expires_at) where status in ('staging', 'ready', 'processing');
create index if not exists manual_member_import_rows_batch_status_idx on public.manual_member_import_rows(batch_id, status, row_number);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manual-member-import-staging', 'manual-member-import-staging', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.manual_member_import_batches enable row level security;
alter table public.manual_member_import_rows enable row level security;
revoke all on table public.manual_member_import_batches from anon;
revoke all on table public.manual_member_import_batches from authenticated;
revoke all on table public.manual_member_import_rows from anon;
revoke all on table public.manual_member_import_rows from authenticated;
drop trigger if exists manual_member_import_batches_set_partnership_updated_at on public.manual_member_import_batches;
create trigger manual_member_import_batches_set_partnership_updated_at before update on public.manual_member_import_batches for each row execute function public.set_partnership_updated_at();
drop trigger if exists manual_member_import_rows_set_partnership_updated_at on public.manual_member_import_rows;
create trigger manual_member_import_rows_set_partnership_updated_at before update on public.manual_member_import_rows for each row execute function public.set_partnership_updated_at();

create or replace function public.complete_manual_member_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  candidate_member_id uuid;
  member_row public.members%rowtype;
  token_row public.member_password_action_tokens%rowtype;
begin
  -- Identify the member without locking the token. All mutations below lock
  -- the member first, then the token, matching the reissue RPC.
  select member_id into candidate_member_id
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in ('manual_initial_setup', 'manual_password_reset')
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'manual_password_action_invalid_or_expired';
  end if;

  select * into member_row
  from public.members
  where id = candidate_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'manual_password_action_member_missing';
  end if;

  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in ('manual_initial_setup', 'manual_password_reset')
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found or token_row.member_id <> member_row.id then
    raise exception 'manual_password_action_invalid_or_expired';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where id = token_row.id;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      email_verified_at = case
        when token_row.delivery_channel = 'email' then coalesce(email_verified_at, now())
        else email_verified_at
      end,
      updated_at = now()
  where id = member_row.id;

  return member_row.id;
end;
$$;
revoke all on function public.complete_manual_member_password_action(text, text, text) from public;
revoke all on function public.complete_manual_member_password_action(text, text, text) from anon;
revoke all on function public.complete_manual_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_manual_member_password_action(text, text, text) to service_role;

create or replace function public.checkpoint_manual_member_import_member(
  p_row_id uuid,
  p_batch_id uuid,
  p_expected_row_updated_at timestamp with time zone,
  p_display_name text,
  p_generation integer,
  p_staff_source_generation integer,
  p_campus text,
  p_mattermost_account_id uuid,
  p_email text,
  p_email_normalized text
)
returns table (
  member_id uuid,
  row_updated_at timestamp with time zone
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  import_row public.manual_member_import_rows%rowtype;
  existing_member public.members%rowtype;
  created_member_id uuid;
begin
  select * into import_row
  from public.manual_member_import_rows
  where id = p_row_id
    and batch_id = p_batch_id
    and status = 'processing'
    and updated_at = p_expected_row_updated_at
  for update;
  if not found then raise exception 'manual_member_import_row_lease_lost'; end if;

  if import_row.member_id is not null then
    select * into existing_member
    from public.members
    where id = import_row.member_id
      and deleted_at is null
    for update;
    if not found then raise exception 'manual_member_import_checkpoint_member_missing'; end if;
    member_id := existing_member.id;
    row_updated_at := import_row.updated_at;
    return next;
    return;
  end if;

  if p_email_normalized is not null and exists (
    select 1 from public.members
    where email_normalized = p_email_normalized and deleted_at is null
  ) then raise exception 'existing_email'; end if;
  if p_mattermost_account_id is not null and exists (
    select 1 from public.members
    where mattermost_account_id = p_mattermost_account_id and deleted_at is null
  ) then raise exception 'existing_mattermost'; end if;

  insert into public.members (
    display_name, generation, staff_source_generation, campus,
    mattermost_account_id, email, email_normalized, must_change_password
  ) values (
    p_display_name, p_generation, p_staff_source_generation, p_campus,
    p_mattermost_account_id, p_email, p_email_normalized, true
  ) returning id into created_member_id;

  update public.manual_member_import_rows
  set member_id = created_member_id
  where id = import_row.id
    and batch_id = p_batch_id
    and status = 'processing'
    and updated_at = p_expected_row_updated_at
  returning updated_at into row_updated_at;
  if not found then raise exception 'manual_member_import_row_lease_lost'; end if;
  member_id := created_member_id;
  return next;
end;
$$;
revoke all on function public.checkpoint_manual_member_import_member(uuid, uuid, timestamp with time zone, text, integer, integer, text, uuid, text, text) from public;
revoke all on function public.checkpoint_manual_member_import_member(uuid, uuid, timestamp with time zone, text, integer, integer, text, uuid, text, text) from anon;
revoke all on function public.checkpoint_manual_member_import_member(uuid, uuid, timestamp with time zone, text, integer, integer, text, uuid, text, text) from authenticated;
grant execute on function public.checkpoint_manual_member_import_member(uuid, uuid, timestamp with time zone, text, integer, integer, text, uuid, text, text) to service_role;

alter table public.manual_member_import_rows
  add column if not exists photo_attached_at timestamp with time zone,
  add column if not exists delivery_attempted_at timestamp with time zone,
  add column if not exists delivery_sent_at timestamp with time zone,
  add column if not exists delivery_idempotency_key text;
alter table public.manual_member_import_rows
  drop constraint if exists manual_member_import_rows_delivery_checkpoint_check;
alter table public.manual_member_import_rows
  add constraint manual_member_import_rows_delivery_checkpoint_check
  check (
    (
      delivery_attempted_at is null
      or (
        delivery_idempotency_key is not null
        and delivery_channel is not null
      )
    )
    and (
      delivery_sent_at is null
      or (
        delivery_attempted_at is not null
        and delivery_idempotency_key is not null
        and delivery_channel is not null
      )
    )
  );
create unique index if not exists manual_member_import_rows_delivery_key_unique
  on public.manual_member_import_rows(delivery_idempotency_key)
  where delivery_idempotency_key is not null;

alter table public.member_profile_images
  add column if not exists manual_member_import_row_id uuid
  references public.manual_member_import_rows(id) on delete set null;
create unique index if not exists member_profile_images_manual_import_row_unique
  on public.member_profile_images(manual_member_import_row_id)
  where manual_member_import_row_id is not null;

-- 20260713204059_contract_member_domain_legacy_columns.sql
-- Contract phase: remove member-table mirrors after canonical relations are live.

do $$
begin
  if exists (
    select 1
    from public.members member
    where member.deleted_at is null
      and (
        btrim(coalesce(member.avatar_base64, '')) <> ''
        or btrim(coalesce(member.avatar_url, '')) <> ''
      )
  ) then
    raise exception 'member_legacy_avatar_migration_required';
  end if;

  if exists (
    select 1
    from public.member_auth_identities identity
    where identity.provider <> 'mattermost'
  ) then
    raise exception 'member_auth_identity_contract_requires_mattermost_only';
  end if;

  if exists (
    select 1
    from public.member_auth_identities identity
    left join public.members member
      on member.id = identity.member_id
    left join public.mm_user_directory directory
      on directory.id = member.mattermost_account_id
    where identity.provider = 'mattermost'
      and (
        directory.id is null
        or lower(directory.mm_username) <> identity.identifier_normalized
      )
  ) then
    raise exception 'member_auth_identity_contract_requires_directory_match';
  end if;

  if exists (
    select 1
    from public.member_profile_images image
    where image.member_id is not null
      and image.status = 'approved'
      and image.deleted_at is null
    group by image.member_id
    having count(*) > 1
  ) then
    raise exception 'member_profile_image_contract_requires_one_approved_image';
  end if;

  if exists (
    select 1
    from public.members member
    where member.active_profile_image_id is not null
      and not exists (
        select 1
        from public.member_profile_images image
        where image.id = member.active_profile_image_id
          and image.member_id = member.id
          and image.status = 'approved'
          and image.deleted_at is null
      )
  ) then
    raise exception 'member_profile_image_contract_requires_canonical_pointer';
  end if;
end;
$$;

create or replace function public.anonymize_deleted_member(p_member_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  mattermost_account_uuid uuid;
  verification_request_uuid uuid;
begin
  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is not null
    and deleted_at <= now() - interval '30 days'
    and anonymized_at is null
  for update;

  if not found then
    return false;
  end if;

  mattermost_account_uuid := member_row.mattermost_account_id;
  select verification_request_id into verification_request_uuid
  from public.graduate_profiles
  where member_id = p_member_id;

  delete from public.member_profile_images where member_id = p_member_id;
  delete from public.member_ssafy_verifications where member_id = p_member_id;
  delete from public.member_email_challenges where member_id = p_member_id;
  delete from public.member_password_action_tokens where member_id = p_member_id;
  delete from public.graduate_profiles where member_id = p_member_id;

  if verification_request_uuid is not null then
    update public.graduate_verification_requests
    set email = concat('deleted+', verification_request_uuid::text, '@deleted.invalid'),
        email_normalized = concat('deleted+', verification_request_uuid::text, '@deleted.invalid'),
        legal_name = '탈퇴한 수료생',
        document_number_hmac = null,
        certificate_storage_path = null,
        certificate_sha256 = null,
        certificate_deleted_at = coalesce(certificate_deleted_at, now()),
        review_note = null,
        rejection_reason = null,
        updated_at = now()
    where id = verification_request_uuid;
  end if;

  update public.members
  set email = null,
      email_normalized = null,
      email_verified_at = null,
      password_hash = null,
      password_salt = null,
      must_change_password = false,
      display_name = '탈퇴한 회원',
      campus = null,
      staff_source_generation = null,
      mattermost_account_id = null,
      anonymized_at = now(),
      updated_at = now()
  where id = p_member_id;

  if mattermost_account_uuid is not null then
    delete from public.mm_user_directory directory
    where directory.id = mattermost_account_uuid
      and not exists (
        select 1
        from public.members linked_member
        where linked_member.mattermost_account_id = directory.id
      );
  end if;

  return true;
end;
$$;

revoke all on function public.anonymize_deleted_member(uuid) from public;
revoke all on function public.anonymize_deleted_member(uuid) from anon;
revoke all on function public.anonymize_deleted_member(uuid) from authenticated;
grant execute on function public.anonymize_deleted_member(uuid) to service_role;

create or replace function public.approve_graduate_verification(
  p_request_id uuid,
  p_admin_id uuid,
  p_document_number_hmac text,
  p_setup_token_hash text,
  p_setup_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_row public.graduate_verification_requests%rowtype;
  photo_row public.member_profile_images%rowtype;
  reviewer_profile_id uuid;
  new_member_id uuid;
  resolved_generation integer;
begin
  select * into request_row
  from public.graduate_verification_requests
  where id = p_request_id
  for update;
  if not found or request_row.status <> 'in_review' then
    raise exception 'graduate_verification_not_reviewable';
  end if;
  if request_row.profile_image_id is null then
    raise exception 'graduate_verification_profile_image_missing';
  end if;

  select * into photo_row
  from public.member_profile_images
  where id = request_row.profile_image_id
  for update;
  if not found or photo_row.status <> 'pending' then
    raise exception 'graduate_verification_profile_image_not_pending';
  end if;

  if exists (
    select 1
    from public.members member
    where member.email_normalized = request_row.email_normalized
      and member.deleted_at is null
  ) then
    raise exception 'graduate_verification_email_exists';
  end if;
  if exists (
    select 1
    from public.graduate_verification_requests request
    where request.document_number_hmac = p_document_number_hmac
      and request.id <> p_request_id
      and request.status = 'approved'
  ) then
    raise exception 'graduate_verification_document_exists';
  end if;

  select profile.id into reviewer_profile_id
  from public.admin_profiles profile
  where profile.member_id = p_admin_id
    and profile.is_active = true;
  if reviewer_profile_id is null then
    raise exception 'graduate_verification_admin_profile_missing';
  end if;

  resolved_generation := coalesce(
    request_row.inferred_generation,
    request_row.inferred_cohort
  );
  if resolved_generation is null then
    raise exception 'graduate_verification_generation_missing';
  end if;

  insert into public.members (
    display_name,
    generation,
    campus,
    email,
    email_normalized,
    email_verified_at,
    must_change_password
  ) values (
    request_row.legal_name,
    resolved_generation,
    request_row.campus,
    request_row.email,
    request_row.email_normalized,
    now(),
    true
  ) returning id into new_member_id;

  insert into public.graduate_profiles (
    member_id,
    verification_request_id,
    verified_at,
    verification_source
  ) values (
    new_member_id,
    request_row.id,
    now(),
    'graduate_certificate'
  );

  update public.member_profile_images
  set member_id = new_member_id,
      source = 'graduate_verification',
      status = 'approved',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      updated_at = now()
  where id = photo_row.id;

  update public.graduate_verification_requests
  set status = 'approved',
      document_number_hmac = p_document_number_hmac,
      inferred_generation = resolved_generation,
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      decided_at = now(),
      certificate_delete_after = now() + interval '30 days',
      resubmission_targets = '{}',
      updated_at = now()
  where id = p_request_id;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    token_hash,
    expires_at
  ) values (
    new_member_id,
    'graduate_initial_setup',
    p_setup_token_hash,
    p_setup_expires_at
  );
  return new_member_id;
end;
$$;

revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from public;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from anon;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from authenticated;
grant execute on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) to service_role;

do $$
declare
  page_definition text;
  summary_definition text;
begin
  select pg_get_functiondef(
    'public.get_admin_logs_page(timestamp with time zone,timestamp with time zone,integer,integer,text,text,text,text,text)'::regprocedure
  ) into page_definition;
  if page_definition is null then
    raise exception 'get_admin_logs_page_missing';
  end if;

  page_definition := replace(
    page_definition,
    $page_event_current$
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    where$page_event_current$,
    $page_event_next$
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    left join public.mm_user_directory directory
      on directory.id = members.mattermost_account_id
    where$page_event_next$
  );
  page_definition := replace(
    page_definition,
    $page_security_current$
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    where$page_security_current$,
    $page_security_next$
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    left join public.mm_user_directory directory
      on directory.id = members.mattermost_account_id
    where$page_security_next$
  );
  page_definition := replace(page_definition, 'members.mm_username', 'directory.mm_username');
  if strpos(page_definition, 'members.mm_username') > 0
    or strpos(page_definition, 'directory.mm_username') = 0 then
    raise exception 'get_admin_logs_page_contract_rewrite_failed';
  end if;
  execute page_definition;

  select pg_get_functiondef(
    'public.get_admin_logs_summary(timestamp with time zone,timestamp with time zone,bigint)'::regprocedure
  ) into summary_definition;
  if summary_definition is null then
    raise exception 'get_admin_logs_summary_missing';
  end if;

  summary_definition := replace(
    summary_definition,
    $summary_event_current$
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    cross join params$summary_event_current$,
    $summary_event_next$
    left join public.members
      on event_logs.actor_type = 'member'
     and members.id::text = event_logs.actor_id
    left join public.mm_user_directory directory
      on directory.id = members.mattermost_account_id
    cross join params$summary_event_next$
  );
  summary_definition := replace(
    summary_definition,
    $summary_security_current$
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    cross join params$summary_security_current$,
    $summary_security_next$
    left join public.members
      on auth_security_logs.actor_type = 'member'
     and members.id::text = auth_security_logs.actor_id
    left join public.mm_user_directory directory
      on directory.id = members.mattermost_account_id
    cross join params$summary_security_next$
  );
  summary_definition := replace(summary_definition, 'members.mm_username', 'directory.mm_username');
  if strpos(summary_definition, 'members.mm_username') > 0
    or strpos(summary_definition, 'directory.mm_username') = 0 then
    raise exception 'get_admin_logs_summary_contract_rewrite_failed';
  end if;
  execute summary_definition;
end;
$$;

create or replace function public.enforce_member_profile_image_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'superseded'))
    or (old.status = 'approved' and new.status in ('superseded', 'rejected'))
  ) then
    raise exception 'invalid_member_profile_image_status_transition';
  end if;

  return new;
end;
$$;

create or replace function public.approve_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
begin
  select * into image_row
  from public.member_profile_images
  where id = p_image_id
    and graduate_verification_request_id is null
    and member_id is not null
    and status = 'pending'
  for update;
  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;
  select * into member_row
  from public.members
  where id = image_row.member_id
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
  end if;
  select id into reviewer_profile_id
  from public.admin_profiles
  where member_id = p_admin_id
    and is_active = true;
  if reviewer_profile_id is null then
    raise exception 'profile_image_admin_profile_missing';
  end if;

  update public.member_profile_images
  set status = 'superseded',
      delete_after = now() + interval '30 days',
      updated_at = now()
  where member_id = member_row.id
    and status = 'approved'
    and deleted_at is null;

  update public.member_profile_images
  set status = 'approved',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      updated_at = now()
  where id = image_row.id;

  update public.members
  set updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

create or replace function public.reject_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;
  select * into image_row
  from public.member_profile_images
  where id = p_image_id
    and graduate_verification_request_id is null
    and member_id is not null
    and status = 'pending'
  for update;
  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;
  select * into member_row
  from public.members
  where id = image_row.member_id
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
  end if;
  select id into reviewer_profile_id
  from public.admin_profiles
  where member_id = p_admin_id
    and is_active = true;
  if reviewer_profile_id is null then
    raise exception 'profile_image_admin_profile_missing';
  end if;

  update public.member_profile_images
  set status = 'rejected',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      review_reason = btrim(p_reason),
      reviewed_at = now(),
      delete_after = now() + interval '30 days',
      updated_at = now()
  where id = image_row.id;

  update public.members
  set updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

create or replace function public.reject_member_active_profile_photo(
  p_member_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;
  select * into member_row
  from public.members
  where id = p_member_id
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
  end if;
  select id into reviewer_profile_id
  from public.admin_profiles
  where member_id = p_admin_id
    and is_active = true;
  if reviewer_profile_id is null then
    raise exception 'profile_image_admin_profile_missing';
  end if;

  update public.member_profile_images
  set status = 'rejected',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      review_reason = btrim(p_reason),
      reviewed_at = now(),
      delete_after = now() + interval '30 days',
      updated_at = now()
  where member_id = member_row.id
    and status = 'approved'
    and deleted_at is null;

  update public.members
  set updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from public;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from anon;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from authenticated;
grant execute on function public.approve_member_profile_image_replacement(uuid, uuid) to service_role;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from public;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from anon;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_profile_image_replacement(uuid, uuid, text) to service_role;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from public;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from anon;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_active_profile_photo(uuid, uuid, text) to service_role;

-- 20260714234606_add_member_email_login_transition.sql
-- The historical schema snapshot retains an older manual-import block above.
-- Reassert the current migration state after that block so this file matches
-- the effective database contract.
alter table public.member_password_action_tokens
  drop constraint if exists member_password_action_tokens_purpose_check;
alter table public.member_password_action_tokens
  add constraint member_password_action_tokens_purpose_check
  check (
    purpose in (
      'graduate_initial_setup',
      'graduate_password_reset',
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
  );

create or replace function public.update_member_mattermost_password_credentials(
  p_member_id uuid,
  p_expected_mattermost_account_id uuid,
  p_expected_updated_at timestamp with time zone,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
begin
  if p_expected_mattermost_account_id is null
    or p_expected_updated_at is null then
    raise exception 'member_mattermost_password_update_invalid';
  end if;

  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'member_mattermost_password_update_member_missing';
  end if;
  if member_row.mattermost_account_id is distinct from p_expected_mattermost_account_id
    or member_row.mattermost_login_disabled_at is not null
    or member_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'member_mattermost_password_update_not_allowed';
  end if;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      auth_session_version = auth_session_version + 1,
      updated_at = now()
  where id = p_member_id;

  return p_member_id;
end;
$$;

revoke all on function public.update_member_mattermost_password_credentials(uuid, uuid, timestamp with time zone, text, text) from public;
revoke all on function public.update_member_mattermost_password_credentials(uuid, uuid, timestamp with time zone, text, text) from anon;
revoke all on function public.update_member_mattermost_password_credentials(uuid, uuid, timestamp with time zone, text, text) from authenticated;
grant execute on function public.update_member_mattermost_password_credentials(uuid, uuid, timestamp with time zone, text, text) to service_role;

create or replace function public.complete_member_password_action_with_delivery(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_row public.member_password_action_tokens%rowtype;
  completed_member_id uuid;
begin
  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in (
      'manual_initial_setup',
      'manual_password_reset',
      'member_email_login_transition'
    )
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'member_password_action_invalid_or_expired';
  end if;

  completed_member_id := public.complete_member_password_action(
    p_token_hash,
    p_password_hash,
    p_password_salt
  );
  return jsonb_build_object(
    'memberId', completed_member_id,
    'deliveryChannel', token_row.delivery_channel
  );
end;
$$;

revoke all on function public.complete_member_password_action_with_delivery(text, text, text) from public;
revoke all on function public.complete_member_password_action_with_delivery(text, text, text) from anon;
revoke all on function public.complete_member_password_action_with_delivery(text, text, text) from authenticated;
grant execute on function public.complete_member_password_action_with_delivery(text, text, text) to service_role;

create or replace function public.complete_manual_member_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  return public.complete_member_password_action(
    p_token_hash,
    p_password_hash,
    p_password_salt
  );
end;
$$;

revoke all on function public.complete_manual_member_password_action(text, text, text) from public;
revoke all on function public.complete_manual_member_password_action(text, text, text) from anon;
revoke all on function public.complete_manual_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_manual_member_password_action(text, text, text) to service_role;

drop trigger if exists members_keep_single_super_admin on public.members;
drop function if exists public.ensure_single_member_super_admin();

create unique index if not exists member_profile_images_one_approved_per_member_idx
  on public.member_profile_images(member_id)
  where member_id is not null
    and status = 'approved'
    and deleted_at is null;

drop table if exists public.member_auth_identities;

alter table public.members
  drop column if exists mm_user_id,
  drop column if exists mm_username,
  drop column if exists year,
  drop column if exists staff_source_year,
  drop column if exists service_policy_version,
  drop column if exists service_policy_consented_at,
  drop column if exists privacy_policy_version,
  drop column if exists privacy_policy_consented_at,
  drop column if exists marketing_policy_version,
  drop column if exists marketing_policy_consented_at,
  drop column if exists admin_permission_id,
  drop column if exists admin_managed_campus_slugs,
  drop column if exists avatar_content_type,
  drop column if exists avatar_base64,
  drop column if exists avatar_url,
  drop column if exists ssafy_sub,
  drop column if exists ssafy_verified_at,
  drop column if exists ssafy_auth_time,
  drop column if exists ssafy_verification_id,
  drop column if exists ssafy_mattermost_user_id,
  drop column if exists ssafy_last_scope,
  drop column if exists ssafy_track,
  drop column if exists ssafy_track_name,
  drop column if exists graduate_verified_at,
  drop column if exists graduate_completion_stage,
  drop column if exists verification_source,
  drop column if exists active_profile_image_id,
  drop column if exists profile_photo_review_status;

-- 20260713205041_harden_member_profile_image_transition_search_path.sql
create or replace function public.enforce_member_profile_image_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'superseded'))
    or (old.status = 'approved' and new.status in ('superseded', 'rejected'))
  ) then
    raise exception 'invalid_member_profile_image_status_transition';
  end if;

  return new;
end;
$$;

-- Schema snapshot sync: canonical member marketing preference backfill (2026-07-13).
with active_marketing_policy as (
  select version
  from public.policy_documents
  where kind = 'marketing'
    and is_active = true
  order by version desc
  limit 1
)
insert into public.push_preferences (
  member_id,
  marketing_enabled,
  updated_at
)
select
  member.id,
  coalesce(member.marketing_policy_version = active_marketing_policy.version, false),
  now()
from public.members as member
left join active_marketing_policy on true
where member.deleted_at is null
on conflict (member_id) do update
set marketing_enabled = excluded.marketing_enabled,
    updated_at = excluded.updated_at
where public.push_preferences.marketing_enabled
  is distinct from excluded.marketing_enabled;

create or replace function public.ensure_single_member_super_admin()
returns trigger
language plpgsql
as $$
declare super_admin_count integer;
begin
  if new.admin_permission_id = 'super_admin' and coalesce(new.mm_username, '') <> 'myknow' then
    raise exception 'only myknow member can hold super_admin permission';
  end if;
  select count(*) into super_admin_count from public.members where admin_permission_id = 'super_admin';
  if super_admin_count > 1 then raise exception 'only one super_admin member is allowed'; end if;
  return new;
end;
$$;

-- Schema snapshot sync: normalized member domain (2026-07-13).

-- Phase 1 / expand: keep legacy member columns until every application reader
-- has moved to the normalized model in a later contract migration.
alter table public.members
  add column if not exists generation integer,
  add column if not exists staff_source_generation integer,
  add column if not exists email text,
  add column if not exists email_normalized text,
  add column if not exists email_verified_at timestamp with time zone,
  add column if not exists mattermost_account_id uuid,
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists anonymized_at timestamp with time zone;

alter table public.members
  drop constraint if exists members_generation_check;
alter table public.members
  add constraint members_generation_check
  check (generation is null or generation between 0 and 99);

alter table public.members
  drop constraint if exists members_staff_source_generation_check;
alter table public.members
  add constraint members_staff_source_generation_check
  check (staff_source_generation is null or staff_source_generation between 1 and 99);

alter table public.members
  drop constraint if exists members_email_normalized_check;
alter table public.members
  add constraint members_email_normalized_check
  check (
    (email is null and email_normalized is null)
    or (email is not null and email_normalized = lower(btrim(email)))
  );

create unique index if not exists members_email_normalized_key
  on public.members(email_normalized)
  where email_normalized is not null;
create index if not exists members_active_generation_campus_idx
  on public.members(generation, campus, created_at desc)
  where deleted_at is null;
create index if not exists members_deleted_at_idx
  on public.members(deleted_at)
  where deleted_at is not null;

-- Reuse the directory as the canonical Mattermost account table. The old
-- snapshot column names remain temporarily so deployed code can coexist.
alter table public.mm_user_directory
  add column if not exists legacy_ssafy_mattermost_user_id text,
  add column if not exists display_name_snapshot text,
  add column if not exists campus_snapshot text,
  add column if not exists source_generations integer[] not null default '{}',
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamp with time zone;

create unique index if not exists mm_user_directory_legacy_ssafy_mattermost_user_id_key
  on public.mm_user_directory(legacy_ssafy_mattermost_user_id)
  where legacy_ssafy_mattermost_user_id is not null;
create index if not exists mm_user_directory_active_username_idx
  on public.mm_user_directory(mm_username)
  where is_active = true;

alter table public.members
  drop constraint if exists members_mattermost_account_id_fkey;
alter table public.members
  add constraint members_mattermost_account_id_fkey
  foreign key (mattermost_account_id)
  references public.mm_user_directory(id)
  on delete restrict;
create unique index if not exists members_mattermost_account_id_key
  on public.members(mattermost_account_id)
  where mattermost_account_id is not null;

create table if not exists public.member_ssafy_verifications (
  member_id uuid primary key references public.members(id) on delete cascade,
  ssafy_sub text not null unique,
  verified_at timestamp with time zone not null,
  auth_time timestamp with time zone,
  verification_id text,
  track text,
  track_name text,
  last_scope text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.graduate_profiles (
  member_id uuid primary key references public.members(id) on delete cascade,
  verification_request_id uuid unique references public.graduate_verification_requests(id) on delete set null,
  verified_at timestamp with time zone not null,
  verification_source text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint graduate_profiles_verification_source_check
    check (verification_source in ('graduate_certificate', 'legacy_migration'))
);

create table if not exists public.admin_profiles (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  permission_template_key text not null references public.admin_permission_templates(key) on delete restrict,
  managed_campus_slugs text[] not null default '{}',
  is_active boolean not null default true,
  permission_version integer not null default 1,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint admin_profiles_permission_version_check check (permission_version > 0)
);

-- Permission templates may be shared by multiple active administrators. The
-- existing privileged-admin guard remains responsible for ensuring that at
-- least one administrator can manage access.
drop index if exists public.admin_profiles_single_super_admin_idx;
create index if not exists admin_profiles_active_permission_template_idx
  on public.admin_profiles(permission_template_key)
  where is_active = true;

create table if not exists public.member_identifier_reservations (
  id uuid primary key default uuid_generate_v4(),
  identifier_kind text not null,
  identifier_hash text not null,
  reserved_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint member_identifier_reservations_kind_check
    check (identifier_kind in ('email', 'mm_user_id', 'mm_username', 'ssafy_sub')),
  constraint member_identifier_reservations_hash_check
    check (identifier_hash ~ '^[0-9a-f]{64}$'),
  unique (identifier_kind, identifier_hash)
);

create table if not exists public.member_email_challenges (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid references public.members(id) on delete cascade,
  graduate_verification_request_id uuid references public.graduate_verification_requests(id) on delete cascade,
  email_normalized text not null,
  purpose text not null,
  code_hash text not null,
  expires_at timestamp with time zone not null,
  verified_at timestamp with time zone,
  consumed_at timestamp with time zone,
  attempt_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint member_email_challenges_owner_check
    check (num_nonnulls(member_id, graduate_verification_request_id) = 1),
  constraint member_email_challenges_purpose_check
    check (purpose in ('email_verify', 'email_change')),
  constraint member_email_challenges_attempt_count_check
    check (attempt_count between 0 and 10)
);

create index if not exists member_email_challenges_lookup_idx
  on public.member_email_challenges(member_id, email_normalized, purpose, expires_at desc);

alter table public.graduate_verification_requests
  add column if not exists inferred_generation integer,
  add column if not exists reviewer_admin_profile_id uuid references public.admin_profiles(id) on delete set null;

-- Graduation semester is legacy history only. New verification uses the
-- inferred generation calculated from the education start period.
alter table public.graduate_verification_requests
  alter column completion_stage drop not null;

alter table public.graduate_verification_requests
  drop constraint if exists graduate_verification_requests_inferred_generation_check;
alter table public.graduate_verification_requests
  add constraint graduate_verification_requests_inferred_generation_check
  check (inferred_generation is null or inferred_generation between 1 and 99);

alter table public.member_profile_images
  add column if not exists source text not null default 'legacy',
  add column if not exists reviewer_admin_profile_id uuid references public.admin_profiles(id) on delete set null;

alter table public.member_profile_images
  drop constraint if exists member_profile_images_source_check;
alter table public.member_profile_images
  add constraint member_profile_images_source_check
  check (source in ('legacy', 'mattermost', 'graduate_verification', 'member_upload'));

-- Consent records must outlive policy activation changes. Existing rows remain
-- service-role only; new tables are explicitly not exposed to Data API users.
alter table public.member_policy_consents
  drop constraint if exists member_policy_consents_policy_document_id_fkey;
alter table public.member_policy_consents
  add constraint member_policy_consents_policy_document_id_fkey
  foreign key (policy_document_id)
  references public.policy_documents(id)
  on delete restrict;

create or replace function public.prevent_policy_document_content_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind is distinct from old.kind
    or new.version is distinct from old.version
    or new.title is distinct from old.title
    or new.summary is distinct from old.summary
    or new.content is distinct from old.content
    or new.created_at is distinct from old.created_at then
    raise exception 'policy_document_version_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists policy_documents_prevent_content_mutation on public.policy_documents;
create trigger policy_documents_prevent_content_mutation
  before update on public.policy_documents
  for each row execute function public.prevent_policy_document_content_mutation();

alter table public.mm_user_directory enable row level security;
alter table public.member_ssafy_verifications enable row level security;
alter table public.graduate_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.member_identifier_reservations enable row level security;
alter table public.member_email_challenges enable row level security;

revoke all on table public.mm_user_directory from anon;
revoke all on table public.mm_user_directory from authenticated;
revoke all on table public.member_ssafy_verifications from anon;
revoke all on table public.member_ssafy_verifications from authenticated;
revoke all on table public.graduate_profiles from anon;
revoke all on table public.graduate_profiles from authenticated;
revoke all on table public.admin_profiles from anon;
revoke all on table public.admin_profiles from authenticated;
revoke all on table public.member_identifier_reservations from anon;
revoke all on table public.member_identifier_reservations from authenticated;
revoke all on table public.member_email_challenges from anon;
revoke all on table public.member_email_challenges from authenticated;

create or replace function public.soft_delete_member(
  p_member_id uuid,
  p_identifier_reservations jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  reservation record;
begin
  select * into member_row
  from public.members
  where id = p_member_id
  for update;

  if not found or member_row.deleted_at is not null then
    return false;
  end if;

  for reservation in
    select identifier_kind, identifier_hash
    from jsonb_to_recordset(coalesce(p_identifier_reservations, '[]'::jsonb))
      as value(identifier_kind text, identifier_hash text)
  loop
    insert into public.member_identifier_reservations (
      identifier_kind,
      identifier_hash
    )
    values (reservation.identifier_kind, reservation.identifier_hash)
    on conflict (identifier_kind, identifier_hash) do nothing;
  end loop;

  update public.members
  set deleted_at = now(), updated_at = now()
  where id = p_member_id;

  update public.admin_profiles
  set is_active = false,
      permission_version = permission_version + 1,
      updated_at = now()
  where member_id = p_member_id;

  delete from public.push_subscriptions
  where member_id = p_member_id;

  return true;
end;
$$;

revoke all on function public.soft_delete_member(uuid, jsonb) from public;
revoke all on function public.soft_delete_member(uuid, jsonb) from anon;
revoke all on function public.soft_delete_member(uuid, jsonb) from authenticated;
grant execute on function public.soft_delete_member(uuid, jsonb) to service_role;

create or replace function public.anonymize_deleted_member(p_member_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  mattermost_account_uuid uuid;
  verification_request_uuid uuid;
begin
  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is not null
    and deleted_at <= now() - interval '30 days'
    and anonymized_at is null
  for update;

  if not found then
    return false;
  end if;

  mattermost_account_uuid := member_row.mattermost_account_id;
  select verification_request_id into verification_request_uuid
  from public.graduate_profiles
  where member_id = p_member_id;

  delete from public.member_profile_images where member_id = p_member_id;
  delete from public.member_ssafy_verifications where member_id = p_member_id;
  delete from public.member_email_challenges where member_id = p_member_id;
  delete from public.member_password_action_tokens where member_id = p_member_id;
  delete from public.member_auth_identities where member_id = p_member_id;
  delete from public.graduate_profiles where member_id = p_member_id;

  if verification_request_uuid is not null then
    update public.graduate_verification_requests
    set email = concat('deleted+', verification_request_uuid::text, '@deleted.invalid'),
        email_normalized = concat('deleted+', verification_request_uuid::text, '@deleted.invalid'),
        legal_name = '탈퇴한 수료생',
        document_number_hmac = null,
        certificate_storage_path = null,
        certificate_sha256 = null,
        certificate_deleted_at = coalesce(certificate_deleted_at, now()),
        review_note = null,
        rejection_reason = null,
        updated_at = now()
    where id = verification_request_uuid;
  end if;

  update public.members
  set email = null,
      email_normalized = null,
      email_verified_at = null,
      manual_login_id = null,
      password_hash = null,
      password_salt = null,
      must_change_password = false,
      display_name = '탈퇴한 회원',
      campus = null,
      staff_source_generation = null,
      mattermost_account_id = null,
      mm_user_id = null,
      mm_username = null,
      ssafy_sub = null,
      ssafy_verified_at = null,
      ssafy_auth_time = null,
      ssafy_verification_id = null,
      ssafy_mattermost_user_id = null,
      ssafy_track = null,
      ssafy_track_name = null,
      ssafy_last_scope = null,
      avatar_content_type = null,
      avatar_base64 = null,
      avatar_url = null,
      graduate_verified_at = null,
      graduate_completion_stage = null,
      verification_source = null,
      admin_permission_id = null,
      admin_managed_campus_slugs = '{}',
      service_policy_version = null,
      service_policy_consented_at = null,
      privacy_policy_version = null,
      privacy_policy_consented_at = null,
      marketing_policy_version = null,
      marketing_policy_consented_at = null,
      active_profile_image_id = null,
      profile_photo_review_status = 'approved',
      anonymized_at = now(),
      updated_at = now()
  where id = p_member_id;

  if mattermost_account_uuid is not null then
    delete from public.mm_user_directory directory
    where directory.id = mattermost_account_uuid
      and not exists (
        select 1
        from public.members linked_member
        where linked_member.mattermost_account_id = directory.id
      );
  end if;

  return true;
end;
$$;

revoke all on function public.anonymize_deleted_member(uuid) from public;
revoke all on function public.anonymize_deleted_member(uuid) from anon;
revoke all on function public.anonymize_deleted_member(uuid) from authenticated;
grant execute on function public.anonymize_deleted_member(uuid) to service_role;

-- Phase 1 / backfill. Every statement is idempotent so Preview retries are
-- safe; ambiguous external identities are deliberately left unlinked.
update public.members
set generation = year
where generation is null;

update public.members
set staff_source_generation = staff_source_year
where staff_source_generation is null
  and staff_source_year is not null;

insert into public.mm_user_directory (
  mm_user_id,
  mm_username,
  display_name,
  campus,
  is_staff,
  source_years,
  display_name_snapshot,
  campus_snapshot,
  source_generations,
  is_active,
  last_seen_at,
  synced_at,
  updated_at
)
select
  member.mm_user_id,
  lower(btrim(member.mm_username)),
  coalesce(nullif(btrim(member.display_name), ''), lower(btrim(member.mm_username))),
  member.campus,
  member.year = 0,
  case when member.year = 0 then array[coalesce(member.staff_source_year, 0)] else array[member.year] end,
  coalesce(nullif(btrim(member.display_name), ''), lower(btrim(member.mm_username))),
  member.campus,
  case when member.year = 0 then array[coalesce(member.staff_source_year, 0)] else array[member.year] end,
  true,
  coalesce(member.updated_at, member.created_at, now()),
  coalesce(member.updated_at, member.created_at, now()),
  now()
from public.members member
where member.mm_user_id is not null
  and member.mm_username is not null
  and btrim(member.mm_username) <> ''
  and not exists (
    select 1
    from public.mm_user_directory existing_username
    where existing_username.mm_username = lower(btrim(member.mm_username))
      and existing_username.mm_user_id <> member.mm_user_id
  )
on conflict do nothing;

update public.mm_user_directory
set
  display_name_snapshot = coalesce(display_name_snapshot, display_name),
  campus_snapshot = coalesce(campus_snapshot, campus),
  source_generations = case
    when coalesce(array_length(source_generations, 1), 0) > 0 then source_generations
    else source_years
  end,
  last_seen_at = coalesce(last_seen_at, synced_at, updated_at, created_at),
  is_active = coalesce(is_active, true);

update public.mm_user_directory directory
set legacy_ssafy_mattermost_user_id = member.ssafy_mattermost_user_id,
    updated_at = now()
from public.members member
where directory.mm_user_id = member.mm_user_id
  and directory.legacy_ssafy_mattermost_user_id is null
  and member.ssafy_mattermost_user_id is not null
  and not exists (
    select 1
    from public.mm_user_directory conflicting_directory
    where conflicting_directory.legacy_ssafy_mattermost_user_id = member.ssafy_mattermost_user_id
      and conflicting_directory.id <> directory.id
  );

update public.members member
set mattermost_account_id = directory.id
from public.mm_user_directory directory
where member.mattermost_account_id is null
  and member.mm_user_id is not null
  and directory.mm_user_id = member.mm_user_id;

insert into public.member_ssafy_verifications (
  member_id,
  ssafy_sub,
  verified_at,
  auth_time,
  verification_id,
  track,
  track_name,
  last_scope,
  updated_at
)
select
  member.id,
  member.ssafy_sub,
  coalesce(member.ssafy_verified_at, member.updated_at, member.created_at, now()),
  member.ssafy_auth_time,
  member.ssafy_verification_id,
  member.ssafy_track,
  member.ssafy_track_name,
  member.ssafy_last_scope,
  now()
from public.members member
where member.ssafy_sub is not null
  and btrim(member.ssafy_sub) <> ''
on conflict do nothing;

update public.members member
set
  email = identity.identifier_normalized,
  email_normalized = identity.identifier_normalized,
  email_verified_at = coalesce(identity.verified_at, member.email_verified_at, now()),
  updated_at = now()
from public.member_auth_identities identity
where identity.member_id = member.id
  and identity.provider = 'graduate_email'
  and member.email_normalized is null;

update public.graduate_verification_requests
set inferred_generation = inferred_cohort
where inferred_generation is null;

insert into public.graduate_profiles (
  member_id,
  verification_request_id,
  verified_at,
  verification_source,
  updated_at
)
select
  member.id,
  request.id,
  coalesce(member.graduate_verified_at, request.reviewed_at, member.updated_at, now()),
  case
    when member.verification_source = 'graduate_certificate' then 'graduate_certificate'
    else 'legacy_migration'
  end,
  now()
from public.members member
left join public.member_auth_identities identity
  on identity.member_id = member.id
 and identity.provider = 'graduate_email'
left join lateral (
  select request_row.id, request_row.reviewed_at
  from public.graduate_verification_requests request_row
  where request_row.email_normalized = identity.identifier_normalized
    and request_row.status = 'approved'
  order by request_row.decided_at desc nulls last, request_row.created_at desc
  limit 1
) request on true
where member.graduate_verified_at is not null
on conflict do nothing;

insert into public.admin_profiles (
  member_id,
  permission_template_key,
  managed_campus_slugs,
  is_active,
  updated_at
)
select
  member.id,
  case
    when lower(coalesce(member.mm_username, '')) = 'myknow' then 'super_admin'
    else member.admin_permission_id
  end,
  coalesce(member.admin_managed_campus_slugs, '{}'),
  true,
  now()
from public.members member
where (
    member.admin_permission_id is not null
    or lower(coalesce(member.mm_username, '')) = 'myknow'
  )
  and exists (
    select 1
    from public.admin_permission_templates template
    where template.key = case
      when lower(coalesce(member.mm_username, '')) = 'myknow' then 'super_admin'
      else member.admin_permission_id
    end
  )
on conflict (member_id) do nothing;

update public.graduate_verification_requests request
set reviewer_admin_profile_id = profile.id
from public.admin_profiles profile
where request.reviewer_admin_profile_id is null
  and request.reviewer_admin_id = profile.member_id;

update public.member_profile_images image
set
  reviewer_admin_profile_id = profile.id,
  source = case
    when image.graduate_verification_request_id is not null then 'graduate_verification'
    when image.member_id is not null then 'member_upload'
    else 'legacy'
  end,
  updated_at = now()
from public.admin_profiles profile
where image.reviewer_admin_profile_id is null
  and image.reviewer_admin_id = profile.member_id;

update public.member_profile_images
set source = case
  when graduate_verification_request_id is not null then 'graduate_verification'
  when member_id is not null then 'member_upload'
  else 'legacy'
end
where source = 'legacy';

insert into public.member_policy_consents (
  member_id,
  policy_document_id,
  kind,
  version,
  agreed_at
)
select
  member.id,
  document.id,
  document.kind,
  document.version,
  consent.agreed_at
from public.members member
cross join lateral (
  values
    ('service'::text, member.service_policy_version, member.service_policy_consented_at),
    ('privacy'::text, member.privacy_policy_version, member.privacy_policy_consented_at),
    ('marketing'::text, member.marketing_policy_version, member.marketing_policy_consented_at)
) as consent(kind, version, agreed_at)
join public.policy_documents document
  on document.kind = consent.kind
 and document.version = consent.version
where consent.version is not null
  and consent.agreed_at is not null
on conflict (member_id, policy_document_id) do nothing;

-- New graduate approvals now write the normalized email, generation, graduate
-- profile, and administrator-profile references. Legacy identity/member fields
-- remain dual-written until the contract migration removes their readers.
create or replace function public.approve_graduate_verification(
  p_request_id uuid,
  p_admin_id uuid,
  p_document_number_hmac text,
  p_setup_token_hash text,
  p_setup_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_row public.graduate_verification_requests%rowtype;
  photo_row public.member_profile_images%rowtype;
  reviewer_profile_id uuid;
  new_member_id uuid;
  resolved_generation integer;
begin
  select * into request_row
  from public.graduate_verification_requests
  where id = p_request_id
  for update;
  if not found or request_row.status <> 'in_review' then
    raise exception 'graduate_verification_not_reviewable';
  end if;
  if request_row.profile_image_id is null then
    raise exception 'graduate_verification_profile_image_missing';
  end if;

  select * into photo_row
  from public.member_profile_images
  where id = request_row.profile_image_id
  for update;
  if not found or photo_row.status <> 'pending' then
    raise exception 'graduate_verification_profile_image_not_pending';
  end if;

  if exists (
    select 1
    from public.members member
    where member.email_normalized = request_row.email_normalized
      and member.deleted_at is null
  ) or exists (
    select 1
    from public.member_auth_identities identity
    where identity.provider = 'graduate_email'
      and identity.identifier_normalized = request_row.email_normalized
  ) then
    raise exception 'graduate_verification_email_exists';
  end if;
  if exists (
    select 1
    from public.graduate_verification_requests request
    where request.document_number_hmac = p_document_number_hmac
      and request.id <> p_request_id
      and request.status = 'approved'
  ) then
    raise exception 'graduate_verification_document_exists';
  end if;

  select profile.id into reviewer_profile_id
  from public.admin_profiles profile
  where profile.member_id = p_admin_id
    and profile.is_active = true;
  if reviewer_profile_id is null then
    raise exception 'graduate_verification_admin_profile_missing';
  end if;

  resolved_generation := coalesce(
    request_row.inferred_generation,
    request_row.inferred_cohort
  );
  if resolved_generation is null then
    raise exception 'graduate_verification_generation_missing';
  end if;

  insert into public.members (
    display_name,
    generation,
    year,
    campus,
    email,
    email_normalized,
    email_verified_at,
    must_change_password,
    graduate_verified_at,
    verification_source
  ) values (
    request_row.legal_name,
    resolved_generation,
    resolved_generation,
    request_row.campus,
    request_row.email,
    request_row.email_normalized,
    now(),
    true,
    now(),
    'graduate_certificate'
  ) returning id into new_member_id;

  insert into public.graduate_profiles (
    member_id,
    verification_request_id,
    verified_at,
    verification_source
  ) values (
    new_member_id,
    request_row.id,
    now(),
    'graduate_certificate'
  );

  insert into public.member_auth_identities (
    member_id,
    provider,
    identifier_normalized,
    verified_at
  ) values (
    new_member_id,
    'graduate_email',
    request_row.email_normalized,
    now()
  );

  update public.member_profile_images
  set member_id = new_member_id,
      source = 'graduate_verification',
      status = 'approved',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      updated_at = now()
  where id = photo_row.id;

  update public.members
  set active_profile_image_id = photo_row.id,
      profile_photo_review_status = 'approved',
      updated_at = now()
  where id = new_member_id;

  update public.graduate_verification_requests
  set status = 'approved',
      document_number_hmac = p_document_number_hmac,
      inferred_generation = resolved_generation,
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      decided_at = now(),
      certificate_delete_after = now() + interval '30 days',
      resubmission_targets = '{}',
      updated_at = now()
  where id = p_request_id;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    token_hash,
    expires_at
  ) values (
    new_member_id,
    'graduate_initial_setup',
    p_setup_token_hash,
    p_setup_expires_at
  );
  return new_member_id;
end;
$$;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from public;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from anon;
revoke all on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) from authenticated;
grant execute on function public.approve_graduate_verification(uuid, uuid, text, text, timestamp with time zone) to service_role;

create or replace function public.reissue_graduate_initial_setup(
  p_request_id uuid,
  p_setup_token_hash text,
  p_setup_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_row public.graduate_verification_requests%rowtype;
  member_row public.members%rowtype;
begin
  select * into request_row
  from public.graduate_verification_requests
  where id = p_request_id
    and status = 'approved'
  for update;
  if not found then
    raise exception 'graduate_initial_setup_request_invalid';
  end if;

  select member.* into member_row
  from public.members member
  join public.graduate_profiles profile
    on profile.member_id = member.id
  where member.email_normalized = request_row.email_normalized
    and member.must_change_password = true
    and member.deleted_at is null
  for update of member;
  if not found then
    raise exception 'graduate_initial_setup_already_completed';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = member_row.id
    and purpose = 'graduate_initial_setup'
    and consumed_at is null;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    token_hash,
    expires_at
  ) values (
    member_row.id,
    'graduate_initial_setup',
    p_setup_token_hash,
    p_setup_expires_at
  );
  return member_row.id;
end;
$$;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from public;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from anon;
revoke all on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.reissue_graduate_initial_setup(uuid, text, timestamp with time zone) to service_role;

create or replace function public.issue_graduate_password_reset(
  p_challenge_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  challenge_row public.graduate_email_challenges%rowtype;
  member_row public.members%rowtype;
begin
  select * into challenge_row
  from public.graduate_email_challenges
  where id = p_challenge_id
    and purpose = 'password_reset'
    and verified_at is not null
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'graduate_password_reset_challenge_invalid';
  end if;

  select member.* into member_row
  from public.members member
  join public.graduate_profiles profile
    on profile.member_id = member.id
  where member.email_normalized = challenge_row.email_normalized
    and member.deleted_at is null
  for update of member;
  if not found then
    update public.graduate_email_challenges
    set consumed_at = now()
    where id = challenge_row.id;
    return null;
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where member_id = member_row.id
    and purpose = 'graduate_password_reset'
    and consumed_at is null;

  insert into public.member_password_action_tokens (
    member_id,
    purpose,
    token_hash,
    expires_at
  ) values (
    member_row.id,
    'graduate_password_reset',
    p_token_hash,
    p_expires_at
  );
  update public.graduate_email_challenges
  set consumed_at = now()
  where id = challenge_row.id;
  return member_row.id;
end;
$$;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from public;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from anon;
revoke all on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.issue_graduate_password_reset(uuid, text, timestamp with time zone) to service_role;

-- Photo-review actions retain the legacy reviewer member ID for compatibility
-- and record the normalized administrator profile ID at the same time.
-- Reassert the manual setup completion function after the legacy snapshot
-- sections so the snapshot matches 20260715004800's final lock order.
create or replace function public.complete_manual_member_password_action(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  candidate_member_id uuid;
  member_row public.members%rowtype;
  token_row public.member_password_action_tokens%rowtype;
begin
  -- Identify the member without locking the token. All mutations below lock
  -- the member first, then the token, matching the reissue RPC.
  select member_id into candidate_member_id
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in ('manual_initial_setup', 'manual_password_reset')
    and consumed_at is null
    and expires_at > now();
  if not found then
    raise exception 'manual_password_action_invalid_or_expired';
  end if;

  select * into member_row
  from public.members
  where id = candidate_member_id
    and deleted_at is null
  for update;
  if not found then
    raise exception 'manual_password_action_member_missing';
  end if;

  select * into token_row
  from public.member_password_action_tokens
  where token_hash = p_token_hash
    and purpose in ('manual_initial_setup', 'manual_password_reset')
    and consumed_at is null
    and expires_at > now()
  for update;
  if not found or token_row.member_id <> member_row.id then
    raise exception 'manual_password_action_invalid_or_expired';
  end if;

  update public.member_password_action_tokens
  set consumed_at = now()
  where id = token_row.id;

  update public.members
  set password_hash = p_password_hash,
      password_salt = p_password_salt,
      must_change_password = false,
      email_verified_at = case
        when token_row.delivery_channel = 'email' then coalesce(email_verified_at, now())
        else email_verified_at
      end,
      updated_at = now()
  where id = member_row.id;

  return member_row.id;
end;
$$;

revoke all on function public.complete_manual_member_password_action(text, text, text) from public;
revoke all on function public.complete_manual_member_password_action(text, text, text) from anon;
revoke all on function public.complete_manual_member_password_action(text, text, text) from authenticated;
grant execute on function public.complete_manual_member_password_action(text, text, text) to service_role;

create or replace function public.approve_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
begin
  select * into image_row
  from public.member_profile_images
  where id = p_image_id
    and graduate_verification_request_id is null
    and member_id is not null
    and status = 'pending'
  for update;
  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;
  select * into member_row
  from public.members
  where id = image_row.member_id
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
  end if;
  select id into reviewer_profile_id
  from public.admin_profiles
  where member_id = p_admin_id
    and is_active = true;
  if reviewer_profile_id is null then
    raise exception 'profile_image_admin_profile_missing';
  end if;

  if member_row.active_profile_image_id is not null then
    update public.member_profile_images
    set status = 'superseded',
        delete_after = now() + interval '30 days',
        updated_at = now()
    where id = member_row.active_profile_image_id;
  end if;
  update public.member_profile_images
  set status = 'approved',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      reviewed_at = now(),
      updated_at = now()
  where id = image_row.id;
  update public.members
  set active_profile_image_id = image_row.id,
      profile_photo_review_status = 'approved',
      updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

create or replace function public.reject_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;
  select * into image_row
  from public.member_profile_images
  where id = p_image_id
    and graduate_verification_request_id is null
    and member_id is not null
    and status = 'pending'
  for update;
  if not found then
    raise exception 'profile_image_not_reviewable';
  end if;
  select * into member_row
  from public.members
  where id = image_row.member_id
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
  end if;
  select id into reviewer_profile_id
  from public.admin_profiles
  where member_id = p_admin_id
    and is_active = true;
  if reviewer_profile_id is null then
    raise exception 'profile_image_admin_profile_missing';
  end if;

  update public.member_profile_images
  set status = 'rejected',
      reviewer_admin_id = p_admin_id,
      reviewer_admin_profile_id = reviewer_profile_id,
      review_reason = btrim(p_reason),
      reviewed_at = now(),
      delete_after = now() + interval '30 days',
      updated_at = now()
  where id = image_row.id;
  update public.members
  set profile_photo_review_status = 'rejected',
      updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

create or replace function public.reject_member_active_profile_photo(
  p_member_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  reviewer_profile_id uuid;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;
  select * into member_row
  from public.members
  where id = p_member_id
  for update;
  if not found then
    raise exception 'profile_image_member_missing';
  end if;
  select id into reviewer_profile_id
  from public.admin_profiles
  where member_id = p_admin_id
    and is_active = true;
  if reviewer_profile_id is null then
    raise exception 'profile_image_admin_profile_missing';
  end if;

  if member_row.active_profile_image_id is not null then
    update public.member_profile_images
    set status = 'rejected',
        reviewer_admin_id = p_admin_id,
        reviewer_admin_profile_id = reviewer_profile_id,
        review_reason = btrim(p_reason),
        reviewed_at = now(),
        delete_after = now() + interval '30 days',
        updated_at = now()
    where id = member_row.active_profile_image_id
      and status = 'approved';
  end if;
  update public.members
  set active_profile_image_id = null,
      profile_photo_review_status = 'rejected',
      updated_at = now()
  where id = member_row.id;
  return member_row.id;
end;
$$;

revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from public;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from anon;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from authenticated;
grant execute on function public.approve_member_profile_image_replacement(uuid, uuid) to service_role;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from public;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from anon;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_profile_image_replacement(uuid, uuid, text) to service_role;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from public;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from anon;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_active_profile_photo(uuid, uuid, text) to service_role;
