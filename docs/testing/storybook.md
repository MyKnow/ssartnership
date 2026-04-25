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

## 현재 포함된 스토리

### Foundations

- [.storybook/overview.stories.tsx](/Users/myknow/coding/ssartnership/.storybook/overview.stories.tsx)

### UI

- [src/components/ui/Button.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Button.stories.tsx)
- [src/components/ui/Badge.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Badge.stories.tsx)
- [src/components/ui/Card.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Card.stories.tsx)
- [src/components/ui/Input.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Input.stories.tsx)
- [src/components/ui/Select.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Select.stories.tsx)
- [src/components/ui/Tabs.stories.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Tabs.stories.tsx)

### Domains

- [src/components/partner-reviews/PartnerReviewCard.stories.tsx](/Users/myknow/coding/ssartnership/src/components/partner-reviews/PartnerReviewCard.stories.tsx)

## 검증 현황

### 완료

- `npm run build-storybook` 통과
- `npm run test-storybook` 통과
- Storybook Vitest browser-mode smoke test 구성 완료

### 현재 자동 테스트 결과

- `8` files passed
- `19` tests passed
- `1` story skipped

## known limitation

`next/image`가 포함된 일부 스토리는 현재 Vitest browser mode에서 충돌할 수 있습니다.

현재 대응:

- [src/components/partner-reviews/PartnerReviewCard.stories.tsx](/Users/myknow/coding/ssartnership/src/components/partner-reviews/PartnerReviewCard.stories.tsx)의 `WithImages` 스토리에 `manual-image` 태그 적용
- [vitest.config.ts](/Users/myknow/coding/ssartnership/vitest.config.ts)에서 `manual-image` 태그는 Storybook Vitest 자동 실행 시 skip

즉:

- 일반 스토리 smoke test는 자동 검증
- 이미지 포함 스토리는 Storybook UI에서 수동 확인

## 운영 기준

### 새 컴포넌트를 Storybook에 추가할 때

1. 가능한 한 primitive부터 스토리 작성
2. 상태 변화가 있는 경우 `args` 또는 local demo wrapper로 표현
3. 네트워크 호출이 필요한 경우 mockable surface만 노출
4. `next/image`, portal, browser-only API가 들어가면 먼저 Storybook build와 `test-storybook` 둘 다 확인

### 테스트 태그 사용

- 기본 자동 검증 대상: 일반 스토리
- 수동 확인 전용 스토리: `tags: ["manual-image"]`

## 우선순위 높은 미포함 컴포넌트

### 1차

- [src/components/ui/Modal.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Modal.tsx)
- [src/components/ui/Textarea.tsx](/Users/myknow/coding/ssartnership/src/components/ui/Textarea.tsx)
- [src/components/ui/PasswordInput.tsx](/Users/myknow/coding/ssartnership/src/components/ui/PasswordInput.tsx)
- [src/components/ui/EmptyState.tsx](/Users/myknow/coding/ssartnership/src/components/ui/EmptyState.tsx)
- [src/components/ui/SubmitButton.tsx](/Users/myknow/coding/ssartnership/src/components/ui/SubmitButton.tsx)

### 2차

- [src/components/HeroSection.tsx](/Users/myknow/coding/ssartnership/src/components/HeroSection.tsx)
- [src/components/SiteHeader.tsx](/Users/myknow/coding/ssartnership/src/components/SiteHeader.tsx)
- [src/components/PartnerCardView.tsx](/Users/myknow/coding/ssartnership/src/components/PartnerCardView.tsx)
- [src/components/PartnerImageCarousel.tsx](/Users/myknow/coding/ssartnership/src/components/PartnerImageCarousel.tsx)

### 3차

- [src/components/partner-reviews/PartnerReviewSummaryCard.tsx](/Users/myknow/coding/ssartnership/src/components/partner-reviews/PartnerReviewSummaryCard.tsx)
- [src/components/partner-reviews/PartnerReviewForm.tsx](/Users/myknow/coding/ssartnership/src/components/partner-reviews/PartnerReviewForm.tsx)
- [src/components/partner-favorites/PartnerFavoriteButton.tsx](/Users/myknow/coding/ssartnership/src/components/partner-favorites/PartnerFavoriteButton.tsx)

### 4차

- [src/components/auth/LoginForm.tsx](/Users/myknow/coding/ssartnership/src/components/auth/LoginForm.tsx)
- [src/components/auth/SignupForm.tsx](/Users/myknow/coding/ssartnership/src/components/auth/SignupForm.tsx)
- [src/components/auth/ResetPasswordForm.tsx](/Users/myknow/coding/ssartnership/src/components/auth/ResetPasswordForm.tsx)

### 5차

- [src/components/admin/AdminShell.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminShell.tsx)
- [src/components/admin/AdminPartnerManager.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminPartnerManager.tsx)
- [src/components/admin/AdminReviewManager.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminReviewManager.tsx)
- [src/components/admin/AdminPushManager.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminPushManager.tsx)
- [src/components/admin/AdminLogsManager.tsx](/Users/myknow/coding/ssartnership/src/components/admin/AdminLogsManager.tsx)

## 다음 권장 작업

1. 1차 UI primitive 스토리 추가
2. 공개 페이지 핵심 표면 스토리 추가
3. 관리자 화면은 전체 manager보다 하위 카드/필터/리스트 단위부터 분해해서 스토리 작성
4. `next/image` 충돌은 별도 mock 전략 또는 Storybook/Vitest 조합 업스트림 변경 확인 후 재정리
