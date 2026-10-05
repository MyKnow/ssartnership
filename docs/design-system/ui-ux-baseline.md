---
title: 08. UI/UX 기준선
type: design-system
status: current
authority: normative
---

# 08. UI/UX 기준선

작성 기준일: 2026-07-09

최종 교정일: 2026-07-10. route별 목표·상태·수용 기준은 [화면 계약](../product/screen-specs/index.md)을 따른다.

## Design direction

현행 디자인 기준은 [디자인 시스템 인덱스](./index.md)에 있다.

- TDS처럼 깔끔하고 일관된 UI를 지향한다.
- 차분한 네이비/슬레이트 기반의 시스템 색을 사용한다.
- 상태색은 success/warning/danger처럼 의미 있는 지점에만 제한적으로 사용한다.
- 모바일 우선 반응형이며, 큰 화면에서도 centered shell을 유지한다.
- surface hierarchy는 page background -> panel -> elevated card -> inset block -> control 순서를 따른다.
- 카드 내부에 또 카드를 중첩하기보다 `Surface level="inset"`을 사용한다.
- 모션은 CSS transition 중심의 짧고 조용한 피드백이며 reduced motion을 존중한다. 기준은 [Layout And Motion](./layout-and-motion.md#motion)이다.

## Shared UI primitives

`src/components/ui`의 공용 primitive가 우선 사용 대상이다.

- Layout: `Container`, `ResponsiveGrid`, `PageHeader`, `PageSection`, `ShellHeader`, `SectionHeading`
- Surface: `Card`, `Surface`, `DataPanel`, `StatsRow`
- Controls: `Button`, `IconActionButton`, `Input`, `PasswordInput`, `Textarea`, `Select`, `Tabs`, `SubmitButton`
- Feedback: `Badge`, `CategoryColorBadge`, `Chip`, `FormMessage`, `InlineMessage`, `EmptyState`, `Skeleton`, `Spinner`, `Toast`, `Modal`, `ConfirmDialog`
- Chart: `TimeseriesLineChart`
- Helpers: `BackButton`, `form-field-state`

`ShellHeader`는 기존 화면 호환용으로 유지하고 새 화면 또는 구조를 고치는 화면은 semantic `PageHeader`/`PageSection`을 우선한다. 화면마다 의미상 `h1`과 primary CTA는 각각 하나만 둔다. 긴 필터는 기본 3~4개만 보이고 나머지는 고급 필터 disclosure로 이동하며, 반복 정보는 `+N` 축약과 compact entity row를 사용한다.

## Global UX shell

- `SiteHeader`는 public site header와 user menu를 담당한다.
- `MobileNav`는 모바일 navigation surface를 제공한다.
- `Footer`는 public site footer와 campus select를 포함한다.
- `RouteScrollManager`는 route 전환 시 scroll 동작을 관리한다.
- `ThemeProvider`, `ThemeToggle`, `ThemeModeButtons`는 light/dark mode를 관리한다.
- `PwaProvider`는 앱 실행 기반을 관리하고, `PwaInstallButton`은 데스크톱 네이티브 install prompt 또는 `/install`의 플랫폼별 안내로 연결한다.

public header는 브랜드와 계정·알림·쿠폰·테마·전체 메뉴처럼 전역 동작만 담당하며 홈 내부 section으로 이동하는 1차 메뉴를 중복 제공하지 않는다. `내 인증`, 쿠폰, 알림, 계정은 인증 사용자 메뉴에 둔다. 파트너 모바일 1차 메뉴는 `홈`, `제휴처`, `알림`, `더보기` 네 개이며 데스크톱 sidebar는 같은 목적지를 펼친다.

## Public UI composition

- 홈: `PromotionCarousel`, `HomeContent`, `HomeView`.
- 목록: `CategoryTabs`, `PartnerFilters`, `PartnerCardView`, `PartnerAudienceChips`, `PartnerValueBadge`.
- 상세: `PartnerImageCarousel`, detail `_page/*` components, `PartnerDetailCoupons`, `PartnerDetailReviews`.
- 리뷰: `PartnerReviewSection`, `PartnerReviewCard`, `PartnerReviewForm`, `PartnerReviewSummaryCard`, `ReviewStarsInput`, review media uploader/crop modal.
- 인증: `CertificationView`, `CertificationCardFrame`, QR/profile sync/footer action components.
- 알림/쿠폰: `NotificationInbox`, `CouponWalletView`.
- 지원/제안: `SuggestForm`, support template components.

## Admin UI composition

- shell/navigation: `AdminShell`, `AdminShellView`, `AdminMobileNav`, `admin-navigation.ts`. 모바일 하단 탐색(홈·작업함·검색·회원·더보기)은 `getAdminMobileNavigation`이 권한 필터된 `ADMIN_NAV_GROUPS`에서 만들어 사이드바와 같은 href·아이콘을 쓰며, `AdminShellView`에 항목 문자열을 하드코딩하지 않는다.
- partner management: `AdminPartnerManager`, `AdminPartnerWorkspace`, partner manager filters/list/item, media editor, file import, account manager.
- company management: `AdminCompanyManager`, `AdminCompanyWorkspace`, `AdminCompanyPlanManager`.
- member management: `AdminMemberManager`, `AdminMemberListItem`, manual add panel, member trend chart, member security log explorer.
- logs: `AdminLogsManager`, `AdminLogsExplorer`, panels/selectors/utils.
- push/notifications: `AdminPushManager`, push composer/log sections, notification center, operational settings panel.
- reviews: `AdminReviewManager`, review card/filter/image gallery.
- events/ads/promotions: event registration form, ad package manager, promotion carousel editor.
- 시각 기준 확인: 별도 인앱 style guide route는 없다. Storybook 개요(`.storybook/overview.stories.tsx`)와 page state stories를 사용한다.

관리자 UI는 정보 밀도가 높은 operational tool이다. 마케팅 landing처럼 큰 hero나 과도한 장식보다 스캔 가능한 필터, 표, dense card, 빠른 액션을 우선한다. shell과 page가 제목을 중복하지 않고 목록은 기본 20행을 기준으로 한다. 행 목록은 `src/lib/admin-ia.ts`의 `ADMIN_LIST_DEFAULT_PAGE_SIZE`(20)와 `ADMIN_LIST_PAGE_SIZE_OPTIONS`(20·50·100)를 쓴다(회원 보안 로그, 쇼케이스 활동 로그, 혜택 이용 이력, 내 알림). 열 배수가 필요한 카드 그리드(제휴처 24, 리뷰 카드 12), 페이지네이션 없이 상한까지 모두 보여 주는 목록(프로필 사진 검토 큐 50, 제휴처 변경 요청 이력 50), 집계 창(자동 알림 요약 30, 최근 운영 로그 50), 발송 대상 검색 제안(30)은 행 목록 기본값의 예외로 둔다. 상한 목록을 20으로 줄이면 대기 항목이 가려지므로, 줄이려면 먼저 페이지네이션을 도입한다.

## Partner portal UI composition

- shell: `PartnerPortalShellView`, 반응형 내비게이션, pending/logout action controls.
- setup/auth: `PartnerSetupForm`, `PartnerLoginSetupToast`, password reset/change forms.
- dashboard: `PartnerDashboardView`, `PartnerCompanySelectionView`, metrics panel.
- service detail: `PartnerServiceDetailView`, summary/contact/metric/pending/history sections.
- change request: `PartnerChangeRequestForm`, immediate/approval forms, pending notice, floating submit button, shared diff primitives.
- plan/support: `PartnerPlanManagementView`, `PartnerPlanUpgradeForm`, `PartnerPlanBrandList`, `PartnerSupportRequestPanel`.
- notifications: `PartnerNotificationCenter`, settings panel.

## Form and error UX

- 입력 오류는 필드 단위 메시지와 form-level inline message를 구분한다.
- 복구 가능한 오류는 입력값을 유지한다.
- 첫 오류 필드에 focus를 이동하는 흐름을 우선한다.
- 비밀번호/로그인/정책 동의/파트너 setup/reset/change-password form은 field error + inline form error 패턴으로 정리되어 있다.
- server action/API 검증은 FE 검증의 대체가 아니라 신뢰 경계의 필수 방어선이다.
- Server Action 폼의 제출 버튼은 `SubmitButton`을 사용해 제출 중 비활성·`aria-busy`·진행 문구를 제공하고 raw `<button type="submit">`을 두지 않는다. 삭제처럼 되돌릴 수 없는 관리자 제출은 `AdminConfirmSubmitButton`으로 확인 대화상자를 거친다. GET 필터 폼에 제출 중 상태가 필요하면 `NavigationForm`과 `SubmitButton`을 함께 쓴다. `NavigationForm`은 `useTransition` 안에서 `router.push`로 이동해 다음 화면이 렌더될 때까지 `SubmitButton`을 적용 중 상태로 두며, JavaScript가 없으면 기본 `method="get"` 제출로 동작한다. `useFormStatus`는 함수 action만 추적하므로 문자열 action 폼(`next/form` 포함)에서는 pending이 되지 않는다.
- toast는 저장 완료, 복사 완료, 비동기 성공/실패처럼 화면 상태와 독립적인 feedback에 사용한다. 실패 toast는 `tone: "error"`로 보내 assertive live region과 오류 톤을 사용한다.

## Responsive baseline

- 모바일 우선 1열 layout이 기본이다.
- breakpoint는 기기 이름보다 실제 viewport와 콘텐츠가 무너지는 지점을 기준으로 한다.
- 공개 혜택 홈은 Compact `<600`, Medium `600–839`, Expanded `840–1199`, Large `1200–1599`, Extra Large `1600 이상`으로 구조를 전환한다.
- 홈 Compact는 이벤트와 혜택 탐색을 단일 pane으로 읽고, 혜택 디렉터리 안에서는 검색 → 카테고리 → 고급 필터 → 결과 순서를 사용한다.
- 홈 Medium은 상단 필터를 유지하면서 카드 결과를 최대 2열로 확장한다.
- 홈 Expanded 이상은 왼쪽 persistent filter sidebar와 오른쪽 결과 pane을 사용하며, Large부터 카드 결과를 최대 2열로 확장한다.
- Extra Large에서도 `grid-wide` 최대 폭을 유지하고 카드나 입력을 viewport 끝까지 늘리지 않는다.
- 필터/컨트롤 바는 작은 화면에서 세로 stack, 큰 화면에서 row alignment를 사용한다.
- 모바일에서 고급 필터를 접어도 현재 적용된 필터와 결과 수는 목록 문맥에서 확인할 수 있어야 한다.
- 카드형은 모든 폭에서 혜택·적용 대상·위치·이용 가능 여부를 유지한다. 리스트형은 모바일·태블릿에서 이름·카테고리·위치·즐겨찾기·상세 이동만 남기고 혜택·적용 대상은 Large 데스크톱부터 비교 정보로 노출한다. Compact 리스트의 상세 아이콘은 별도 행으로 내리지 않고 trailing column에 고정하며, 44px 조작 영역을 유지하면서 썸네일과 정보 밀도를 줄인다.
- chip 군집은 모바일에서 과도한 좌우 padding과 줄바꿈을 만들지 않아야 한다.
- admin/partner 화면은 작은 화면에서도 주요 액션이 접히거나 가려지지 않아야 한다.

## Loading, empty, error states

- route-specific `loading.tsx`와 shared skeleton을 함께 사용한다. 모든 `loading.tsx`는 `RouteLoadingStatus`(sr-only `role="status"`, "화면을 불러오는 중입니다.")를 정확히 한 번 렌더하고, 스켈레톤 블록과 페이지 내부 Suspense fallback은 live region을 만들지 않는다.
- 관리자 페이지는 `AdminShell`을 페이지마다 렌더하므로 관리자 route `loading.tsx`도 `AdminRouteSkeleton` 또는 셸을 포함한 `Admin*Skeleton`을 사용해 사이드바·모바일 헤더·하단 탐색을 유지한다. route loading 스켈레톤이 끝나면 페이지가 셸과 헤더를 먼저 스트리밍하고 데이터 영역만 `*SkeletonContent showHeader={false}` Suspense fallback으로 대체하는 2단계 스트리밍은 의도된 동작이다.
- list empty는 `EmptyState` 또는 domain-specific empty panel로 표현한다.
- app error는 `AppErrorScreen`과 route/global error surface를 사용한다. 루트 `error.tsx`·`global-error.tsx`는 `layout="page"`(기본값)로 화면 전체를 대체하고, 공개 `(site)`·파트너 그룹 `error.tsx`는 `layout="embedded"`로 그룹 셸(하단 탐색·Footer·파트너 포털 셸) 안에서 렌더해 복귀 동선을 유지한다. 그룹 layout 자체의 예외는 루트 경계가 받는다.
- `notFound()`는 호출한 영역의 셸 안에서 404를 보여 준다. 공개 제휴처 상세는 `(site)/partners/[id]/not-found.tsx`(헤더만 렌더하고 Footer는 `(site)` layout이 담당), 관리자는 `admin/(protected)/not-found.tsx`(AdminShell과 요청 경로가 속한 관리 목록 복귀), 파트너는 `partner/not-found.tsx`(파트너 포털 셸과 파트너 홈 복귀)를 사용한다. 어떤 라우트에도 맞지 않는 URL은 루트 `not-found.tsx`가 처리하며, 404 kicker는 `404`로 통일한다.

## Storybook 추적 기준

- `actual-view`: route inventory의 `viewComponent`를 실제 렌더하는 Story.
- `component-fragment`: 화면 일부 컴포넌트만 렌더하는 Story.
- `state-model`: 실제 View 대신 합성 레이아웃으로 상태를 설명하는 Story.
- `storybook-complete`는 모든 `requiredStateKeys`가 `actual-view` Story에 연결되고 각 Story가 route policy의 360/820/1366 viewport를 모두 선언할 때만 부여한다.
- fragment와 state model은 설계 참고 자료로 남기되 actual View coverage로 승격하지 않는다.

## UI regression risks

- 홈/상세의 partner card와 carousel은 public traffic 핵심 surface이므로 리팩토링 시 mobile/desktop screenshot QA가 필요하다.
- admin lists/logs는 데이터가 많을 때 selector memoization과 filter UX가 무너지기 쉽다.
- partner portal request form은 pending state와 immediate/approval split이 복잡해 회귀 위험이 높다.
- Korean text는 길이가 길고 줄바꿈 지점이 많으므로 320/360/390px 모바일 폭에서 버튼/칩/카드 overflow를 확인해야 한다.
