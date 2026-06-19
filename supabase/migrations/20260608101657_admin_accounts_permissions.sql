create table if not exists public.admin_accounts (
  id uuid primary key default uuid_generate_v4(),
  login_id text not null unique,
  display_name text not null,
  email text,
  password_hash text,
  password_salt text,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  initial_setup_token_hash text unique,
  initial_setup_expires_at timestamp with time zone,
  initial_setup_completed_at timestamp with time zone,
  last_login_at timestamp with time zone,
  permission_version integer not null default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint admin_accounts_login_id_check
    check (login_id ~ '^[A-Za-z0-9._-]{3,64}$'),
  constraint admin_accounts_password_pair_check
    check (
      (password_hash is null and password_salt is null)
      or (password_hash is not null and password_salt is not null)
    )
);

create table if not exists public.admin_permissions (
  admin_id uuid not null references public.admin_accounts(id) on delete cascade,
  resource text not null,
  action text not null,
  granted boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (admin_id, resource, action),
  constraint admin_permissions_resource_check
    check (resource in (
      'members',
      'reviews',
      'logs',
      'brands',
      'companies',
      'notifications',
      'home_ads',
      'events',
      'cycles',
      'admin_management'
    )),
  constraint admin_permissions_action_check
    check (action in ('create', 'read', 'update', 'delete')),
  constraint admin_permissions_logs_read_only_check
    check (resource <> 'logs' or action = 'read' or granted = false)
);

