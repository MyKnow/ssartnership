# 전역 최적화 프로그램

## 운영 원칙
- wave 단위로 진행한다.
- 각 wave 종료 시 `npm run lint`, `npx tsc --noEmit`, 관련 핵심 테스트, 문서 `Status`를 갱신한다.
- 리팩토링과 명백한 버그 수정만 허용한다.
- 기능 정책 변경은 하지 않는다.

## 백로그

### OPT-001
- ID: `OPT-001`
- Priority: `P0`
- Category: `maintainability`
- Targets: `src/lib/push.ts`, `src/components/admin/AdminPushManager.tsx`, `src/components/push/PushSettingsCard.tsx`
- Current Problem: push 도메인 로직, 관리자 발송 UI, 개인 알림 설정 UI가 각각 과도한 책임을 갖고 있고, 파싱/발송/상태 계산/표시 로직이 한 파일에 몰려 있다.
- Planned Change: push 도메인을 payload builder, audience resolver, preferences/subscriptions service, log service, send orchestration으로 나누고, admin/settings UI는 form state, log filtering, render section, browser capability helper로 분리한다.
- Validation: `npm run lint`, `npx tsc --noEmit`, push 관련 핵심 테스트 추가 또는 기존 발송/설정 경로 회귀 검증
- Status: `done`
- Completed:
  - `src/lib/push.ts`를 façade로 축소하고 `src/lib/push/` 아래에 `types`, `config`, `audience`, `preferences`, `subscriptions`, `payloads`, `logs`, `send`로 분해
  - `src/components/admin/AdminPushManager.tsx`를 orchestration으로 축소하고 `src/components/admin/push-manager/` 아래에 `types`, `constants`, `selectors`, `useAdminPushManager`, `PushComposerSection`, `PushLogsSection` 추가
  - `src/components/push/PushSettingsCard.tsx`를 orchestration으로 축소하고 `src/components/push/push-settings/` 아래에 `device`, `status`, `usePushSettingsController`, `InstallGuideStep`, `PreferenceToggle` 추가
  - `tests/push/wave1-helpers.test.mts` 추가
- Validation Result:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `node --test tests/push/wave1-helpers.test.mts tests/batch4-refactor.test.mts tests/partner-portal.mock.test.mts`
  - `git diff --check`

### OPT-002
- ID: `OPT-002`
- Priority: `P0`
- Category: `maintainability`
- Targets: `src/components/partner/PartnerServiceDetailView.tsx`, `src/components/admin/PartnerChangeRequestQueue.tsx`, `src/components/partner/PartnerChangeRequestForm.tsx`
- Current Problem: partner/admin 양쪽에서 diff 렌더, pending UI, action bar, metadata 구성이 중복되고, 변경 요청 관련 화면 책임이 과도하게 크다.
- Planned Change: diff presentation primitive, metadata section, immediate/approval tabs, contact popup/action bar를 공용 단위로 추출하고 각 화면은 orchestration만 남긴다.
- Validation: `npm run lint`, `npx tsc --noEmit`, `node --test tests/partner-portal.mock.test.mts`
- Status: `done`
- Completed:
  - `src/components/partner-change-request-ui/` 아래에 공용 diff primitive와 diff item builder 추가
  - `src/components/admin/PartnerChangeRequestQueue.tsx`를 orchestration으로 축소하고 `src/components/admin/partner-change-request-queue/ContactPopupButton.tsx` 추가
  - `src/components/partner/PartnerChangeRequestForm.tsx`를 orchestration으로 축소하고 `src/components/partner/partner-change-request-form/` 아래에 `FieldGroup`, `PendingRequestNotice`, `ImmediateChangeForm`, `ApprovalChangeForm` 추가
  - `src/components/partner/PartnerServiceDetailView.tsx`에서 중복 diff 계산/렌더를 공용 모듈로 이동
- Validation Result:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `node --test tests/push/wave1-helpers.test.mts tests/batch4-refactor.test.mts tests/partner-portal.mock.test.mts`
  - `git diff --check`

