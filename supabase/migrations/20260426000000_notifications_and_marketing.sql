alter table members
  add column if not exists marketing_policy_version integer,
  add column if not exists marketing_policy_consented_at timestamp with time zone;

alter table policy_documents drop constraint if exists policy_documents_kind_check;
alter table policy_documents add constraint policy_documents_kind_check
  check (kind in ('service', 'privacy', 'marketing'));

alter table member_policy_consents drop constraint if exists member_policy_consents_kind_check;
alter table member_policy_consents add constraint member_policy_consents_kind_check
  check (kind in ('service', 'privacy', 'marketing'));

insert into policy_documents (
  kind,
  version,
  title,
  summary,
  content,
  is_active,
  effective_at
)
values (
  'marketing',
  1,
  '마케팅 정보 수신 동의',
  '제휴 소식, 혜택 안내, 이벤트 등 알림 수신 동의입니다.',
  $$## 1. 목적
싸트너십은 제휴 혜택, 신규 제휴, 종료 임박, 운영 공지와 같은 서비스 관련 정보와 함께, 이용자가 동의한 경우 마케팅성 안내를 전송할 수 있습니다.

## 2. 수신 범위
- 제휴 소식
- 혜택 안내
- 이벤트 및 캠페인 안내
- 기타 서비스 관련 소식

## 3. 동의 및 철회
이 동의는 선택 사항이며, 회원은 언제든지 알림 설정에서 동의를 변경할 수 있습니다.

## 4. 문의
마케팅 정보 수신 관련 문의는 아래 연락처로 접수합니다.
- 책임자: myknow
- 이메일: myknow00@naver.com$$,
  true,
  now()
)
on conflict (kind, version) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  is_active = excluded.is_active,
  effective_at = excluded.effective_at,
  updated_at = now();

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  title text not null,
  body text not null,
  target_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_member_id uuid references members(id) on delete set null,
  created_at timestamp with time zone default now()
);

alter table notifications drop constraint if exists notifications_target_url_check;
alter table notifications add constraint notifications_target_url_check
  check (target_url like '/%' and target_url not like '//%');

create table if not exists member_notifications (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references notifications(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  read_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (notification_id, member_id)
);

create table if not exists notification_deliveries (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references notifications(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  channel text not null,
  status text not null,
  error_message text,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table notification_deliveries drop constraint if exists notification_deliveries_channel_check;
alter table notification_deliveries add constraint notification_deliveries_channel_check
  check (channel in ('in_app', 'push', 'mm'));
alter table notification_deliveries drop constraint if exists notification_deliveries_status_check;
alter table notification_deliveries add constraint notification_deliveries_status_check
  check (status in ('pending', 'sent', 'failed', 'skipped'));

alter table push_preferences
  add column if not exists mm_enabled boolean not null default true,
  add column if not exists marketing_enabled boolean not null default false;

create index if not exists notifications_created_at_idx on notifications(created_at desc);
create index if not exists notifications_type_idx on notifications(type);
create index if not exists member_notifications_member_id_created_at_idx
  on member_notifications(member_id, deleted_at, created_at desc);
create index if not exists member_notifications_notification_id_idx
  on member_notifications(notification_id);
create index if not exists member_notifications_member_read_idx
  on member_notifications(member_id, read_at, deleted_at);
create index if not exists notification_deliveries_notification_id_idx
  on notification_deliveries(notification_id);
create index if not exists notification_deliveries_member_id_idx
  on notification_deliveries(member_id);
create index if not exists notification_deliveries_created_at_idx
  on notification_deliveries(created_at desc);

alter table notifications enable row level security;
alter table member_notifications enable row level security;
alter table notification_deliveries enable row level security;

revoke all on table notifications from anon;
revoke all on table notifications from authenticated;
revoke all on table member_notifications from anon;
revoke all on table member_notifications from authenticated;
revoke all on table notification_deliveries from anon;
revoke all on table notification_deliveries from authenticated;
