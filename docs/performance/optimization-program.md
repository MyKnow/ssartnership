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

### OPT-009
- ID: `OPT-009`
- Priority: `P0`
- Category: `maintainability`
- Targets: `src/app/admin/(protected)/_actions/partner-support.ts`
- Current Problem: 협력사 연결, 계정 생성/재활성화, 초기설정 URL 발급, 미디어 파싱/업로드가 한 파일에 섞여 있어 수정 범위와 장애 범위가 불필요하게 넓다.
- Planned Change: façade는 유지하고 내부를 `setup-link`, `company-provision`, `media`, `shared`, `slug` 모듈로 분리해 책임을 나눈다.
- Validation: `npm run lint`, `npx tsc --noEmit`, `git diff --check`
- Status: `done`
- Completed:
  - `src/app/admin/(protected)/_actions/partner-support.ts`를 façade로 축소
  - `src/app/admin/(protected)/_actions/partner-support/shared.ts`에 계정/회사 정규화와 표시명/로그인 ID helper 이동
  - `src/app/admin/(protected)/_actions/partner-support/setup-link.ts`에 초기설정 URL 발급 로직 이동
  - `src/app/admin/(protected)/_actions/partner-support/company-provision.ts`에 회사/계정/link provision 및 cleanup 로직 이동
  - `src/app/admin/(protected)/_actions/partner-support/media.ts`에 media manifest 파싱과 업로드 로직 이동
  - `src/app/admin/(protected)/_actions/partner-support/slug.ts`에 회사 slug 생성 로직 이동
- Validation Result:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `git diff --check`

### OPT-010
- ID: `OPT-010`
- Priority: `P0`
- Category: `maintainability`
- Targets: `src/app/api/mm/_shared/verify-code.ts`
- Current Problem: MM 인증 완료 경로가 throttle, MM 사용자 해석, 인증코드 검증, 회원 생성/동기화, 실패 응답 매핑을 한 함수에 모두 담고 있어 테스트와 장애 격리가 어렵다.
- Planned Change: façade는 유지하고 내부를 `verify-code-identity`, `verify-code-verification`, `verify-code-member`, `verify-code-failure`로 분리해 `parse -> resolve -> verify -> finalize -> respond` 구조로 줄인다.
- Validation: `npm run lint`, `npx tsc --noEmit`, `node --test tests/mm-route-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/app/api/mm/_shared/verify-code.ts`를 orchestration으로 축소
  - `src/app/api/mm/_shared/verify-code-identity.ts`에 MM 사용자/디렉터리 해석 로직 이동
  - `src/app/api/mm/_shared/verify-code-verification.ts`에 인증 시도/차단/코드 검증/초기화 로직 이동
  - `src/app/api/mm/_shared/verify-code-member.ts`에 회원 생성/동기화/세션 발급/정책 동의 기록 로직 이동
  - `src/app/api/mm/_shared/verify-code-failure.ts`에 실패 응답 및 보안 로그 기록 로직 이동
- Validation Result:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `node --test tests/mm-route-helpers.test.mts`
  - `git diff --check`

### OPT-011
- ID: `OPT-011`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/app/(site)/partners/[id]/page.tsx`
- Current Problem: 공개 제휴 상세 페이지가 카테고리/파트너 조회, 메타 데이터 조립, structured data 생성, 요약 카드 렌더, 연락처 섹션 렌더를 한 파일에 모두 담고 있어 수정 범위가 넓고 데이터 매핑이 반복된다.
- Planned Change: page는 orchestration만 남기고, 데이터 조립은 `_page/page-data.ts`, 렌더는 요약 카드와 연락처 섹션 컴포넌트로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/campus-seo.test.mts tests/seo-ops-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/app/(site)/partners/[id]/_page/page-data.ts` 추가
  - `src/app/(site)/partners/[id]/_page/PartnerDetailSummaryCard.tsx` 추가
  - `src/app/(site)/partners/[id]/_page/PartnerDetailContactSection.tsx` 추가
  - `src/app/(site)/partners/[id]/page.tsx`를 메타/페이지 orchestration 위주로 축소
