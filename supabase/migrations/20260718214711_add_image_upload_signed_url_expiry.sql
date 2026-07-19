-- Supabase Storage signed upload URLs are currently valid for two hours.
-- Keep the actual staging object private, and enforce our shorter 10-minute
-- acceptance window in the application/session layer.
alter table public.image_upload_sessions
  add column if not exists signed_url_expires_at timestamp with time zone;

update public.image_upload_sessions
set signed_url_expires_at = least(expires_at, created_at + interval '10 minutes')
where signed_url_expires_at is null;

alter table public.image_upload_sessions
  alter column signed_url_expires_at set not null;

alter table public.image_upload_sessions
  drop constraint if exists image_upload_sessions_signed_url_expiry_check;

alter table public.image_upload_sessions
  add constraint image_upload_sessions_signed_url_expiry_check
  check (signed_url_expires_at <= expires_at);

create index if not exists image_upload_sessions_signed_url_expiry_idx
  on public.image_upload_sessions(status, signed_url_expires_at)
  where status = 'signed';
