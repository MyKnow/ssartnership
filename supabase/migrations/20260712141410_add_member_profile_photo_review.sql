alter table public.members
  add column if not exists profile_photo_review_status text not null default 'approved';

update public.members
set profile_photo_review_status = 'approved'
where profile_photo_review_status is null;

alter table public.members
  drop constraint if exists members_profile_photo_review_status_check;
alter table public.members
  add constraint members_profile_photo_review_status_check
  check (profile_photo_review_status in ('approved', 'pending', 'rejected'));

create or replace function public.enforce_member_profile_image_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = new.status then
    return new;
  end if;
  if not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'superseded'))
    or (old.status = 'approved' and new.status in ('superseded', 'rejected'))
  ) then
    raise exception 'invalid_member_profile_image_status_transition';
  end if;
  return new;
end;
$$;

alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;
alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'members', 'reviews', 'logs', 'brands', 'companies', 'notifications',
    'home_ads', 'events', 'cycles', 'admin_management', 'graduate_verifications',
    'profile_images'
  ));

update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{profile_images}',
  '{"create":false,"read":true,"update":true,"delete":false}'::jsonb,
  true
), updated_at = now()
where key in ('super_admin', 'operations_manager', 'support');

update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{profile_images}',
  '{"create":false,"read":true,"update":false,"delete":false}'::jsonb,
  true
)
where key = 'readonly';

create or replace function public.approve_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
begin
  select * into image_row from public.member_profile_images
    where id = p_image_id
      and graduate_verification_request_id is null
      and member_id is not null
      and status = 'pending'
    for update;
  if not found then raise exception 'profile_image_not_reviewable'; end if;

  select * into member_row from public.members where id = image_row.member_id for update;
  if not found then raise exception 'profile_image_member_missing'; end if;

  if member_row.active_profile_image_id is not null then
    update public.member_profile_images
      set status = 'superseded', delete_after = now() + interval '30 days', updated_at = now()
      where id = member_row.active_profile_image_id;
  end if;

  update public.member_profile_images
    set status = 'approved', reviewer_admin_id = p_admin_id, review_reason = null,
      reviewed_at = now(), updated_at = now()
    where id = image_row.id;

  update public.members
    set active_profile_image_id = image_row.id,
      profile_photo_review_status = 'approved',
      updated_at = now()
    where id = member_row.id;

  return member_row.id;
end;
$$;

create or replace function public.reject_member_profile_image_replacement(
  p_image_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  image_row public.member_profile_images%rowtype;
  member_row public.members%rowtype;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;

  select * into image_row from public.member_profile_images
    where id = p_image_id
      and graduate_verification_request_id is null
      and member_id is not null
      and status = 'pending'
    for update;
  if not found then raise exception 'profile_image_not_reviewable'; end if;

  select * into member_row from public.members where id = image_row.member_id for update;
  if not found then raise exception 'profile_image_member_missing'; end if;

  update public.member_profile_images
    set status = 'rejected', reviewer_admin_id = p_admin_id,
      review_reason = btrim(p_reason), reviewed_at = now(),
      delete_after = now() + interval '30 days', updated_at = now()
    where id = image_row.id;

  update public.members
    set profile_photo_review_status = 'rejected', updated_at = now()
    where id = member_row.id;

  return member_row.id;
end;
$$;

create or replace function public.reject_member_active_profile_photo(
  p_member_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'profile_image_rejection_reason_invalid';
  end if;

  select * into member_row from public.members where id = p_member_id for update;
  if not found then raise exception 'profile_image_member_missing'; end if;

  if member_row.active_profile_image_id is not null then
    update public.member_profile_images
      set status = 'rejected', reviewer_admin_id = p_admin_id,
        review_reason = btrim(p_reason), reviewed_at = now(),
        delete_after = now() + interval '30 days', updated_at = now()
      where id = member_row.active_profile_image_id and status = 'approved';
  end if;

  update public.members
    set active_profile_image_id = null,
      profile_photo_review_status = 'rejected',
      updated_at = now()
    where id = member_row.id;

  return member_row.id;
end;
$$;

revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from public;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from anon;
revoke all on function public.approve_member_profile_image_replacement(uuid, uuid) from authenticated;
grant execute on function public.approve_member_profile_image_replacement(uuid, uuid) to service_role;

revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from public;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from anon;
revoke all on function public.reject_member_profile_image_replacement(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_profile_image_replacement(uuid, uuid, text) to service_role;

revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from public;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from anon;
revoke all on function public.reject_member_active_profile_photo(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_active_profile_photo(uuid, uuid, text) to service_role;
