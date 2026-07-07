alter table public.members
  add column if not exists admin_managed_campus_slugs text[] not null default '{}';

alter table public.members
  drop constraint if exists members_admin_managed_campus_slugs_check;

alter table public.members
  add constraint members_admin_managed_campus_slugs_check
  check (
    admin_managed_campus_slugs <@ array[
      'seoul',
      'gumi',
      'daejeon',
      'busan-ulsan-gyeongnam',
      'gwangju'
    ]::text[]
  );

alter table public.partner_companies
  add column if not exists managed_campus_slugs text[] not null default '{}';

alter table public.partners
  add column if not exists managed_campus_slugs text[] not null default '{}';

update public.partners
set managed_campus_slugs = case
  when cardinality(managed_campus_slugs) > 0 then managed_campus_slugs
  when cardinality(campus_slugs) > 0 then campus_slugs
  else public.infer_partner_campus_slugs(location)
end
where cardinality(managed_campus_slugs) = 0;

with company_managed_campuses as (
  select
    company_id,
    array_agg(distinct campus_slug order by campus_slug) as managed_campus_slugs
  from public.partners
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
update public.partner_companies
set managed_campus_slugs = company_managed_campuses.managed_campus_slugs
from company_managed_campuses
where partner_companies.id = company_managed_campuses.company_id
  and cardinality(partner_companies.managed_campus_slugs) = 0;

update public.partner_companies
set managed_campus_slugs = array[
  'seoul',
  'gumi',
  'daejeon',
  'busan-ulsan-gyeongnam',
  'gwangju'
]::text[]
where cardinality(managed_campus_slugs) = 0;

alter table public.partner_companies
  drop constraint if exists partner_companies_managed_campus_slugs_check;

alter table public.partner_companies
  add constraint partner_companies_managed_campus_slugs_check
  check (
    cardinality(managed_campus_slugs) > 0
    and managed_campus_slugs <@ array[
      'seoul',
      'gumi',
      'daejeon',
      'busan-ulsan-gyeongnam',
      'gwangju'
    ]::text[]
  );

alter table public.partners
  drop constraint if exists partners_managed_campus_slugs_check;

alter table public.partners
  add constraint partners_managed_campus_slugs_check
  check (
    cardinality(managed_campus_slugs) > 0
    and managed_campus_slugs <@ array[
      'seoul',
      'gumi',
      'daejeon',
      'busan-ulsan-gyeongnam',
      'gwangju'
    ]::text[]
  );

create index if not exists members_admin_managed_campus_slugs_idx
  on public.members using gin (admin_managed_campus_slugs)
  where cardinality(admin_managed_campus_slugs) > 0;

create index if not exists partner_companies_managed_campus_slugs_idx
  on public.partner_companies using gin (managed_campus_slugs);

create index if not exists partners_managed_campus_slugs_idx
  on public.partners using gin (managed_campus_slugs);

insert into public.admin_permission_templates (key, name, description, permissions)
values
  (
    'regional_partner_manager',
    '지역 제휴 관리자',
    '배정된 지역의 제휴처와 파트너사 운영을 담당합니다.',
    '{"members":{"create":false,"read":false,"update":false,"delete":false},"reviews":{"create":false,"read":true,"update":false,"delete":false},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":false},"companies":{"create":true,"read":true,"update":true,"delete":false},"notifications":{"create":false,"read":false,"update":false,"delete":false},"home_ads":{"create":false,"read":false,"update":false,"delete":false},"events":{"create":false,"read":false,"update":false,"delete":false},"cycles":{"create":false,"read":false,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb
  )
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    permissions = excluded.permissions,
    updated_at = now();
