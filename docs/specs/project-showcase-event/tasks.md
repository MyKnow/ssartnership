---
title: SSAFY 프로젝트 쇼케이스 작업 기록
type: task-list
status: active
authority: descriptive
---

# SSAFY 프로젝트 쇼케이스 작업 기록

## 결정 기록

- 2026-09-26: 기획안 v4 기준으로 명세를 다시 썼다. 체험 인정은 체험 시작 60초 후 피드백 제출, 추첨권은 유효 체험 프로젝트 수, 유형에 GAME 추가, 학번 7자리, 당첨자는 마스킹 이름·학번으로 Mattermost 공지, 경품은 Mattermost로 발송, 개인정보는 정산 30일 후 파기.
- 초기 구현의 선택 공개 동의(동의자만 추첨 대상), 1인 1장 추첨권, 발표 기간 상위 3개 전시는 폐기했다.
- 검수자 FK를 `members`에서 `admin_accounts`로 바로잡았다. 관리자 세션 ID는 `admin_accounts.id`다.

## PR 1 — 이벤트 기반과 출품

- [x] 전체 테이블과 RLS, 출품·수정·취소·검수·조회 RPC, 관리자 집계·활동 RPC
- [x] 공용 검증(출품·일정·검수), 에러 코드 매핑, mock/Supabase Repository
- [x] 허브 개편, 출품 폼(GAME, 팀명, 대표자 학번, 필수 동의 2개), 내 참여, 내 출품 보기·수정·취소
- [x] 기간 밖 상세 안내 화면
- [x] 관리자 일정·경품 수량, 상태별 전체 출품 목록과 검수(사유 필수 규칙), 로그·집계
- [x] 도메인 테스트 `tests/project-showcase.test.mts`
- [x] 360px·820px·1366px 화면 캡처, Production 빌드, E2E 접근 제어
- [x] `verify:change`, dev PR #481 (원격 첫 실행 감사 완료)
- [ ] 실제 Postgres에 migration 적용 확인 (dev 병합 후 Preview migration)

## PR 2 — 체험·피드백

- [x] 참여 등록, 체험 시작, 60초 게이트 피드백, 관심 표시, 추첨권 RPC와 mock/Supabase Repository
- [x] 상세 체험 패널(서버 시각 기준 카운트다운), 갤러리 체험 완료 배지
- [x] 내 참여 체험 영역, 출품자 받은 반응·피드백 목록, 관리자 피드백 숨김 화면
- [x] 체험 규칙 도메인 테스트
- [x] dev PR #482

## PR 3 — 검증·추첨·발표

- [x] 후보 제외·복구, 출품 균등·체험 추첨권 가중 추첨(CSPRNG), 출품→체험 순서, 1인 1경품(무효 이력 포함 재당첨 금지), 무효·재추첨
- [x] 마스킹 결과 공개, Mattermost 공지 문구 복사, 내 당첨 확인, 발송·정산 기록, 정산 30일 후 파기 cron
- [x] 추첨·정산 도메인 테스트, schema 스냅샷 원문 일치 계약 테스트
- [ ] PR 2 병합 후 dev PR

## 운영 체크

- 홈 프로모션 슬라이드는 비활성으로 들어간다. 일정을 설정한 뒤 광고 관리에서 활성화한다.
- PR 1 병합 후 클라우드 Preview migration 워크플로는 Supabase 앱 검사 부재로 fail-closed 실패했다(원장 `preview_migration_supabase_check_absent_after_self_host`). 자체 호스팅 Preview는 운영자가 DDL을 적용·검증하고 `schema-approval.json`을 갱신해야 새 버전이 배포된다.
