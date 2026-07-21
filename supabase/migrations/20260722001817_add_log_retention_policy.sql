-- 개인정보가 포함될 수 있는 운영·보안 원본 로그는 1년만 보관하고,
-- 이미 생성된 집계 테이블은 장기 보관한다. 보안 사고·분쟁은 보존 hold로 예외 처리한다.

create table if not exists public.log_retention_holds (
  id uuid primary key default uuid_generate_v4(),
  log_group text not null,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone not null,
  reason text not null,
  created_by text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint log_retention_holds_group_check
    check (log_group in (
      'event_logs',
      'admin_audit_logs',
      'auth_security_logs',
      'push_message_logs',
      'push_delivery_logs',
      'partner_benefit_usages'
    )),
  constraint log_retention_holds_range_check
    check (end_at > start_at),
  constraint log_retention_holds_reason_check
    check (char_length(trim(reason)) between 1 and 500)
);

create index if not exists log_retention_holds_lookup_idx
  on public.log_retention_holds(log_group, start_at, end_at, expires_at);

alter table public.log_retention_holds enable row level security;
revoke all on table public.log_retention_holds from public;
revoke all on table public.log_retention_holds from anon;
revoke all on table public.log_retention_holds from authenticated;

create or replace function public.purge_expired_operational_logs(
  input_cutoff timestamp with time zone default now() - interval '1 year'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamp with time zone := coalesce(input_cutoff, now() - interval '1 year');
  event_log_count integer := 0;
  admin_audit_log_count integer := 0;
  auth_security_log_count integer := 0;
  push_message_log_count integer := 0;
  push_delivery_log_count integer := 0;
  partner_benefit_usage_count integer := 0;
begin
  -- The guard prevents an accidental caller from reducing the policy below one year.
  if cutoff > now() - interval '1 year' then
    raise exception 'log_retention_cutoff_must_be_at_least_one_year_old';
  end if;

  delete from public.event_logs
  where created_at < cutoff
    and not exists (
      select 1
      from public.log_retention_holds hold
      where hold.log_group = 'event_logs'
        and (hold.expires_at is null or hold.expires_at > now())
        and event_logs.created_at >= hold.start_at
        and event_logs.created_at < hold.end_at
    );
  get diagnostics event_log_count = row_count;

  delete from public.admin_audit_logs
  where created_at < cutoff
    and not exists (
      select 1
      from public.log_retention_holds hold
      where hold.log_group = 'admin_audit_logs'
        and (hold.expires_at is null or hold.expires_at > now())
        and admin_audit_logs.created_at >= hold.start_at
        and admin_audit_logs.created_at < hold.end_at
    );
  get diagnostics admin_audit_log_count = row_count;

  delete from public.auth_security_logs
  where created_at < cutoff
    and not exists (
      select 1
      from public.log_retention_holds hold
      where hold.log_group = 'auth_security_logs'
        and (hold.expires_at is null or hold.expires_at > now())
        and auth_security_logs.created_at >= hold.start_at
        and auth_security_logs.created_at < hold.end_at
    );
  get diagnostics auth_security_log_count = row_count;

  delete from public.push_delivery_logs
  where created_at < cutoff
    and not exists (
      select 1
      from public.log_retention_holds hold
      where hold.log_group = 'push_delivery_logs'
        and (hold.expires_at is null or hold.expires_at > now())
        and push_delivery_logs.created_at >= hold.start_at
        and push_delivery_logs.created_at < hold.end_at
    );
  get diagnostics push_delivery_log_count = row_count;

  delete from public.push_message_logs
  where created_at < cutoff
    and not exists (
      select 1
      from public.log_retention_holds hold
      where hold.log_group = 'push_message_logs'
        and (hold.expires_at is null or hold.expires_at > now())
        and push_message_logs.created_at >= hold.start_at
        and push_message_logs.created_at < hold.end_at
    );
  get diagnostics push_message_log_count = row_count;

  delete from public.partner_benefit_usages
  where created_at < cutoff
    and not exists (
      select 1
      from public.log_retention_holds hold
      where hold.log_group = 'partner_benefit_usages'
        and (hold.expires_at is null or hold.expires_at > now())
        and partner_benefit_usages.created_at >= hold.start_at
        and partner_benefit_usages.created_at < hold.end_at
    );
  get diagnostics partner_benefit_usage_count = row_count;

  return jsonb_build_object(
    'cutoff', cutoff,
    'event_logs', event_log_count,
    'admin_audit_logs', admin_audit_log_count,
    'auth_security_logs', auth_security_log_count,
    'push_delivery_logs', push_delivery_log_count,
    'push_message_logs', push_message_log_count,
    'partner_benefit_usages', partner_benefit_usage_count
  );
end;
$$;

revoke all on function public.purge_expired_operational_logs(timestamp with time zone) from public;
revoke all on function public.purge_expired_operational_logs(timestamp with time zone) from anon;
revoke all on function public.purge_expired_operational_logs(timestamp with time zone) from authenticated;
grant execute on function public.purge_expired_operational_logs(timestamp with time zone) to service_role;

update public.policy_documents
set is_active = false,
    updated_at = now()
where kind = 'privacy'
  and is_active = true;

insert into public.policy_documents (
  kind,
  version,
  title,
  summary,
  content,
  is_active,
  effective_at
)
values (
  'privacy',
  3,
  '개인정보 수집·이용 및 처리방침',
  '회원 인증, 서비스 이용, 로그 보존 및 보안 대응을 위한 개인정보 처리 기준을 안내합니다.',
  $$## 1. 처리 목적
싸트너십은 회원 식별, 본인 확인, 계정 운영, 제휴 정보 제공, 리뷰 기능, 알림 발송, 보안 대응, 서비스 개선 및 운영 문의 처리를 위해 개인정보를 처리합니다.

## 2. 수집 항목
- 회원 인증 정보: Mattermost user_id, Mattermost username, 이름, 기수 또는 운영진 여부, 캠퍼스, 프로필 사진
- 계정 정보: 로그인 식별자, 비밀번호 해시, 세션 정보, 비밀번호 변경 이력
- 서비스 이용 정보: 제휴 조회, 클릭, 리뷰 작성·수정·삭제, 알림 읽음·삭제 상태, 설정 변경 이력
- 알림 정보: 푸시 구독 endpoint, 브라우저·기기 정보, 알림 선호 설정
- 보안 및 운영 로그: 접속 기록, 인증 이력, IP, user-agent, 오류 및 감사 로그
- 제휴 혜택 사용 이력: 사용 회원, 제휴처, 선택 혜택, 사용 횟수 및 확인 시각

## 3. 보유 및 이용 기간
- 회원 정보: 회원 탈퇴 또는 계정 삭제 요청 시까지
- 보안·감사·제품 원본 로그와 푸시 전달 로그: 생성일로부터 1년
- 제휴 혜택 사용 이력: 정산·분쟁 대응에 필요한 기간 동안, 기본 1년
- DAU·WAU·MAU 및 제휴처별 집계 데이터: 직접 식별자, IP, user-agent, 세션 정보가 제거된 통계 형태로 서비스 운영에 필요한 기간 동안
- 보안 사고·분쟁 또는 법령상 보존 의무가 있는 경우: 해당 사건에 필요한 범위와 기간 동안 별도 보존
- 보유기간이 지나거나 처리 목적이 달성된 원본 개인정보는 파기하며, 집계 결과만 남길 수 있습니다.

## 4. 개인정보 제3자 제공 및 처리 위탁
싸트너십은 원칙적으로 이용자의 개인정보를 외부 제휴 업체를 포함한 제3자에게 제공하지 않습니다. 서비스 운영을 위해 Supabase, Vercel, Mattermost, 이미지 저장소 등 외부 인프라를 사용할 수 있으며 필요한 범위에서 개인정보가 처리될 수 있습니다.

## 5. 이용자의 권리 및 안전성 확보
이용자는 개인정보 열람, 정정, 삭제, 처리 정지 및 탈퇴를 요청할 수 있습니다. 싸트너십은 접근 권한 제한, 서버 측 권한 검증, 로그 마스킹, 보존기간 자동 점검 등 합리적인 보호 조치를 적용합니다.

## 6. 문의처
- 책임자: 정민호
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
