---
title: Issue 432 수료생 기수 전환 롤아웃
type: implementation-plan
status: current
authority: normative
related_issue: "#432"
---

# Issue 432 수료생 기수 전환 롤아웃

## Phase 1 — 기수 전환과 앱 배포

- 기존 요청은 유효한 `inferred_generation`/`inferred_cohort`를 우선 사용하고, 없으면 기존 시작 연월에서 기수를 계산해 두 호환 필드를 백필한다. 누락·잘못된 값은 migration을 실패시킨다.
- 신규·보완 신청은 `generation`만 제출한다. 날짜 네 컬럼은 nullable로만 바꿔 구 앱 배포 중단을 피한다.
- Preview에서 generation-only 코드와 migration 적용을 검증한다.

PR [#433](https://github.com/MyKnow/ssartnership/pull/433)은 dev `55082c824bb48d16548f073154f471ab4e58dc11`로 병합됐다. 같은 SHA의 Preview 배포가 READY이며, `20260905192117` 적용과 기간 네 컬럼의 nullable 상태, 교육 정보·파일 보완 대상 유지를 읽기 전용 조회로 확인했다. 당시 Preview 신청은 0건이었다. 기존 신청의 실제 변환과 보완 상태 보존은 별도 PostgreSQL 17 합성 데이터로 검증했다.

## Phase 2 — 교육 기간 컬럼 제거

앱 배포와 Phase 1 반영을 확인한 뒤 별도 forward migration `20260905193818_finalize_graduate_cohort_schema.sql`로 다음을 수행한다.

1. 모든 신청의 `inferred_generation`과 `inferred_cohort`가 유효하고 같은지 확인한다. 실패하면 트랜잭션을 중단한다.
2. `inferred_generation`을 필수 값으로 설정하고, 기간·월 제약과 `education_start_year`, `education_start_month`, `education_end_year`, `education_end_month` 네 컬럼만 제거한다.
3. `restrict`로 예상하지 못한 의존성 삭제를 막는다. 적용 전 Preview 조회에서 함수 본문 참조와 기간 제약 외 의존 객체는 0건이었다.
4. `education_period`, `certificate`, `profile_image` 보완 대상과 기존 요청 상태·파일·승인 계약을 유지한다. `education_period`의 화면 표시는 계속 ‘교육 정보’이며 기수를 보완한다.

두 번째 변경은 같은 앱 소스의 독립 작업 공간에서 전체 Release 검증을 통과했다. PostgreSQL 17에서는 잘못된 기수일 때 삭제가 중단되고, 정상 전환 전후 네 기간 컬럼 외의 행 데이터가 동일함을 확인했다. 최종 dev 병합 후 마이그레이션 이력, 기간 컬럼 제거, 필수 기수와 보완 대상 유지, 동일 SHA의 Preview 배포를 다시 확인한다.

이 작업의 배포 범위는 dev/Preview이며 main/Production 승격은 포함하지 않는다.
