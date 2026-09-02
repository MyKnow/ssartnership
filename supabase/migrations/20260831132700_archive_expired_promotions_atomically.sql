create or replace function public.archive_expired_promotions_batch(
  input_now timestamp with time zone default pg_catalog.clock_timestamp(),
  input_limit integer default 100
)
returns table (
  archived_event_slugs text[],
  archived_slide_count bigint
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with expired_events as materialized (
    select promotion_events.slug
    from public.promotion_events
    where promotion_events.is_active = true
      and promotion_events.ends_at < coalesce(input_now, pg_catalog.clock_timestamp())
    order by promotion_events.ends_at asc, promotion_events.slug asc
    limit least(greatest(coalesce(input_limit, 100), 1), 100)
    for update of promotion_events skip locked
  ),
  archived_events as (
    update public.promotion_events
    set is_active = false
    where slug in (select expired_events.slug from expired_events)
    returning slug
  ),
  archived_slides as (
    update public.promotion_slides
    set is_active = false
    where is_active = true
      and event_slug in (select archived_events.slug from archived_events)
    returning id
  )
  select
    coalesce(
      array(
        select archived_events.slug
        from archived_events
        order by archived_events.slug asc
      ),
      '{}'::text[]
    ) as archived_event_slugs,
    (
      select pg_catalog.count(*)::bigint
      from archived_slides
    ) as archived_slide_count;
$$;

revoke all on function public.archive_expired_promotions_batch(timestamp with time zone, integer) from public;
revoke all on function public.archive_expired_promotions_batch(timestamp with time zone, integer) from anon;
revoke all on function public.archive_expired_promotions_batch(timestamp with time zone, integer) from authenticated;
grant execute on function public.archive_expired_promotions_batch(timestamp with time zone, integer) to service_role;
