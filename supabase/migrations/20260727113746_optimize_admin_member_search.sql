-- Speed up the admin member search contract, which intentionally supports
-- Korean substring matching across member and Mattermost identity fields.
-- Rollback, if needed:
--   drop index if exists public.members_admin_display_name_trgm_idx;
--   drop index if exists public.members_admin_manual_login_id_trgm_idx;
--   drop index if exists public.mm_user_directory_admin_username_trgm_idx;
--   drop index if exists public.mm_user_directory_admin_user_id_trgm_idx;

create extension if not exists pg_trgm;

create index if not exists members_admin_display_name_trgm_idx
  on public.members using gin (display_name gin_trgm_ops)
  where deleted_at is null;

create index if not exists members_admin_manual_login_id_trgm_idx
  on public.members using gin (manual_login_id gin_trgm_ops)
  where deleted_at is null and manual_login_id is not null;

create index if not exists mm_user_directory_admin_username_trgm_idx
  on public.mm_user_directory using gin (mm_username gin_trgm_ops)
  where mm_username is not null;

create index if not exists mm_user_directory_admin_user_id_trgm_idx
  on public.mm_user_directory using gin (mm_user_id gin_trgm_ops)
  where mm_user_id is not null;
