-- Review count helpers that keep read paths cheap without introducing persisted counters yet.
-- Rollback, if needed:
--   drop function if exists public.get_admin_review_counts();
--   drop function if exists public.get_partner_review_visibility_counts(uuid);
--   drop function if exists public.get_member_visible_review_count_in_range(uuid, timestamp with time zone, timestamp with time zone);
--   drop index if exists public.partner_reviews_member_id_deleted_hidden_created_at_idx;

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

create index if not exists partner_reviews_member_id_deleted_hidden_created_at_idx
  on public.partner_reviews (member_id, deleted_at, hidden_at, created_at desc);
