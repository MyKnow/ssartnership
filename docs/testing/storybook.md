# Storybook

이 문서는 `/Users/myknow/coding/ssartnership` 프로젝트의 Storybook 구성 현황과 운영 기준을 정리합니다.

## 목적

- 공용 UI primitive를 독립적으로 검증
- 실제 도메인 컴포넌트를 페이지 밖에서 빠르게 확인
- Tailwind v4, App Router, light/dark UI 상태를 고정된 미리보기에서 검토
- Storybook 기반 Vitest smoke test로 회귀를 빠르게 감지

## 현재 구성

### 의존성

- `storybook`
- `@storybook/nextjs-vite`
- `@storybook/addon-docs`
- `@storybook/addon-a11y`
- `@storybook/addon-vitest`
- `vitest`
- `@vitest/browser-playwright`
- `@vitest/coverage-v8`
- `playwright`

### 설정 파일

- [.storybook/main.ts](/Users/myknow/coding/ssartnership/.storybook/main.ts)
- [.storybook/preview.tsx](/Users/myknow/coding/ssartnership/.storybook/preview.tsx)
- [vitest.config.ts](/Users/myknow/coding/ssartnership/vitest.config.ts)

### package.json scripts

```bash
npm run storybook
npm run build-storybook
npm run test-storybook
npm run test-storybook:watch
```

## 검증 게이트

Storybook 자체 검증은 로컬 릴리즈 게이트로 유지합니다.

- `npm run release`는 커밋/푸시 전에 `npm run build-storybook`을 반드시 실행합니다.
- `npm run release`는 커밋/푸시 전에 `npm run test-storybook`을 반드시 실행합니다.
- 두 명령 중 하나라도 실패하면 버전 업데이트, 커밋, 푸시를 진행하지 않습니다.
- GitHub Actions의 Chromatic publish workflow는 무료 한도 소진으로 인한 외부 `UI Tests` pending을 피하기 위해 수동 실행 전용입니다.
- 긴급 상황에서 `git push --no-verify`로 로컬 hook을 우회하더라도 release 스크립트와 Public Readiness CI 게이트는 우회하지 않는 것을 원칙으로 합니다.

## 현재 포함된 스토리

### Foundations

- [.storybook/overview.stories.tsx](/Users/myknow/coding/ssartnership/.storybook/overview.stories.tsx)

### UI

- [src/components/ui/Button.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Button.stories.tsx)
- [src/components/ui/Badge.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Badge.stories.tsx)
- [src/components/ui/Card.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Card.stories.tsx)
- [src/components/ui/Modal.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Modal.stories.tsx)
- [src/components/ui/Input.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Input.stories.tsx)
- [src/components/ui/Textarea.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Textarea.stories.tsx)
- [src/components/ui/PasswordInput.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/PasswordInput.stories.tsx)
- [src/components/ui/Select.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Select.stories.tsx)
- [src/components/ui/Tabs.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Tabs.stories.tsx)
- [src/components/ui/EmptyState.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/EmptyState.stories.tsx)
- [src/components/ui/SubmitButton.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/SubmitButton.stories.tsx)

### Public / Domain

- [src/components/HeroSection.stories.tsx](/Users/myknow/coding/ssartnership/src/components/HeroSection.stories.tsx)
- [src/components/SiteHeader.stories.tsx](/Users/myknow/coding/ssartnership/src/components/SiteHeader.stories.tsx)
- [src/components/PartnerCardView.stories.tsx](/Users/myknow/coding/ssartnership/src/components/PartnerCardView.stories.tsx)
- [src/components/PartnerImageCarousel.stories.tsx](/Users/myknow/coding/ssartnership/src/components/PartnerImageCarousel.stories.tsx)
- [src/components/partner-reviews/PartnerReviewCard.stories.tsx](/Users/myknow/coding/ssartnership/src/components/partner-reviews/PartnerReviewCard.stories.tsx)
- [src/components/partner-reviews/PartnerReviewSummaryCard.stories.tsx](/Users/myknow/coding/ssartnership/src/components/partner-reviews/PartnerReviewSummaryCard.stories.tsx)
- [src/components/partner-reviews/PartnerReviewForm.stories.tsx](/Users/myknow/coding/ssartnership/src/components/partner-reviews/PartnerReviewForm.stories.tsx)
- [src/components/partner-favorites/PartnerFavoriteButton.stories.tsx](/Users/myknow/coding/ssartnership/src/components/partner-favorites/PartnerFavoriteButton.stories.tsx)