- Validation Result:
  - `npx eslint 'src/app/(site)/partners/[id]/page.tsx' 'src/app/(site)/partners/[id]/_page/page-data.ts' 'src/app/(site)/partners/[id]/_page/PartnerDetailSummaryCard.tsx' 'src/app/(site)/partners/[id]/_page/PartnerDetailContactSection.tsx'`
  - `npx tsc --noEmit`
  - `node --test tests/campus-seo.test.mts tests/seo-ops-helpers.test.mts`
  - `git diff --check`

### OPT-012
- ID: `OPT-012`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/lib/mm-directory.ts`
- Current Problem: MM 디렉터리 모듈이 외부 API 수집, snapshot merge, DB 조회/업서트/정리까지 한 파일에 모두 담고 있어 회귀 범위가 크고 테스트 경계가 불분명하다.
- Planned Change: façade는 유지하고 내부를 `shared`, `collector`, `repository`로 분리해 수집/병합/저장을 나눈다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `git diff --check`
- Status: `done`
- Completed:
  - `src/lib/mm-directory.ts`를 façade로 축소
  - `src/lib/mm-directory/shared.ts`에 타입, 에러, snapshot merge helper 이동
  - `src/lib/mm-directory/collector.ts`에 selectable year 수집 및 배치 merge 로직 이동
  - `src/lib/mm-directory/repository.ts`에 디렉터리 조회, upsert, 전체 sync 로직 이동
- Validation Result:
  - `npx eslint src/lib/mm-directory.ts src/lib/mm-directory/shared.ts src/lib/mm-directory/collector.ts src/lib/mm-directory/repository.ts`
  - `npx tsc --noEmit`
  - `git diff --check`

### OPT-013
- ID: `OPT-013`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/components/push/push-settings/usePushSettingsController.ts`
- Current Problem: 푸시 설정 훅이 브라우저 capability 판단, 초기 기기 상태 로드, API transport, UI orchestration을 한 파일에 모두 들고 있어 클라이언트 제어 흐름이 과도하게 뭉쳐 있다.
- Planned Change: device state와 API transport를 별도 모듈로 분리하고, 컨트롤러 훅은 UI orchestration만 남긴다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `git diff --check`
- Status: `done`

### OPT-020
- ID: `OPT-020`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/components/auth/SignupForm.tsx`
- Current Problem: 회원가입 폼이 step 상태, field validation, request/verify fetch, 포커스 제어, 안내 섹션 렌더를 한 파일에 모두 담고 있어 수정 범위가 넓고 helper 테스트 경계가 없다.
- Planned Change: façade는 유지하고 내부를 state controller, 순수 validation/error mapping helper, identity/policy/guide/action section으로 분리해 테스트 가능한 단위로 축소한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/signup-form-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/components/auth/SignupForm.tsx`를 façade로 축소
  - `src/components/auth/signup-form/` 아래에 `types`, `helpers`, `useSignupFormController`, `SignupGuideCard`, `SignupIdentityFields`, `SignupPoliciesSection`, `SignupVerificationField`, `SignupActions`, `SignupFormView` 추가
  - request/verify 단계별 validation과 서버 응답 에러 매핑을 순수 helper로 이동
  - `tests/signup-form-helpers.test.mts` 추가
- Validation Result:
  - `npx eslint src/components/auth/SignupForm.tsx src/components/auth/signup-form/types.ts src/components/auth/signup-form/helpers.ts src/components/auth/signup-form/useSignupFormController.ts src/components/auth/signup-form/SignupGuideCard.tsx src/components/auth/signup-form/SignupIdentityFields.tsx src/components/auth/signup-form/SignupPoliciesSection.tsx src/components/auth/signup-form/SignupVerificationField.tsx src/components/auth/signup-form/SignupActions.tsx src/components/auth/signup-form/SignupFormView.tsx`
  - `npx tsc --noEmit`
  - `node --test tests/signup-form-helpers.test.mts`
  - `git diff --check`

