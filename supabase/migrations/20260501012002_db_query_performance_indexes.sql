-- Optimize observed members list and partner metric queries.
-- Rollback, if needed:
--   drop index if exists public.members_year_created_at_idx;
--   drop index if exists public.members_created_at_idx;
--   drop index if exists public.event_logs_partner_metric_idx;

create index if not exists members_year_created_at_idx
  on public.members (year desc, created_at desc);

create index if not exists members_created_at_idx
  on public.members (created_at desc);

create index if not exists event_logs_partner_metric_idx
  on public.event_logs (target_type, target_id, event_name, created_at)
  where target_id is not null;
