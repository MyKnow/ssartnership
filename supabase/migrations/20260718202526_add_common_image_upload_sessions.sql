-- Shared, private staging for browser image uploads. Final assets remain in
-- their existing public/private feature buckets so current read contracts do
-- not change during the rollout.
create table if not exists public.image_upload_sessions (
  id uuid primary key default uuid_generate_v4(),
  owner_kind text not null,
  owner_id text not null,
  purpose text not null,
  role text not null,
  storage_bucket text not null default 'image-upload-staging',
  storage_path text not null unique,
  source_content_type text,
  source_size_bytes integer,
  content_type text,
  sha256 text,
  width integer,
  height integer,
  final_bucket text,
  final_path text,
  final_url text,
  status text not null default 'signed',
  expires_at timestamp with time zone not null,
  completed_at timestamp with time zone,
  attached_at timestamp with time zone,
  attached_resource_type text,
  attached_resource_id text,
  failure_code text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint image_upload_sessions_owner_kind_check
    check (owner_kind in ('admin', 'member', 'partner', 'graduate_challenge', 'guest')),
  constraint image_upload_sessions_owner_id_check
    check (char_length(btrim(owner_id)) between 1 and 256),
  constraint image_upload_sessions_purpose_check
    check (purpose in (
      'partner',
      'partner-registration',
      'partner-change-request',
      'review',
      'profile',
      'graduate-verification',
      'manual-member-import',
      'promotion'
    )),
  constraint image_upload_sessions_bucket_check
    check (storage_bucket = 'image-upload-staging'),
  constraint image_upload_sessions_source_size_check
    check (source_size_bytes is null or source_size_bytes between 1 and 10485760),
  constraint image_upload_sessions_final_content_type_check
    check (content_type is null or content_type = 'image/webp'),
  constraint image_upload_sessions_sha256_check
    check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  constraint image_upload_sessions_dimensions_check
    check (
      (width is null and height is null)
      or (width between 1 and 10000 and height between 1 and 10000)
    ),
  constraint image_upload_sessions_status_check
    check (status in ('signed', 'ready', 'attached', 'expired', 'failed'))
);

create index if not exists image_upload_sessions_owner_lookup_idx
  on public.image_upload_sessions(owner_kind, owner_id, purpose, expires_at desc);
create index if not exists image_upload_sessions_expiry_idx
  on public.image_upload_sessions(status, expires_at)
  where status in ('signed', 'ready');
create index if not exists image_upload_sessions_final_path_idx
  on public.image_upload_sessions(final_bucket, final_path)
  where final_path is not null;

create table if not exists public.image_asset_migrations (
  id uuid primary key default uuid_generate_v4(),
  source_url text not null,
  source_hash text,
  target_table text not null,
  target_column text not null,
  target_row_id text not null,
  target_index integer,
  expected_value text not null,
  final_bucket text,
  final_path text,
  final_url text,
  status text not null default 'pending',
  error_code text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  constraint image_asset_migrations_status_check
    check (status in ('pending', 'converted', 'skipped', 'failed')),
  constraint image_asset_migrations_target_check
    check (
      char_length(btrim(target_table)) between 1 and 128
      and char_length(btrim(target_column)) between 1 and 128
      and char_length(btrim(target_row_id)) between 1 and 256
    ),
  unique (target_table, target_column, target_row_id, target_index, expected_value)
);

create index if not exists image_asset_migrations_status_idx
  on public.image_asset_migrations(status, created_at asc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'image-upload-staging',
  'image-upload-staging',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/svg+xml'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.image_upload_sessions enable row level security;
alter table public.image_asset_migrations enable row level security;

revoke all on table public.image_upload_sessions from anon;
revoke all on table public.image_upload_sessions from authenticated;
revoke all on table public.image_asset_migrations from anon;
revoke all on table public.image_asset_migrations from authenticated;

drop trigger if exists image_upload_sessions_set_partnership_updated_at on public.image_upload_sessions;
create trigger image_upload_sessions_set_partnership_updated_at
  before update on public.image_upload_sessions
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists image_asset_migrations_set_partnership_updated_at on public.image_asset_migrations;
create trigger image_asset_migrations_set_partnership_updated_at
  before update on public.image_asset_migrations
  for each row
  execute function public.set_partnership_updated_at();
