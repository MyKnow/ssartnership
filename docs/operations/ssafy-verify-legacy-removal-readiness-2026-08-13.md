# SSAFY Verify 레거시 삭제 준비도 감사 (2026-08-13)

관련 Issue: [#309](https://github.com/MyKnow/ssartnership/issues/309)

## 범위와 안전 경계

- 코드 기준선: `origin/dev`의 `44b63485`
- 데이터 기준선: Supabase 프로젝트 표시명이 `SSARTNERSHIP`인 Production
- 확인 방식: 행 본문을 읽지 않는 `count(*)` 집계, `information_schema`와 `pg_catalog`의 객체·권한·함수 정의 검사, Vercel 환경 변수의 이름·target metadata 검사
- 수행하지 않은 작업: Production DDL/DML, RPC 실행, 회원 ID·이메일·Mattermost ID·SSAFY subject·로그 properties 등 식별 가능 값 조회, 환경 변수 값 조회, 배포·설정 변경

로컬 환경 파일의 공개 사이트 URL만으로 Production을 판별하면 안 된다. 이번 점검에서 로컬 `SUPABASE_URL`은 표시명이 `SSARTNERSHIP PREVIEW`인 프로젝트를 가리켰다. 아래 Production 수치는 Supabase 프로젝트 목록에서 표시명 `SSARTNERSHIP`을 다시 선택한 뒤 확인했다. 이 절차 전에 얻은 Preview 수치는 모두 폐기했다.

## 판정

**HOLD — 현재는 삭제를 승인할 수 없다.**

런타임의 SSAFY Verify reader·writer·route는 제거됐지만, 다음 네 가지가 남아 있다.

1. Production에 Verify proof 13행과 legacy Mattermost alias 8행이 남아 있다. 둘 다 식별 가능 정보이므로 보관 또는 삭제 결정을 운영자가 명시해야 한다.
2. Vercel에 런타임이 더 이상 읽지 않는 Verify 환경 변수 key 10종, target별 엔트리 12개가 남아 있다. 그중 server client secret 엔트리는 삭제와 provider credential 폐기를 함께 결정해야 한다.
3. `anonymize_deleted_member(uuid)`가 `member_ssafy_verifications`를 직접 삭제하고, 이미 제거된 `members.ssafy_*` 컬럼도 참조한다. 현재 30일 익명화 대기 행은 0건이지만, 향후 대상이 생기면 익명화 작업이 실패할 수 있으므로 레거시 테이블보다 함수를 먼저 교체해야 한다.
4. TypeScript와 DB constraint에 휴면 상태의 `ssafy_sub` 식별자 예약 계약이 남아 있다. Production 예약 행은 0건이지만, 스키마 삭제와 함께 계약·테스트를 정리해야 한다.

## Production 비식별 집계

2026-08-13 KST 기준이다. 아래 값은 개수만 조회했으며 행 또는 식별자 값은 조회하지 않았다.

| 확인 대상 | 결과 | 판단 |
| --- | ---: | --- |
| `member_ssafy_verifications` 전체 행 | 13 | 삭제·보관 승인이 필요한 legacy proof |
| `mm_user_directory.legacy_ssafy_mattermost_user_id is not null` | 8 | 삭제·보관 승인이 필요한 legacy alias |
| `notification_deliveries.provider = 'ssafy_verify'` | 0 | Verify delivery 행 정리 작업은 현재 불필요 |
| `member_identifier_reservations.identifier_kind = 'ssafy_sub'` | 0 | 데이터 삭제는 없지만 휴면 계약 제거 필요 |
| `auth_security_logs.event_name = 'ssafy_verify_api_trace'` | 7,490 | Verify 스키마 삭제와 분리하고 기존 로그 보존 정책 적용 |
| 탈퇴 후 30일이 지났고 아직 익명화되지 않은 회원 | 0 | 현재 backlog는 없지만 함수 계약 결함은 선제 수정 필요 |
| 탈퇴했으나 아직 익명화되지 않은 회원 전체 | 0 | 현재 backlog 없음 |

`auth_security_logs`는 [운영 로그 보존 migration](../../supabase/migrations/20260722001817_add_log_retention_policy.sql)의 1년 기준과 hold 절차를 따른다. Verify 제거를 이유로 별도 일괄 삭제하지 않는다.

## Vercel 환경 변수 metadata

값은 열람하지 않았다. Preview/Production target을 합쳐 12개 엔트리이며, 고유 key는 다음 10종이다.

- `NEXT_PUBLIC_SSAFY_VERIFY_CLIENT_ID`
- `NEXT_PUBLIC_SSAFY_VERIFY_ISSUER`
- `NEXT_PUBLIC_SSAFY_VERIFY_REDIRECT_URI`
- `SSAFY_VERIFY_CLIENT_ID`
- `SSAFY_VERIFY_ISSUER`
- `SSAFY_VERIFY_REDIRECT_URI`
- `SSAFY_VERIFY_REDIRECT_URIS`
- `SSAFY_VERIFY_SERVER_API_BASE_URL`
- `SSAFY_VERIFY_SERVER_CLIENT_ID`
- `SSAFY_VERIFY_SERVER_CLIENT_SECRET`

`SSAFY_VERIFY_SERVER_CLIENT_ID`와 `SSAFY_VERIFY_SERVER_CLIENT_SECRET`은 Preview와 Production target에 각각 존재해 key 수보다 엔트리 수가 2개 더 많다. 현재 코드와 `.env.example`에는 이 key들의 reader가 없지만, 미사용 secret을 보존하는 것은 불필요한 노출면이다. 삭제 승인을 받으면 Vercel 엔트리 제거뿐 아니라 Verify provider 쪽 credential 폐기 또는 회전 가능 여부도 확인한다.

## 코드와 런타임 감사

| 표면 | 현행 상태 | 삭제 작업에서의 처리 |
| --- | --- | --- |
| Verify API routes, auth UI, client/config | `src`와 `scripts`에 active reader/writer 없음 | 이미 완료. 되돌리지 않음 |
| 공개 env 예시 | Verify key 없음 | 현행 유지 |
| 직접 Mattermost 회귀 계약 | [mattermost-direct-reversion.test.mts](../../tests/mattermost-direct-reversion.test.mts)가 제거된 route와 공개 env key의 부재를 검증 | **삭제하지 않고 유지** |
| 정규화 인증 회귀 계약 | [member-normalized-auth-contract.test.mts](../../tests/member-normalized-auth-contract.test.mts)가 active lifecycle reader의 proof-table 의존 부재를 검증 | **삭제하지 않고 유지** |
| 식별자 예약 helper | [member-domain.ts](../../src/lib/member-domain.ts)가 `ssafy_sub` input/kind/hash 생성을 허용 | active caller는 `ssafySub`를 전달하지 않지만 후속 코드 정리 필요 |
| 식별자 예약 test | [member-domain.test.mts](../../tests/member-domain.test.mts)가 `ssafy_sub` 생성을 기대 | helper·constraint와 같은 PR에서 갱신 |
| 알림 delivery | [admin-notification-ops-delivery.ts](../../src/lib/admin-notification-ops-delivery.ts)는 같은 provider 컬럼에 현재 `mattermost` 값을 기록 | generic provider 컬럼·인덱스는 **삭제 금지** |
| 탈퇴 익명화 | [member-lifecycle.ts](../../src/lib/member-lifecycle.ts)가 `anonymize_deleted_member` RPC를 호출 | 레거시 drop보다 먼저 함수 교체 및 회귀 테스트 필요 |

정적 검색의 `SSAFY Verify` 문자열은 역사 문서, immutable migration, event 이름, 회귀 테스트에도 남는다. 문자열이 있다는 이유만으로 일괄 삭제하지 않는다.

## Production DB 객체와 의존성

| 객체 | 현재 계약 | 의존성·권한 | 결론 |
| --- | --- | --- | --- |
| `public.member_ssafy_verifications` | `member_id` PK/FK, unique `ssafy_sub`, 검증·track metadata | `members(id) on delete cascade`; PK/unique 인덱스; RLS enabled; `anon`/`authenticated` SELECT 없음; owner `postgres` | 승인 후 drop 후보 |
| `public.mm_user_directory.legacy_ssafy_mattermost_user_id` | nullable legacy alias | unique partial index `mm_user_directory_legacy_ssafy_mattermost_user_id_key`; table RLS enabled; owner `postgres` | 승인 후 column/index drop 후보 |
| `member_identifier_reservations_kind_check` | `email`, `mm_user_id`, `mm_username`, `ssafy_sub` 허용 | TypeScript union/helper와 계약 결합 | `ssafy_sub` 제거 후보 |
| `public.anonymize_deleted_member(uuid)` | 30일 탈퇴 회원의 개인정보 익명화 | proof table DELETE와 제거된 `members.ssafy_*` 컬럼을 함수 본문에서 참조; `security invoker`, `search_path=public`; public/anon/authenticated 실행 불가, service role만 실행 | **먼저 교체할 blocker** |
| Verify 전용 view/materialized view/trigger | 없음 | catalog와 정의문 검색 결과 없음 | 추가 drop 없음 |
| Verify 전용 delivery row | 0 | provider 컬럼은 Mattermost가 계속 사용 | row/column cleanup 없음 |

`pg_depend`에는 table FK·PK·unique·toast 같은 구조 의존성만 나타났고 함수 의존성은 나타나지 않았다. PL/pgSQL 함수 본문의 textual relation 참조는 catalog dependency만 확인해서는 놓칠 수 있으므로 `pg_get_functiondef` 정의문 검사 결과를 삭제 순서의 근거로 사용한다.

Production `members`에는 현재 `ssafy_*` 컬럼이 없다. 과거 migration의 create/backfill/drop 문장은 replay 이력이며, live `information_schema`가 현행 구조의 기준이다. 다음 migration은 근거 이력이므로 수정하거나 삭제하지 않는다.

- [20260713014528_normalize_member_domain_expand.sql](../../supabase/migrations/20260713014528_normalize_member_domain_expand.sql): proof table, alias, reservation kind, 최초 익명화 함수
- [20260713014534_backfill_member_domain_extensions.sql](../../supabase/migrations/20260713014534_backfill_member_domain_extensions.sql): legacy data backfill
- [20260713204059_contract_member_domain_legacy_columns.sql](../../supabase/migrations/20260713204059_contract_member_domain_legacy_columns.sql): `members.ssafy_*` 제거와 익명화 함수 갱신
- [20260714153509_add_manual_member_login_id.sql](../../supabase/migrations/20260714153509_add_manual_member_login_id.sql): 현재 익명화 함수 정의

이름에 `ssafy`가 포함돼도 `ssafy_cycle_settings`와 `ssafy_cohort_card_themes`는 현재 기수·카드 표시 도메인이다. Verify 제거 대상이 아니다.

## 보관·롤백 결정

13개 proof 행은 pairwise subject와 검증·track metadata를, 8개 alias는 외부 Mattermost 식별자를 보관한다. 두 집합 모두 개인정보 또는 가명정보로 취급해야 한다. 이 문서는 법적 보존 기간을 새로 정하지 않는다.

권장안은 **Verify 런타임 rollback을 명시적으로 포기하고 별도 원문 export를 만들지 않는 것**이다. 승인된 Supabase 암호화 backup/PITR의 실제 보존·복구 가능 범위를 운영자가 확인한 뒤, application table의 proof·alias와 Vercel credential을 제거한다. raw SQL/CSV 파일을 로컬이나 저장소에 별도로 남기면 새로운 개인정보 보관 위치와 접근 통제가 생기므로 기본안으로 삼지 않는다.

사업·분쟁 대응 때문에 별도 보관이 필요하면 다음을 먼저 확정한다.

- 암호화된 비공개 저장 위치
- 접근 가능한 최소 인원과 책임자
- 보관 종료일과 삭제 확인 방식
- 복구 목적과 복구 승인자
- export 파일에 포함할 최소 필드

## 운영자 승인 경계

다음 항목이 모두 채워지기 전에는 Production migration이나 환경 변수 삭제를 시행하지 않는다.

| 결정 | 선택지 | 승인 기록 |
| --- | --- | --- |
| SSAFY Verify 런타임 rollback | `포기` / `YYYY-MM-DD까지 유지` | 미결정 |
| proof 13행 | `삭제` / `암호화 archive` / `YYYY-MM-DD까지 유지` | 미결정 |
| legacy alias 8행 | `삭제` / `암호화 archive` / `YYYY-MM-DD까지 유지` | 미결정 |
| archive 선택 시 위치·owner·만료일 | 구체 값 필수 | 미결정 |
| Supabase backup/PITR | 보존 범위·복구 권한·복구 절차 확인 | 미확인 |
| Vercel Verify env 12개 엔트리 | Preview/Production 삭제 승인 | 미결정 |
| Verify provider credential | 폐기 또는 회전 승인 | 미결정 |
| Preview 검증 후 Production forward migration | 수동 적용 승인 | 미결정 |

권장 승인 문구는 다음과 같다.

> SSAFY Verify 런타임 rollback을 포기한다. Production의 proof 13행과 legacy alias 8행은 별도 원문 export 없이 삭제한다. 승인된 Supabase backup/PITR의 보존·복구 범위를 확인한 뒤, Preview 검증을 통과한 forward migration을 Production에 수동 적용하고 Vercel의 Verify env 12개 엔트리와 provider credential을 제거한다.

다른 선택을 할 경우 숫자, 보관 종료일, archive 위치·owner·만료일을 위 문구에 명시한다.

## 승인 후 구현 순서

1. 별도 cleanup Issue와 `dev` 기반 typed branch를 만든다. 삭제 migration은 이 문서 PR과 분리한다.
2. 현행 `members` 컬럼만 사용하는 `anonymize_deleted_member` 계약 테스트를 먼저 추가한다. proof table 삭제 전후 모두 익명화가 성립해야 한다.
3. `MemberIdentifierReservation`의 `ssafy_sub`, `ssafySub` input과 관련 test를 제거한다.
4. 실제 현재시각 prefix의 forward migration 하나에서 다음 순서를 지킨다.
   1. `anonymize_deleted_member`를 현행 컬럼만 사용하고 proof table을 참조하지 않도록 교체한다.
   2. `member_identifier_reservations_kind_check`에서 `ssafy_sub`를 제거한다.
   3. `member_ssafy_verifications`를 drop한다.
   4. `mm_user_directory.legacy_ssafy_mattermost_user_id`와 partial index를 drop한다.
5. schema snapshot을 같은 최종 계약으로 갱신하고 migration replay·mock/Supabase 계약 테스트를 통과시킨다.
6. Preview에 migration을 적용한 뒤 직접 Mattermost 가입·재설정·프로필 동기화·탈퇴/30일 익명화 계약을 확인한다. 운영 행을 임의로 만들거나 삭제하는 smoke는 별도 승인된 테스트 데이터에서만 수행한다.
7. Production 적용 직전에 이 문서의 aggregate와 catalog boolean을 다시 SELECT-only로 확인하고 수치가 달라졌으면 승인을 갱신한다.
8. 운영자가 backup/PITR와 수동 Production gate를 확인한 뒤 forward migration을 적용한다.
9. 앱 배포와 직접 Mattermost smoke가 정상임을 확인한 뒤 Vercel Verify env를 제거하고 provider credential을 폐기 또는 회전한다.
10. postflight에서 table·column·constraint·함수 정의·env key 부재를 확인하고 Issue에 식별값 없는 결과만 기록한다.

forward migration을 되감는 reverse SQL을 기본 rollback으로 두지 않는다. 데이터 삭제 뒤 rollback이 필요하면 승인된 backup/PITR와 그 시점에 맞는 코드·환경 변수를 함께 복원해야 한다.

## 재확인용 SELECT-only SQL

아래 쿼리는 행 본문을 반환하지 않는다. Production 프로젝트는 URL이나 로컬 env 추측이 아니라 표시명으로 먼저 확인한다.

```sql
select count(*) from public.member_ssafy_verifications;

select count(*)
from public.mm_user_directory
where legacy_ssafy_mattermost_user_id is not null;

select count(*)
from public.notification_deliveries
where provider = 'ssafy_verify';

select count(*)
from public.member_identifier_reservations
where identifier_kind = 'ssafy_sub';

select count(*)
from public.auth_security_logs
where event_name = 'ssafy_verify_api_trace';

select count(*)
from public.members
where deleted_at is not null
  and deleted_at <= now() - interval '30 days'
  and anonymized_at is null;
```

함수 정의는 원문을 운영 채널에 붙여 넣지 말고, 필요한 문자열의 존재 여부만 boolean으로 확인한다.

```sql
select
  position(
    'delete from public.member_ssafy_verifications'
    in lower(pg_get_functiondef(p.oid))
  ) > 0 as references_legacy_proof,
  position(
    'ssafy_sub = null'
    in lower(pg_get_functiondef(p.oid))
  ) > 0 as references_removed_ssafy_columns
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'anonymize_deleted_member'
  and pg_get_function_identity_arguments(p.oid) = 'p_member_id uuid';
```

## 관련 `dev` 구현 증빙

문서 감사 시점의 `dev`에는 다음 PR이 병합돼 있다. Production 승격 여부와 이슈 종료는 별도 운영 게이트다.

| Issue | `dev` 구현 | CI 근거 | 남은 경계 |
| --- | --- | --- | --- |
| [#291](https://github.com/MyKnow/ssartnership/issues/291) | [PR #292](https://github.com/MyKnow/ssartnership/pull/292) | [Public Readiness](https://github.com/MyKnow/ssartnership/actions/runs/30452254334) | Preview 통합·Production 승격 확인 |
| [#293](https://github.com/MyKnow/ssartnership/issues/293) | [PR #294](https://github.com/MyKnow/ssartnership/pull/294) | [Public Readiness](https://github.com/MyKnow/ssartnership/actions/runs/30697804651) | Preview 운영 흐름·Production 승격 확인 |
| [#295](https://github.com/MyKnow/ssartnership/issues/295) | [PR #296](https://github.com/MyKnow/ssartnership/pull/296) | [Public Readiness](https://github.com/MyKnow/ssartnership/actions/runs/30707380720) | 실제 신청 행·상세 이동 Preview 증빙과 Production 승격 |
| [#301](https://github.com/MyKnow/ssartnership/issues/301) | [PR #304](https://github.com/MyKnow/ssartnership/pull/304), [#305](https://github.com/MyKnow/ssartnership/pull/305), [#306](https://github.com/MyKnow/ssartnership/pull/306), [#307](https://github.com/MyKnow/ssartnership/pull/307) | [PR #307 Public Readiness](https://github.com/MyKnow/ssartnership/actions/runs/31586312877) | [#308](https://github.com/MyKnow/ssartnership/issues/308), Preview 실제 기기·Production 승인 |
