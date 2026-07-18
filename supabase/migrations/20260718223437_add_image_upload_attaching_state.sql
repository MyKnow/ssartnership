-- Claim a ready upload before copying it to the final bucket. This makes an
-- interrupted or concurrent attach retryable without allowing one upload ID
-- to be connected to two different final assets.
alter table public.image_upload_sessions
  drop constraint if exists image_upload_sessions_status_check;

alter table public.image_upload_sessions
  add constraint image_upload_sessions_status_check
  check (status in ('signed', 'ready', 'attaching', 'attached', 'expired', 'failed'));

drop index if exists public.image_upload_sessions_expiry_idx;
create index if not exists image_upload_sessions_expiry_idx
  on public.image_upload_sessions(status, expires_at)
  where status in ('signed', 'ready', 'attaching');
