alter table members
  add column if not exists ssafy_track text,
  add column if not exists ssafy_track_name text;

comment on column members.ssafy_track is 'Canonical track slug returned by SSAFY Verify ssafy.track scope. Nullable when no track rule matches or scope is unavailable.';
comment on column members.ssafy_track_name is 'Display track name returned by SSAFY Verify ssafy.track scope. Nullable and not used as a stable key.';

create index if not exists members_ssafy_track_idx
  on members(ssafy_track)
  where ssafy_track is not null;
