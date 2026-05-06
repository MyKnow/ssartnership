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
  updated_at timestamp with time zone default now()
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
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists partners (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references partner_companies(id) on delete set null,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  visibility text not null default 'public',
  benefit_visibility text not null default 'public',
  location text not null,
  campus_slugs text[] not null default '{}',
  map_url text,
  reservation_link text,
  inquiry_link text,
  period_start date,
  period_end date,
  conditions text[] not null default '{}',
  benefits text[] not null default '{}',
  applies_to text[] not null default '{staff,student,graduate}',
  thumbnail text,
  images text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
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
alter table partners add column if not exists campus_slugs text[] not null default '{}';
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
update partners
set campus_slugs = public.infer_partner_campus_slugs(location)
where cardinality(campus_slugs) = 0;
alter table partners drop constraint if exists partners_campus_slugs_check;
alter table partners add constraint partners_campus_slugs_check
  check (
    cardinality(campus_slugs) > 0
    and campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
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
alter table partners add column if not exists reservation_link text;
alter table partners add column if not exists inquiry_link text;
alter table partners add column if not exists updated_at timestamp with time zone default now();
alter table partners drop column if exists contact;

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
alter table partner_change_requests add column if not exists current_map_url text;
alter table partner_change_requests add column if not exists current_campus_slugs text[] not null default '{}';
alter table partner_change_requests add column if not exists current_tags text[] not null default '{}';
alter table partner_change_requests add column if not exists requested_partner_name text not null default '';
alter table partner_change_requests add column if not exists requested_partner_location text not null default '';
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
  avatar_content_type text,
  avatar_base64 text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

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
    (select count(*)::bigint from public.event_logs) as product_log_count,
    (select count(*)::bigint from public.admin_audit_logs) as audit_log_count,
    (select count(*)::bigint from public.auth_security_logs) as security_log_count;
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

create table if not exists mm_verification_codes (
  id uuid primary key default uuid_generate_v4(),
  code_hash text not null,
  expires_at timestamp with time zone not null,
  mm_user_id text not null,
  mm_username text not null,
  display_name text,
  year integer not null,
  campus text,
  avatar_content_type text,
  avatar_base64 text,
  created_at timestamp with time zone default now()
);

alter table mm_verification_codes drop column if exists email;
alter table mm_verification_codes drop column if exists region;
alter table mm_verification_codes add column if not exists year integer;
update mm_verification_codes set year = 15 where year is null;
alter table mm_verification_codes alter column year set not null;
alter table mm_verification_codes alter column year drop default;
alter table mm_verification_codes drop constraint if exists mm_verification_codes_year_check;
alter table mm_verification_codes
  add constraint mm_verification_codes_year_check check (year between 0 and 99);
comment on column mm_verification_codes.year is 'SSAFY year; 0 indicates staff';

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
  delivered_at timestamp with time zone,
  created_at timestamp with time zone default now()
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
  created_at timestamp with time zone default now()
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

create table if not exists admin_audit_logs (
  id uuid primary key default uuid_generate_v4(),
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

create table if not exists auth_security_logs (
  id uuid primary key default uuid_generate_v4(),
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
create index if not exists partners_updated_at_idx on partners(updated_at desc);
create index if not exists categories_updated_at_idx on categories(updated_at desc);
create index if not exists partner_companies_name_idx on partner_companies(name);
create index if not exists admin_login_attempts_identifier_idx on admin_login_attempts(identifier);
create index if not exists suggestion_attempts_identifier_idx on suggestion_attempts(identifier);
create index if not exists member_auth_attempts_identifier_idx on member_auth_attempts(identifier);
create index if not exists partner_accounts_login_id_idx on partner_accounts(login_id);
create index if not exists partner_account_companies_account_id_idx on partner_account_companies(account_id);
create index if not exists partner_account_companies_company_id_idx on partner_account_companies(company_id);
create index if not exists partner_auth_attempts_identifier_idx on partner_auth_attempts(identifier);
create index if not exists partner_change_requests_company_id_idx on partner_change_requests(company_id);
create index if not exists partner_change_requests_partner_id_idx on partner_change_requests(partner_id);
create index if not exists partner_change_requests_status_idx on partner_change_requests(status);
create index if not exists partner_change_requests_created_at_idx on partner_change_requests(created_at desc);
create unique index if not exists partner_change_requests_pending_partner_idx
  on partner_change_requests(partner_id)
  where status = 'pending';
create index if not exists mm_verification_attempts_identifier_idx on mm_verification_attempts(identifier);
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
create index if not exists event_logs_created_at_idx on event_logs(created_at desc);
create index if not exists event_logs_event_name_idx on event_logs(event_name);
create index if not exists event_logs_actor_id_idx on event_logs(actor_id);
create index if not exists event_logs_target_idx on event_logs(target_type, target_id);
create index if not exists event_logs_partner_metric_idx
  on event_logs(target_type, target_id, event_name, created_at)
  where target_id is not null;
create index if not exists event_logs_path_idx on event_logs(path);
create index if not exists event_logs_session_id_idx on event_logs(session_id);
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
create index if not exists admin_audit_logs_action_idx on admin_audit_logs(action);
create index if not exists admin_audit_logs_actor_id_idx on admin_audit_logs(actor_id);
create index if not exists admin_audit_logs_target_idx on admin_audit_logs(target_type, target_id);
create index if not exists auth_security_logs_created_at_idx on auth_security_logs(created_at desc);
create index if not exists auth_security_logs_event_name_idx on auth_security_logs(event_name);
create index if not exists auth_security_logs_status_idx on auth_security_logs(status);
create index if not exists auth_security_logs_actor_id_idx on auth_security_logs(actor_id);
create index if not exists auth_security_logs_identifier_idx on auth_security_logs(identifier);
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

drop index if exists mm_verification_codes_email_idx;

alter table categories enable row level security;
alter table public_cache_versions enable row level security;
alter table partner_companies enable row level security;
alter table partners enable row level security;
alter table partner_accounts enable row level security;
alter table partner_account_companies enable row level security;
alter table partner_auth_attempts enable row level security;
alter table admin_login_attempts enable row level security;
alter table suggestion_attempts enable row level security;
alter table member_auth_attempts enable row level security;
alter table members enable row level security;
alter table policy_documents enable row level security;
alter table member_policy_consents enable row level security;
alter table mm_user_directory enable row level security;
alter table mm_verification_codes enable row level security;
alter table mm_verification_attempts enable row level security;
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
revoke all on table member_auth_attempts from anon;
revoke all on table member_auth_attempts from authenticated;
revoke all on table public_cache_versions from anon;
revoke all on table public_cache_versions from authenticated;
revoke all on table partner_companies from anon;
revoke all on table partner_companies from authenticated;
revoke all on table partner_accounts from anon;
revoke all on table partner_accounts from authenticated;
revoke all on table partner_account_companies from anon;
revoke all on table partner_account_companies from authenticated;
revoke all on table partner_auth_attempts from anon;
revoke all on table partner_auth_attempts from authenticated;
revoke all on table partner_change_requests from anon;
revoke all on table partner_change_requests from authenticated;
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
revoke all on table mm_verification_codes from anon;
revoke all on table mm_verification_codes from authenticated;
revoke all on table mm_verification_attempts from anon;
revoke all on table mm_verification_attempts from authenticated;
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
revoke all on table admin_audit_logs from anon;
revoke all on table admin_audit_logs from authenticated;
revoke all on table auth_security_logs from anon;
revoke all on table auth_security_logs from authenticated;
