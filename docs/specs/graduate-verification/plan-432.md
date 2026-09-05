---
title: Issue 432 수료생 기수 전환 롤아웃
type: implementation-plan
status: current
authority: normative
related_issue: "#432"
---

# Issue 432 수료생 기수 전환 롤아웃

## Phase 1 — 이 변경

- 기존 요청은 유효한 `inferred_generation`/`inferred_cohort`를 우선 사용하고, 없으면 기존 시작 연월에서 기수를 계산해 두 호환 필드를 백필한다. 누락·잘못된 값은 migration을 실패시킨다.
- 신규·보완 신청은 `generation`만 제출한다. 날짜 네 컬럼은 nullable로만 바꿔 구 앱 배포 중단을 피한다.
- Preview에서 generation-only 코드와 migration 적용을 검증한다.

## Phase 2 — Preview 검증 후

새 앱이 배포되어 날짜 컬럼을 읽거나 쓰지 않는 것이 확인된 후 별도 forward migration으로 다음을 수행한다.

1. `graduate_verification_requests_period_check`을 제거한다.
2. `education_start_year`, `education_start_month`, `education_end_year`, `education_end_month`를 `drop column`한다.
3. 의존성(뷰·함수·정책·쿼리)을 migration 전에 재조회하고, 발견 시 먼저 generation-only로 교체한다.

이 Phase 1 migration에는 drop을 포함하지 않는다.
