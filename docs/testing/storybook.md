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

## 강제 게이트

Chromatic 빌드 에러가 push 이후 이메일로만 발견되는 상황을 막기 위해 Storybook 검증을 릴리즈 게이트로 둡니다.

- `npm run release`는 커밋/푸시 전에 `npm run build-storybook`을 반드시 실행합니다.
- `npm run release`는 커밋/푸시 전에 `npm run test-storybook`을 반드시 실행합니다.
- 두 명령 중 하나라도 실패하면 버전 업데이트, 커밋, 푸시를 진행하지 않습니다.
- GitHub Actions의 Chromatic workflow는 실패를 허용하지 않으므로, CI에서도 Storybook/Chromatic 실패가 명확히 실패로 남습니다.
- 긴급 상황에서 `git push --no-verify`로 로컬 hook을 우회하더라도 release 스크립트와 CI 게이트는 우회하지 않는 것을 원칙으로 합니다.

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
- [src/components/auth/SignupForm.stories.tsx](/Users/myknow/coding/ssartnership/src/components/auth/SignupForm.stories.tsx)
- [src/components/auth/ResetPasswordForm.stories.tsx](/Users/myknow/coding/ssartnership/src/components/auth/ResetPasswordForm.stories.tsx)
- [src/components/auth/signup-form/SignupActions.stories.tsx](/Users/myknow/coding/ssartnership/src/components/auth/signup-form/SignupActions.stories.tsx)
- [src/components/auth/signup-form/SignupVerificationField.stories.tsx](/Users/myknow/coding/ssartnership/src/components/auth/signup-form/SignupVerificationField.stories.tsx)
- [src/components/auth/signup-form/SignupPoliciesSection.stories.tsx](/Users/myknow/coding/ssartnership/src/components/auth/signup-form/SignupPoliciesSection.stories.tsx)
- [src/components/auth/signup-form/SignupPasswordFields.stories.tsx](/Users/myknow/coding/ssartnership/src/components/auth/signup-form/SignupPasswordFields.stories.tsx)

### Admin

- [src/components/admin/AdminLogoutButton.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminLogoutButton.stories.tsx)
- [src/components/admin/AdminMobileNav.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminMobileNav.stories.tsx)
- [src/components/admin/AdminShell.stories.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminShell.stories.tsx)
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

## 검증 현황

### 완료

- `npm run build-storybook` 통과
- `npm run test-storybook` 통과
- Storybook Vitest browser-mode smoke test 구성 완료

### 현재 자동 테스트 결과

- `41` files passed
- `99` tests passed
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
