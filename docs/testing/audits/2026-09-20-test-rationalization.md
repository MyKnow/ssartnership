---
title: 2026-09-20 테스트 유지·삭제 분류
type: audit
status: completed
authority: evidence
---

# 테스트 유지·삭제 분류

기준선 dev `538b16b4`, [Issue #474](https://github.com/MyKnow/ssartnership/issues/474). 이 문서의 completed는 파일 분류 기록이며 통합·배포 완료 상태가 아니다. 실행 결과는 [tasks](../../specs/documentation-architecture/tasks.md)에 별도로 기록한다.

## 판단 범위

추적된 테스트 파일 519개와 모든 Story 파일을 목록화해 책임별로 분류했다. 삭제 후보의 실제 assertion을 검토했고 혼합 파일은 안전·동작 계약을 보존했다. 유지 파일 전체의 모든 assertion이 최적이거나 중복이 전혀 없다는 판정은 아니다. 성능 숫자는 CI 로그 표본이며 파일별 시간 합에 서버·브라우저 공통 비용은 포함되지 않는다.

최근 CI 35500102870 / 35498504116 / 35496955037: 전체 E2E 120개 378~588초, page-smoke 105~187초, auth-ops 68~94초, home-partners 46~73초. Node 전체 27~41초, 단위/coverage 약 5~7초. 실제 변경 후 시간은 같은 환경의 실행과 구분한다.

## 삭제와 잔여 위험

공개·로그인 단순 렌더 24개를 제거한다. 법적 고지·제안·신고 등 독립 행동 E2E가 없는 페이지는 전용 렌더 자동 감지가 사라진다. 중요 접근·토큰·도메인 검사는 남으며 UI 변경 시 수동 검증한다. 보호 경로 34개는 접근 제어 파일로 분리한다. CSS 배치·문구·삭제된 장식 컴포넌트 부재 검사는 제품 계약을 바꾸지 않고 자동화 범위만 줄인다.

삭제된 상세 시각 E2E의 6개 viewport는 전체 픽셀/배치 보장을 더 이상 제공하지 않는다. 혜택 대상·노출 판정은 domain 검사, 실제 상세 진입·검색 복귀는 행동 E2E가 담당한다. Storybook/Visual은 수동이라 실행 시간 절감을 위해 무작정 삭제하지 않는다.

최종 발견 목록은 E2E 76개(기존 120개에서 44개 감소)다. 24개 단순 렌더와 20개 시각/중복 사례를 삭제한다. 자동 생성된 테스트 이름에 따른 개수이며 소스의 test 호출 개수와 다르다.

## 개별 삭제 사례

- `tests/e2e/site-header.spec.ts`: guest/member header stays compact across responsive boundaries (2개; 각 10개 viewport 반복)

- `tests/e2e/home-partners.spec.ts`: aligns the desktop ad carousel with the partner directory container
- `tests/e2e/home-partners.spec.ts`: keeps the mobile list summary compact without a separate detail action
- `tests/e2e/home-partners.spec.ts`: adapts the directory from medium grid to expanded two-pane layout
- `tests/e2e/home-partners.spec.ts`: prioritizes search on mobile and preserves decision information in desktop lists
- `tests/e2e/home-partners.spec.ts`: wraps expanded mobile categories instead of horizontally scrolling
- `tests/e2e/home-partners.spec.ts`: opens a public partner detail page from the card surface
- `tests/e2e/home-partners.spec.ts`: does not render a scroll-to-top FAB on mobile partner detail
- `tests/e2e/partner-image-carousel.spec.ts`: uses the full-bleed gallery lead only below the mobile breakpoint
- `tests/e2e/mobile-ui-ux.spec.ts`: mobile sort labels fit at narrow widths
- `tests/e2e/mobile-ui-ux.spec.ts`: install recommendation stays at the bottom and clear of the header
- `tests/e2e/mobile-ui-ux.spec.ts`: home and iOS guide preserve content across responsive widths
- `tests/e2e/admin-console.spec.ts`: keeps the registration queue inside narrow and wide viewports
- `tests/partner-plan-ui-contract.test.mts`: partner plan badge mapping is reused from the shared helper
- `tests/partner-plan-ui-contract.test.mts`: partner plan date and expiry day helpers are reused from the shared helper
- `tests/partner-plan-ui-contract.test.mts`: partner visibility copy uses the shared domain label without local drift
- `tests/admin-ui-ux-foundation.test.mts`: 관리자 공통 진입점은 외래어 대신 한국어 업무 맥락을 표시한다
- `tests/admin-ui-ux-foundation.test.mts`: 대표 셸 Story는 작업 중심 콘텐츠와 새 데이터 분류를 보여준다
- `tests/admin-ui-ux-foundation.test.mts`: 서비스 활성도는 약어보다 한국어 업무 의미를 먼저 표시한다
- `tests/admin-ui-ux-foundation.test.mts`: 실제 관리자 화면의 eyebrow는 한국어 업무 맥락을 사용한다
- `tests/admin-ui-ux-foundation.test.mts`: 실제 관리자 화면의 kicker는 한국어 업무 맥락을 사용한다
- `tests/ad-coupon-ui-contract.test.mts`: 제휴처 상세 쿠폰 Chip에는 전체 사용량 문구를 다시 노출하지 않는다
- `tests/member-settings-route-ui-contract.test.mts`: 설정 화면은 공용 헤더와 설정 전용 뷰를 렌더링한다

## 전체 파일 분류

| 기준선 파일 | 처리 | 근거 |
| --- | --- | --- |
| `.storybook/overview.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/app/(site)/partners/[id]/_page/PartnerDetailAccessGate.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/app/(site)/partners/[id]/_page/PartnerDetailMobileActionBar.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/app/(site)/partners/[id]/_page/PartnerDetailScreen.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/Footer.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/HeroSection.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/HomeView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/MobileNav.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/PartnerCardView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/PartnerImageCarousel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/PwaInstallButton.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/SiteHeader.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/TabletMenu.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminAccountsView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminAdvertisementView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminCategoryManager.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminCompaniesView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminConfirmDialog.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminCycleView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminEventDetailView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminEventListView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminGlobalSearchResultsView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminGraduateVerificationQueue.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminLogoutButton.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminLogsAncillaryPanels.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminLogsManager.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminMemberDetailView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminMemberDirectCreatePanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminMemberManager.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminMemberManualAddPanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminMemberOperationsPanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminMemberSignupApprovalDetail.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminMemberSignupApprovalQueue.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminMemberTrendChart.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminMobileNav.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminNotificationTemplateManager.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminNotificationsView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminOperationFlow.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminPageStates.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminPaginationLink.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminPartnerEditView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminPartnerManager.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminPartnerNewView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminPartnerPreviewLinkPanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminPartnerRegistrationsView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminPrefetchSummaryPanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminProfilePhotoReviewQueue.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminPushManager.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminQuickNavigator.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminReviewManager.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminReviewQueueFilters.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminReviewQueueHeader.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminRouteTimingSummaryPanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminShell.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminStatePanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminTaskInboxView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminTaskOutcomeSummaryPanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminWebVitalSummaryPanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/AdminWorkspaceSummary.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/PartnerChangeRequestQueue.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/ad-packages/AdminPartnerCouponManager.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/cohort-card-themes/AdminCohortCardThemeManager.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/logs/AdminLogsExplorer.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/member-detail/AdminMemberCommunicationPanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/member-detail/AdminMemberDetailStatusMessages.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/member-detail/AdminMemberProfilePhotoPanel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/partner-manager/AdminPartnerListItem.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/partner-manager/AdminPartnerManagerList.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/partner-media-editor/MediaCardToolbar.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/push-manager/PushComposerSection.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/push-manager/PushLogsSection.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/push-manager/constants.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/push-manager/selectors.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/review-manager/AdminReviewCardView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/review-manager/AdminReviewFilters.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/admin/review-manager/AdminReviewImageGallery.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/auth/AuthEntryViews.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/auth/LoginForm.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/auth/MattermostCodeVerificationForm.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/auth/MattermostSignupCompleteForm.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/auth/UserMenu.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/campuses/CampusLandingView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/certification/AppleWalletPassCard.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/certification/AppleWalletPassSection.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/certification/CertificationAccountActions.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/certification/CertificationEmailSummary.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/certification/CertificationMattermostSyncAction.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/certification/CertificationView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/certification/MemberEmailVerificationView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/coupons/CouponPartnerVerificationView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/coupons/CouponWalletView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/events/EventPageView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/graduate-verification/GraduatePasswordSetupView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/graduate-verification/GraduateProfilePhotoForm.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/graduate-verification/GraduateVerificationApplicationView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/legal/LegalPolicyView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/loading/AdminGlobalSearchSkeletonContent.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/loading/MemberEmailVerificationPageSkeleton.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/media/ImageCropDialog.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/member-manual-import/ManualMemberPasswordSetupView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/notifications/NotificationsView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-card-view/helpers.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-favorites/PartnerFavoriteButton.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-image-carousel/LightboxModal.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-image-carousel/helpers.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-image-carousel/useCarouselController.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-registration/PartnerRegistrationClient.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-reviews/PartnerReviewCard.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-reviews/PartnerReviewForm.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-reviews/PartnerReviewLightbox.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-reviews/PartnerReviewSection.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-reviews/PartnerReviewSummaryCard.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner-reviews/helpers.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner/PartnerBenefitUseAction.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner/PartnerBenefitVerificationView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner/PartnerCanonicalViews.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner/PartnerCompanySelectionView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner/PartnerDashboardView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner/PartnerPageStates.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/partner/PartnerPortalShellView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/promotions/PromotionCarousel.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/pwa/PwaInstallGuideView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/pwa/PwaVisitRecommendation.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/review-media/ReviewImageCropModal.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/review-media/ReviewImageUploader.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/review-media/shared.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/settings/MemberAccountDeletionView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/suggest/SuggestPageView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/support/BugReportView.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/Badge.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/Button.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/Card.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/EmptyState.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/Input.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/Modal.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/PasswordInput.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/Select.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/SubmitButton.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/Tabs.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/Textarea.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/components/ui/Toast.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/browser-password.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/datetime.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/image-cache.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/notifications/shared.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/partner-audience.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/partner-links.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/partner-password-errors.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/partner-review-reactions.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/partner-reviews/shared.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/partner-utils.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/partner-visibility.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/return-to.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/review-media.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/ssafy-year.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `src/lib/validation.stories.tsx` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/activity-logs.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/ad-campaign-action-errors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/ad-coupon-api-contract.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/ad-coupon-code-batch-performance.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/ad-coupon-domain.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/ad-coupon-issued-read-performance.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/ad-coupon-rpc-access-contract.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/ad-coupon-sql-contract.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/ad-coupon-ui-contract.test.mts` | 일부 삭제 | 시각·문구·중복 구조 검사만 제거; 동작·실패·권한 검사 보존 |
| `tests/ad-coupon-validation.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/ad-package-repository.mock.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/ad-packages.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-account-feedback.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-advertisement-flow.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-advertisement-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-audit-logging.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-category-deletion-safety.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-category-read-model.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-companies-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-company-account-create.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-company-workspace-read-model.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-company-workspace.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-cycle-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-dashboard-home-snapshot.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-dashboard-scope.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-event-detail-performance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-event-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-form-actions-ui-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-forward-activity-performance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-global-search.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-graduate-verification-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-graduate-verification-queue-page.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-graduate-verification-queue.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-ia-refactor.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-json-route-body-limits.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-list-shell-streaming.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-log-access.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-log-auth-contract.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-log-cursor-rpc-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-log-detail-route.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-log-export-security-contract.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-log-loading-strategy.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-logs-safe-errors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-media-performance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-member-detail-profile-photo.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-member-detail-single-sync.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-member-detail.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-member-list-avatar-loading.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-member-list-database-filtering.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-member-list-read-model.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-member-manual-add-panel-ui.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-member-page-order.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-member-password-reset.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-member-signup-queue-page.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-notification-inbox.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-notification-route-body.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-notification-store.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-notification-template-detail-route.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-notification-template-feedback.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-notification-template-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-notification-template-recipient-loading.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-notification-unread-index-contract.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-notifications-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-notifications-read-model.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-observability.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-operation-paths.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-pagination-feedback.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-audit-scope.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-partner-benefit-action-parser.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-campaign-performance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-detail-flow.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-detail-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-partner-file-import.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-form-options.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-list-performance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-queue-performance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-registration-feedback.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-registration-page.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-registration-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-partner-save-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-service-mode.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-partner-update-atomicity.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-partner-update-errors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-performance-observability.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-plan-action-errors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-prefetch-observability.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-preview-performance.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-profile-photo-image-loading.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-profile-photo-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-profile-photo-queue-resilience.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-profile-photo-review.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-push-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-push-recipient-loading.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-quick-navigator.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-read-model-timeout.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-regional-scope.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-review-actions-return-to.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-review-detail-route.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-review-page-recovery.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-review-queue-ux.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-review-queue.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/admin-reviews-permissions.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-route-timing-summary.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-safe-messages.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-search-query.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-session-bridge.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-session-read-model.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/admin-state-panel-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-task-inbox.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-task-outcome-summary.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-touch-targets.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-ui-ux-foundation.test.mts` | 일부 삭제 | 시각·문구·중복 구조 검사만 제거; 동작·실패·권한 검사 보존 |
| `tests/admin-viewport.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/admin-web-vitals-summary.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/apple-wallet-config.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/apple-wallet-device-token.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/apple-wallet-marketing-badge.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/apple-wallet-notification-bounds.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/apple-wallet-payload.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/apple-wallet-push.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/apple-wallet-trademark-credit.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/apple-wallet-web-routes.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/apple-wallet-web-service.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/async-concurrency.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/audit-mutation-durability.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/auth-form-validation.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/auth-mock-navigation-contract.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/auth-session-isolation.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/batch4-refactor.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/browser-password-security.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/campus-seo.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/certification-account-settings-ui-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/certification-card-responsive-contract.test.mts` | 삭제 | CSS·구조 문자열 중복; mobile-account 실제 QR/카드 검증 유지 |
| `tests/certification-member-view.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/certification-wallet-deferred.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/change-policy.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/client-opt-in-bundle-boundaries.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/client-uuid.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/cohort-card-themes.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/conditional-json-response.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/contact-copy-row-ui-contract.test.mts` | 삭제 | CSS 문자열·정확한 클래스 순서만 고정; 렌더 검증 아님 |
| `tests/coupon-wallet-ui-contract.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/cron-route-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/cross-platform-development-contract.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/csrf-route-contracts.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/development-environment.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/docs-governance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/e2e/admin-console.spec.ts` | 일부 삭제 | 시각·문구·중복 구조 검사만 제거; 동작·실패·권한 검사 보존 |
| `tests/e2e/auth-ops.spec.ts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/e2e/graduate-verification.spec.ts` | 유지 | 사용자 행동·실패 복구·접근성 회귀 |
| `tests/e2e/home-partners.spec.ts` | 일부 삭제 | 시각·문구·중복 구조 검사만 제거; 동작·실패·권한 검사 보존 |
| `tests/e2e/mobile-account-ui.spec.ts` | 유지 | 사용자 행동·실패 복구·접근성 회귀 |
| `tests/e2e/mobile-ui-ux.spec.ts` | 일부 삭제 | 시각·문구·중복 구조 검사만 제거; 동작·실패·권한 검사 보존 |
| `tests/e2e/page-smoke.spec.ts` | 분리·축소 | 공개·로그인 24개 단순 렌더 삭제; 보호 경로 34개 유지 |
| `tests/e2e/partner-detail-introduction.spec.ts` | 삭제 | 6개 viewport의 상세 배치·클래스·문구 반복; 혜택 노출 도메인과 실제 상세 진입은 유지 |
| `tests/e2e/partner-image-carousel.spec.ts` | 일부 삭제 | 시각·문구·중복 구조 검사만 제거; 동작·실패·권한 검사 보존 |
| `tests/e2e/partner-registration.spec.ts` | 유지 | 사용자 행동·실패 복구·접근성 회귀 |
| `tests/e2e/pwa-shell.spec.ts` | 유지 | 사용자 행동·실패 복구·접근성 회귀 |
| `tests/e2e/site-header.spec.ts` | 일부 삭제 | 회원/비회원 10개 폭 반복 배치 검사 제거; 메뉴·포커스·로그인 복귀·PWA 행동 유지 |
| `tests/email-content.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/email-delivery.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/event-reward-admin.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/event-rewards.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/exceljs-archiver-compat.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/expiring-partner-push-idempotency.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/form-idempotency.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/github-actions-operations-skill.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/graduate-approval-schema-contract.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/graduate-cohort-schema-contract.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/graduate-email-delivery-hotfix.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/graduate-existing-member-recovery.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/graduate-upload-error-contract.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/graduate-verification-domain.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/graduate-verification-email-code.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/graduate-verification-email-content.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/graduate-verification-files.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/graduate-verification-security.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/graduate-verification-storage.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/home-partner-directory.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/home-partner-state-route-performance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/home-partner-state.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/home-push-opt-in-banner-removal-contract.test.mts` | 삭제 | 삭제된 장식 배너·skeleton 순서만 고정 |
| `tests/home-server-waterfall.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/image-cache.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/image-proxy-rate-limit.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/image-proxy-token-chip-helpers.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/image-proxy.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/image-upload-client-transform.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-client.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-complete-route-contract.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-draft.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-heif.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-http.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-manifest.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-policy.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-quota.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-repository-contract.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-repository-selector.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-repository.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/image-upload-session-source-path.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/image-upload-transform.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/install-scripts-policy.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/json-ld-security.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/json-route-body-limits.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/legacy-member-avatar-migration.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/lint-artifact-isolation.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/log-insights-actors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/log-insights-csv-security.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/log-insights-cursor.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/log-insights-paging.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/log-insights-privacy.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/log-retention-policy.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/logging-foundation.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-cleanup.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-draft.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-duplicate.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-editor.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-focus.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-options.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-photo-source.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-reissue.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-row-api-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import-xlsx.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/manual-member-import.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mattermost-client.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mattermost-code-expiration.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mattermost-code-flow-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mattermost-direct-reversion.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mattermost-mm-profile-helpers.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mattermost-sender-availability.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mattermost-sender-credentials.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mattermost-sender-health.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mattermost-sender-self-test-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mattermost-signup-campus.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-account-deletion-flow.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-anonymization-schema-contract.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/member-auth-security.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/member-direct-create.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-domain-contract-migration.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/member-domain.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-email-login-transition.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/member-email-recovery.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/member-email-required-gate.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/member-email-security-log-parity.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/member-email-verification-completion.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/member-email-verification-flow.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/member-email-verification.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/member-json-route-body-limits.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-login-method-preference.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-manual-add-normalized.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-mattermost-profile-sync.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-normalized-auth-contract.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/member-notification-preferences-atomicity.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/member-profile-image-source.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-profile-photo-route-safe-errors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-profile-photo.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-profile-sync-errors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-required-gates.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/member-settings-route-ui-contract.test.mts` | 일부 삭제 | 시각·문구·중복 구조 검사만 제거; 동작·실패·권한 검사 보존 |
| `tests/member-signup-complete.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-signup-rollback.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/member-sync-batch.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-wallet-lifecycle-sql-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/member-wallet-pass-sql-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mm-member-lifecycle.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mm-profile-csv.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mm-route-helpers.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mm-signup-approval-action-input.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mm-signup-approval.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mm-signup-expiration-performance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mobile-navigation-ui-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mock-admin-auth.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/mock-member-demo.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/mock-scenarios.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/modal-close-button-ui-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/new-partner-campus-notifications.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/notification-campaign-claim.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/notification-center.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/notification-client-safe-errors.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/notification-email-content.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/notification-recipient-fanout.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/notification-route-safe-errors.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/notification-template-test-delivery.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/notification-templates.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/nts-business-status.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/operational-notification-atomicity.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/operational-notification-settings-reuse.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/opt-wave4-helpers.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/opt-wave5-selectors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-account-manager-helpers.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-auth-route-body.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-auth-session-version-fallback.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-benefit-action.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-benefit-items.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-benefit-usage.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-benefit-use-count.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-benefit-visibility.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-billing-profile-bulk.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-billing-profile-default-atomicity.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-billing-profiles.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-billing.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-branch-link-persistence.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-branch-link-reuse.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-branch-registration.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-business-status-rate-limit.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-card-form-accessibility.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-card-form-draft.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-change-request-contract-parity.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-change-requests-page.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-client-safe-request-errors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-company-plans.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-company-provision-rollback.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-counts-visibility.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-counts.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-coupon-action-scope.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-create-idempotency.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-create-rollback.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-delete-removal.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-detail-benefit-action.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-detail-image-role-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-detail-introduction-e2e-contract.test.mts` | 삭제 | 삭제 대상 시각 E2E의 작성 형식만 검사 |
| `tests/partner-detail-issued-coupon-map.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-form-request-size.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-image-carousel-layout.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-json-route-body-limits.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-media-attachment-cleanup.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-media-upload-items.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-metric-loader.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-metric-rollups.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-metric-timeseries.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-notification-input.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-notification-mock-parity.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-notification-routing.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-notification-store.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-notification-ui.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-notifications-audit-scope.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-password-reset-contract.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-plan-billing-atomicity.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-plan-review-error-contract.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-plan-safe-messages.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-plan-ui-contract.test.mts` | 일부 삭제 | 시각·문구·중복 구조 검사만 제거; 동작·실패·권한 검사 보존 |
| `tests/partner-plan-ui.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-plan-upgrades.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-portal-layout.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-portal-metric-access.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-portal-navigation.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-portal-scope.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-portal.mock.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-preview.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-public-table-security.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-registration-conversion-cleanup.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-registration-safe-errors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-registration.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-review-domain.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-review-pending.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-review-query-performance.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-review-section-ui-contract.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-reviews-helpers.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/partner-service-detail-helpers.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-service-metrics.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-session-revalidation.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-setup-fallback.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-setup-route-security.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/partner-view-context-performance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/partner-visibility.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/password-reset-method-tabs.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/performance-bounds-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/platform-activity-metrics-schema.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/platform-activity-metrics.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/platform-activity-window.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/prepush-e2e-gate.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/preview-credential-seed.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/preview-db-health.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/preview-sync-dump-container.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/preview-sync-sanitize.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/preview-sync-storage.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/preview-sync-wallet-isolation.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/production-migration-hygiene.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/promotion-archive-atomicity.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/promotion-cache-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/promotion-carousel-draft.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/promotion-carousel-ui-contract.test.mts` | 삭제 | 배치·여백·클래스 구현 형태; 변경 시 시각 QA로 확인 |
| `tests/promotion-image-source.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/promotion-visibility.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/public-cache-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/public-canonical-story-contracts.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/public-image-optimization-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/public-partner-directory-performance.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/public-rate-limit-success-paths.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/public-readiness.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/public-route-safe-errors.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/public-storage-url.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/push-audience-pagination.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/push-delivery-concurrency.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/push-device-label.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/push-subscription-trust.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/push-template-bookkeeping.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/push/wave1-helpers.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/pwa-install-guide.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/rate-limit-atomic.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/rate-limit-common.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/review-media-upload-items.test.mts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/runtime-data-access.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/scroll-to-top-fab-removal-contract.test.mts` | 삭제 | 삭제된 장식 컴포넌트의 영구 부재만 고정 |
| `tests/search-params.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/security-audit-policy.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/security-hardening.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/security-schema.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/self-host-alert-email.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-atomic-manifests.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-ci-archive.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-ci-batches.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-ci-warmup.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-ci.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-cron.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-database-credentials.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-database-logging.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-database.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-edge-compose.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-environments.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-github-release.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-mac-operator.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-maintenance.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-migration-age-install.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-migration-database.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-migration-github.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-migration-storage.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-migration-transfer.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-monitoring.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-offhost.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-online-backup.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-operations.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-operator-entrypoint.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-origin.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-original-preview-compose.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-production-backup.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-production-compose.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-production-cron.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-production-css.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-production-e2e.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-production-export.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-recovery-envelope.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-redirects.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-release-receiver.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-runtime.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-schema-approval.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-host-storage-runtime.test.mts` | 유지 | 배포·데이터·검증 절차 안전 경계 |
| `tests/self-service-audit-actor-type.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/seo-ops-helpers.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/server-client-module-boundary.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/server-timing.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/site-navigation.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/smtp-config.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/ssafy-cycle-simulation.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/storybook-test-runner.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/suggest-email-security.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/suggest-validation.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/supabase-paging.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/supabase-transport.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/telemetry-loading.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/terminology-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit-runner-resource-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/admin-dashboard-scope.test.ts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/unit/admin-graduate-verification-image-route.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/admin-ia.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/admin-member-detail.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/admin-notification-ops-utils.test.ts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/unit/admin-notification-preferences-route.test.ts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/unit/admin-notification-template-api-access.test.ts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/unit/admin-reviews.test.ts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/unit/content-budget.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/e2e-mutation-mode.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/graduate-verification-resubmission.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/graduate-verification-submit-route.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/home-directory-state.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/json-body-limit-routes.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/member-lifecycle.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/member-profile-sync-status.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/notification-preferences.test.ts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/unit/partner-billing-action-errors.test.ts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/unit/partner-billing-cron-route.test.ts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/unit/partner-business-status-route.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/partner-portal-paths.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/partner-registration-steps.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/partner-review-repository.supabase.test.ts` | 유지 | 데이터·외부 부작용·중복·실패 복구 |
| `tests/unit/password.test.ts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/unit/policy-documents.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/supabase-server.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/unit/web-vitals-route.test.ts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/user-session-request-cache.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/uuid.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/visual/admin-operations.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/admin-platform-activity.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/apple-wallet-pass-card.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/certification-card.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/core-responsive-overflow.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/core-screens.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/graduate-verification.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/mattermost-code-form.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/mattermost-signup-complete.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/mobile-nav.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/partner-benefit-verification.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/partner-detail-density.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/visual/promotion-carousel.visual.spec.ts` | 유지 (수동) | 일반 PR 필수 실행 아님; 시각·접근성·컴포넌트 확인 수단 보존 |
| `tests/wallet-apple-pass-member-route.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/wallet-pass-eligibility.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/wallet-pass-log-path.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/wallet-pass-notify.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/wallet-pass-reconcile.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/wallet-pass-repository-selector.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/wallet-pass-repository.mock.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/wallet-pass-service-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/wallet-pass-token.test.mts` | 유지 | 인증·권한·민감 정보 경계 |
| `tests/wallet-pass-ui-state.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/wallet-verify-page-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/wallet-verify-state-contract.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
| `tests/xlsx-resource-limits.test.mts` | 유지 | 도메인·상태·입력·성능/접근성 계약; 낮은 비용 대비 삭제 이익 미확인 |
