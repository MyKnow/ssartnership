alter table public.members
  add column if not exists ssafy_sub text,
  add column if not exists ssafy_verified_at timestamp with time zone,
  add column if not exists ssafy_auth_time timestamp with time zone,
  add column if not exists ssafy_verification_id text,
  add column if not exists ssafy_mattermost_user_id text,
  add column if not exists ssafy_last_scope text;

create unique index if not exists members_ssafy_sub_key
  on public.members(ssafy_sub)
  where ssafy_sub is not null;

create unique index if not exists members_ssafy_mattermost_user_id_key
  on public.members(ssafy_mattermost_user_id)
  where ssafy_mattermost_user_id is not null;

comment on column public.members.ssafy_sub is
  'SSAFY Verify pairwise subject for this partner service.';
comment on column public.members.ssafy_verified_at is
  'Timestamp when SSAFY Verify last confirmed this member.';
comment on column public.members.ssafy_auth_time is
  'verification_token auth_time converted from JWT NumericDate seconds.';
comment on column public.members.ssafy_verification_id is
  'Last SSAFY Verify transaction identifier from /verify/token result.';
comment on column public.members.ssafy_mattermost_user_id is
  'Mattermost raw user.id returned by ssafy.mattermost_id for legacy account mapping.';
comment on column public.members.ssafy_last_scope is
  'Last approved SSAFY Verify scope string used during member verification.';
