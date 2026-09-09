create or replace function public.get_admin_member_filter_options()
returns table (
  generations integer[],
  campuses text[]
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    coalesce(
      array(
        select distinct members.generation
        from public.members as members
        where members.deleted_at is null
          and members.generation is not null
        order by members.generation desc
      ),
      '{}'::integer[]
    ) as generations,
    coalesce(
      array(
        select distinct btrim(members.campus)
        from public.members as members
        where members.deleted_at is null
          and members.campus is not null
          and btrim(members.campus) <> ''
        order by btrim(members.campus) asc
      ),
      '{}'::text[]
    ) as campuses;
$$;

revoke all on function public.get_admin_member_filter_options() from public;
revoke all on function public.get_admin_member_filter_options() from anon;
revoke all on function public.get_admin_member_filter_options() from authenticated;
grant execute on function public.get_admin_member_filter_options() to service_role;