### OPT-021
- ID: `OPT-021`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/components/partner/PartnerServiceDetailView.tsx`
- Current Problem: 파트너 상세 뷰가 승인 대기 섹션, 요약 카드, 예약/문의 카드, 링크/스타일 계산을 한 파일에 모두 담고 있어 읽기와 수정 단위가 너무 크다.
- Planned Change: façade는 유지하고 내부를 view props, visual helper, pending section, summary section, contact section, orchestration view로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/partner-service-detail-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/components/partner/PartnerServiceDetailView.tsx`를 façade로 축소
  - `src/components/partner/partner-service-detail-view/` 아래에 `types`, `helpers`, `SectionTitle`, `PartnerPendingRequestSection`, `PartnerServiceSummaryCard`, `PartnerServiceContacts`, `PartnerServiceDetailViewContent` 추가
  - 카테고리 색상/예약 문의 상태/지도 링크 계산을 pure helper로 이동
  - `tests/partner-service-detail-helpers.test.mts` 추가
- Validation Result:
  - `npx eslint src/components/partner/PartnerServiceDetailView.tsx src/components/partner/partner-service-detail-view/types.ts src/components/partner/partner-service-detail-view/helpers.ts src/components/partner/partner-service-detail-view/SectionTitle.tsx src/components/partner/partner-service-detail-view/PartnerPendingRequestSection.tsx src/components/partner/partner-service-detail-view/PartnerServiceSummaryCard.tsx src/components/partner/partner-service-detail-view/PartnerServiceContacts.tsx src/components/partner/partner-service-detail-view/PartnerServiceDetailViewContent.tsx`
  - `npx tsc --noEmit`
  - `node --test tests/partner-service-detail-helpers.test.mts`
  - `git diff --check`

### OPT-022
- ID: `OPT-022`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/components/admin/AdminPartnerAccountManager.tsx`
- Current Problem: 협력사 계정 관리 화면이 헤더 상태 badge, 초기설정 URL 액션, 계정 편집 폼, 협력사 연결 리스트를 한 파일에 모두 담고 있어 읽기와 수정 단위가 너무 크다.
- Planned Change: façade는 유지하고 내부를 타입, helper, header, account form, company links, account card, content orchestration으로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/partner-account-manager-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/components/admin/AdminPartnerAccountManager.tsx`를 façade로 축소
  - `src/components/admin/partner-account-manager/` 아래에 `types`, `helpers`, `FieldGroup`, `PartnerAccountHeader`, `PartnerAccountForm`, `PartnerAccountLinks`, `PartnerAccountCard`, `AdminPartnerAccountManagerContent` 추가
  - 초기설정 URL 생성과 datetime 포맷을 pure helper로 이동
  - `tests/partner-account-manager-helpers.test.mts` 추가
- Validation Result:
  - `npx eslint src/components/admin/AdminPartnerAccountManager.tsx src/components/admin/partner-account-manager/types.ts src/components/admin/partner-account-manager/helpers.ts src/components/admin/partner-account-manager/FieldGroup.tsx src/components/admin/partner-account-manager/PartnerAccountHeader.tsx src/components/admin/partner-account-manager/PartnerAccountForm.tsx src/components/admin/partner-account-manager/PartnerAccountLinks.tsx src/components/admin/partner-account-manager/PartnerAccountCard.tsx src/components/admin/partner-account-manager/AdminPartnerAccountManagerContent.tsx tests/partner-account-manager-helpers.test.mts`
  - `npx tsc --noEmit`
  - `node --test tests/partner-account-manager-helpers.test.mts`
  - `git diff --check`

