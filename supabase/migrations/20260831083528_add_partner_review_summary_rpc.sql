create or replace function public.get_partner_review_summary(
  input_partner_id uuid,
  input_rating integer default null,
  input_images_only boolean default false
)
returns table (
  average_rating numeric,
  total_count bigint,
  rating_1_count bigint,
  rating_2_count bigint,
  rating_3_count bigint,
  rating_4_count bigint,
  rating_5_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(round(avg(reviews.rating)::numeric, 1), 0::numeric) as average_rating,
    count(*)::bigint as total_count,
    count(*) filter (where reviews.rating = 1)::bigint as rating_1_count,
    count(*) filter (where reviews.rating = 2)::bigint as rating_2_count,
    count(*) filter (where reviews.rating = 3)::bigint as rating_3_count,
    count(*) filter (where reviews.rating = 4)::bigint as rating_4_count,
    count(*) filter (where reviews.rating = 5)::bigint as rating_5_count
  from public.partner_reviews reviews
  where reviews.partner_id = input_partner_id
    and reviews.deleted_at is null
    and reviews.hidden_at is null
    and (input_rating is null or reviews.rating = input_rating)
    and (
      not input_images_only
      or coalesce(cardinality(reviews.images), 0) > 0
    );
$$;

revoke all on function public.get_partner_review_summary(uuid, integer, boolean) from public;
revoke all on function public.get_partner_review_summary(uuid, integer, boolean) from anon;
revoke all on function public.get_partner_review_summary(uuid, integer, boolean) from authenticated;
grant execute on function public.get_partner_review_summary(uuid, integer, boolean) to service_role;
