-- Keep the browser-uploaded object separate from the normalized object.
-- Supabase Storage can serve stale bytes after an in-place upsert, so the
-- attach step must read a new immutable path for the normalized image.
alter table public.image_upload_sessions
  add column if not exists source_storage_path text;

update public.image_upload_sessions
set source_storage_path = storage_path
where source_storage_path is null;

create index if not exists image_upload_sessions_source_path_idx
  on public.image_upload_sessions(source_storage_path)
  where source_storage_path is not null;
