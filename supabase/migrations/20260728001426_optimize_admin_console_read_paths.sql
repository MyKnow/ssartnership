-- Keep the high-frequency admin inbox and push recipient reads on narrow,
-- active-only index paths.
-- Rollback:
--   drop index if exists public.admin_notification_recipients_active_admin_created_idx;
--   drop index if exists public.members_admin_recipient_display_name_idx;

create index if not exists admin_notification_recipients_active_admin_created_idx
  on public.admin_notification_recipients(admin_id, created_at desc)
  where deleted_at is null;

create index if not exists members_admin_recipient_display_name_idx
  on public.members(display_name)
  include (id, mattermost_account_id, generation, campus)
  where deleted_at is null;
