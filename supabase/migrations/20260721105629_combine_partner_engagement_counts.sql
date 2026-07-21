-- One round trip for the two always-co-requested partner engagement counters.
-- The legacy count RPCs remain for compatibility with existing integrations.
create or replace function public.get_partner_engagement_counts(input_partner_ids uuid[])
returns table (
  partner_id uuid,
  favorite_count bigint,
  review_count bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with requested as (
    select unnest(coalesce(input_partner_ids, '{}'::uuid[])) as partner_id
  ),
  favorites as (
    select
      partner_favorites.partner_id,
      count(*)::bigint as favorite_count
    from public.partner_favorites
    where partner_favorites.partner_id = any(coalesce(input_partner_ids, '{}'::uuid[]))
    group by partner_favorites.partner_id
  ),
  reviews as (
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
    coalesce(favorites.favorite_count, 0)::bigint as favorite_count,
    coalesce(reviews.review_count, 0)::bigint as review_count
  from requested
  left join favorites using (partner_id)
  left join reviews using (partner_id);
$$;

revoke all on function public.get_partner_engagement_counts(uuid[]) from public;
revoke all on function public.get_partner_engagement_counts(uuid[]) from anon;
revoke all on function public.get_partner_engagement_counts(uuid[]) from authenticated;
grant execute on function public.get_partner_engagement_counts(uuid[]) to service_role;
