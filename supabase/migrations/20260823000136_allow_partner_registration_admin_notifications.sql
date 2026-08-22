-- Allow the operational notification emitted by public partner registration.
-- Existing notification rows already use the legacy values retained below.
alter table public.admin_notifications
  drop constraint if exists admin_notifications_type_check;

alter table public.admin_notifications
  add constraint admin_notifications_type_check
  check (
    type in (
      'partner_change_request',
      'partner_immediate_update',
      'expiring_partner',
      'security_alert',
      'partner_registration_request'
    )
  );
