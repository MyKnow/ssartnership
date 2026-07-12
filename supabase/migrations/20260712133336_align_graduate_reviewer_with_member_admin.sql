-- The active admin session is backed by members.id, not the legacy
-- admin_accounts table. Keep review attribution aligned with that identity.
alter table public.graduate_verification_requests
  drop constraint if exists graduate_verification_requests_reviewer_admin_id_fkey;
alter table public.graduate_verification_requests
  add constraint graduate_verification_requests_reviewer_admin_id_fkey
  foreign key (reviewer_admin_id)
  references public.members(id)
  on delete set null;

alter table public.member_profile_images
  drop constraint if exists member_profile_images_reviewer_admin_id_fkey;
alter table public.member_profile_images
  add constraint member_profile_images_reviewer_admin_id_fkey
  foreign key (reviewer_admin_id)
  references public.members(id)
  on delete set null;
