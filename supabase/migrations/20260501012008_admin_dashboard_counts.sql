-- Consolidate admin dashboard summary counts into one RPC to reduce repeated PostgREST count queries.
-- Rollback, if needed:
--   drop function if exists public.get_admin_dashboard_counts();

create or replace function public.get_admin_dashboard_counts()
returns table (
  member_count bigint,
  company_count bigint,
  partner_count bigint,
  category_count bigint,
  account_count bigint,
  review_count bigint,
  active_push_subscription_count bigint,
  product_log_count bigint,
  audit_log_count bigint,
  security_log_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    (select count(*)::bigint from public.members) as member_count,
    (select count(*)::bigint from public.partner_companies) as company_count,
    (select count(*)::bigint from public.partners) as partner_count,
    (select count(*)::bigint from public.categories) as category_count,
    (select count(*)::bigint from public.partner_accounts) as account_count,
    (
      select count(*)::bigint
      from public.partner_reviews
      where deleted_at is null
    ) as review_count,
    (
      select count(*)::bigint
      from public.push_subscriptions
      where is_active = true
    ) as active_push_subscription_count,
    (select count(*)::bigint from public.event_logs) as product_log_count,
    (select count(*)::bigint from public.admin_audit_logs) as audit_log_count,
    (select count(*)::bigint from public.auth_security_logs) as security_log_count;
$$;
