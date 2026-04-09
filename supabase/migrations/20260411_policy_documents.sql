alter table members
  add column if not exists service_policy_version integer,
  add column if not exists service_policy_consented_at timestamp with time zone,
  add column if not exists privacy_policy_version integer,
  add column if not exists privacy_policy_consented_at timestamp with time zone;

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

create index if not exists member_policy_consents_member_id_idx
  on member_policy_consents(member_id);
create index if not exists member_policy_consents_policy_document_id_idx
  on member_policy_consents(policy_document_id);

alter table policy_documents enable row level security;
alter table member_policy_consents enable row level security;

revoke all on table policy_documents from anon;
revoke all on table policy_documents from authenticated;
revoke all on table member_policy_consents from anon;
revoke all on table member_policy_consents from authenticated;
