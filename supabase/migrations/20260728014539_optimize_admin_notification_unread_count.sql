-- Keep the exact unread count on the admin notification inbox index-only path.
-- Rollback, if needed:
--   drop index if exists public.admin_notification_recipients_unread_admin_idx;

create index if not exists admin_notification_recipients_unread_admin_idx
  on public.admin_notification_recipients(admin_id)
  where deleted_at is null and read_at is null;
