alter table public.partner_publication_notification_states
  add column if not exists new_partner_notification_processing_at timestamp with time zone;
