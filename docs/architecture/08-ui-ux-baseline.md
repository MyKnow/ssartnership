# 08. UI/UX 기준선

작성 기준일: 2026-07-09

최종 교정일: 2026-07-10. route별 목표·상태·수용 기준은 [화면 계약](../product/screen-specs/index.md)을 따른다.

## Design direction

현행 디자인 기준은 [docs/design-system](../design-system/README.md)에 있다.

- TDS처럼 깔끔하고 일관된 UI를 지향한다.
- 차분한 네이비/슬레이트 기반의 시스템 색을 사용한다.
- 상태색은 success/warning/danger처럼 의미 있는 지점에만 제한적으로 사용한다.
- 모바일 우선 반응형이며, 큰 화면에서도 centered shell을 유지한다.
- surface hierarchy는 page background -> panel -> elevated card -> inset block -> control 순서를 따른다.
- 카드 내부에 또 카드를 중첩하기보다 `Surface level="inset"`을 사용한다.
- 모션은 Framer Motion 기반의 조용한 reveal/transition이며 reduced motion을 고려한다.

## Shared UI primitives

`src/components/ui`의 공용 primitive가 우선 사용 대상이다.

- Layout: `Container`, `ResponsiveGrid`, `PageHeader`, `PageSection`, `ShellHeader`, `SectionHeading`
- Surface: `Card`, `Surface`, `DataPanel`, `StatsRow`
- Controls: `Button`, `IconActionButton`, `Input`, `PasswordInput`, `Textarea`, `Select`, `Tabs`, `SubmitButton`
- Feedback: `Badge`, `CategoryColorBadge`, `Chip`, `FormMessage`, `InlineMessage`, `EmptyState`, `Skeleton`, `Spinner`, `Toast`, `Modal`
- Chart: `TimeseriesLineChart`
- Helpers: `BackButton`, `form-field-state`

`ShellHeader`는 기존 화면 호환용으로 유지하고 새 화면 또는 구조를 고치는 화면은 semantic `PageHeader`/`PageSection`을 우선한다. 화면마다 의미상 `h1`과 primary CTA는 각각 하나만 둔다. 긴 필터는 기본 3~4개만 보이고 나머지는 고급 필터 disclosure로 이동하며, 반복 정보는 `+N` 축약과 compact entity row를 사용한다.

## Global UX shell

- `SiteHeader`는 public site header와 user menu를 담당한다.
- `MobileNav`는 모바일 navigation surface를 제공한다.
- `Footer`는 public site footer와 campus select를 포함한다.
- `RouteScrollManager`는 route 전환 시 scroll 동작을 관리한다.
- `ThemeProvider`, `ThemeToggle`, `ThemeModeButtons`는 light/dark mode를 관리한다.
- `PwaProvider`, `PwaInstallButton`은 install prompt를 관리한다.
- `ScrollToTopFab`은 긴 목록/상세 페이지 보조 동작이다.

public header는 브랜드와 계정·알림·쿠폰·테마·전체 메뉴처럼 전역 동작만 담당하며 홈 내부 section으로 이동하는 1차 메뉴를 중복 제공하지 않는다. `내 인증`, 쿠폰, 알림, 계정은 인증 사용자 메뉴에 둔다. 파트너 모바일 1차 메뉴는 `홈`, `제휴처`, `알림`, `더보기` 네 개이며 데스크톱 sidebar는 같은 목적지를 펼친다.

## Public UI composition

- 홈: `PromotionCarousel`, `HomePushOptInBannerGate`, `HomeContent`, `HomeView`.
- 목록: `CategoryTabs`, `PartnerFilters`, `PartnerCardView`, `PartnerAudienceChips`, `PartnerValueBadge`.
- 상세: `PartnerImageCarousel`, detail `_page/*` components, `PartnerDetailCoupons`, `PartnerDetailReviews`.
- 리뷰: `PartnerReviewSection`, `PartnerReviewCard`, `PartnerReviewForm`, `PartnerReviewSummaryCard`, `ReviewStarsInput`, review media uploader/crop modal.
- 인증: `CertificationView`, `CertificationCardFrame`, QR/profile sync/footer action components.
- 알림/쿠폰: `NotificationInbox`, `CouponWalletView`.
- 지원/제안: `SuggestForm`, support template components.

## Admin UI composition

- shell/navigation: `AdminShell`, `AdminShellView`, `AdminMobileNav`, `admin-navigation.ts`.
- partner management: `AdminPartnerManager`, `AdminPartnerWorkspace`, partner manager filters/list/item, media editor, file import, account manager.
- company management: `AdminCompanyManager`, `AdminCompanyWorkspace`, `AdminCompanyPlanManager`.
- member management: `AdminMemberManager`, `AdminMemberListItem`, manual add panel, member trend chart, member security log explorer.
- logs: `AdminLogsManager`, `AdminLogsExplorer`, panels/selectors/utils.
- push/notifications: `AdminPushManager`, push composer/log sections, notification center, operational settings panel.
- reviews: `AdminReviewManager`, review card/filter/image gallery.
- events/ads/promotions: event registration form, ad package manager, promotion carousel editor.
- style guide/demo: `AdminStyleGuideTabsDemo`, shared page state stories.

관리자 UI는 정보 밀도가 높은 operational tool이다. 마케팅 landing처럼 큰 hero나 과도한 장식보다 스캔 가능한 필터, 표, dense card, 빠른 액션을 우선한다. shell과 page가 제목을 중복하지 않고 목록은 기본 20행을 기준으로 한다.

## Partner portal UI composition

- shell: `PartnerPortalShellView`, `PartnerPortalHeader`, `PartnerPortalFooter`, action links.
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
- toast는 저장 완료, 복사 완료, 비동기 성공/실패처럼 화면 상태와 독립적인 feedback에 사용한다.

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

- route-specific `loading.tsx`와 shared skeleton을 함께 사용한다.
- list empty는 `EmptyState` 또는 domain-specific empty panel로 표현한다.
- app error는 `AppErrorScreen`과 route/global error surface를 사용한다.
- 상세 페이지에서 존재하지 않는 partner는 `not-found.tsx`로 분리되어 있다.

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
