---
title: 2026-10 책임 분리 후속 실행 계획
type: exec-plan
status: active
authority: normative
---

# 2026-10 책임 분리 후속 실행 계획

관련 Issue: [#591](https://github.com/MyKnow/ssartnership/issues/591). 2026-10-17 사용자가 아래 8개 단위의 실행을 모두 명시적으로 승인했다. 기능 추가를 기다리는 후보가 아니라, 현재 책임 경계와 검증을 개선하는 승인 작업이다. 이 문서는 작업 범위와 완료 판정 조건을 관리하며 [#530 기본 결정](./refactor-program-2026-10.md#기본-결정)을 대체하지 않는다.

## 기준과 작업 분리

- 코드 기준은 `dev`의 `2e29183854d5f6d71a928a1317a951be4d03a45f`다. 8개 단위는 이 SHA에서 만든 서로 다른 관리형 worktree와 작업 브랜치에서 진행한다. 원본 작업 경로와 다른 단위의 변경은 보존한다.
- 기존 문서의 `b2a212f4`는 2026-10-05 시점 기록이다. 현재 코드 기준과 혼동하지 않는다. R8에서 직접 재측정한 항목·방법·범위는 [기술 부채 원장의 부분 갱신](../tech-debt.md#2026-10-17-부분-갱신-범위)에 둔다.
- 각 단위는 승인된 책임만 소유하며, 공통 파일 충돌은 통합 단계에서 조정한다. 파일 크기 목표를 맞추기 위한 재배치나 전역 프레임워크 도입은 하지 않는다.

## 승인된 단위와 완료 조건

| 단위 | 범위 | 완료에 필요한 증거 | 현재 상태 |
| --- | --- | --- | --- |
| R1 | 청구 동작 테스트 | 청구의 입력·상태·실패 계약을 검증하는 집중 동작 테스트와 결과 | 로컬 완료: billing 동작 62개·SQL 구조 8개 통과 |
| R2 | 파트너 알림 controller 분리 | 기존 알림 동작과 오류·대기 상태를 보존한 책임 분리, 집중 검증과 관련 화면 확인 | 로컬 완료: 명령 동작 15개·관련 Node 27개 및 3개 화면 폭 확인 |
| R3 | 이벤트 보상 책임 분리 | 보상 처리의 기존 권한·상태 전이·중복 처리 계약을 보존한 분리와 집중 검증 | 로컬 완료: 관련 Node 75개·Vitest 26개 및 불변식 독립 검토 |
| R4 | 회원 가져오기 서버·UI 분리 | 서버 처리와 UI 상태의 책임 분리, 기존 검증·가져오기 결과·오류 계약과 관련 화면 확인 | 로컬 완료: 관련 Node 116개·Vitest 15개 및 3개 화면 폭 확인 |
| R5 | 운영 알림 책임 분리 | 기존 발송 조건·대상·실패 처리·외부 호출 계약 보존과 집중 검증 | 로컬 완료: 특성화 20개·분리 계약 89개·발송 경계 2개 확인 |
| R6 | 광고·쿠폰 Database typed pilot | 지정 경계의 타입 적용과 기존 데이터 매핑·동작 검증. 공용 클라이언트·전체 Repository 전환은 포함하지 않음 | 로컬 완료: Repository 동작 25개·관련 Node 47개 및 타입 검사 |
| R7 | 푸시 수신자 모달 분리 | 수신자 선택·취소·확정·검색 상태와 키보드·focus 동작 보존, 집중 검증과 관련 화면 확인 | 로컬 완료: 관련 Node 34개·Story 6개·3개 화면 폭 및 전체 검증 |
| R8 | 확인된 문서 freshness 정정과 이 실행 계획 | 기준 SHA의 재측정, 승인/보류 구분, 문서 링크·메타데이터 검사 | 로컬 완료: 문서 125개·루트 지식 파일 7개 검사 및 통합 검토 |

R7의 승인은 `PushComposerSection` 전체 재설계 승인이 아니다. R6는 기존 생성 타입의 좁은 적용이며 타입 재생성·DDL·인증 변경을 포함하지 않는다. 각 단위의 완료 보고는 통합 검토 전 후보 증거로 취급한다.

## 검증과 전달

1. 각 작업 브랜치에서 변경 책임의 동작 테스트, TypeScript·변경 파일 ESLint 등 필요한 집중 검증을 한다. R8은 `npm run check:docs`와 최종 diff 검토를 수행한다. 외부 메일·푸시·Mattermost 실발송을 로컬 검증으로 실행하지 않는다.
2. UI를 바꾼 단위는 도달 가능한 대기·오류·성공 상태와 모바일·태블릿·데스크톱 위험을 실제 렌더링으로 확인하고 시각 증거를 남긴다. 범위 밖이거나 캡처할 수 없으면 이유와 대체 검증을 기록한다.
3. 통합 브랜치에서 단위 diff, 소스 경로 계약, 충돌과 전체 영향 범위를 검토한다. `npm run verify:change`를 통과하고 build·E2E·인증/보안 등 Release 경계에 해당하면 `npm run verify:release`를 수행한다. 기존 실패·skip과 새 결함을 구분한다.
4. PR은 작업 브랜치에서 `dev`를 대상으로 하고 `Refs #591`로 연결한다. GitHub Actions를 유발하거나 영향을 주는 작업 전에는 해당 운영 스킬과 실패 원장을 확인한다. 각 PR·병합 SHA의 CI 결과와 실제 Preview/integration 수용은 로컬 검사와 별도로 기록한다.
5. `main`/Production 전달은 통합·Preview 수용과 운영자 승인 뒤 별도 판정한다. Issue 종료는 모든 관련 작업의 `dev` 병합, Preview/integration 통과, Production 승격 또는 명시적 Preview-only 수락 뒤다.

## 유지하는 경계와 상태

#530에서 제외한 대량 Repository+mock 도입, 공용 route wrapper·응답 봉투 일괄 전환, 캐시/PPR 전환, 세션·키 체계 재설계, migration squash와 Wallet 작업은 재개하지 않는다. 외부 계정·secret 삭제, 라이브 DDL, 인프라 적용과 외부 발송은 기존 운영자 경계에 남긴다. 문서 freshness 자동 감시나 새 승인 상태 기계를 만들지 않는다.

## 2026-10-17 로컬 구현·통합 검증

8개 작업은 각 독립 worktree에서 구현했고, 별도 `refactor/591-integration` worktree에 모아 검토했다. 원본 root 및 다른 작업은 보존했다. 두 독립 읽기 전용 검토에서 도입된 P1/P2를 발견하지 못했으며, 특성화·공개 facade·공통 소스 계약을 함께 확인했다. 이는 원격 CI나 운영 환경 검증을 대신하지 않는다.

- `npm run verify:change`: high/quick 통과. 문서 125개·루트 지식 파일 7개, 설치·교차 OS·lockfile·migration/snapshot 정책, 전체 ESLint(오류 0·경고 48), 의미 TypeScript, Node 2,815개 통과·기존 조건부 skip 9개·실패 0개, unit 396개 통과, 의존성 보안 정책 통과.
- Quick 뒤 정본 `npm run verify:release:post-quick`: route typegen, mock 주입 Production build, 별도 격리된 Production fixture build와 E2E 119개 통과. JSON reporter에서 retry·flaky·skip·unexpected·errors는 모두 0이다. 라이브 데이터나 실제 외부 발송은 사용하지 않았다.
- UI 세 화면은 360·820·1366px에서 실제 렌더링과 가로 넘침·pageerror 0을 확인했다. 알림 필터별 읽음/삭제 요청 대상, 취소 시 요청 없음과 focus 복원, 503 rollback 및 retry를 별도 조작했다. 사진 편집·검증·실패 복구 및 수신자 검색 취소·중복 제출은 브라우저 Story로 검증했다. 이미지와 로그는 통합 worktree의 ignored 임시 QA 경로에 보관한다.
- 전체 Storybook 최종 결과: 158개 파일·529개 사례 모두 통과, 재시도·실패·skip·browser console.error·종료 timeout 없음. 21개 교정 검사는 독립 두 프로세스에서 통과했다. 기존 모듈 externalization 경고 22건은 기준 코드와 같은 Story의 통합 코드 실행을 직접 비교해 내용·횟수 동등성을 확인했다(전체 reporter는 같은 경고를 두 채널로 44줄 출력).

첫 화면 검사에서 추가한 두 Escape 조작의 비동기 대기 오류를 발견해 Story에 한정하여 고쳤다. 첫 전체 Storybook은 158개 파일·529개 사례 중 기존 4개 Story 파일의 6개 사례가 실패했다. 기준 코드와 같은 파일의 SVG 보안 정책·전체 기기 로그아웃 문구·동작 줄이기 선호 기대값이 오래된 원인이었다. 별도 `test/591-storybook-contracts` worktree에서 테스트 fixture만 정렬했고 제품 정책·공용 설정·재시도 조건은 바꾸지 않았다. 첫 실패·진단·교정 결과는 구분해 보존하며 해당 운영 스킬의 실패 원장에도 기록했다.

기존 Node skip 9개는 외부 CSV fixture 미제공 8개와 환경 조건부 paired-storage 검사 1개다. 초기 의존성 준비의 Node 선택 오류와 병렬 타입 검사 자원 경합은 중단 기록을 보존했고, 고정 Node 24.18.1/npm 11.16.0의 통합 정본 검사로 판정했다. 개별 취소된 타입 검사를 통과로 세지 않는다.

## 2026-10-17 발행과 수용 범위

사용자는 작업별 커밋·푸시·`dev` 대상 PR·병합을 승인했고, 추가로 최종 `dev`의 Preview 반영을 승인했다. `main`/Production 승격은 이번 전달 범위에 포함하지 않는다. 아래 PR 분할은 독립 검토 경계이며, 생성 사실과 CI·병합·배포 완료는 구분한다.

| 작업 | 전달 PR |
| --- | --- |
| 기존 Story fixture와 첫 실패 기록 | [#592](https://github.com/MyKnow/ssartnership/pull/592) |
| R1 청구 동작 테스트 | [#593](https://github.com/MyKnow/ssartnership/pull/593) |
| R2 파트너 알림 controller | [#594](https://github.com/MyKnow/ssartnership/pull/594) |
| R3 이벤트 보상 | [#595](https://github.com/MyKnow/ssartnership/pull/595) |
| R4 회원 가져오기 | [#596](https://github.com/MyKnow/ssartnership/pull/596) |
| R5 운영 알림 | [#597](https://github.com/MyKnow/ssartnership/pull/597) |
| R6 광고·쿠폰 저장소 | [#598](https://github.com/MyKnow/ssartnership/pull/598) |
| R7 푸시 수신자 모달 | [#599](https://github.com/MyKnow/ssartnership/pull/599) |
| R8 문서 freshness와 실행 계획 | `docs/591-refactor-freshness`의 별도 문서 PR |

각 브랜치는 고정 Node 24.18.1/npm 11.16.0의 `npm run release -- --version=none` 경로로 전달한다. 공유 버전·lockfile 변경 없이 각 단위의 canonical gate를 수행한다. PR head의 첫 CI, 병합 SHA의 CI와 이미지 게시, 실제 Preview 적용은 각 SHA의 독립 증거로 확인한다. 이전 이미지 게시가 끝나기 전에 다음 병합으로 `dev`를 이동하지 않는다.

Preview는 비활성 자동 수신기를 임의로 다시 켜지 않고, 승인된 최종 SHA에 기존 수동 수신 절차를 적용한다. 사전 점검에서 확인한 기존 DB 이력 차이는 [스키마 변경 배포 절차](../../operations/runbooks/self-host-ci-maintenance.md#스키마-변경을-포함한-배포-완료-순서)에 따라 백업·전체 checksum·필요한 DDL·권한/RPC를 검증한 뒤 승인 기록을 갱신한다. 리팩토링 PR에는 migration/schema 변경을 추가하지 않는다. 이전 앱과 혼용할 수 없는 기존 migration은 요청을 배수하고 앱·관련 작업을 멈춘 뒤 적용하고 새 앱으로 전환한다.

최종 커밋·PR·병합 SHA, 첫 CI 실행·시도, 수신기 state·container revision·공개 health 결과는 [Issue #591](https://github.com/MyKnow/ssartnership/issues/591)과 해당 프로젝트의 Durumari 전달 Context에 기록한다. 원본 작업 및 복구 snapshot은 보존한다. 계획과 Issue의 종료는 앞서 정의한 Preview/integration 및 Production 승격 또는 명시적 Preview-only 수락 조건에 따른다.
