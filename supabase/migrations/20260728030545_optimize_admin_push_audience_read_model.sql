-- Return only the audience facets needed by the admin push composer.
-- This avoids transferring every active member row just to derive years and
-- campuses while keeping partner options in the same read-model request.
-- Rollback:
--   drop function if exists public.get_admin_push_audience_facets();

create or replace function public.get_admin_push_audience_facets()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'memberCount', (
      select count(*)::integer
      from public.members
      where deleted_at is null
    ),
    'availableYears', coalesce((
      select jsonb_agg(generation order by generation desc)
      from (
        select distinct generation
        from public.members
        where deleted_at is null
          and generation is not null
      ) years
    ), '[]'::jsonb),
    'availableCampuses', coalesce((
      select jsonb_agg(campus order by campus)
      from (
        select distinct trim(campus) as campus
        from public.members
        where deleted_at is null
          and nullif(trim(campus), '') is not null
      ) campuses
    ), '[]'::jsonb),
    'partners', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', id, 'name', name)
        order by name, id
      )
      from public.partners
    ), '[]'::jsonb),
    'partnerCount', (select count(*)::integer from public.partners)
  );
$$;

revoke all on function public.get_admin_push_audience_facets() from public;
revoke all on function public.get_admin_push_audience_facets() from anon;
revoke all on function public.get_admin_push_audience_facets() from authenticated;
grant execute on function public.get_admin_push_audience_facets() to service_role;