### Auth

- [src/components/auth/LoginForm.stories.tsx](/Users/myknow/coding/ssartnership/src/components/auth/LoginForm.stories.tsx)
- [src/components/auth/ResetPasswordForm.stories.tsx](/Users/myknow/coding/ssartnership/src/components/auth/ResetPasswordForm.stories.tsx)

### Admin

- [src/components/admin/AdminLogoutButton.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminLogoutButton.stories.tsx)
- [src/components/admin/AdminMobileNav.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminMobileNav.stories.tsx)
- [src/components/admin/AdminShell.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminShell.stories.tsx)
- [src/components/admin/AdminPageStates.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminPageStates.stories.tsx)
- [src/components/admin/AdminPartnerManager.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminPartnerManager.stories.tsx)
- [src/components/admin/partner-manager/AdminPartnerManagerFilters.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/partner-manager/AdminPartnerManagerFilters.stories.tsx)
- [src/components/admin/partner-manager/AdminPartnerManagerList.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/partner-manager/AdminPartnerManagerList.stories.tsx)
- [src/components/admin/AdminReviewManager.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminReviewManager.stories.tsx)
- [src/components/admin/review-manager/AdminReviewFilters.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/review-manager/AdminReviewFilters.stories.tsx)
- [src/components/admin/review-manager/AdminReviewCardView.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/review-manager/AdminReviewCardView.stories.tsx)
- [src/components/admin/review-manager/AdminReviewImageGallery.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/review-manager/AdminReviewImageGallery.stories.tsx)
- [src/components/admin/partner-manager/AdminPartnerListItem.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/partner-manager/AdminPartnerListItem.stories.tsx)
- [src/components/admin/logs/AdminLogsExplorer.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/logs/AdminLogsExplorer.stories.tsx)
- [src/components/admin/AdminPushManager.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminPushManager.stories.tsx)
- [src/components/admin/AdminLogsManager.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminLogsManager.stories.tsx)

### Partner Page States

- [src/components/partner/PartnerCompanySelectionView.stories.tsx](/Users/myknow/coding/ssartnership/src/components/partner/PartnerCompanySelectionView.stories.tsx)
- [src/components/partner/PartnerDashboardView.stories.tsx](/Users/myknow/coding/ssartnership/src/components/partner/PartnerDashboardView.stories.tsx)

## Mock Scenario Registry

Mock 전략은 Repository/service mock을 폐기하지 않고, 그 위에 시나리오 레지스트리를 얹는 방식으로 운영합니다.

- 시나리오 정의: [src/lib/mock/scenarios/registry.ts](/Users/myknow/coding/ssartnership/src/lib/mock/scenarios/registry.ts)
- Route/View inventory: [src/lib/mock/scenarios/route-inventory.ts](/Users/myknow/coding/ssartnership/src/lib/mock/scenarios/route-inventory.ts)
- Required state policy: [src/lib/mock/scenarios/required-states.ts](/Users/myknow/coding/ssartnership/src/lib/mock/scenarios/required-states.ts)
- Coverage matrix: [src/lib/mock/scenarios/coverage.ts](/Users/myknow/coding/ssartnership/src/lib/mock/scenarios/coverage.ts)
- Storybook scenario traceability: [src/lib/mock/scenarios/storybook-coverage.ts](/Users/myknow/coding/ssartnership/src/lib/mock/scenarios/storybook-coverage.ts)
- Adoption policy: [src/lib/mock/scenarios/adoption-policy.ts](/Users/myknow/coding/ssartnership/src/lib/mock/scenarios/adoption-policy.ts)
- Partner portal story adapter: [src/lib/mock/scenarios/partner-portal.ts](/Users/myknow/coding/ssartnership/src/lib/mock/scenarios/partner-portal.ts)
- Browser-safe Storybook fixture: [src/lib/mock/scenarios/storybook-partner-portal.ts](/Users/myknow/coding/ssartnership/src/lib/mock/scenarios/storybook-partner-portal.ts)
- 검증 테스트: [tests/mock-scenarios.test.mts](/Users/myknow/coding/ssartnership/tests/mock-scenarios.test.mts)

