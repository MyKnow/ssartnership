create table if not exists public.admin_permission_templates (
  key text primary key,
  name text not null,
  description text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

insert into public.admin_permission_templates (key, name, description, permissions)
values
  ('super_admin', 'Super Admin', '멤버 관리자 권한과 전체 운영 권한을 관리합니다.', '{"members":{"create":true,"read":true,"update":true,"delete":true},"reviews":{"create":true,"read":true,"update":true,"delete":true},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":true,"read":true,"update":true,"delete":true},"notifications":{"create":true,"read":true,"update":true,"delete":true},"home_ads":{"create":true,"read":true,"update":true,"delete":true},"events":{"create":true,"read":true,"update":true,"delete":true},"cycles":{"create":true,"read":true,"update":true,"delete":true},"admin_management":{"create":true,"read":true,"update":true,"delete":true}}'::jsonb),
  ('operations_manager', '운영 관리자', '회원, 협력사, 알림, 이벤트, 기수 운영을 담당합니다.', '{"members":{"create":true,"read":true,"update":true,"delete":true},"reviews":{"create":false,"read":true,"update":true,"delete":true},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":true,"read":true,"update":true,"delete":true},"notifications":{"create":true,"read":true,"update":true,"delete":true},"home_ads":{"create":true,"read":true,"update":true,"delete":true},"events":{"create":true,"read":true,"update":true,"delete":true},"cycles":{"create":false,"read":true,"update":true,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb),
  ('content_manager', '콘텐츠 관리자', '브랜드, 홈광고, 이벤트 노출 콘텐츠를 관리합니다.', '{"members":{"create":false,"read":false,"update":false,"delete":false},"reviews":{"create":false,"read":true,"update":true,"delete":false},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":false,"read":false,"update":false,"delete":false},"notifications":{"create":false,"read":false,"update":false,"delete":false},"home_ads":{"create":true,"read":true,"update":true,"delete":true},"events":{"create":true,"read":true,"update":true,"delete":true},"cycles":{"create":false,"read":false,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb),
  ('support', '고객지원', '회원과 리뷰 상태를 확인하고 필요한 조치를 수행합니다.', '{"members":{"create":false,"read":true,"update":true,"delete":false},"reviews":{"create":false,"read":true,"update":true,"delete":false},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":false,"read":true,"update":false,"delete":false},"companies":{"create":false,"read":true,"update":false,"delete":false},"notifications":{"create":false,"read":true,"update":false,"delete":false},"home_ads":{"create":false,"read":false,"update":false,"delete":false},"events":{"create":false,"read":true,"update":false,"delete":false},"cycles":{"create":false,"read":false,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb),
  ('readonly', '조회 전용', '운영 데이터를 조회만 할 수 있습니다.', '{"members":{"create":false,"read":true,"update":false,"delete":false},"reviews":{"create":false,"read":true,"update":false,"delete":false},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":false,"read":true,"update":false,"delete":false},"companies":{"create":false,"read":true,"update":false,"delete":false},"notifications":{"create":false,"read":true,"update":false,"delete":false},"home_ads":{"create":false,"read":true,"update":false,"delete":false},"events":{"create":false,"read":true,"update":false,"delete":false},"cycles":{"create":false,"read":true,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb)
on conflict (key) do update
   set name = excluded.name,
       description = excluded.description,
       permissions = excluded.permissions,
       updated_at = now();

alter table public.members
  add column if not exists admin_permission_id text;

alter table public.members
  drop constraint if exists members_admin_permission_id_fkey;
alter table public.members
  add constraint members_admin_permission_id_fkey
  foreign key (admin_permission_id)
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
