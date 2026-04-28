-- Aggregate partner favorite/review counts inside Postgres instead of reading raw rows into app code.
-- Rollback, if needed:
--   drop function if exists public.get_partner_favorite_counts(uuid[]);
--   drop function if exists public.get_partner_review_counts(uuid[]);

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
