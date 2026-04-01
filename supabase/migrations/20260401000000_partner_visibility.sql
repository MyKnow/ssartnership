alter table partners add column if not exists visibility text;

update partners
set visibility = case lower(trim(coalesce(visibility, 'public')))
  when 'public' then 'public'
  when 'confidential' then 'confidential'
  when 'private' then 'private'
  else 'public'
end;

alter table partners alter column visibility set default 'public';
alter table partners alter column visibility set not null;
alter table partners drop constraint if exists partners_visibility_check;
alter table partners add constraint partners_visibility_check
  check (visibility in ('public', 'confidential', 'private'));

drop policy if exists "Public read partners" on partners;
create policy "Public read partners" on partners
  for select
  using (visibility = 'public');