### OPT-023
- ID: `OPT-023`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/components/admin/AdminLogsManager.tsx`
- Current Problem: 관리자 로그 화면이 range fetch, export, explorer filter state, dashboard selector binding을 한 컴포넌트에서 모두 관리하고 있어 상태 변경과 렌더링 책임이 과도하게 결합돼 있다.
- Planned Change: façade는 유지하고 내부를 `useAdminLogsManager` controller와 `AdminLogsManagerContent` 렌더 orchestration으로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `git diff --check`
- Status: `done`
- Completed:
  - `src/components/admin/AdminLogsManager.tsx`를 façade로 축소
  - `src/components/admin/logs-manager/useAdminLogsManager.ts` 추가
  - `src/components/admin/logs-manager/AdminLogsManagerContent.tsx` 추가
- Validation Result:
  - `npx eslint src/components/admin/AdminLogsManager.tsx src/components/admin/logs-manager/useAdminLogsManager.ts src/components/admin/logs-manager/AdminLogsManagerContent.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`

### OPT-024
- ID: `OPT-024`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/lib/mattermost.ts`
- Current Problem: Mattermost API 모듈이 env/config, HTTP client, 인증, 사용자 조회, 채널 탐색, selectable member 해석을 한 파일에 모두 담고 있어 회귀 범위가 크다.
- Planned Change: façade는 유지하고 내부를 `types`, `config`, `client`, `auth`, `users`, `channels`, `resolver`로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/mattermost-mm-profile-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/lib/mattermost.ts`를 façade로 축소
  - `src/lib/mattermost/` 아래에 `types`, `config`, `client`, `auth`, `users`, `channels`, `resolver` 추가
  - Mattermost config 기본값 검증을 위해 helper 테스트 추가
- Validation Result:
  - `npx eslint src/lib/mattermost.ts src/lib/mattermost/types.ts src/lib/mattermost/config.ts src/lib/mattermost/client.ts src/lib/mattermost/auth.ts src/lib/mattermost/users.ts src/lib/mattermost/channels.ts src/lib/mattermost/resolver.ts tests/mattermost-mm-profile-helpers.test.mts`
  - `npx tsc --noEmit`
  - `node --test tests/mattermost-mm-profile-helpers.test.mts`
  - `git diff --check`

### OPT-025
- ID: `OPT-025`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/lib/mm-profile.ts`
- Current Problem: SSAFY 프로필 파서가 상수, 문자열 정규화, 소속 해석, parser 조립을 한 파일에 모두 담고 있어 읽기와 테스트 단위가 너무 크다.
- Planned Change: façade는 유지하고 내부를 `types`, `constants`, `text`, `affiliation`, `parser`로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/mattermost-mm-profile-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/lib/mm-profile.ts`를 façade로 축소
  - `src/lib/mm-profile/` 아래에 `types`, `constants`, `text`, `affiliation`, `parser` 추가
  - 프로필 parser의 캠퍼스/운영진 해석 검증을 helper 테스트에 추가
- Validation Result:
  - `npx eslint src/lib/mm-profile.ts src/lib/mm-profile/types.ts src/lib/mm-profile/constants.ts src/lib/mm-profile/text.ts src/lib/mm-profile/affiliation.ts src/lib/mm-profile/parser.ts tests/mattermost-mm-profile-helpers.test.mts`
  - `npx tsc --noEmit`
  - `node --test tests/mattermost-mm-profile-helpers.test.mts`
  - `git diff --check`

### OPT-026
- ID: `OPT-026`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/app/admin/(protected)/_actions/partner-actions.ts`
- Current Problem: 관리자 파트너 액션 파일이 생성, 수정, 승인/거절, 삭제 흐름과 push/audit/revalidate까지 한 파일에서 관리해 수정 범위가 넓다.
- Planned Change: façade는 유지하고 내부를 `create`, `update`, `review`, `delete` 모듈로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `git diff --check`
- Status: `done`
- Completed:
  - `src/app/admin/(protected)/_actions/partner-actions.ts`를 façade로 축소
  - `src/app/admin/(protected)/_actions/partner-actions/create.ts`, `update.ts`, `review.ts`, `delete.ts` 추가
- Validation Result:
  - `npx eslint 'src/app/admin/(protected)/_actions/partner-actions.ts' 'src/app/admin/(protected)/_actions/partner-actions/create.ts' 'src/app/admin/(protected)/_actions/partner-actions/update.ts' 'src/app/admin/(protected)/_actions/partner-actions/review.ts' 'src/app/admin/(protected)/_actions/partner-actions/delete.ts'`
  - `npx tsc --noEmit`
  - `git diff --check`

