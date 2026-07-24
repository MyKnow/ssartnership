# 관리자 UI/UX 리팩터링 실행 계획

작성 기준일: 2026-07-23
관련 Issue: #205
기준 명세: [관리자 기능·UI/UX 구현 명세](./admin-ui-ux-spec.md)

## 목적

관리자 화면을 한 번에 다시 쓰지 않는다. 운영 중인 권한·감사·승인 흐름을 유지하면서, 영향이 작은 공용 기반부터 목록, 큐, workspace 순으로 독립 PR을 만든다. 각 PR은 `dev`에서 Preview와 Storybook 상태를 검증한 뒤 다음 단계로 진행한다.

## 우선순위

| 우선순위 | 사용자 가치 | 대상 |
| --- | --- | --- |
| P0 | 권한 누출·중복 처리·입력 손실·민감 정보 노출 방지 | permission/scope, approval mutation, return context, safe error, loading/disabled |
| P1 | 가장 자주 쓰는 업무의 탐색·복귀·필터 일관성 | shell, dashboard, 회원·제휴처 목록 |
| P2 | 승인 판단 속도와 편집 정확도 | 변경 요청, 등록 신청, 인증·사진·가입 승인 큐, 제휴처 편집/생성 |
| P3 | 운영 관측과 발송 안정성 | logs, push, notifications, ads, event, companies |
| P4 | 장기 유지보수와 visual regression 방지 | Storybook coverage, scenario inventory, E2E/visual baseline, 문서 동기화 |

## PR 분할 계획

### PR 0 — 기준선과 route/Storybook 정합성

- 범위: 화면 명세, route inventory, scenario ownership, 현 UI의 query/권한/state gap 기록.
- 변경 후보: `docs/product/admin-ui-ux-spec.md`, 이 문서, `docs/product/screen-specs/*`, scenario coverage metadata.
- 수용 기준:
  - canonical/conditional/compat/mock-only route가 명세와 일치한다.
  - 각 canonical admin route의 View, data source, required scenario를 찾을 수 있다.
  - 구현하지 않은 상태는 완료로 표시하지 않고 gap으로 남긴다.

### PR 1 — Shell·내비게이션·공통 운영 상태

- 범위: `AdminShell`, desktop rail, mobile drawer, PageHeader/section convention, shared empty/error/loading/permission surface.
- 목표:
  - navigation group과 permission filtering을 현재 권한 matrix에 맞춘다.
  - shell title/h1 중복, sticky control 중복, 모바일 header/drawer focus 문제를 해결한다.
  - 목록·queue·workspace가 같은 `loading`, `forbidden`, `empty`, `InlineMessage`를 쓴다.
- 비범위: 각 도메인의 repository/API 변경, 화면별 데이터 모델 재설계.
- 검증: `AdminShell`, `AdminMobileNav`, `AdminPageStates` Storybook과 360/820/1366 screenshot; keyboard drawer·logout·back navigation.

### PR 2 — 목록·검색·URL 상태 기반

- 범위: `/admin/members`, `/admin/partners`, `/admin/reviews`, `/admin/logs`, `/admin/event`의 filter/list/pagination patterns.
- 목표:
  - filter/query/page/page size를 canonical URL state로 통일한다.
  - 기존 local-only partner filter를 shareable, restorable query로 전환한다.
  - compact row와 desktop dense list의 정보 우선순위를 맞춘다.
- 비범위: 회원/제휴처 detail의 mutation contract 변경.
- 검증: 새로고침·공유 URL·뒤로가기, long Korean/no result/many rows, permission/campus scope, focus 유지, pagination and filter unit/E2E.

### PR 3 — 검토·승인 큐

- 범위: `/admin/partner-registrations`, `/admin/partner-requests`, `/admin/graduate-verifications`, `/admin/profile-photos`, `/admin/member-signup-requests` 및 상세.
- 목표:
  - queue → evidence/diff → decision → result/audit 순서를 통일한다.
  - 승인/반려의 pending, conflict, one-time decision, private viewer UX를 안전하게 만든다.
  - 신규 수료생, 기존 회원 복구, 일반 사진 변경을 화면과 server contract에서 혼동하지 않는다.
- 비범위: storage/RPC schema를 UI 편의만으로 변경하지 않는다.
- 검증: default/empty/many/error/forbidden/already handled Story; approval/reject server-action tests; private URL/PII leakage review; mobile split workspace QA.

### PR 4 — 제휴처·파트너사 workspace

- 범위: `/admin/partners/new`, `/admin/partners/[partnerId]`, `/admin/companies`, `/admin/categories`.
- 목표:
  - `FormSection` 기반의 생성/편집 hierarchy와 한 개의 primary save를 만든다.
  - media upload, validation, sticky save, conflict, audit, canonical success navigation을 통일한다.
  - 파트너사/제휴처/지점/혜택 용어를 고정한다.