### OPT-003
- ID: `OPT-003`
- Priority: `P0`
- Category: `maintainability`
- Targets: `src/lib/partner-auth.ts`, `src/app/api/mm/verify-code/route.ts`, `src/app/api/mm/request-code/route.ts`, `src/app/api/mm/reset-password/route.ts`
- Current Problem: auth 도메인에서 request parsing, throttle, Mattermost resolution, session/policy handling, response mapping이 한 파일에 섞여 있다.
- Planned Change: auth helper, request parser, domain command, response mapper로 분리하고 API route는 orchestration만 남긴다.
- Validation: `npm run lint`, `npx tsc --noEmit`, MM auth 관련 핵심 테스트
- Status: `done`
- Completed:
  - `src/lib/partner-auth.ts`를 façade로 유지하고 `src/lib/partner-auth/` 아래에 `types`, `repository`, `mappers`, `supabase`로 분해
  - `src/app/api/mm/_shared/` 아래에 `types`, `parsers`, `throttle`, `responses`, `mattermost`, `request-code`, `verify-code`, `reset-password` 추가
  - `src/app/api/mm/request-code/route.ts`, `src/app/api/mm/verify-code/route.ts`, `src/app/api/mm/reset-password/route.ts`를 `parse -> domain -> response` 구조로 축소
  - `tests/mm-route-helpers.test.mts` 추가
- Validation Result:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `node --test tests/mm-route-helpers.test.mts tests/batch4-refactor.test.mts tests/partner-portal.mock.test.mts`
  - `git diff --check`