### 현재 Coverage Matrix

현재 상태는 전체 완료가 아니라 foundation coverage입니다.

- App Router `page.tsx` route: 61개
- 등록된 mock scenario: 45개
- Storybook scenario story: 14개
- Storybook complete route: 11개
- Storybook partial route: 0개
- Storybook missing route: 17개
- Route inventory only route: 33개

이 숫자는 [tests/mock-scenarios.test.mts](/Users/myknow/coding/ssartnership/tests/mock-scenarios.test.mts)에서 고정합니다. 새 route나 story가 추가되면 coverage matrix 수치를 함께 갱신해야 합니다.

운영 규칙:

1. 새 화면, 새 데이터 분기, 새 권한 분기, 새 비동기 상태가 생기면 `registry.ts`에 stable scenario id를 추가합니다.
2. 새 `page.tsx`가 생기면 `route-inventory.ts`에 route, view component, data source, required scenario를 추가합니다.
3. 새 story가 생기면 `storybook-coverage.ts`에 route, scenario id, story id, viewport를 추가합니다.
4. Storybook은 모든 route를 그대로 복제하지 않고, View 중심 Page States를 추가합니다.
5. MSW는 client fetch/API route 상호작용이 필요한 경우에만 도입합니다. 서버 컴포넌트와 Repository mock은 scenario adapter를 우선 사용합니다.
6. Storybook/test/local mock 데이터는 synthetic only입니다. 이메일은 `.example` 도메인만 사용하고, Supabase Preview/Production 데이터를 캡처 fixture에 섞지 않습니다.
7. 자동 캡처 스크립트는 Storybook story id와 `parameters.mockScenario.scenarioId`가 안정화된 뒤 연결합니다.

### MSW 도입 기준

현재 기본 전략은 `scenario adapter`입니다. 서버 컴포넌트, Repository mock, service mock, props 기반 View는 별도 네트워크 레이어 없이 Storybook fixture로 표현합니다.

MSW는 다음 조건을 모두 만족할 때만 추가합니다.

- Storybook `play` 또는 browser-mode test에서 `fetch` 상호작용을 실제로 실행한다.
- `PATCH`, `DELETE`, `더보기`, `미리보기`, `저장`처럼 응답에 따라 UI가 변한다.
- props fixture만으로는 성공/실패/rollback/pending 상태를 재현하기 어렵다.

단순히 route inventory의 `dataSources`에 `api-route`가 있다는 이유만으로 MSW를 넣지 않습니다. 네트워크 상호작용을 실행하지 않는 알림 수신함, 초기 목록, 읽기 전용 상태는 초기 state fixture를 우선합니다. 이 판단은 [src/lib/mock/scenarios/adoption-policy.ts](/Users/myknow/coding/ssartnership/src/lib/mock/scenarios/adoption-policy.ts)의 `getMockScenarioNetworkMockingDecision`으로 고정합니다.

### 관리자 Page States

관리자 화면은 모든 `page.tsx`를 Storybook에 복제하지 않고, 운영 위험도가 높은 route를 우선 Page State로 연결합니다.

- `/admin`: 운영 요약, 빠른 이동, 권한 제한을 확인하는 대시보드 상태
- `/admin/companies`: 플랜/과금, 계좌이체 입금 확인, 세금계산서 발급 상태
- `/admin/notifications`: 관리자 수신함, 중요/미확인 알림, 더보기 상태
- `/admin/partners`, `/admin/partners/[partnerId]`, `/admin/partners/new`: 브랜드 목록과 생성/편집 흐름
- `/admin/logs`, `/admin/push`, `/admin/reviews`: 기존 도메인 스토리를 route scenario에 연결

