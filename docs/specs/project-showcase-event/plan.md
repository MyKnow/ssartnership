---
title: SSAFY 프로젝트 쇼케이스 구현 계획
type: implementation-plan
status: active
authority: descriptive
---

# SSAFY 프로젝트 쇼케이스 구현 계획

기준: [기능 명세](./spec.md). 운영 일정에 맞춰 PR 3개로 나눠 각 단계 시작 전에 Production에 반영한다.

## 경계

- 공개·회원 화면은 `/events/project-showcase/**`, 운영 화면은 `/admin/events/project-showcase/**`에 둔다.
- 페이지와 Server Action은 `src/lib/project-showcase`의 Repository만 호출한다. mock과 Supabase 구현은 같은 단계·소유권·복수 출품·1인 1경품 규칙을 강제하고 위반 시 `ShowcaseDomainError`를 던진다.
- 회원 Server Action은 `(site)/events/project-showcase/actions.ts`, 관리자 Server Action은 `admin/(protected)/events/project-showcase/actions.ts`에 둔다. 관리자 액션은 `events` 권한을 다시 확인하고 감사 로그를 남긴다.
- 폼 검증은 `validation.ts`의 같은 함수(`parseShowcaseProjectSubmission`, `parseShowcaseSchedule`, `parseShowcaseReview`)를 FE와 BE에서 사용한다. DB 예외 문구는 `errors.ts`의 코드·메시지 매핑으로 바꿔 field focus에 연결한다.
- 모든 테이블은 RLS를 켜고 anon/authenticated 권한을 회수한다. 쓰기는 service role 전용 RPC와 unique index가 최종 방어선이다.

## 데이터 모델

| 테이블 | 역할 | PR |
| --- | --- | --- |
| `showcase_events` | 기간, 경품 수량(기본 20/25), 활성화, 정산·파기 시각 | 1 |
| `showcase_projects` | 출품, 유형(web/app/game/embedded), 팀명, 검수 상태·사유, 취소 시각. 회원별 복수 출품, 생성일 기준 목록 인덱스 | 1 |
| `showcase_project_participants` | 폐기된 명단 테이블. 기존 행 삭제 후 신규 쓰기 금지(배포 호환용 빈 테이블) | 1 |
| `showcase_registrations` | 체험 참여 등록(회원, 이름 공개 동의). 회원별 1회, 학번 컬럼은 항상 NULL | 2 |
| `showcase_project_views` | 회원별 최초 상세 조회 | 1 |
| `showcase_experiences` | 체험 시작 시각(60초 게이트 기준) | 2 |
| `showcase_feedback` | 한 줄 피드백 = 유효 체험 1건, 숨김 처리 | 2 |
| `showcase_interests` | 관심 표시 토글 | 2 |
| `showcase_candidate_exclusions` | 추첨 전 후보 제외·복구 | 3 |
| `showcase_draws`, `showcase_winners` | 최초·재추첨 원장, 마스킹 스냅샷, 무효·발송 기록. 회원당 유효 당첨 1건 unique | 3 |

테이블은 PR 1에서 한 번에 만들고, RPC는 각 PR에서 추가한다. 회원 연결 컬럼은 nullable이며 정산 30일 후 파기 작업이 연결을 끊는다.

## PR 분할

1. **이벤트 기반과 출품**: 전체 테이블, 출품·수정·취소·검수·조회 RPC, 허브(단계별 주요 버튼, 참여 방법·경품·유의사항, 출품 가이드), 내 참여의 출품 영역, 내 출품 보기·수정, 기간 밖 상세 안내, 관리자 일정·전체 출품 목록·검수, 로그·집계.
2. **체험·피드백**: 참여 등록, 체험 시작, 60초 게이트 피드백, 관심 표시, 추첨권 계산, 갤러리 체험 완료 배지, 내 참여의 체험·추첨권, 출품자 피드백 목록, 관리자 피드백 숨김.
3. **검증·추첨·발표**: 후보 검증·제외, 출품→체험 순서 추첨(균등·추첨권 가중), 1인 1경품, 무효·재추첨, 마스킹 결과 공개, Mattermost 공지 텍스트 복사, 당첨 확인, 발송·정산 기록, 30일 후 파기 예약 작업.

## 확인 방법

- DB: forward-only migration, `supabase/schema.sql`, `npm run validate:migrations`, Preview 적용 결과.
- 도메인: `tests/project-showcase.test.mts`(검증, 단계, 마스킹, 일정·검수 검증, 에러 매핑, mock Repository 규칙).
- UI: 공개·회원·관리자 화면 360px, 820px, 1366px 캡처.
- 변경 위험 등급에 따른 `npm run verify:change`.

## Issue #491 — 정책 변경과 배포

- 기능 기준: 학번·팀원 입력 제거, 복수 출품, 승인 프로젝트당 1장, 전체 분야 통합 1인 1경품, 수동 중복 반려.
- UI 목표: 회원이 추가 출품하고 자기 프로젝트별 상태를 확인한다. 기존 폼·카드·모바일 세로 배치를 유지하고, 관리자에게 중복 반려 사유 입력과 회원 연락처 확인 링크를 제공한다. 신규 디자인 토큰은 만들지 않는다.
- DB: `20260926203807_showcase_member_multiple_submissions.sql`은 1인 1출품 인덱스를 제거하고 기존 명단·학번을 지운다. 배포 중 구버전 RPC 호출을 위해 이전 인자와 빈 컬럼 모양은 유지하되, 인자는 무시하고 CHECK로 재수집을 막는다. 당첨·출품 ID와 검수 이력은 보존한다.
- 추첨: 프로젝트 표본을 뽑은 뒤 당첨 회원의 모든 표본을 제거한다. DB에서 후보 인원·표본 수를 재확인하고 동일 회원 재당첨을 거절한다.
- 순서: 운영 DB 백업 복원 리허설 → 로컬 Release 및 화면 확인 → 기능 PR을 dev에 병합 → Preview DDL·배포 확인 → dev에서 main 승격 → Production DDL·배포 확인. 기존 파기 예약 작업을 유지한다.