### OPT-027
- ID: `OPT-027`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/lib/partner-change-requests/commands.ts`
- Current Problem: 파트너 변경요청 명령 모듈이 생성, 취소, 승인, 거절 로직과 media cleanup을 한 파일에 모두 담고 있어 책임 구분이 약하다.
- Planned Change: façade는 유지하고 내부를 `commands/create`, `commands/cancel`, `commands/review`로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/partner-portal.mock.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/lib/partner-change-requests/commands.ts`를 façade로 축소
  - `src/lib/partner-change-requests/commands/create.ts`, `cancel.ts`, `review.ts` 추가
- Validation Result:
  - `npx eslint src/lib/partner-change-requests/commands.ts src/lib/partner-change-requests/commands/create.ts src/lib/partner-change-requests/commands/cancel.ts src/lib/partner-change-requests/commands/review.ts`
  - `npx tsc --noEmit`
  - `node --test tests/partner-portal.mock.test.mts`
  - `git diff --check`

### OPT-028
- ID: `OPT-028`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/lib/image-proxy.ts`
- Current Problem: 이미지 프록시가 IP 필터링, DNS 해석, HTTP fetch, content validation을 한 파일에 모두 담고 있어 보안 로직과 네트워크 로직의 경계가 흐리다.
- Planned Change: façade는 유지하고 내부를 `shared`, `ip`, `fetch`로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/image-proxy-token-chip-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/lib/image-proxy.ts`를 façade로 축소
  - `src/lib/image-proxy/shared.ts`, `ip.ts`, `fetch.ts` 추가
  - public IP 판별 helper 검증 추가
- Validation Result:
  - `npx eslint src/lib/image-proxy.ts src/lib/image-proxy/shared.ts src/lib/image-proxy/ip.ts src/lib/image-proxy/fetch.ts tests/image-proxy-token-chip-helpers.test.mts`
  - `npx tsc --noEmit`
  - `node --test tests/image-proxy-token-chip-helpers.test.mts`
  - `git diff --check`

### OPT-029
- ID: `OPT-029`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/components/admin/TokenChipField.tsx`
- Current Problem: 토큰 칩 필드가 helper, 편집 상태, 리스트 렌더, 입력 composer를 한 파일에 모두 담고 있어 재사용성과 테스트성이 낮다.
- Planned Change: façade는 유지하고 내부를 `helpers`, `useTokenChipField`, `TokenChipItems`, `TokenChipComposer`, `TokenChipFieldContent`로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/image-proxy-token-chip-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/components/admin/TokenChipField.tsx`를 façade로 축소
  - `src/components/admin/token-chip-field/` 아래에 `helpers`, `useTokenChipField`, `TokenChipItems`, `TokenChipComposer`, `TokenChipFieldContent` 추가
  - dedupe/move helper 검증 추가
- Validation Result:
  - `npx eslint src/components/admin/TokenChipField.tsx src/components/admin/token-chip-field/helpers.ts src/components/admin/token-chip-field/useTokenChipField.ts src/components/admin/token-chip-field/TokenChipItems.tsx src/components/admin/token-chip-field/TokenChipComposer.tsx src/components/admin/token-chip-field/TokenChipFieldContent.tsx tests/image-proxy-token-chip-helpers.test.mts`
  - `npx tsc --noEmit`
  - `node --test tests/image-proxy-token-chip-helpers.test.mts`
  - `git diff --check`

