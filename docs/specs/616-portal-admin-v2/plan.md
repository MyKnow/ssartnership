---
title: 파트너 포털·어드민 v2 화면 이관 구현 계획
type: implementation-plan
status: active
authority: descriptive
---

# 파트너 포털·어드민 v2 화면 이관 구현 계획

[명세](./spec.md)를 구현하는 기술 계획이다. 진행 상태와 경로별 체크리스트는 [작업 기록](./tasks.md)에 있다. 다른 에이전트(예: Sonnet)가 이 문서만 읽고 이어서 작업할 수 있도록 결정·함정·검증 방법을 적는다.

## 1. 디자인 원본

- Figma 파일 `NX6dwapOy7FSyejB0eLXj1`. 페이지: `04 · 파트너 포털 v2`(80:45), `05 · 파트너 v2 디자인 시스템`(104:1632), `06 · 어드민 v2`(124:45). 경로 대응표 보드: 파트너 163:6107, 어드민 163:23905.
- 경로별 Desktop 프레임 노드는 [작업 기록](./tasks.md)의 표에 있다. 같은 이름의 `· Tablet`(820)·`· Mobile`(360) 프레임이 함께 있고, 상태 변형은 `State · <화면명> · <상태>` 프레임이다.
- Figma MCP 사용 순서: `create_session`(fileKey) → `skill://figma/figma-design-to-code/SKILL.md` 읽기(서버 `plugin:design:figma`) → `get_design_context`(nodeId, `skillNames: "resource:figma-design-to-code"`). 응답 코드는 절대 좌표·Noto Sans KR·인라인 hex가 섞인 참고 구현이다. 그대로 붙이지 말고 아래 v2 컴포넌트와 `pv2-*` 토큰으로 옮긴다.
- 큰 페이지 `get_metadata`는 수십만 자라서 파일로 저장된다. `python3 -I`로 `Coverage v2 / Content / <route> / Desktop` 심볼이나 `V2 · <화면명> · Desktop` 프레임만 추출한다.
- 아이콘은 lucide 계열(Home, Inbox, Store, Users, FileText, Bell, Settings, ChartNoAxesCombined)이다. 프로젝트의 `lucide-react`를 쓰고 Figma SVG를 내려받지 않는다.

## 2. 토큰과 기반(PR1, 일부 구현됨)

`src/app/globals.css`에 추가됨:

- `:root`의 `--partner-v2-color-*`(26색), `--partner-v2-radius-{badge,control,panel}`(6/8/12px). `html.dark`가 덮어쓰지 않는다(라이트 전용).
- `@theme inline`의 Tailwind 별칭 `--color-pv2-*`, `--radius-pv2-*` → `bg-pv2-canvas`, `text-pv2-muted`, `border-pv2-border-strong`, `rounded-pv2-panel` 등.
- `@layer utilities`의 `.portal-v2`(라이트 루트), 타입 스케일 `.pv2-title`(26/38, 모바일 22/32), `.pv2-heading`(18/28), `.pv2-body`(14/22), `.pv2-label`(14/22·500), `.pv2-caption`(12/18), `.pv2-metric`(28/40·700, tabular-nums).

`src/components/portal-v2/`에 추가됨:

| 파일 | 역할 | Figma 규격 |
| --- | --- | --- |
| `portal-v2-classes.ts` | v2 포커스 링(표면용·사이드바용), 120ms 전환 | 포커스 white2+blue2 |
| `PortalButton.tsx` | `PortalButton`, `PortalButtonLink`, `portalButtonClassName` (primary/secondary/danger) | 모바일 44, md 이상 40, 좌우 16, radius 8 |
| `PortalBadge.tsx` | 상태 배지(neutral/info/success/warning/danger) | 높이 28, 좌우 8, radius 6 |
| `PortalPanel.tsx` | 제목·설명·액션을 가진 `section` | padding 24(모바일 16), gap 16, radius 12, 그림자 없음 |
| `PortalMetric.tsx` | `dl` 지표 grid(모바일 2열, md 4열) | Label 14 + Metric 28/40 |
| `PortalPageHeader.tsx` | 유일한 h1·설명·주요 행동 1개 | Title 26/38 |
| `PortalStatePanel.tsx` | empty/loading/error/forbidden | 데이터 상태 보드 86:305 |
| `portal-shell-navigation.ts` | 경로 일치, 하단 탭 3개+더보기 선택 | — |
| `PortalShell.tsx` | 공용 셸(client) | 데스크톱 사이드바 240·상단 64 / 태블릿 72 rail / 모바일 헤더 56 + 메뉴 dialog + 하단 탭 |

`tests/portal-v2-foundation.test.mts`가 경로 일치, 하단 탭, 토큰 값, 브레이크포인트, 포커스 링, 폼 속성, 셸·표·탭·확인 대화상자 접근성 계약을 검사한다(관련 계약 테스트 19개 통과, 2026-11-20).

### PR1 기반 작업 현황