### OPT-004
- ID: `OPT-004`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/lib/mock/partner-portal.ts`, `src/components/PartnerImageCarousel.tsx`, `src/components/PartnerCardView.tsx`
- Current Problem: mock/public UI에 큰 단위 파일이 남아 있어 유지보수성과 회귀 범위가 크다.
- Planned Change: mock store/service helpers, carousel interaction helpers, partner card display primitives로 분해한다.
- Validation: `npm run lint`, `npx tsc --noEmit`, 기존 mock portal 테스트
- Status: `done`
- Completed:
  - `src/lib/mock/partner-portal.ts`를 façade로 축소하고 `src/lib/mock/partner-portal/` 아래에 `shared`, `store`, `setup`, `auth`, `dashboard`로 분해
  - `src/components/PartnerImageCarousel.tsx`를 façade로 유지하고 `src/components/partner-image-carousel/` 아래에 `types`, `helpers`, `useCarouselController`, `ThumbStrip`, `LightboxModal`, `CarouselLoadingSkeleton` 추가
  - `src/components/PartnerCardView.tsx`를 façade로 유지하고 `src/components/partner-card-view/` 아래에 `helpers`, `PartnerCardMedia`, `PartnerCardMeta`, `PartnerCardActions`, `PartnerCardLockState` 추가
  - `tests/opt-wave4-helpers.test.mts` 추가
- Validation Result:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `node --test tests/opt-wave4-helpers.test.mts tests/batch4-refactor.test.mts tests/partner-portal.mock.test.mts`
  - `git diff --check`

### OPT-005
- ID: `OPT-005`
- Priority: `P1`
- Category: `performance`
- Targets: admin/client list screens 전반
- Current Problem: 클라이언트 컴포넌트에서 검색 인덱스 생성과 대량 리스트 전처리가 렌더마다 반복되는 구간이 남아 있다.
- Planned Change: selector를 pure module로 이동하고, 검색 인덱스/정렬 전처리를 입력 변화 기준으로 제한하며, 화면별 무거운 `useMemo` 의존성을 줄인다.
- Validation: selector unit test, 렌더 영향 확인, lint/tsc
- Status: `done`
- Completed:
  - `src/components/home-view/selectors.ts`, `src/components/admin/member-manager/selectors.ts`, `src/components/admin/logs/selectors.ts` 추가
  - `HomeView`, `AdminMemberManager`, `AdminLogsManager`의 검색 인덱스/정렬/필터/집계 계산을 pure selector로 이동
  - `tests/opt-wave5-selectors.test.mts` 추가
- Validation Result:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `node --test tests/opt-wave5-selectors.test.mts tests/batch4-refactor.test.mts tests/partner-portal.mock.test.mts`
  - `git diff --check`

### OPT-006
- ID: `OPT-006`
- Priority: `P1`
- Category: `ux`
- Targets: admin/partner/auth form 흐름 전반
- Current Problem: 입력 오류와 네트워크 오류를 inline recovery로 처리하는 기준이 화면마다 완전히 통일되지 않았다.
- Planned Change: field error, form error, inline message, toast 사용 기준을 정리하고 복구 가능한 실패는 입력 유지 + inline message로 통일한다.
- Validation: 주요 create/update/login/reset 흐름 수동 회귀 + 관련 테스트
- Status: `done`
- Completed:
  - `PasswordInput`, `MmUsernameInput`, `PolicyAgreementField`가 ref/invalid 상태를 받도록 보강
  - `SignupForm`, `LoginForm`, `ResetPasswordForm`, `ChangePasswordForm`, `PolicyConsentForm`을 field error + inline form error 구조로 정리
  - `PartnerPasswordResetForm`, `PartnerPasswordChangeForm`, `PartnerSetupForm`을 동일한 복구 기준으로 정리
  - 복구 가능한 실패에서 입력값 유지, 필드 포커스, 필드 단위 에러 표시로 통일
- Validation Result:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `node --test tests/mm-route-helpers.test.mts tests/opt-wave5-selectors.test.mts tests/batch4-refactor.test.mts tests/partner-portal.mock.test.mts`
  - `git diff --check`

### OPT-007
- ID: `OPT-007`
- Priority: `P1`
- Category: `seo`
- Targets: `src/app/sitemap.ts`, `src/app/robots.ts`, canonical/meta 구성 전반
- Current Problem: sitemap/robots는 기본 동작은 되지만 lastmod 안정성, canonical 일관성, 검색엔진 친화적 fallback 점검이 더 필요하다.
- Planned Change: sitemap/robots/canonical 경로를 재점검하고, 동적 실패 시 fail-soft와 안정적인 메타 구성을 강화한다.
- Validation: 정적 검증, production URL 출력 점검, Search Console 재검토 기준 문서화
- Status: `done`
- Completed:
  - `src/lib/seo/index.ts` 추가
  - `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/layout.tsx`, `src/app/(site)/page.tsx`, `src/app/(site)/partners/[id]/page.tsx`, `src/app/rss.xml/route.ts`에서 canonical/site URL 조립을 공용 helper로 통일
  - 동적 partner sitemap entry에서 요청 시점 `new Date()` 기반 `lastModified` 제거
  - `tests/seo-ops-helpers.test.mts`에 SEO helper 검증 추가
- Validation Result:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `node --test tests/seo-ops-helpers.test.mts`
  - `git diff --check`

### OPT-008
- ID: `OPT-008`
- Priority: `P1`
- Category: `ops`
- Targets: cron/manual broadcast/notification 운영 경로
- Current Problem: cron partial failure, 환경 변수 준비 상태, 운영 로그/알림 회복 경로가 문서화와 코드 양쪽에서 더 정리될 여지가 있다.
- Planned Change: 배치 실패 격리, 환경 점검, 운영 로그/알림 가시성을 보강하고 관련 fallback을 표준화한다.
- Validation: cron route 회귀, 운영 로그 확인 기준, lint/tsc
- Status: `done`
- Completed:
  - `src/lib/push/ops.ts` 추가
  - `src/app/api/cron/push-expiring-partners/route.ts`에서 대상 필터링과 partial failure 집계를 공용 helper로 이동
  - `src/app/api/push/admin/broadcast/route.ts`에서 same-origin 검사, 요청 파싱, audit property 생성을 공용 helper로 이동
  - cron/manual broadcast의 JSON shape는 유지하면서 operator-visible failure summary를 통일
  - `tests/seo-ops-helpers.test.mts`에 ops helper 검증 추가
- Validation Result:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `node --test tests/seo-ops-helpers.test.mts tests/push/wave1-helpers.test.mts`
  - `git diff --check`