### OPT-030
- ID: `OPT-030`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/app/partner/setup/[token]/page.tsx`
- Current Problem: 파트너 초기 설정 페이지가 메타데이터, 히어로, 회사/서비스 정보, 폼 영역을 한 페이지 파일에 모두 담고 있어 page orchestration과 섹션 렌더가 결합돼 있다.
- Planned Change: page는 metadata/context 조회만 남기고 내부를 hero, company section, page content, shared types로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `git diff --check`
- Status: `done`
- Completed:
  - `src/app/partner/setup/[token]/page.tsx`를 orchestration으로 축소
  - `src/app/partner/setup/[token]/_page/PartnerSetupHero.tsx`, `PartnerSetupCompanySection.tsx`, `PartnerSetupPageContent.tsx`, `types.ts` 추가
- Validation Result:
  - `npx eslint 'src/app/partner/setup/[token]/page.tsx' 'src/app/partner/setup/[token]/_page/PartnerSetupHero.tsx' 'src/app/partner/setup/[token]/_page/PartnerSetupCompanySection.tsx' 'src/app/partner/setup/[token]/_page/PartnerSetupPageContent.tsx' 'src/app/partner/setup/[token]/_page/types.ts'`
  - `npx tsc --noEmit`
  - `git diff --check`
- Completed:
  - `src/components/push/push-settings/api.ts` 추가
  - `src/components/push/push-settings/usePushDeviceState.ts` 추가
  - `src/components/push/push-settings/usePushSettingsController.ts`를 orchestration 위주로 축소
- Validation Result:
  - `npx eslint src/components/push/push-settings/api.ts src/components/push/push-settings/usePushDeviceState.ts src/components/push/push-settings/usePushSettingsController.ts src/components/push/PushSettingsCard.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`

### OPT-014
- ID: `OPT-014`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/app/partner/login/page.tsx`
- Current Problem: 파트너 로그인 페이지가 search param 해석, 에러 메시지 매핑, 서버 액션, rate limit 처리, 세션 발급, redirect 규칙, UI 렌더를 한 파일에 모두 담고 있어 변경 범위가 넓다.
- Planned Change: 페이지는 렌더와 search param 해석만 남기고, 서버 액션과 redirect helper를 `_actions`로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `git diff --check`
- Status: `done`
- Completed:
  - `src/app/partner/login/_actions/shared.ts` 추가
  - `src/app/partner/login/_actions/login.ts` 추가
  - `src/app/partner/login/page.tsx`를 UI orchestration 위주로 축소
- Validation Result:
  - `npx eslint 'src/app/partner/login/page.tsx' 'src/app/partner/login/_actions/shared.ts' 'src/app/partner/login/_actions/login.ts'`
  - `npx tsc --noEmit`
  - `git diff --check`

### OPT-015
- ID: `OPT-015`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/app/api/mm/_shared/request-code.ts`
- Current Problem: MM 인증코드 발급 경로가 사용자 해석, 실패 응답, 재발송 제한, 기존 회원 검사, 인증코드 저장, DM 발송을 한 파일에 모두 담고 있어 테스트와 장애 격리가 어렵다.
- Planned Change: façade는 유지하고 내부를 `request-code-identity`, `request-code-delivery`, `request-code-failure`로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/mm-route-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/app/api/mm/_shared/request-code-identity.ts` 추가
  - `src/app/api/mm/_shared/request-code-delivery.ts` 추가
  - `src/app/api/mm/_shared/request-code-failure.ts` 추가
  - `src/app/api/mm/_shared/request-code.ts`를 orchestration 위주로 축소
- Validation Result:
  - `npx eslint src/app/api/mm/_shared/request-code.ts src/app/api/mm/_shared/request-code-failure.ts src/app/api/mm/_shared/request-code-identity.ts src/app/api/mm/_shared/request-code-delivery.ts`
  - `npx tsc --noEmit`
  - `node --test tests/mm-route-helpers.test.mts`
  - `git diff --check`

