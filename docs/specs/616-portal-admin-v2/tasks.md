---
title: 파트너 포털·어드민 v2 화면 이관 작업 기록
type: task-list
status: active
authority: descriptive
---

# 파트너 포털·어드민 v2 화면 이관 작업 기록

[명세](./spec.md)와 [구현 계획](./plan.md)을 실행하는 재개용 체크리스트다. 항목을 끝내면 체크하고 커밋·PR·검증 증거를 한 줄로 남긴다. "Figma"는 파일 `NX6dwapOy7FSyejB0eLXj1`의 Desktop 프레임 노드다. 같은 이름의 Tablet·Mobile 프레임과 `State · …` 프레임도 함께 확인한다.

## 현재 상태 (2026-11-21)

- **dev에 머지됨**: PR #624(기반 컴포넌트·토큰·셸·문서), #625(파트너 셸 어댑터와 인증 5개 경로), #626(토큰 브리지·어드민 셸). 세 PR 모두 첫 시도 CI 통과(Node 2,875 통과·실패 0, E2E 121 통과·재시도 0).
- **통합 브랜치(`chore/616-v2-screens`)**: 어드민 전 화면이 공유하는 `AdminPageHeader`(h1·설명·행동)와 `AdminStatePanel`(empty·error·forbidden)을 v2(`pv2-title`, `PortalStatePanel`)로 교체했다. props·접근성 계약은 유지하고 상태 패널 계약 테스트는 위임 구조에 맞춰 갱신했다.
- **적용 범위**: 파트너·어드민 전 경로가 `.portal-v2` 셸 안에서 v2 색·12px radius·그림자 없음·타입 스케일을 따른다(토큰 브리지, [portal-v2.md](../../design-system/portal-v2.md#토큰-브리지-아직-옮기지-않은-화면)). 파트너 로그인·재설정·변경·초기 설정·회사 선택은 v2 컴포넌트로 직접 옮겼다. 어드민 셸은 사이드바·상단 바만 v2로 제자리 교체했다.
- **남은 일(화면 단위 이관)**: 아래 PR3·PR4~6 표의 경로는 레이아웃·정보 구조가 아직 기존 구현이다. 화면을 옮길 때 `PortalPanel`·`PortalDataTable`·`PortalPageHeader`로 바꾸고 브리지 의존을 줄인다. 어드민 모바일 메뉴·하단 탐색은 브리지 스타일이다.
- **미검증**: Storybook 자동 테스트(Playwright Chromium 미설치), 820px 태블릿, 실제 Preview 계정 통합 검증(파트너 로그인→회사 선택→대시보드, 어드민 홈→작업함 등), 로컬 `verify:release`(브라우저 미설치; 승격 PR의 CI가 high 계층으로 실행).

## 작업 순서 규칙

1. 한 PR 범위를 시작할 때 최신 `origin/dev`에서 브랜치를 만들고 이 문서의 해당 절을 갱신한다.
2. 경로마다: Figma Desktop·Tablet·Mobile·State 프레임 확인 → View 컴포넌트 이관 → 상태 분기 → 관련 테스트 → 3개 viewport 스크린샷.
3. PR을 열기 전 [구현 계획 7절](./plan.md#7-검증) 검증을 실행한다.

## PR1 · 기반 (`feat/616-v2-foundation`)

- [x] v2 색·radius 토큰과 `pv2-*` Tailwind 별칭, `.portal-v2`, 타입 스케일 (`src/app/globals.css`)
- [x] `PortalButton`·`PortalBadge`·`PortalPanel`·`PortalMetricGrid`·`PortalPageHeader`·`PortalStatePanel`
- [x] `PortalShell` + `portal-shell-navigation.ts` + `portal-v2-classes.ts`
- [x] `tests/portal-v2-foundation.test.mts`
- [x] `npx tsc --noEmit`, `npx eslint src/components/portal-v2 tests/portal-v2-foundation.test.mts` 통과 (2026-11-20)
- [x] 스토리 `Domains/PortalV2/{Shell,Primitives,DataTable}`: 셸(파트너·어드민 nav, 모바일 메뉴 play), 버튼·배지·패널·지표·상태 4종·폼·탭·필터·페이지·확인 대화상자·긴 한국어 표
- [x] 폼 `PortalField`·`PortalInput`·`PortalSelect`·`PortalTextarea`·`portalFieldProps`(도움말·오류 `aria-describedby` 연결)
- [x] `PortalDataTable`·`PortalTablePanel`: 데스크톱 `table` + 모바일 `dl` 카드
- [x] `PortalTabs`(방향키)·`PortalPagination`·`PortalFilterBar`·`PortalSearchField`·`PortalConfirmDialog`
- [x] 문서: `docs/design-system/portal-v2.md` 추가, 디자인 시스템 인덱스 링크
- [ ] 스토리북 1440·820·360 스크린샷, `npm run verify:change`, PR 생성(`Refs #616`)

## PR2 · 파트너 셸과 인증 (`feat/616-partner-auth`)

- [x] `PartnerPortalShellView`를 `PortalShell` 어댑터로 교체(`PartnerPendingLink`, 테마 토글 제거)
- [x] 아래 경로 이관 (로그인·재설정·변경·초기 설정·회사 선택). 추가한 v2 컴포넌트: `PortalAuthLayout`·`PortalPasswordInput`·`PortalSubmitButton`·`PortalFormMessage`, `PortalButton`의 `loading`. 개발 전용 `/partner/setup` 데모 목록은 구 스타일 그대로 둔다.

| 경로 | 화면 | Figma | 주 컴포넌트 |
| --- | --- | --- | --- |
| `/partner/login` | 파트너 로그인 | 156:1633 (상태 159:4463·159:4471) | `PartnerLoginScreen` |
| `/partner` | 운영할 파트너사 선택 | 157:1704 (상태 159:4440·159:4448) | `PartnerCompanySelectionView` |
| `/partner/reset` | 비밀번호 재설정 | 157:1974 | `PartnerResetScreen`, `PartnerPasswordResetForm` |
| `/partner/change-password` | 비밀번호 변경 | 157:2091 | `PartnerPasswordChangeForm` |
| `/partner/setup/[token]` | 초기 비밀번호 설정 | 157:4905 | `PartnerSetupForm` |

## PR3 · 파트너 업무 화면 (`feat/616-partner-workspace`)

| 경로 | 화면 | Figma | 주 컴포넌트 |
| --- | --- | --- | --- |
| `/partner/companies/[companyId]` | 제휴 성과와 운영 현황 | 157:5594 | `PartnerDashboardView`, `PartnerMetricTimeseriesPanel` |
| `/partner/companies/[companyId]/plans` | 플랜·과금 관리 | 157:6085 | `PartnerPlanScreen`, `PartnerPlanUpgradeForm` |
| `/partner/companies/[companyId]/services/[partnerId]` | 제휴처 운영 상세 | 157:6911 | `PartnerServiceDetailView`, `partner-service-detail-view/` |
| `/partner/companies/[companyId]/services/new` | 새 제휴처 신청 1/5–5/5·검토 | 167:5067·167:5255·167:5445·167:5638·167:5822·157:7715 | `PartnerServiceNewScreen`, `partner-change-request-form/` |
| `/partner/notifications` | 내 알림 | 157:8537 | `PartnerNotificationsScreen` |
| `/partner/account` | 계정·담당자 정보 | 157:5046 | `PartnerAccountScreen`, `PartnerAccountInfoView` |
| `/partner/support` | 지원 요청 | 157:8993 | `PartnerSupportScreen`, `PartnerSupportRequestPanel` |

- [ ] 새 제휴처 신청은 모바일 `CompactStepper` 규칙(현재/전체 + 단계명, 주요 CTA 1개)을 따른다.
- [ ] 대시보드는 가상 지표를 만들지 않고 측정 안내 패널을 유지한다(명세 D5).

## PR4 · 어드민 셸과 검토 큐 (`feat/616-admin-shell-queues`)

- [ ] `AdminShellView`를 `PortalShell` 어댑터로 교체(`AdminIntentLink`, 상단 검색 → `/admin/search`, 테마 토글 제거, `title`·`backHref` prop 유지)

| 경로 | 화면 | Figma |
| --- | --- | --- |
| `/admin` | 운영 홈 | 157:9753 |
| `/admin/tasks` | 작업함 | 157:10550 |
| `/admin/search` | 통합 검색 | 157:11093 |
| `/admin/notifications` | 내 알림 | 157:9278 |
| `/admin/denied` | 접근 권한이 없습니다 | 157:23563 |
| `/admin/partner-registrations` | 신규 제휴 접수 | 157:14757 |
| `/admin/partner-requests` | 제휴처 변경 요청 | 157:15995 |
| `/admin/member-signup-requests` | Mattermost 가입 승인 | 157:19895 |
| `/admin/member-signup-requests/[requestId]` | 가입 신청 상세 | 157:20218 |
| `/admin/profile-photos` | 프로필 사진 검토 | 157:20508 |
| `/admin/graduate-verifications` | 수료생 인증 검토 | 157:20882 |
| `/admin/reviews` | 리뷰 관리 | 157:24224 |

## PR5 · 어드민 데이터 화면 (`feat/616-admin-entities`)

| 경로 | 화면 | Figma |
| --- | --- | --- |
| `/admin/partners` | 제휴처 목록 | 157:11535 |
| `/admin/partners/new` | 제휴처 추가 | 157:12098 |
| `/admin/partners/[partnerId]` | 제휴처 운영 상세 | 157:14008 |
| `/admin/partners/[partnerId]/edit` | 제휴처 정보 수정 | 157:13059 |
| `/admin/companies` | 파트너사·계정·과금 | 157:16963 |
| `/admin/categories` | 제휴처 카테고리 | 157:17753 |
| `/admin/members` | 회원 탐색 (+ 고급 필터 165:22228) | 157:18238 |
| `/admin/members/[memberId]` | 회원 상세 | 157:19069 |
| `/admin/admins` | 관리자 계정·권한 | 157:21333 |
| `/admin/logs` | 운영 로그 | 157:21871 |

## PR6 · 어드민 콘텐츠·발송·이벤트 (`feat/616-admin-content`)

| 경로 | 화면 | Figma |
| --- | --- | --- |
| `/admin/notification-templates` | 알림 템플릿 | 157:22436 |
| `/admin/push` | 발송 관리 | 157:22782 |
| `/admin/cycle` | 기수 운영 | 157:23238 |
| `/admin/advertisement` | 광고·프로모션 | 157:23688 |
| `/admin/event` | 이벤트 목록 | 157:24762 |
| `/admin/event/[slug]` | 이벤트 상세 운영 | 157:25263 |
| `/admin/events` | 이벤트 운영 | 157:25893 |
| `/admin/events/project-showcase` | 쇼케이스 운영 | 157:26359 |
| `/admin/events/project-showcase/projects/new` | 출품작 등록 | 157:27098 |
| `/admin/events/project-showcase/projects/[projectId]/edit` | 출품작 수정 | 157:27613 |
| `/admin/events/project-showcase/feedback` | 쇼케이스 피드백 | 157:28104 |
| `/admin/events/project-showcase/logs` | 쇼케이스 로그·집계 | 157:28474 |
| `/admin/events/project-showcase/draw` | 검증·추첨·발표 | 157:29389 |

- [ ] Figma가 없는 `/admin/mcp`·`/admin/mcp/authorize`·`/admin/mcp/reviews/[reviewId]`·`/admin/cycle/mock`은 셸만 v2로 바뀌었는지 확인한다.

## PR7 · 정리와 승격 (`chore/616-v2-cleanup`)

- [ ] 사용처 0인 구 파트너·어드민 셸, `AdminMobileNav`, 대체된 primitive 사용처 제거
- [ ] visual snapshot 정리, `docs/design-system/` 갱신, 이 명세 `status: current`로 전환
- [ ] Preview 통합 검증(계획 7절 흐름) → `npm run verify:release` → dev→main PR → Production health 확인 → Issue #616 종료

## 진행 로그

- 2026-11-20 Claude(Sonnet): PR3·4 통합 변경(`feat/616-partner-workspace`) — `.portal-v2` 안 기존 의미 토큰·텍스트 클래스를 v2로 다시 매핑하는 브리지(파트너·어드민 전 경로에 색·radius·그림자·타입 스케일 적용), 어드민 셸 사이드바·헤더를 v2로 제자리 교체(`AdminShellView` 구조·prefetch·하단 탐색 계약 유지, 테마 토글 제거). 경로별 레이아웃을 `PortalPanel`·`PortalDataTable`로 바꾸는 화면 단위 이관은 이 PR에 포함하지 않았다.
- 2026-11-20 Claude(Sonnet): PR2 파트너 셸 어댑터·인증 5개 경로 v2 이관(`feat/616-partner-auth`).
- 2026-11-20 Claude(Sonnet): PR1 폼·표·탭·페이지·필터·확인 대화상자·스토리·`portal-v2.md` 작성. 셸이 데스크톱에서 레일로만 보이는 버그를 찾아 `min-[1200px]:`를 이름 있는 브레이크포인트 `pv2-desktop:`로 교체했다(plan 6절 함정).
- 2026-11-20 Claude(Opus): `feat/616-v2-foundation` 생성, PR1 토큰·셸·기본 컴포넌트·계약 테스트 작성(미커밋), 명세·계획·작업 기록 작성. 이후 구현은 Sonnet이 이어받는다.
