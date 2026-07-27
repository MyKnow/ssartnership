-- Return only the administrator session snapshot needed on every protected
-- request. This avoids a nested PostgREST relationship read on the hot auth
-- path while preserving the existing permission-version and active checks.
-- Rollback:
--   drop function if exists public.get_admin_session_snapshot(uuid);

create or replace function public.get_admin_session_snapshot(p_member_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'id', member.id,
    'login_id', directory.mm_username,
    'display_name', coalesce(
      nullif(btrim(member.display_name), ''),
      nullif(btrim(directory.display_name), ''),
      directory.mm_username
    ),
    'email', member.email,
    'must_change_password', member.must_change_password,
    'is_active', profile.is_active and directory.is_active and member.deleted_at is null,
    'permission_version', profile.permission_version,
    'permission_template_key', profile.permission_template_key,
    'managed_campus_slugs', profile.managed_campus_slugs,
    'created_at', profile.created_at,
    'updated_at', profile.updated_at
  )
  from public.admin_profiles profile
  join public.members member on member.id = profile.member_id
  join public.mm_user_directory directory on directory.id = member.mattermost_account_id
  where profile.member_id = p_member_id
  limit 1;
$$;

revoke all on function public.get_admin_session_snapshot(uuid) from public;
revoke all on function public.get_admin_session_snapshot(uuid) from anon;
revoke all on function public.get_admin_session_snapshot(uuid) from authenticated;
grant execute on function public.get_admin_session_snapshot(uuid) to service_role;
