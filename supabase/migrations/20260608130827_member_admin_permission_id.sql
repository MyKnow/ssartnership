alter table public.members
  add column if not exists admin_permission_id text
    references public.admin_permission_templates(key)
    on update cascade
    on delete set null;

create index if not exists members_admin_permission_id_idx
  on public.members(admin_permission_id)
  where admin_permission_id is not null;

create or replace function public.ensure_single_member_super_admin()
returns trigger
language plpgsql
as $$
declare
  super_admin_count integer;
begin
  if new.admin_permission_id = 'super_admin' and new.mm_username <> 'myknow' then
    raise exception 'only myknow member can hold super_admin permission';
  end if;

  select count(*)
    into super_admin_count
    from public.members
   where admin_permission_id = 'super_admin';

  if super_admin_count > 1 then
    raise exception 'only one super_admin member is allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists members_keep_single_super_admin on public.members;
create trigger members_keep_single_super_admin
  after insert or update of admin_permission_id, mm_username on public.members
  for each row
  execute function public.ensure_single_member_super_admin();

update public.members
   set admin_permission_id = 'super_admin',
       updated_at = now()
 where mm_username = 'myknow'
   and admin_permission_id is distinct from 'super_admin';