구현 완료(2026-11-20): 스토리, 폼 primitive(`PortalFormControls.tsx`, `portal-field-props.ts`), `PortalDataTable`, `PortalTabs`, `PortalPagination`, `PortalFilterBar`, `PortalConfirmDialog`, [`docs/design-system/portal-v2.md`](../../design-system/portal-v2.md). 남은 것은 `verify:change`와 PR 생성뿐이며 체크리스트는 [작업 기록](./tasks.md)이 기준이다. 각 컴포넌트의 규격·접근성 계약은 `portal-v2.md`에 있다.

## 3. 셸 적용 방식

`PortalShell`은 경로 판단·권한을 모른다. 각 영역이 어댑터를 만든다.

- 파트너: `src/components/partner/PartnerPortalShellView.tsx`를 v2 어댑터로 바꾼다. 기존 `companyNavItems`·`globalNavItems`·`getPrimaryNavHref`·`isActivePrimaryPath`·`shouldUsePartnerPortalDashboardShell`·`shouldShowPartnerPortalMobileNavigation` 로직을 유지하고 결과를 `PortalNavGroup[]`(그룹 "홈"·"제휴처"·"알림"·"더보기", Figma 사이드바 참고)로 넘긴다. `linkComponent`에 `PartnerPendingLink`를 넘겨 pending 표시를 유지한다. 회사 범위는 `scope` 블록(현재 회사명 + "운영할 파트너사 선택" 링크), 로그아웃·사용자 화면은 `sidebarFooter`. 비로그인·인증 화면(`login`, `reset`, `setup/[token]`, 회사 선택)은 셸 없이 중앙 카드 레이아웃(Figma 520px 콘텐츠)으로 둔다.
- 어드민: `src/components/admin/AdminShellView.tsx`를 v2 어댑터로 바꾼다. `ADMIN_NAV_GROUPS`·`filterAdminNavGroupsByPermissions`·`isAdminNavActive`·`getAdminMobileNavigation`을 그대로 쓰고, 아이콘 타입만 맞춘다(`AdminNavIcon`은 SVGProps 기반이므로 `PortalNavIcon`에 맞는지 typecheck로 확인). 상단 바 왼쪽은 기존 `/admin/search`로 가는 검색 필드(Figma 125:90), 오른쪽은 범위 배지·지역/기수 표시. `title`·`backHref`·`backLabel` prop 계약은 유지해 35개 페이지를 한 번에 깨지 않는다. `linkComponent`는 `AdminIntentLink`.
- 두 셸 모두 `ThemeToggle`을 빼고(D1) `.portal-v2` 루트 안에서 렌더한다.

## 4. 페이지 이관 규칙

- 페이지 서버 컴포넌트(`page.tsx`)의 데이터 로딩·권한·redirect는 건드리지 않는다. 바뀌는 곳은 `src/components/partner/**`, `src/components/admin/**`의 View 컴포넌트다.
- 기존 `Card`·`Surface`·`ui/Button`·`AdminPageHeader`·`AdminStatePanel`·`EmptyState`를 v2 컴포넌트로 교체한다. 같은 역할이면 같은 v2 컴포넌트를 쓰고, 화면 전용 스타일은 마지막 수단으로만 쓴다.
- 문구는 Figma를 기준으로 하되 현재 화면의 기능 문구(오류 코드 매핑, 법적 안내)를 지우지 않는다. 바뀐 문구가 테스트에 고정돼 있으면 테스트와 함께 바꾸고 PR에 적는다.
- 상태: 각 View가 이미 가진 empty/error/loading 분기를 `PortalStatePanel`로 바꾼다. `loading.tsx`(`src/components/loading/*Skeletons*`)도 v2 패널 모양의 스켈레톤으로 바꾼다.
- 기존 컴포넌트를 지우는 것은 마지막 PR(7)에서 사용처가 0일 때만 한다.

## 5. PR 분할

Issue의 5단계를 리뷰 가능한 크기로 7개로 나눈다(Issue 본문에 갱신 필요). 모두 최신 `dev`에서 typed 브랜치를 만들고 `dev`로 PR을 연다. 본문에 `Refs #616`.

| PR | 브랜치 | 범위 |
| --- | --- | --- |
| 1 | `feat/616-v2-foundation` | 토큰·셸·공용 컴포넌트·스토리·문서 (현재 작업 중) |
| 2 | `feat/616-partner-auth` | 파트너 셸 어댑터 + 로그인·비밀번호 재설정·비밀번호 변경·초기 설정·회사 선택 |
| 3 | `feat/616-partner-workspace` | 파트너 대시보드·플랜·제휴처 상세·새 제휴처 신청 5단계·알림·계정·지원 |
| 4 | `feat/616-admin-shell-queues` | 어드민 셸 어댑터 + 운영 홈·작업함·검색·내 알림·접근 거부 + 검토 큐(신규 제휴 접수·변경 요청·가입 승인·가입 상세·프로필 사진·수료생 인증·리뷰) |
| 5 | `feat/616-admin-entities` | 제휴처 목록·추가·상세·수정, 파트너사·계정·과금, 카테고리, 회원 목록·상세·고급 필터, 관리자 계정, 운영 로그 |
| 6 | `feat/616-admin-content` | 알림 템플릿·발송·기수·광고, 이벤트 목록·상세·운영, 쇼케이스 6개 경로 |
| 7 | `chore/616-v2-cleanup` | 사용처 0인 구 셸·컴포넌트 제거, visual snapshot 정리, 문서 current 전환 |

