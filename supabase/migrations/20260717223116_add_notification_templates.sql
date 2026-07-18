-- 관리자 전용 채널별 알림 템플릿 수정본 저장소
alter table public.graduate_verification_requests
  add column if not exists rejection_email_sent_at timestamp with time zone;
alter table public.graduate_verification_requests
  add column if not exists rejection_email_last_error_at timestamp with time zone;

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  channel text not null,
  title_template text not null,
  body_template text not null,
  updated_by uuid references public.members(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint notification_templates_channel_check
    check (channel in ('email', 'mattermost', 'push', 'in_app')),
  constraint notification_templates_title_length_check
    check (char_length(title_template) between 1 and 2000),
  constraint notification_templates_body_length_check
    check (char_length(body_template) between 1 and 20000),
  constraint notification_templates_event_channel_key
    unique (event_key, channel)
);

create index if not exists notification_templates_event_key_idx
  on public.notification_templates(event_key);

create or replace function public.set_notification_templates_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_templates_set_updated_at
  on public.notification_templates;
create trigger notification_templates_set_updated_at
  before update on public.notification_templates
  for each row
  execute function public.set_notification_templates_updated_at();

alter table public.notification_templates enable row level security;
revoke all on table public.notification_templates from public;
revoke all on table public.notification_templates from anon;
revoke all on table public.notification_templates from authenticated;
grant select, insert, update, delete on table public.notification_templates to service_role;

alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;
alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'members', 'reviews', 'logs', 'brands', 'companies', 'notifications',
    'home_ads', 'events', 'cycles', 'admin_management', 'graduate_verifications',
    'profile_images', 'mattermost_senders', 'member_signup_requests',
    'notification_templates'
  ));

update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{notification_templates}',
  '{"create":true,"read":true,"update":true,"delete":true}'::jsonb,
  true
), updated_at = now()
where key = 'super_admin';

update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{notification_templates}',
  '{"create":false,"read":false,"update":false,"delete":false}'::jsonb,
  true
), updated_at = now()
where key <> 'super_admin';
