-- Page a regional administrator's registration queue in the database instead of
-- loading a fixed client-side window and filtering it after the fact.
-- Rollback: drop function public.get_admin_partner_registration_request_page(text, integer, integer, text[]);

create index if not exists partner_registration_requests_status_created_id_idx
  on public.partner_registration_requests(status, created_at desc, id desc);

create or replace function public.get_admin_partner_registration_request_page(
  input_status text default null,
  input_page integer default 1,
  input_page_size integer default 12,
  input_managed_campus_slugs text[] default null
)
returns table (
  id uuid,
  total_count bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with parameters as (
    select
      case
        when input_status in ('pending', 'in_review', 'converted', 'rejected', 'archived')
          then input_status
        else null
      end as status_filter,
      greatest(coalesce(input_page, 1), 1) as page,
      least(greatest(coalesce(input_page_size, 12), 1), 24) as page_size,
      input_managed_campus_slugs is null as is_global,
      coalesce(input_managed_campus_slugs, '{}'::text[]) as managed_campus_slugs
  ),
  scoped_rows as (
    select request.id, request.created_at
    from public.partner_registration_requests as request
    left join public.partner_companies as company on company.id = request.company_id
    cross join parameters
    where (parameters.status_filter is null or request.status = parameters.status_filter)
      and (
        parameters.is_global
        or (
          company.id is not null
          and company.managed_campus_slugs && parameters.managed_campus_slugs
        )
        or (
          company.id is null
          and request.location ~ '(전국|전\s*지점|전체\s*지점|모든\s*지점|전\s*매장|전체\s*매장|모든\s*매장|서울|강남|역삼|역삼역|선릉|테헤란|봉은사|논현|구미|경북|경상북도|대전|유성|둔산|부산|울산|경남|창원|김해|양산|해운대|서면|광주|전남)'
          and public.infer_partner_campus_slugs(request.location) && parameters.managed_campus_slugs
        )
      )
  ),
  numbered_rows as (
    select
      id,
      created_at,
      count(*) over()::bigint as total_count,
      row_number() over (order by created_at desc, id desc) as row_num
    from scoped_rows
  )
  select numbered_rows.id, numbered_rows.total_count
  from numbered_rows
  cross join parameters
  where numbered_rows.row_num > ((parameters.page - 1) * parameters.page_size)
    and numbered_rows.row_num <= (parameters.page * parameters.page_size)
  order by numbered_rows.row_num;
$$;

revoke all on function public.get_admin_partner_registration_request_page(text, integer, integer, text[]) from public;
revoke all on function public.get_admin_partner_registration_request_page(text, integer, integer, text[]) from anon;
revoke all on function public.get_admin_partner_registration_request_page(text, integer, integer, text[]) from authenticated;
grant execute on function public.get_admin_partner_registration_request_page(text, integer, integer, text[]) to service_role;
