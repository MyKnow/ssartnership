-- Manual member import photos now point at the common image-upload session.
-- Legacy staging columns remain readable until previously prepared batches expire.
alter table public.manual_member_import_rows
  add column if not exists image_upload_id uuid
    references public.image_upload_sessions(id) on delete set null,
  add column if not exists photo_sha256 text,
  add column if not exists photo_width integer,
  add column if not exists photo_height integer;

alter table public.manual_member_import_rows
  drop constraint if exists manual_member_import_rows_photo_check;
alter table public.manual_member_import_rows
  add constraint manual_member_import_rows_photo_check
  check (
    (
      photo_filename is null
      and staging_bucket is null
      and staging_path is null
      and photo_content_type is null
      and photo_size_bytes is null
      and image_upload_id is null
      and photo_sha256 is null
      and photo_width is null
      and photo_height is null
    )
    or (
      image_upload_id is null
      and photo_filename is not null
      and staging_bucket = 'manual-member-import-staging'
      and staging_path is not null
      and photo_content_type in ('image/jpeg', 'image/png', 'image/webp')
      and photo_size_bytes between 1 and 5242880
      and photo_sha256 is null
      and photo_width is null
      and photo_height is null
    )
    or (
      image_upload_id is not null
      and photo_filename is not null
      and staging_bucket = 'member-profile-images'
      and staging_path is not null
      and photo_content_type = 'image/webp'
      and photo_size_bytes is null
      and photo_sha256 ~ '^[0-9a-f]{64}$'
      and photo_width = 640
      and photo_height = 640
    )
  );

create index if not exists manual_member_import_rows_image_upload_idx
  on public.manual_member_import_rows(image_upload_id)
  where image_upload_id is not null;
