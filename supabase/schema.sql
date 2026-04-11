create extension if not exists "uuid-ossp";

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  label text not null,
  description text,
  color text,
  created_at timestamp with time zone default now()
);

alter table categories add column if not exists color text;

create table if not exists partner_companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  contact_name text,
  contact_email text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists partners (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references partner_companies(id) on delete set null,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  visibility text not null default 'public',
  location text not null,
  map_url text,
  reservation_link text,
  inquiry_link text,
  period_start date,
  period_end date,
  conditions text[] not null default '{}',
  benefits text[] not null default '{}',
  applies_to text[] not null default '{staff,student,graduate}',
  thumbnail text,
  images text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamp with time zone default now()
);

alter table partners add column if not exists visibility text not null default 'public';
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

alter table partners add column if not exists applies_to text[] not null default '{staff,student,graduate}';
update partners
set applies_to = case
  when coalesce(cardinality(applies_to), 0) = 0 then array['staff', 'student', 'graduate']
  else applies_to
end;
alter table partners alter column applies_to set default '{staff,student,graduate}';
alter table partners alter column applies_to set not null;
alter table partners drop constraint if exists partners_applies_to_check;
alter table partners add constraint partners_applies_to_check
  check (
    cardinality(applies_to) > 0
    and applies_to <@ array['staff', 'student', 'graduate']::text[]
  );
alter table partners add column if not exists company_id uuid references partner_companies(id) on delete set null;
alter table partners add column if not exists thumbnail text;
alter table partners add column if not exists conditions text[] not null default '{}';
alter table partners add column if not exists images text[] not null default '{}';
alter table partners add column if not exists reservation_link text;
alter table partners add column if not exists inquiry_link text;
alter table partners drop column if exists contact;