create table if not exists public.admin_permission_templates (
  key text primary key,
  name text not null,
  description text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists admin_accounts_login_id_idx
  on public.admin_accounts(login_id);
create index if not exists admin_accounts_is_active_idx
  on public.admin_accounts(is_active);
create index if not exists admin_permissions_admin_id_idx
  on public.admin_permissions(admin_id);
create index if not exists admin_permissions_resource_action_idx
  on public.admin_permissions(resource, action)
  where granted = true;

drop trigger if exists admin_accounts_set_partnership_updated_at on public.admin_accounts;
create trigger admin_accounts_set_partnership_updated_at
  before update on public.admin_accounts
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists admin_permissions_set_partnership_updated_at on public.admin_permissions;
create trigger admin_permissions_set_partnership_updated_at
  before update on public.admin_permissions
  for each row
  execute function set_partnership_updated_at();

drop trigger if exists admin_permission_templates_set_partnership_updated_at on public.admin_permission_templates;
create trigger admin_permission_templates_set_partnership_updated_at
  before update on public.admin_permission_templates
  for each row
  execute function set_partnership_updated_at();

create or replace function public.bump_admin_permission_version()
returns trigger
language plpgsql
as $$
begin
  update public.admin_accounts
     set permission_version = permission_version + 1,
         updated_at = now()
   where id = coalesce(new.admin_id, old.admin_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists admin_permissions_bump_permission_version on public.admin_permissions;
create trigger admin_permissions_bump_permission_version
  after insert or update or delete on public.admin_permissions
  for each row
  execute function public.bump_admin_permission_version();

create or replace function public.ensure_active_privileged_admin_exists()
returns trigger
language plpgsql
as $$
declare
  privileged_count integer;
begin
  select count(*)
    into privileged_count
    from public.admin_accounts account
    where account.is_active = true
      and exists (
        select 1
          from public.admin_permissions permission
         where permission.admin_id = account.id
           and permission.resource = 'admin_management'
           and permission.action = 'update'
           and permission.granted = true
      )
      and exists (
        select 1
          from public.admin_permissions permission
         where permission.admin_id = account.id
           and permission.resource = 'admin_management'
           and permission.action = 'delete'
           and permission.granted = true
      );

  if privileged_count < 1 then
    raise exception 'at least one active privileged admin account is required';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists admin_accounts_keep_privileged_admin on public.admin_accounts;
create trigger admin_accounts_keep_privileged_admin
  after update of is_active on public.admin_accounts
  for each row
  when (old.is_active is distinct from new.is_active)
  execute function public.ensure_active_privileged_admin_exists();

drop trigger if exists admin_permissions_keep_privileged_admin on public.admin_permissions;
create trigger admin_permissions_keep_privileged_admin
  after update or delete on public.admin_permissions
  for each row
  execute function public.ensure_active_privileged_admin_exists();

insert into public.admin_permission_templates (key, name, description, permissions)
values
  (
    'super_admin',
    'Super Admin',
    '어드민 계정과 전체 운영 권한을 관리합니다.',
    '{
      "members":{"create":true,"read":true,"update":true,"delete":true},
      "reviews":{"create":true,"read":true,"update":true,"delete":true},
      "logs":{"create":false,"read":true,"update":false,"delete":false},
      "brands":{"create":true,"read":true,"update":true,"delete":true},
      "companies":{"create":true,"read":true,"update":true,"delete":true},
      "notifications":{"create":true,"read":true,"update":true,"delete":true},
      "home_ads":{"create":true,"read":true,"update":true,"delete":true},
      "events":{"create":true,"read":true,"update":true,"delete":true},
      "cycles":{"create":true,"read":true,"update":true,"delete":true},
      "admin_management":{"create":true,"read":true,"update":true,"delete":true}
    }'::jsonb
  ),
  (
    'operations_manager',
    '운영 관리자',
    '회원, 협력사, 알림, 이벤트, 기수 운영을 담당합니다.',
    '{
      "members":{"create":true,"read":true,"update":true,"delete":true},
      "reviews":{"create":false,"read":true,"update":true,"delete":true},
      "logs":{"create":false,"read":true,"update":false,"delete":false},
      "brands":{"create":true,"read":true,"update":true,"delete":true},
      "companies":{"create":true,"read":true,"update":true,"delete":true},
      "notifications":{"create":true,"read":true,"update":true,"delete":true},
      "home_ads":{"create":true,"read":true,"update":true,"delete":true},
      "events":{"create":true,"read":true,"update":true,"delete":true},
      "cycles":{"create":false,"read":true,"update":true,"delete":false},
      "admin_management":{"create":false,"read":false,"update":false,"delete":false}
    }'::jsonb
  ),
  (
    'content_manager',
    '콘텐츠 관리자',
    '브랜드, 홈광고, 이벤트 노출 콘텐츠를 관리합니다.',
    '{
      "members":{"create":false,"read":false,"update":false,"delete":false},
      "reviews":{"create":false,"read":true,"update":true,"delete":false},
      "logs":{"create":false,"read":true,"update":false,"delete":false},
      "brands":{"create":true,"read":true,"update":true,"delete":true},
      "companies":{"create":false,"read":false,"update":false,"delete":false},
      "notifications":{"create":false,"read":false,"update":false,"delete":false},
      "home_ads":{"create":true,"read":true,"update":true,"delete":true},
      "events":{"create":true,"read":true,"update":true,"delete":true},
      "cycles":{"create":false,"read":false,"update":false,"delete":false},
      "admin_management":{"create":false,"read":false,"update":false,"delete":false}
    }'::jsonb
  ),
  (
    'support',
    '고객지원',
    '회원과 리뷰 상태를 확인하고 필요한 조치를 수행합니다.',
    '{
      "members":{"create":false,"read":true,"update":true,"delete":false},
      "reviews":{"create":false,"read":true,"update":true,"delete":false},
      "logs":{"create":false,"read":true,"update":false,"delete":false},
      "brands":{"create":false,"read":true,"update":false,"delete":false},
      "companies":{"create":false,"read":true,"update":false,"delete":false},
      "notifications":{"create":false,"read":true,"update":false,"delete":false},
      "home_ads":{"create":false,"read":false,"update":false,"delete":false},
      "events":{"create":false,"read":true,"update":false,"delete":false},
      "cycles":{"create":false,"read":false,"update":false,"delete":false},
      "admin_management":{"create":false,"read":false,"update":false,"delete":false}
    }'::jsonb
  ),
  (
    'readonly',
    '조회 전용',
    '운영 데이터를 조회만 할 수 있습니다.',
    '{
      "members":{"create":false,"read":true,"update":false,"delete":false},
      "reviews":{"create":false,"read":true,"update":false,"delete":false},
      "logs":{"create":false,"read":true,"update":false,"delete":false},
      "brands":{"create":false,"read":true,"update":false,"delete":false},
      "companies":{"create":false,"read":true,"update":false,"delete":false},
      "notifications":{"create":false,"read":true,"update":false,"delete":false},
      "home_ads":{"create":false,"read":true,"update":false,"delete":false},
      "events":{"create":false,"read":true,"update":false,"delete":false},
      "cycles":{"create":false,"read":true,"update":false,"delete":false},
      "admin_management":{"create":false,"read":false,"update":false,"delete":false}
    }'::jsonb
  )
on conflict (key) do update
   set name = excluded.name,
       description = excluded.description,
       permissions = excluded.permissions,
       updated_at = now();

alter table public.admin_accounts enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_permission_templates enable row level security;

revoke all on table public.admin_accounts from anon;
revoke all on table public.admin_accounts from authenticated;
revoke all on table public.admin_permissions from anon;
revoke all on table public.admin_permissions from authenticated;
revoke all on table public.admin_permission_templates from anon;
revoke all on table public.admin_permission_templates from authenticated;
