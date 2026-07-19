-- Atomically claim a signed staging object before the server normalizes it.
-- Without this state, two concurrent completion requests can both transform an
-- upload and one can mark the other's ready result as failed.
alter table public.image_upload_sessions
  drop constraint if exists image_upload_sessions_status_check;

alter table public.image_upload_sessions
  add constraint image_upload_sessions_status_check
  check (status in ('signed', 'processing', 'ready', 'attaching', 'attached', 'expired', 'failed'));

drop index if exists public.image_upload_sessions_expiry_idx;
create index if not exists image_upload_sessions_expiry_idx
  on public.image_upload_sessions(status, expires_at)
  where status in ('signed', 'processing', 'ready', 'attaching');