PR 2는 PR 1 머지 후, PR 3은 PR 2 후 시작한다. PR 4는 PR 1 머지 후 PR 2·3과 병렬 가능하고, PR 5·6은 PR 4 머지 후 서로 병렬 가능하다(같은 파일을 만지지 않게 `AdminShellView`·`admin-navigation.ts`는 PR 4만 수정한다).

## 6. 함정

- 반응형 분기점에 `min-[1200px]:` 같은 임의 px variant를 쓰지 않는다. rem 기반 `md:`와 CSS 정렬 순서가 뒤집혀 데스크톱에서도 태블릿 규칙이 이긴다. 데스크톱(1200px)은 `globals.css`의 `--breakpoint-pv2-desktop`로 정의한 `pv2-desktop:`를 쓴다(2026-11-20 Storybook에서 확인한 버그).
- Tailwind v4에서 `@layer utilities` 안의 사용자 클래스(`pv2-label` 등)에는 `md:` 같은 variant가 붙지 않는다. 반응형으로 바꿔야 하면 `md:text-sm md:leading-[1.375rem]`처럼 기본 유틸리티를 쓰거나 `@utility`로 다시 정의한다.
- `npm run test:node`의 `tests/design-token-contract.test.mts`가 `rounded-[...]`·`text-[#hex]`·`shadow-sm/md/lg`·`!important`·`h-screen/100vh` 사용 수를 `tests/fixtures/design-token-budget.json` 예산으로 막는다. v2 코드는 `rounded-pv2-*`, `bg-pv2-*`, `min-h-dvh`/`h-dvh`만 쓴다. 등록되지 않은 `rounded-<이름>`은 바로 실패한다.
- `src/components/ui/`의 비-스토리 파일은 lucide를 import할 수 없다(heroicons만). v2 컴포넌트는 `src/components/portal-v2/`에 두므로 lucide를 써도 된다.
- 기존 포커스 링 계약 테스트는 `ring-ring`을 요구한다. v2 영역은 D4 예외라 `portal-v2-classes.ts`를 쓰고, 새 테스트(`tests/portal-v2-foundation.test.mts`)로 검증한다. 공용 `ui/` 컴포넌트를 v2용으로 고치지 않는다.
- 데스크톱 40px 버튼은 44px 히트 영역을 `TOUCH_TARGET_HIT_AREA_CLASS_NAME`으로 확보한다. 이 클래스는 `before:`를 쓰므로 `overflow-hidden`과 함께 쓰지 않는다.
- 이 저장소의 Next.js는 학습 데이터와 다르다. 라우팅·캐시·`next/link` 동작을 바꾸기 전에 `node_modules/next/dist/docs/`를 읽는다. 셸은 client 컴포넌트이고 layout의 서버 데이터 로딩을 옮기지 않는다.
- `tests/visual/__snapshots__`의 관리자·파트너 화면 snapshot은 의도적으로 바뀐다. 실패를 보고 diff를 확인한 뒤 해당 PR에서 갱신하고, 무관한 snapshot 변경은 원인을 찾는다.
- 파트너 대시보드 Figma 값(1,284회 등)은 가상 데이터다. 수치·문구를 하드코딩하지 않는다.

## 7. 검증

작업 PR마다:

```bash
npx tsc --noEmit --pretty false
npx eslint <changed-files>
node --import ./tests/alias-register.mjs --test tests/portal-v2-foundation.test.mts tests/design-token-contract.test.mts tests/focus-ring-ui-contract.test.mts tests/touch-target-ui-contract.test.mts
npm run check:docs
npm run verify:change
```

- 화면 PR은 바뀐 경로를 mock 모드 dev 서버로 띄워 360·820·1440px(위험하면 320·390 추가) 스크린샷을 `.tmp/ui-qa/616/`에 저장하고 PR 본문에 Figma 프레임과 나란히 첨부한다. 스크린샷은 stage하지 않는다.
- 관련 기존 테스트: 파트너 `tests/partner-*.test.mts`, 어드민 `tests/admin-*.test.mts`, E2E `tests/e2e/admin-console.spec.ts`, `tests/e2e/partner-registration.spec.ts`, visual `tests/visual/admin-operations.visual.spec.ts`.
- push 전 `github-actions-operations` 스킬을 먼저 읽는다. 커밋·push는 `npm run release`를 기본으로 한다.
- 승격: PR 1–7이 dev에 모이면 Preview에서 파트너(회사 선택→대시보드→제휴처 상세→새 제휴처 신청→알림)와 어드민(홈→작업함→변경 요청 처리→회원 상세→발송 관리)을 실제 Preview 계정으로 확인하고 `npm run verify:release` 후 dev→main PR을 연다. Production 배포 후 health를 확인하고 Issue를 닫는다.
