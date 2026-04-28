-- First-pass DB/service query refactor.
-- Rollback, if needed:
--   alter table public.partner_accounts add column if not exists initial_setup_verification_code_hash text;
--   drop index if exists public.members_display_name_idx;
--   drop index if exists public.members_year_campus_display_name_idx;
--   drop index if exists public.members_campus_display_name_idx;
--   drop index if exists public.auth_security_logs_member_policy_consent_idx;
--   drop index if exists public.push_subscriptions_active_member_idx;
--   drop index if exists public.partner_reviews_admin_created_at_idx;
--   drop index if exists public.partner_reviews_admin_hidden_created_at_idx;
--   drop index if exists public.partner_reviews_admin_rating_created_at_idx;

alter table public.partner_accounts
  drop column if exists initial_setup_verification_code_hash;

create index if not exists members_display_name_idx
  on public.members (display_name);

create index if not exists members_year_campus_display_name_idx
  on public.members (year, campus, display_name);

create index if not exists members_campus_display_name_idx
  on public.members (campus, display_name);

create index if not exists auth_security_logs_member_policy_consent_idx
  on public.auth_security_logs (actor_type, event_name, status, actor_id, created_at desc)
  where actor_id is not null;

create index if not exists push_subscriptions_active_member_idx
  on public.push_subscriptions (member_id)
  where is_active = true;

create index if not exists partner_reviews_admin_created_at_idx
  on public.partner_reviews (created_at desc)
  where deleted_at is null;

create index if not exists partner_reviews_admin_hidden_created_at_idx
  on public.partner_reviews (hidden_at, created_at desc)
  where deleted_at is null;

create index if not exists partner_reviews_admin_rating_created_at_idx
  on public.partner_reviews (rating, created_at desc)
  where deleted_at is null;