create table if not exists partner_accounts (
  id uuid primary key default uuid_generate_v4(),
  login_id text not null unique,
  display_name text not null,
  password_hash text not null,
  password_salt text not null,
  email text,
  email_verified_at timestamp with time zone,
  initial_setup_completed_at timestamp with time zone,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists partner_account_companies (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references partner_accounts(id) on delete cascade,
  company_id uuid not null references partner_companies(id) on delete cascade,
  role text not null default 'owner',
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  constraint partner_account_companies_role_check
    check (role in ('owner', 'admin', 'manager', 'viewer')),
  constraint partner_account_companies_account_company_key
    unique (account_id, company_id)
);

create table if not exists partner_auth_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists partner_change_requests (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references partner_companies(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete cascade,
  requested_by_account_id uuid references partner_accounts(id) on delete set null,
  status text not null default 'pending',
  current_conditions text[] not null default '{}',
  current_benefits text[] not null default '{}',
  current_applies_to text[] not null default '{staff,student,graduate}',
  current_tags text[] not null default '{}',
  current_thumbnail text,
  current_images text[] not null default '{}',
  current_reservation_link text,
  current_inquiry_link text,
  current_period_start date,
  current_period_end date,
  requested_conditions text[] not null default '{}',
  requested_benefits text[] not null default '{}',
  requested_applies_to text[] not null default '{staff,student,graduate}',
  requested_tags text[] not null default '{}',
  requested_thumbnail text,
  requested_images text[] not null default '{}',
  requested_reservation_link text,
  requested_inquiry_link text,
  requested_period_start date,
  requested_period_end date,
  reviewed_by_admin_id text,
  reviewed_at timestamp with time zone,
  cancelled_by_account_id uuid references partner_accounts(id) on delete set null,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_change_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

alter table partner_change_requests add column if not exists current_tags text[] not null default '{}';
alter table partner_change_requests add column if not exists requested_tags text[] not null default '{}';

create table if not exists admin_login_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists suggestion_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists member_auth_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists members (
  id uuid primary key default uuid_generate_v4(),
  mm_user_id text not null unique,
  mm_username text not null,
  password_hash text,
  password_salt text,
  must_change_password boolean not null default false,
  display_name text,
  year integer not null,
  staff_source_year integer,
  campus text,
  service_policy_version integer,
  service_policy_consented_at timestamp with time zone,
  privacy_policy_version integer,
  privacy_policy_consented_at timestamp with time zone,
  avatar_content_type text,
  avatar_base64 text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table members drop column if exists email;
alter table members drop column if exists region;
alter table members add column if not exists year integer;
update members set year = 15 where year is null;
alter table members alter column year set not null;
alter table members alter column year drop default;
alter table members drop constraint if exists members_year_check;
alter table members add constraint members_year_check check (year between 0 and 99);
comment on column members.year is 'SSAFY year; 0 indicates staff';
comment on column members.staff_source_year is 'Original staff lookup year when members.year is 0';

create table if not exists ssafy_cycle_settings (
  id integer primary key default 1,
  anchor_year integer not null default 14,
  anchor_calendar_year integer not null default 2025,
  anchor_month integer not null default 7,
  manual_current_year integer,
  manual_reason text,
  manual_applied_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint ssafy_cycle_settings_singleton_check check (id = 1)
);

alter table ssafy_cycle_settings add column if not exists anchor_year integer not null default 14;
alter table ssafy_cycle_settings add column if not exists anchor_calendar_year integer not null default 2025;
alter table ssafy_cycle_settings add column if not exists anchor_month integer not null default 7;
alter table ssafy_cycle_settings add column if not exists manual_current_year integer;
alter table ssafy_cycle_settings add column if not exists manual_reason text;
alter table ssafy_cycle_settings add column if not exists manual_applied_at timestamp with time zone;
alter table ssafy_cycle_settings add column if not exists created_at timestamp with time zone default now();
alter table ssafy_cycle_settings add column if not exists updated_at timestamp with time zone default now();
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_singleton_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_singleton_check check (id = 1);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_anchor_year_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_anchor_year_check check (anchor_year between 1 and 99);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_anchor_calendar_year_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_anchor_calendar_year_check check (anchor_calendar_year between 2000 and 3000);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_anchor_month_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_anchor_month_check check (anchor_month between 1 and 12);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_manual_current_year_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_manual_current_year_check
  check (manual_current_year is null or manual_current_year between 0 and 99);

insert into ssafy_cycle_settings (
  id,
  anchor_year,
  anchor_calendar_year,
  anchor_month
)
values (1, 14, 2025, 7)
on conflict (id) do update set
  anchor_year = excluded.anchor_year,
  anchor_calendar_year = excluded.anchor_calendar_year,
  anchor_month = excluded.anchor_month,
  updated_at = now();

create table if not exists policy_documents (
  id uuid primary key default uuid_generate_v4(),
  kind text not null,
  version integer not null,
  title text not null,
  summary text,
  content text not null,
  is_active boolean not null default false,
  effective_at timestamp with time zone not null default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table policy_documents drop constraint if exists policy_documents_kind_check;
alter table policy_documents add constraint policy_documents_kind_check
  check (kind in ('service', 'privacy'));
alter table policy_documents drop constraint if exists policy_documents_version_check;
alter table policy_documents add constraint policy_documents_version_check
  check (version > 0);
alter table policy_documents drop constraint if exists policy_documents_kind_version_key;
alter table policy_documents add constraint policy_documents_kind_version_key
  unique (kind, version);
create unique index if not exists policy_documents_active_kind_idx
  on policy_documents(kind)
  where is_active = true;

create table if not exists member_policy_consents (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references members(id) on delete cascade,
  policy_document_id uuid not null references policy_documents(id) on delete cascade,
  kind text not null,
  version integer not null,
  agreed_at timestamp with time zone not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamp with time zone default now()
);

alter table member_policy_consents
  drop constraint if exists member_policy_consents_kind_check;
alter table member_policy_consents
  add constraint member_policy_consents_kind_check
  check (kind in ('service', 'privacy'));
alter table member_policy_consents
  drop constraint if exists member_policy_consents_version_check;
alter table member_policy_consents
  add constraint member_policy_consents_version_check
  check (version > 0);
alter table member_policy_consents
  drop constraint if exists member_policy_consents_member_policy_key;
alter table member_policy_consents
  add constraint member_policy_consents_member_policy_key
  unique (member_id, policy_document_id);

insert into policy_documents (
  kind,
  version,
  title,
  summary,
  content,
  is_active,
  effective_at
)
values
  (
    'service',
    1,
    '서비스 이용약관',
    '싸트너십 회원가입, 로그인, 제휴 정보 이용에 필요한 기본 약관입니다.',
    $$## 제1조 목적
본 약관은 싸트너십(SSARTNERSHIP) 서비스의 이용 조건, 회원의 권리와 의무, 운영 기준을 정하는 것을 목적으로 합니다.

## 제2조 서비스 대상
서비스는 삼성 청년 SW·AI 아카데미(SSAFY) 교육생 및 운영진을 대상으로 제공합니다.

## 제3조 제공 기능
- 제휴 업체와 혜택 정보 조회
- 회원 인증 및 로그인
- 교육생/운영진 인증 카드 제공
- 제휴 관련 공지 및 알림 제공

## 제4조 회원가입과 계정 관리
- 회원가입 시 사실과 다른 정보를 제공해서는 안 됩니다.
- 회원은 본인 계정을 직접 관리해야 하며, 계정 공유나 타인 사칭을 해서는 안 됩니다.
- 비밀번호 유출 또는 계정 오남용이 의심되는 경우 즉시 운영자에게 알려야 합니다.

## 제5조 금지행위
- 타인의 정보를 도용하거나 허위 정보를 입력하는 행위
- 서비스, 제휴처, 다른 회원에게 피해를 주는 행위
- 비정상적인 방식으로 인증, 로그인, 제휴 정보 접근을 시도하는 행위
- 서비스 운영을 방해하거나 취약점을 악용하는 행위

## 제6조 서비스 변경 및 중단
운영자는 서비스 개선, 점검, 정책 변경, 제휴 종료 등의 사유로 서비스 일부 또는 전부를 변경하거나 중단할 수 있습니다.

## 제7조 외부 링크
서비스에는 제휴 업체의 외부 사이트 또는 랜딩 페이지 링크가 포함될 수 있으며, 해당 외부 서비스의 운영과 정책은 각 제공 주체가 따릅니다.

## 제8조 회원 자격의 제한
운영자는 약관 위반, 부정 이용, 보안 위협, 서비스 목적에 맞지 않는 사용이 확인될 경우 회원 자격을 제한하거나 이용을 중지할 수 있습니다.

## 제9조 책임 제한
운영자는 무료로 제공되는 서비스 범위 안에서 안정적인 운영을 위해 노력하지만, 천재지변, 외부 서비스 장애, 이용자 귀책 사유로 인한 손해에 대해서는 법령이 허용하는 범위에서 책임이 제한될 수 있습니다.

## 제10조 문의처
서비스 운영 및 약관 관련 문의는 아래 연락처로 접수합니다.
- 책임자: myknow
- 이메일: myknow00@naver.com$$,
    true,
    now()
  ),
  (
    'privacy',
    1,
    '개인정보 수집·이용 및 처리방침',
    '회원 인증, 계정 운영, 보안 대응에 필요한 개인정보 처리 기준을 안내합니다.',
    $$## 1. 수집 목적
싸트너십은 회원 식별, 본인 확인, 로그인, 비밀번호 재설정, 인증 카드 제공, 제휴 정보 제공, 보안 대응과 서비스 운영을 위해 개인정보를 처리합니다.

## 2. 수집 항목
- 필수: Mattermost user_id, Mattermost username, 이름, 기수 또는 운영진 여부, 캠퍼스, 프로필 사진
- 서비스 운영 과정에서 생성되는 정보: 비밀번호 해시, 세션 정보, 인증코드 발급 및 인증 이력, 보안 로그, 접속 기록, 푸시 설정 및 구독 정보

## 3. 보유 및 이용 기간
- 회원 정보: 회원 탈퇴 시까지
- 다만 관계 법령 또는 분쟁 대응, 보안 대응이 필요한 경우에는 관련 법령이 허용하는 최소한의 기간 동안 보관할 수 있습니다.

## 4. 개인정보 제3자 제공
싸트너십은 원칙적으로 이용자의 개인정보를 외부 제휴 업체를 포함한 제3자에게 제공하지 않습니다. 법령상 의무가 있거나 이용자가 별도로 동의한 경우에만 예외적으로 제공할 수 있습니다.

## 5. 처리 위탁
서비스는 운영을 위해 Supabase, Vercel 등 클라우드 인프라를 사용할 수 있으며, 해당 범위 안에서 필요한 개인정보가 처리될 수 있습니다.

## 6. 이용자의 권리
이용자는 언제든지 개인정보 처리 관련 문의, 정정, 삭제, 탈퇴를 요청할 수 있습니다.

## 7. 안전성 확보 조치
싸트너십은 비밀번호 해시 저장, 접근 통제, 인증 로그 기록 등 합리적인 보호 조치를 적용합니다.

## 8. 문의처
개인정보 처리 관련 문의는 아래 연락처로 접수합니다.
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

create table if not exists mm_user_directory (
  id uuid primary key default uuid_generate_v4(),
  mm_user_id text not null unique,
  mm_username text not null unique,
  display_name text not null,
  campus text,
  is_staff boolean not null default false,
  source_years integer[] not null default '{}',
  synced_at timestamp with time zone not null default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table mm_user_directory add column if not exists campus text;
alter table mm_user_directory add column if not exists is_staff boolean not null default false;
alter table mm_user_directory add column if not exists source_years integer[] not null default '{}';
alter table mm_user_directory add column if not exists synced_at timestamp with time zone not null default now();
update mm_user_directory set synced_at = coalesce(synced_at, now());
alter table mm_user_directory alter column synced_at set not null;
alter table mm_user_directory alter column synced_at set default now();
create index if not exists mm_user_directory_source_years_idx on mm_user_directory using gin(source_years);

create table if not exists mm_verification_codes (
  id uuid primary key default uuid_generate_v4(),
  code_hash text not null,
  expires_at timestamp with time zone not null,
  mm_user_id text not null,
  mm_username text not null,
  display_name text,
  year integer not null,
  campus text,
  avatar_content_type text,
  avatar_base64 text,
  created_at timestamp with time zone default now()
);

alter table mm_verification_codes drop column if exists email;
alter table mm_verification_codes drop column if exists region;
alter table mm_verification_codes add column if not exists year integer;
update mm_verification_codes set year = 15 where year is null;
alter table mm_verification_codes alter column year set not null;
alter table mm_verification_codes alter column year drop default;
alter table mm_verification_codes drop constraint if exists mm_verification_codes_year_check;
alter table mm_verification_codes
  add constraint mm_verification_codes_year_check check (year between 0 and 99);
comment on column mm_verification_codes.year is 'SSAFY year; 0 indicates staff';

create table if not exists mm_verification_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists password_reset_attempts (
  id uuid primary key default uuid_generate_v4(),
  identifier text not null unique,
  count integer not null default 0,
  first_attempt_at timestamp with time zone not null default now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists push_preferences (
  member_id uuid primary key references members(id) on delete cascade,
  enabled boolean not null default false,
  announcement_enabled boolean not null default true,
  new_partner_enabled boolean not null default true,
  expiring_partner_enabled boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamp with time zone,
  user_agent text,
  is_active boolean not null default true,
  failure_reason text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_success_at timestamp with time zone,
  last_failure_at timestamp with time zone
);

create table if not exists push_message_logs (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  source text not null default 'automatic',
  target_scope text not null default 'all',
  target_label text not null default '전체',
  target_year integer,
  target_campus text,
  target_member_id uuid references members(id) on delete set null,
  title text not null,
  body text not null,
  url text,
  status text not null default 'pending',
  targeted integer not null default 0,
  delivered integer not null default 0,
  failed integer not null default 0,
  created_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

alter table push_message_logs add column if not exists target_year integer;

create table if not exists push_delivery_logs (
  id uuid primary key default uuid_generate_v4(),
  message_log_id uuid references push_message_logs(id) on delete set null,
  member_id uuid references members(id) on delete set null,
  subscription_id uuid references push_subscriptions(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  url text,
  status text not null,
  error_message text,
  created_at timestamp with time zone default now()
);

create table if not exists event_logs (
  id uuid primary key default uuid_generate_v4(),
  session_id text,
  actor_type text not null,
  actor_id text,
  event_name text not null,
  path text,
  referrer text,
  target_type text,
  target_id text,
  properties jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_address text,
  created_at timestamp with time zone default now()
);

create table if not exists admin_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id text,
  action text not null,
  path text,
  target_type text,
  target_id text,
  properties jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_address text,
  created_at timestamp with time zone default now()
);

create table if not exists auth_security_logs (
  id uuid primary key default uuid_generate_v4(),
  event_name text not null,
  status text not null,
  actor_type text not null,
  actor_id text,
  identifier text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_address text,
  created_at timestamp with time zone default now()
);

create index if not exists partners_category_id_idx on partners(category_id);
create index if not exists partners_company_id_idx on partners(company_id);
create index if not exists partner_companies_name_idx on partner_companies(name);
create index if not exists admin_login_attempts_identifier_idx on admin_login_attempts(identifier);
create index if not exists suggestion_attempts_identifier_idx on suggestion_attempts(identifier);
create index if not exists member_auth_attempts_identifier_idx on member_auth_attempts(identifier);
create index if not exists partner_accounts_login_id_idx on partner_accounts(login_id);
create index if not exists partner_account_companies_account_id_idx on partner_account_companies(account_id);
create index if not exists partner_account_companies_company_id_idx on partner_account_companies(company_id);
create index if not exists partner_auth_attempts_identifier_idx on partner_auth_attempts(identifier);
create index if not exists partner_change_requests_company_id_idx on partner_change_requests(company_id);
create index if not exists partner_change_requests_partner_id_idx on partner_change_requests(partner_id);
create index if not exists partner_change_requests_status_idx on partner_change_requests(status);
create index if not exists partner_change_requests_created_at_idx on partner_change_requests(created_at desc);
create unique index if not exists partner_change_requests_pending_partner_idx
  on partner_change_requests(partner_id)
  where status = 'pending';
create index if not exists mm_verification_attempts_identifier_idx on mm_verification_attempts(identifier);
create index if not exists password_reset_attempts_identifier_idx on password_reset_attempts(identifier);
create index if not exists push_subscriptions_member_id_idx on push_subscriptions(member_id);
create index if not exists push_subscriptions_active_idx on push_subscriptions(is_active);
create index if not exists push_message_logs_created_at_idx on push_message_logs(created_at desc);
create index if not exists push_message_logs_type_idx on push_message_logs(type);
create index if not exists push_message_logs_status_idx on push_message_logs(status);
create index if not exists push_delivery_logs_member_id_idx on push_delivery_logs(member_id);
create index if not exists push_delivery_logs_created_at_idx on push_delivery_logs(created_at desc);
create index if not exists event_logs_created_at_idx on event_logs(created_at desc);
create index if not exists event_logs_event_name_idx on event_logs(event_name);
create index if not exists event_logs_actor_id_idx on event_logs(actor_id);
create index if not exists event_logs_target_idx on event_logs(target_type, target_id);
create index if not exists event_logs_path_idx on event_logs(path);
create index if not exists event_logs_session_id_idx on event_logs(session_id);
create index if not exists admin_audit_logs_created_at_idx on admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_action_idx on admin_audit_logs(action);
create index if not exists admin_audit_logs_actor_id_idx on admin_audit_logs(actor_id);
create index if not exists admin_audit_logs_target_idx on admin_audit_logs(target_type, target_id);
create index if not exists auth_security_logs_created_at_idx on auth_security_logs(created_at desc);
create index if not exists auth_security_logs_event_name_idx on auth_security_logs(event_name);
create index if not exists auth_security_logs_status_idx on auth_security_logs(status);
create index if not exists auth_security_logs_actor_id_idx on auth_security_logs(actor_id);
create index if not exists auth_security_logs_identifier_idx on auth_security_logs(identifier);
create index if not exists member_policy_consents_member_id_idx on member_policy_consents(member_id);
create index if not exists member_policy_consents_policy_document_id_idx on member_policy_consents(policy_document_id);

drop index if exists mm_verification_codes_email_idx;

alter table categories enable row level security;
alter table partner_companies enable row level security;
alter table partners enable row level security;
alter table partner_accounts enable row level security;
alter table partner_account_companies enable row level security;
alter table partner_auth_attempts enable row level security;
alter table admin_login_attempts enable row level security;
alter table suggestion_attempts enable row level security;
alter table member_auth_attempts enable row level security;
alter table members enable row level security;
alter table policy_documents enable row level security;
alter table member_policy_consents enable row level security;
alter table mm_user_directory enable row level security;
alter table mm_verification_codes enable row level security;
alter table mm_verification_attempts enable row level security;
alter table password_reset_attempts enable row level security;
alter table partner_change_requests enable row level security;
alter table push_preferences enable row level security;
alter table push_subscriptions enable row level security;
alter table push_message_logs enable row level security;
alter table push_delivery_logs enable row level security;
alter table event_logs enable row level security;
alter table admin_audit_logs enable row level security;
alter table auth_security_logs enable row level security;

create policy "Public read categories" on categories
  for select
  using (true);

comment on column partners.company_id is 'Company grouping for partner portal; one company can own multiple service rows.';

drop policy if exists "Public read partners" on partners;
create policy "Public read partners" on partners
  for select
  using (visibility = 'public');

revoke all on table admin_login_attempts from anon;
revoke all on table admin_login_attempts from authenticated;
revoke all on table suggestion_attempts from anon;
revoke all on table suggestion_attempts from authenticated;
revoke all on table member_auth_attempts from anon;
revoke all on table member_auth_attempts from authenticated;
revoke all on table partner_companies from anon;
revoke all on table partner_companies from authenticated;
revoke all on table partner_accounts from anon;
revoke all on table partner_accounts from authenticated;
revoke all on table partner_account_companies from anon;
revoke all on table partner_account_companies from authenticated;
revoke all on table partner_auth_attempts from anon;
revoke all on table partner_auth_attempts from authenticated;
revoke all on table partner_change_requests from anon;
revoke all on table partner_change_requests from authenticated;
revoke all on table members from anon;
revoke all on table members from authenticated;
revoke all on table policy_documents from anon;
revoke all on table policy_documents from authenticated;
revoke all on table member_policy_consents from anon;
revoke all on table member_policy_consents from authenticated;
revoke all on table mm_user_directory from anon;
revoke all on table mm_user_directory from authenticated;
revoke all on table mm_verification_codes from anon;
revoke all on table mm_verification_codes from authenticated;
revoke all on table mm_verification_attempts from anon;
revoke all on table mm_verification_attempts from authenticated;
revoke all on table password_reset_attempts from anon;
revoke all on table password_reset_attempts from authenticated;
revoke all on table push_preferences from anon;
revoke all on table push_preferences from authenticated;
revoke all on table push_subscriptions from anon;
revoke all on table push_subscriptions from authenticated;
revoke all on table push_message_logs from anon;
revoke all on table push_message_logs from authenticated;
revoke all on table push_delivery_logs from anon;
revoke all on table push_delivery_logs from authenticated;
revoke all on table event_logs from anon;
revoke all on table event_logs from authenticated;
revoke all on table admin_audit_logs from anon;
revoke all on table admin_audit_logs from authenticated;
revoke all on table auth_security_logs from anon;
revoke all on table auth_security_logs from authenticated;