관리자 Storybook 상태는 1차 기준으로 `360px / 820px / 1366px`를 고정합니다. 이후 자동 캡처 스크립트 단계에서 전체 viewport 세트(`320/360/390/768/820/1366/1440/1536`)로 확장합니다.

### Required State Policy

모든 route는 최소 `default`, `long-korean`, `mobile-overflow` 상태를 갖습니다. 데이터/권한/폼/이미지/페이지네이션 성격에 따라 `loading`, `error`, `unauthorized`, `validation-error`, `image-gallery`, `broken-image`, `pagination`, `filter`, `locked-metric`, `payment-pending`, `billing-profile` 같은 machine-readable state key가 추가됩니다.

캡처 정책은 다음 viewport를 기준으로 합니다.

- 모바일: 320px, 360px, 390px
- 태블릿: 768px, 820px
- 데스크탑: 1366px, 1440px, 1536px

현재 Storybook page-state는 우선 `360px / 820px / 1366px`를 `parameters.chromatic.viewports`로 고정하고, 자동 캡처 스크립트 단계에서 전체 viewport 세트로 확장합니다.

### Adoption Policy

다음 변경은 scenario, Storybook state, coverage matrix 갱신이 필요합니다.

- 새 route 또는 새 View
- 새 데이터 분기
- 새 권한 분기
- 새 비동기 동작
- 새 폼 검증
- 새 이미지/업로드 흐름
- 새 페이지네이션 흐름

문구 변경이나 시각 polish만 있고 새 상태/분기/데이터 계약이 없으면 기존 scenario를 재사용할 수 있습니다.

## 검증 현황

### 완료

- `npm run build-storybook` 통과
- `npm run test-storybook` 통과
- Storybook Vitest browser-mode smoke test 구성 완료

### 현재 자동 테스트 결과

- `74` files passed
- `188` tests passed
- skipped 없음

## 현재 상태

`next/image`가 포함된 스토리도 현재 Vitest browser mode에서 자동 검증됩니다.

현재 대응:

- [.storybook/vitest.setup.tsx](/Users/myknow/coding/ssartnership/.storybook/vitest.setup.tsx)에서 `next/image`를 Storybook Vitest용 `img` mock으로 대체
- 이미지 포함 스토리도 `npm run test-storybook`에 포함
- `manual-image`, `manual-server` 태그는 더 이상 사용하지 않음

즉:

- 일반 스토리와 이미지 포함 스토리 모두 자동 smoke test로 검증
- 수동 확인은 시각 품질 점검이 필요할 때만 추가로 수행

서버 액션 결합 문제는 해결했습니다.

- [src/components/admin/AdminShell.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminShell.tsx)는 [AdminShellView.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminShellView.tsx) wrapper 구조로 분리
- [src/components/admin/AdminReviewManager.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminReviewManager.tsx)는 [AdminReviewManagerView.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminReviewManagerView.tsx), [AdminReviewCardView.tsx](/Users/myknow/coding/ssartnership/src/components/admin/review-manager/AdminReviewCardView.tsx) 구조로 분리
- 따라서 `manual-server` 태그는 더 이상 사용하지 않음

## 운영 기준

### 새 컴포넌트를 Storybook에 추가할 때

1. 가능한 한 primitive부터 스토리 작성
2. 상태 변화가 있는 경우 `args` 또는 local demo wrapper로 표현
3. 네트워크 호출이 필요한 경우 mockable surface만 노출
4. `next/image`, portal, browser-only API가 들어가면 먼저 Storybook build와 `test-storybook` 둘 다 확인

### 테스트 태그 사용

- 기본 자동 검증 대상: 전체 스토리
- 예외 태그는 현재 없음

## 현재 미포함 컴포넌트 방향

현재 `storybook.md`에 우선순위로 적어두었던 1차~5차 대상은 모두 스토리 추가가 끝났습니다.

## 다음 권장 작업

1. 인증/관리자 화면을 `form section`, `row`, `dialog`, `empty/loading/error` 단위로 계속 확장
2. 추가된 하위 스토리에 `play` 기반 interaction test를 더 넓게 적용
3. 필요 시 visual regression 기준을 별도 도입
