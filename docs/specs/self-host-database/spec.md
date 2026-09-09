---
title: 자체 호스팅 데이터와 운영 복구 명세
type: feature-spec
status: active
authority: normative
issue: https://github.com/MyKnow/ssartnership/issues/435
---

# 자체 호스팅 데이터와 운영 복구

## 결과

### 상시 Production/Preview 격리 계약

2026-09-07 사용자 승인: Production과 Preview는 앱(Next.js FE/BE)·PostgreSQL·Storage를 각각 상시 실행한다. Compose 프로젝트, DB 계정, JWT/세션/암호화 키, 네트워크, 데이터/파일/백업 볼륨을 공유하지 않는다. 브라우저 쿠키는 포트가 아닌 hostname 경계이므로 최종 ingress도 서로 다른 hostname과 host-only 쿠키를 사용한다. Preview의 변경·삭제·마이그레이션·복구는 Production에 쓰지 않는다. 동일 물리 호스트의 장애·자원 경쟁은 별도 위험이며 자원 제한과 실측이 필요하다.

Production → Preview 복사는 명령으로 요청하는 단방향 유지보수다. 일반 dev 배포는 데이터를 복사하지 않는다. 검증된 DB/Storage 짝 백업을 네트워크 없는 격리 환경에 복원하고, 운영 비밀번호·재사용 가능한 토큰·발송 자격증명을 제거한 뒤 새 Preview 후보에 전달한다. 기존 Preview는 후보 검증과 명시적 교체가 끝날 때까지 유지한다. 운영 데이터 그대로의 무차별 복제가 아니라, 기존 회원 비밀번호 제외 및 Storage 허용 정책을 보존한 테스트 사본이다. 세부 범위와 현재 한계는 [두 환경 운영과 복사](../../operations/runbooks/self-host-environments.md)를 따른다.

[홈 서버 마이그레이션](../self-hosting/spec.md)의 데이터·운영 범위다. PostgreSQL, REST/RPC와 Storage를 자체 운영하고, 현재 사용하거나 장기 유지보수에 필요한 관리형 기능을 대체한다. Next.js와 기존 Repository·SDK 계약을 유지한다. 로컬 선행 작업은 실제 운영 데이터 없이 Docker Desktop에서 재현한다.

