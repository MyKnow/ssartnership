-- Add explicit campus visibility scopes for partner listings.
-- Rollback, if needed:
--   alter table public.partner_change_requests drop constraint if exists partner_change_requests_requested_campus_slugs_check;
--   alter table public.partner_change_requests drop constraint if exists partner_change_requests_current_campus_slugs_check;
--   alter table public.partner_change_requests drop column if exists requested_campus_slugs;
--   alter table public.partner_change_requests drop column if exists current_campus_slugs;
--   alter table public.partners drop constraint if exists partners_campus_slugs_check;
--   alter table public.partners drop column if exists campus_slugs;

alter table public.partners
  add column if not exists campus_slugs text[] not null default '{}';

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

update public.partners
set campus_slugs = public.infer_partner_campus_slugs(location)
where cardinality(campus_slugs) = 0;

alter table public.partners
  drop constraint if exists partners_campus_slugs_check;

alter table public.partners
  add constraint partners_campus_slugs_check
  check (
    cardinality(campus_slugs) > 0
    and campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
  );

alter table public.partner_change_requests
  add column if not exists current_campus_slugs text[] not null default '{}',
  add column if not exists requested_campus_slugs text[] not null default '{}';

update public.partner_change_requests as request
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
from public.partners
where partners.id = request.partner_id;

update public.partner_change_requests
set
  current_campus_slugs = public.infer_partner_campus_slugs(current_partner_location),
  requested_campus_slugs = public.infer_partner_campus_slugs(requested_partner_location)
where cardinality(current_campus_slugs) = 0
   or cardinality(requested_campus_slugs) = 0;

alter table public.partner_change_requests
  drop constraint if exists partner_change_requests_current_campus_slugs_check;

alter table public.partner_change_requests
  add constraint partner_change_requests_current_campus_slugs_check
  check (
    cardinality(current_campus_slugs) > 0
    and current_campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
  );

alter table public.partner_change_requests
  drop constraint if exists partner_change_requests_requested_campus_slugs_check;

alter table public.partner_change_requests
  add constraint partner_change_requests_requested_campus_slugs_check
  check (
    cardinality(requested_campus_slugs) > 0
    and requested_campus_slugs <@ array['seoul','gumi','daejeon','busan-ulsan-gyeongnam','gwangju']::text[]
  );