- 비범위: public partner detail의 정보 구조 변경.
- 검증: shared client/server parser/schema, duplicate/concurrent update, media error/retry, global-only category restriction, 360/820/1366 form screenshots.

### PR 5 — 메시지·노출·이벤트 운영 workspace

- 범위: `/admin/notifications`, `/admin/push`, `/admin/notification-templates`, `/admin/advertisement`, `/admin/event/[slug]`, `/admin/cycle`, `/admin/admins`.
- 목표:
  - inbox와 send composer를 분리하고 대상·preview·confirm·result의 전이를 명확히 한다.
  - 로그/export, 이벤트 보상, 권한 template, 기수 설정처럼 영향이 큰 행동의 precondition·audit·result를 일관되게 표현한다.
- 비범위: 채널 provider와 결제/이벤트 도메인 규칙 자체의 변경.
- 검증: send duplicate guard/partial failure, template variable validation, export privilege/redaction, last privileged admin guard, event reward idempotency.

### PR 6 — 시각 회귀·운영 수용

- 범위: Storybook scenario gap, Playwright route smoke/critical flow, visual baseline, 운영 체크리스트.
- 목표:
  - canonical admin route마다 최소 하나의 actual View Story와 360/820/1366 capture를 연결한다.
  - 처리 빈도가 높은 흐름은 permission variant와 error recovery E2E를 갖는다.
  - intentional visual change만 baseline에 반영한다.
- 검증: `npm run build-storybook`, focused Storybook interaction test, visual test, relevant Playwright, `git diff --check`.

## 작업 의존성

```text
PR 0 (명세·inventory)
  └─ PR 1 (shell·공통 상태)
       ├─ PR 2 (목록·query)
       ├─ PR 3 (승인 큐)
       └─ PR 4 (제휴 workspace)
            └─ PR 5 (메시지·이벤트·설정 workspace)
                 └─ PR 6 (전수 QA·visual baseline)
```

PR 2~5는 공통 primitive의 API를 변경할 때만 순서를 강제한다. 독립 화면은 하나의 PR에서 수정하되, permission/resource 또는 repository contract를 두 도메인에 동시에 넓히지 않는다.

## 외부 Agent 구현 체크리스트

### 시작 전

1. 이 명세와 해당 screen contract를 읽는다.
2. route page, 관련 server action, repository/service, 현재 Storybook story를 찾는다.
3. 사용자·단일 행동·기존 제약·기능적 signature 하나를 포함한 미니 브리프를 PR에 적는다.
4. 변경이 P0 보안/권한 contract와 겹치면 먼저 focused test를 추가하거나 보강한다.

### 구현 중

1. 공용 token/component로 해결 가능한지 먼저 확인한다.
2. 예상 실패를 safe code/field error로 처리하고 raw server error를 UI에 렌더하지 않는다.
3. 새 목적지는 push, completion/canonical/query state는 replace 또는 server redirect, 현재 route 재검증만 refresh를 사용한다.
4. query와 `returnTo`는 allowlist/sanitizer를 거쳐 보존한다.
5. client validation과 server validation을 같은 schema/rule helper로 맞춘다.
6. mutation은 pending을 item/action 범위로 두고 성공 뒤 한 번만 navigation/revalidation한다.

### 완료 전

1. default, empty, loading, error, forbidden, long Korean을 확인한다.
2. 360/820/1366px screenshot을 검토한다. table/form/modal처럼 위험한 화면은 320/390px을 추가한다.
3. keyboard flow, focus return, reduced motion, document overflow, safe error copy를 확인한다.
4. focused unit/server-action/E2E 또는 Storybook test를 실행하고, 공용 UI 변경 시 Storybook build와 visual baseline을 확인한다.
5. 변경된 route, 권한, state, screenshot, verification, 남은 risk를 PR description에 쓴다.

## 완료 정의

관리자 UI/UX 개선 wave는 다음을 모두 만족할 때 완료다.

- 현재 역할에서 필요한 navigation, count, row action, data만 보이며 서버도 같은 요청을 거부/허용한다.
- canonical URL과 목록 query가 안정적으로 복원되고 legacy URL은 canonical route로 이동한다.
- 승인·삭제·발송·권한 변경의 상태 전이와 audit 경계가 유지된다.
- 공용 surface/typography/feedback/spacing을 사용하며 new raw token·중첩 card·임의 shadow가 없다.
- 실제 View Story, deterministic scenario, browser QA가 해당 화면의 위험 상태를 증명한다.
- 앱 코드·Supabase schema·repository contract 변경은 각각의 별도 PR과 focused verification으로 추적된다.