Supabase 자체 호스팅은 관리형 백업/PITR, branching, 고급 metrics, 플랫폼 Management API를 포함하지 않는다. 따라서 데이터 컨테이너가 실행되는 것과 운영 서비스가 준비되는 것은 서로 다른 수용 조건이다. [공식 차이점](https://supabase.com/docs/guides/self-hosting#how-self-hosted-supabase-differs)을 기준으로 다음을 범위에 포함한다.

| 기능 | 자체 운영 계약 |
| --- | --- |
| DB·REST·RPC·Storage | 고정한 Supabase 구성요소, 환경별 Compose 프로젝트·비밀·볼륨, 공개 API와 내부 DB망 |
| 관리형 백업·PITR | pgBackRest 전체/증분 백업, WAL 연속 보관, 새 대상에서 지정 복구 지점 검증 |
| Storage 복구 | Restic 암호화 스냅샷·무결성 검사·복원, DB 복구 지점과 짝지은 manifest |
| Database branching | 별도 프로젝트의 빈 DB에 동일 마이그레이션을 적용하는 schema-first Preview; 운영 데이터는 기본 복사 금지 |
| 플랫폼 관리 | 접근 통제된 로컬/SSH CLI로 생성·상태·마이그레이션·백업·복구 실행, 구성은 Git과 비밀 파일로 관리 |
| 유지보수·감시 | 실패/백업 나이/아카이브 상태·복구 검사 기록, 호스트 스케줄, 외부 장애 알림, 고정 버전 업그레이드·되돌리기 절차 |
| Vercel Analytics·SpeedInsights | 기존 제품 이벤트/SQL 지표는 유지하되, 실제 사용자 Web Vitals·성능·오류 수집의 자체 운영 대체를 전환 전 마련 |

저장소의 기존 운영 사용처는 `supabase db push`와 migration 상태 확인, Preview 동기화의 dump·sanitizer·Storage 복사다. 플랫폼 `api.supabase.com`을 직접 호출하는 기능은 이번 코드 조사에서 발견되지 않았다. 현재 클라우드 조회에서는 운영과 Preview가 별도 PostgreSQL 17 프로젝트이며 각각 기본 branch만 확인했다. 지속형 운영·Preview 격리와 필요할 때 생성하는 테스트 환경을 우선 제공한다. 관리형 백업/PITR의 실제 구독·보관 설정은 아직 확인하지 않았다.

## 불변조건

`src/app/layout.tsx`에서 사용하던 Vercel Analytics와 SpeedInsights는 Vercel 밖에서 비활성화된다. 기존 내부 제품 이벤트와 SQL 지표가 이를 모두 대체하지 않으며, 이번 backup 상태 CLI도 RUM/Web Vitals 대체물이 아니다. 자체 성능·오류·가용성 수집과 외부 장애 알림은 전환 전 검증할 별도 필수 작업이다.

- 기존 199개 migration은 수정하지 않는다. Storage가 자신의 schema를 만든 후 순서대로 적용하며, 적용 hash와 ledger·잠금으로 중복 및 드리프트를 검출한다. `schema.sql`은 초기화 입력으로 사용하지 않는다.
- 서비스의 권한·RLS·RPC와 기존 사용자 인증 계약을 유지한다. DB 관리자와 Docker 소켓을 공개 API에 노출하지 않는다.
- 공개 `SUPABASE_URL`에서 SDK 파일 URL을 만들고, 서버 요청만 선택적인 `SUPABASE_INTERNAL_URL`로 전송한다. 다른 origin이나 redirect로 service key를 전달하지 않는다.
- 환경 비밀은 환경별 난수이며 소유자 전용 파일에 저장한다. 운영 비밀·데이터를 개발 환경에 암묵적으로 상속하지 않는다.
- 운영 데이터 복제에는 기존 Preview sanitizer와 별도의 명시적 범위가 필요하다. 회원 비밀번호 hash/salt는 복제하지 않는다.
- 복구 명령은 기존 운영 볼륨에 덮어쓰지 않는다. 복원 결과 검증 뒤의 실제 전환은 별도 운영 단계다.
- DB PITR과 임의 시점 파일 복구를 동일하게 보장하지 않는다. 파일 overwrite/delete 이후 DB만 과거로 복원하면 참조와 객체가 어긋날 수 있다.
- 같은 호스트의 백업 볼륨은 로컬 복구 실습용이다. 운영 준비에는 독립 장애 영역의 암호화 저장소와 서버 밖의 키 보관이 필수다.

## 수용 기준

1. 빈 볼륨에서 DB→Storage→199개 migration→REST/gateway가 실행되고 재실행은 hash 확인 후 건너뛴다.
2. service 권한의 read/write/RPC, anon 거절, 공개·비공개 파일의 업로드·서명·다운로드, 재시작 후 지속성을 실제 구성에서 검증한다.
3. 전체/증분 백업, WAL 아카이브, 암호화 파일 스냅샷 및 새 대상의 PITR 복구가 실행되며 marker와 파일 내용으로 결과를 확인한다.
4. 백업 실패·노후화·저장소 검사 결과가 기계가 읽는 상태로 제공된다. 예약 작업과 장애 알림의 실제 설치·전달을 운영 전 검증한다.
5. 서로 다른 Preview 프로젝트의 포트·볼륨·비밀이 분리되고 하나의 종료가 다른 환경에 영향을 주지 않는다.
6. 외부 저장소·키 복구·서버 용량·배포 권한·실제 운영 전환의 미검증 항목을 [작업 목록](./tasks.md)에 남긴다.

[기술 계획](./plan.md), [데이터 실행 절차](../../operations/runbooks/self-host-database.md), [백업·운영 절차](../../operations/runbooks/self-host-operations.md)를 함께 따른다.