### OPT-016
- ID: `OPT-016`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/app/api/mm/_shared/reset-password.ts`
- Current Problem: MM 비밀번호 재설정 경로가 사용자 해석, 실패 응답, 운영진 발송자 선택, 회원 동기화, 임시 비밀번호 발급/DM 발송, 시도 제한 업데이트를 한 파일에 모두 담고 있다.
- Planned Change: façade는 유지하고 내부를 `reset-password-identity`, `reset-password-execution`, `reset-password-failure`로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `node --test tests/mm-route-helpers.test.mts`, `git diff --check`
- Status: `done`
- Completed:
  - `src/app/api/mm/_shared/reset-password-identity.ts` 추가
  - `src/app/api/mm/_shared/reset-password-execution.ts` 추가
  - `src/app/api/mm/_shared/reset-password-failure.ts` 추가
  - `src/app/api/mm/_shared/reset-password.ts`를 orchestration 위주로 축소
- Validation Result:
  - `npx eslint src/app/api/mm/_shared/reset-password.ts src/app/api/mm/_shared/reset-password-failure.ts src/app/api/mm/_shared/reset-password-identity.ts src/app/api/mm/_shared/reset-password-execution.ts`
  - `npx tsc --noEmit`
  - `node --test tests/mm-route-helpers.test.mts`
  - `git diff --check`

### OPT-017
- ID: `OPT-017`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/lib/partner-auth/supabase.ts`
- Current Problem: 파트너 인증 Supabase 구현이 회사 조회, 계정 조회, 로그인, 비밀번호 재설정, 초기 설정, 비밀번호 변경까지 한 파일에 모두 담고 있어 command 책임이 섞여 있다.
- Planned Change: façade는 유지하고 내부를 `company`, `accounts`, `login`, `reset`, `setup`, `password` 모듈로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `git diff --check`
- Status: `done`
- Completed:
  - `src/lib/partner-auth/company.ts` 추가
  - `src/lib/partner-auth/accounts.ts` 추가
  - `src/lib/partner-auth/login.ts` 추가
  - `src/lib/partner-auth/reset.ts` 추가
  - `src/lib/partner-auth/setup.ts` 추가
  - `src/lib/partner-auth/password.ts` 추가
  - `src/lib/partner-auth/supabase.ts`를 façade로 축소
- Validation Result:
  - `npx eslint src/lib/partner-auth/supabase.ts src/lib/partner-auth/company.ts src/lib/partner-auth/accounts.ts src/lib/partner-auth/login.ts src/lib/partner-auth/reset.ts src/lib/partner-auth/setup.ts src/lib/partner-auth/password.ts`
  - `npx tsc --noEmit`
  - `git diff --check`

### OPT-018
- ID: `OPT-018`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/lib/member-manual-add.ts`
- Current Problem: 수동 회원 추가 모듈이 입력 파싱, MM 사용자 해석, 기존 회원 조회, payload 생성, 임시 비밀번호 발송, 실패 롤백을 한 파일에 모두 담고 있어 회귀 범위가 넓다.
- Planned Change: façade는 유지하고 내부를 `shared`, `lookup`, `rollback`, `provision`으로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `git diff --check`
- Status: `done`
- Completed:
  - `src/lib/member-manual-add/shared.ts` 추가
  - `src/lib/member-manual-add/lookup.ts` 추가
  - `src/lib/member-manual-add/rollback.ts` 추가
  - `src/lib/member-manual-add/provision.ts` 추가
  - `src/lib/member-manual-add.ts`를 façade로 축소
- Validation Result:
  - `npx eslint src/lib/member-manual-add.ts src/lib/member-manual-add/shared.ts src/lib/member-manual-add/lookup.ts src/lib/member-manual-add/rollback.ts src/lib/member-manual-add/provision.ts`
  - `npx tsc --noEmit`
  - `git diff --check`

### OPT-019
- ID: `OPT-019`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/lib/mm-member-sync.ts`
- Current Problem: MM 회원 동기화 모듈이 snapshot 생성, sender session 캐시, diff 계산, 단건/배치 sync를 한 파일에 모두 담고 있어 책임이 과도하게 크다.
- Planned Change: façade는 유지하고 내부를 `shared`, `snapshot`, `sync`로 분리한다.
- Validation: `npx eslint` 대상 파일, `npx tsc --noEmit`, `git diff --check`
- Status: `done`
- Completed:
  - `src/lib/mm-member-sync/shared.ts` 추가
  - `src/lib/mm-member-sync/snapshot.ts` 추가
  - `src/lib/mm-member-sync/sync.ts` 추가
  - `src/lib/mm-member-sync.ts`를 façade로 축소
- Validation Result:
  - `npx eslint src/lib/mm-member-sync.ts src/lib/mm-member-sync/shared.ts src/lib/mm-member-sync/snapshot.ts src/lib/mm-member-sync/sync.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
