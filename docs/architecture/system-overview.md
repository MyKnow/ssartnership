---
title: 05. 시스템 아키텍처
type: architecture
status: current
authority: descriptive
---

# 05. 시스템 아키텍처

작성 기준일: 2026-07-09. 저장소 배치·캐시·외부 서비스 절은 2026-10-05 `dev` 기준으로 다시 대조했다.

## 계층 구조

```text
Browser
  -> Next.js App Router page/layout/client component
  -> Server Component / Server Action / Route Handler
  -> src/lib domain service/helper/repository interface
  -> mock repository or Supabase repository
  -> Supabase PostgreSQL / Storage
  -> external services: Mattermost, SMTP/Resend, Web Push, NTS business status, Apple Wallet/APNs
```

## Next.js boundary

- `src/app/layout.tsx`는 전역 metadata, PWA manifest, theme, toast, analytics를 담당한다.
- route group `(site)`는 공개 사이트이지만 로그인 세션의 정책 동의/비밀번호 변경 상태를 강제한다.
- `auth` route group은 회원 인증과 정책/비밀번호 회복 화면을 분리한다.
- `admin/(protected)`는 layout에서 page access를 요구하고, 세부 server action/API는 permission 단위로 다시 검사한다.
- `partner` layout은 partner session과 회사 summary를 주입해 포털 shell을 구성한다.
- server action은 관리자/협력사 form submit처럼 route handler보다 페이지 문맥이 강한 변경 작업에 사용된다.
- route handler는 API, cron, push, upload sign, image proxy, export/download처럼 HTTP contract가 명확한 작업에 사용된다.

## Repository pattern

저장소는 두 위치에 둔다([리팩토링 기본 결정 D4](../plans/active/refactor-program-2026-10.md#기본-결정)). 여러 도메인이 공유하는 엔티티는 `src/lib/repositories`, 한 도메인 전용 테이블은 도메인 폴더의 `repository.ts`·`repository.supabase.ts`·`repository.mock.ts`에 둔다.

`src/lib/repositories/index.ts`는 환경에 따라 아래 6개 저장소의 mock 또는 Supabase 구현을 선택한다.

| Interface | Mock 구현 | Supabase 구현 | 역할 |
| --- | --- | --- | --- |
| `PartnerRepository` | `mock/partner-repository.mock.ts` | `supabase/partner-repository.supabase.ts` | category/partner 목록과 상세 |
| `NotificationRepository` | `mock/notification-repository.mock.ts` | `supabase/notification-repository.supabase.ts` | 회원 알림 생성/조회/읽음/삭제 |
| `PartnerFavoriteRepository` | `mock/partner-favorite-repository.mock.ts` | `supabase/partner-favorite-repository.supabase.ts` | 즐겨찾기 count/member state |
| `PartnerReviewRepository` | `mock/partner-review-repository.mock.ts` | `supabase/partner-review-repository.supabase.ts` | 리뷰 CRUD/reaction/moderation |
| `AdPackageRepository` | `mock/ad-package-repository.mock.ts` | `supabase/ad-package-repository.supabase.ts` | 광고 캠페인/쿠폰/사용 |
| `PartnerBenefitUsageRepository` | `mock/partner-benefit-usage-repository.mock.ts` | `supabase/partner-benefit-usage-repository.supabase.ts` | 혜택 사용 확인·이력 |

같은 폴더에 있지만 index를 거치지 않는 저장소도 있다. Apple Wallet pass(`wallet-pass.ts`가 선택), 회원 이메일 인증·복구(`member-email-verification-service.ts`와 복구 route가 직접 생성)다.

도메인 폴더 저장소:

| 위치 | 구성 | 역할 |
| --- | --- | --- |
| `src/lib/project-showcase/` | `repository.ts`, `repository.supabase.ts`, `repository.mock.ts` | 쇼케이스 이벤트·출품·체험·추첨·정산·파기 |
| `src/lib/image-upload/` | `repository.ts`, `repository.supabase.ts`, `repository.server.ts`(미설정 시 unavailable) | 업로드 세션·quota |
| `src/lib/partner-auth/`, `src/lib/partner-change-requests/`, `src/lib/mattermost-senders/`, `src/lib/mm-directory/`, `src/lib/mm-signup-approval/`, `src/lib/notification-templates/` | 함수형 `repository.ts`(또는 `repository.server.ts`) | Supabase 전용 도메인 접근 |

이 밖의 파일이 직접 `.from("<table>")`을 호출하는 경계 위반은 늘리지 않는다. 기준값과 측정 명령은 [기술 부채 원장](../plans/tech-debt.md#증가-금지-기준)에 있다.

전환 규칙:

- `NEXT_PUBLIC_DATA_SOURCE=mock`이면 mock 구현을 사용한다.
- 명시적 `mock`만 mock 구현을 선택한다. 잘못된 source나 필요한 자격 정보 누락은 `unavailable`로 처리하며 mock으로 조용히 fallback하지 않는다. 공개 읽기와 관리자 쓰기의 자격 조건은 다르다. [선택 구현](../../src/lib/runtime-data-access.ts)과 [회귀 테스트](../../tests/runtime-data-access.test.mts)가 근거다.
- `NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE`는 partner portal mock 여부만 별도로 override한다.
- repository method는 raw DB row가 아니라 domain model을 반환한다.
- Supabase row-to-domain mapping은 Supabase repository 근처에 둔다.

## Mock 모드 지원 범위

mock 데이터 모드는 기본 E2E(`playwright.config.ts`), Storybook, `npm run bootstrap`이 만드는 로컬 profile을 위해 유지한다([리팩토링 기본 결정 D6](../plans/active/refactor-program-2026-10.md#기본-결정)). 모든 모듈에 mock 경로를 두는 것이 목표가 아니다.

| 범위 | 지원 방식 |
| --- | --- |
| 공개 카탈로그·리뷰·즐겨찾기·회원 알림·쿠폰·혜택 사용 | `src/lib/repositories/index.ts`의 6개 mock 저장소 |
| 쇼케이스 | `src/lib/project-showcase/repository.mock.ts` |
| 협력사 포털 | `NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE=mock`과 `src/lib/mock/partner-portal*` |
| 회원 로그인 | `MOCK_MEMBER_AUTH=1`(mock profile 전용) |
| Storybook·화면 상태 | `src/lib/mock/scenarios/*` 시나리오 레지스트리 |
| E2E 쓰기 | `E2E_MOCK_MUTATIONS=1`일 때 허용된 mock 쓰기와 `/api/e2e/mock/reset` |

이 밖에서 Supabase를 직접 조회하는 모듈은 mock 모드 동작을 보장하지 않는다. E2E·Storybook이 렌더하는 경로는 직접 조회 대신 위 저장소나 시나리오 adapter를 거쳐야 한다(CI에는 Supabase 비밀이 없다). 새 mock 쓰기 경로는 E2E나 Storybook이 실제로 필요할 때만 추가한다. 자체 호스팅 real 모드 실행 검증(`deploy/self-host/runtime-env.mjs`)은 두 data source가 `supabase`가 아니거나 `MOCK_MEMBER_AUTH`가 켜져 있으면 거절한다.

## Supabase access

- 서버 코드는 `getSupabaseAdminClient()`를 통해 service role 기반 query를 수행한다.
- service role key는 서버 전용 환경 변수이며 public bundle에 노출하지 않는다.
- public data 조회도 서버에서 domain model로 변환한 뒤 UI에 전달한다.
- 모든 주요 테이블은 RLS가 enable되어 있다.
- storage는 partner media, review media, promotion slides, avatar/image proxy 등에서 사용된다.

## Session/auth boundary

| Session | Cookie | Secret | TTL | 주요 payload |
| --- | --- | --- | --- | --- |
| 회원 | `user_session` | `USER_SESSION_SECRET` | 7일 | userId, authSessionVersion, authenticationMethod, issuedAt, expiresAt, mustChangePassword, policy consent snapshot, authenticatedAt(선택) |
| 관리자 | `admin_session` | `ADMIN_SESSION_SECRET` | admin security config | adminId, loginId, permissionVersion |
| 협력사 | `partner_session` | `PARTNER_SESSION_SECRET` | 7일 | accountId, loginId, displayName, companyIds, authSessionVersion, mustChangePassword |

공통 원칙:

- 모두 HMAC signed token을 httpOnly, sameSite=lax, production secure cookie로 저장한다.
- 토큰 파서는 `src/lib/session-tokens.ts`, 비밀값 레지스트리와 길이 정책은 `src/lib/session-secrets.ts`, 쿠키 이름·기본 속성은 `src/lib/session-cookies.ts` 하나만 사용한다. `src/proxy.ts`도 같은 파서와 상수를 쓰므로 프록시 리디렉션과 서버 인가 판정이 갈라지지 않는다.
- 토큰 wire 포맷(`<json>.<hex hmac>`)과 필드 이름은 고정한다. 바꾸면 배포만으로 전원 로그아웃된다. `tests/session-token-parity.test.mts`의 golden token이 이를 고정한다.
- 운영 필수 전용 비밀값(협력사 세션, QR, 식별자 예약, 이메일 인증 HMAC)은 `USER_SESSION_SECRET`으로 fallback하지 않는다. 남은 fallback(운영 선택값인 MM 비밀번호 재설정 완료 토큰·수동 가입 설정 토큰)은 레지스트리 주석과 `tests/session-secrets.test.mts`가 고정한다.
- token signature, raw secret, password 원문은 로그에 남기지 않는다.
- 관리자 session은 account active, mustChangePassword, permissionVersion mismatch 시 무효 처리되고, 자신을 발급한 회원 session이 무효가 되면 함께 무효 처리된다.
- 회원 로그아웃(`/api/mm/logout`)은 `members.auth_session_version`을 올려 그 계정의 모든 기기 session을 끝낸다.
- 회원 쓰기 API는 `requireMemberApiSession()`으로 미로그인(401)과 비밀번호 변경 필요(403)를 함께 거부한다.
- 민감 작업(회원 탈퇴, 로그인·복구 이메일 바인딩, `/admin/session` 관리자 승격)은 최근 인증을 요구한다. `authenticatedAt`이 10분 이내이거나 현재 비밀번호를 확인해야 하며, 비밀번호가 없는 회원과 관리자 승격은 다시 로그인해야 한다. 규칙은 `src/lib/member-recent-auth.ts` 하나를 화면과 API가 함께 쓴다. `authenticatedAt`은 자격 확인 흐름(`freshAuthentication`)에서만 갱신되고 동의 갱신 같은 재발급은 이전 값을 유지한다.
- 로그인·복구 이메일이 이전에 인증한 주소와 다른 주소로 바뀌면 응답 뒤 이전 주소로 변경 알림(`email.member_email_changed`, 새 주소는 일부 가림)을 보낸다. 발송 실패는 바인딩 결과를 바꾸지 않고 `member_email_verification`/`member_email_recovery` 보안 로그(`change_notice` 단계)로 남긴다.
- 협력사 session은 companyIds가 비어 있거나 비정상 값이면 무효 처리된다.

## Domain service/helper 배치

| 도메인 | 주요 파일 |
| --- | --- |
| 인증/세션 | `user-auth.ts`, `auth.ts`, `partner-session.ts`, `partner-auth/*`, `request-guards.ts` |
| Mattermost 직접 연동 | `mattermost/client.ts`, `mattermost-senders/*`, `mm-directory/*`, `mm-member-sync/*`, `mattermost-code-verification.ts` |
| 제휴 | `partner-visibility.ts`, `partner-benefit-visibility.ts`, `partner-audience.ts`, `partner-utils.ts`, `home-partner-*` |
| 협력사 포털 | `partner-auth/portal*.ts`(경로·회사 범위·레이아웃·지표 접근), `partner-change-requests/*`, `partner-dashboard*`, `partner-plan-*`, `partner-billing*` |
| 리뷰 | `partner-reviews.ts`, `review-validation.ts`, `review-media*.ts`, review repository |
| 알림/Push | `notifications/shared.ts`, `notification-preferences.ts`, `push/*`, `admin-notification-*`, `partner-notifications*` |
| 로그/메트릭 | `activity-logs.ts`, `log-insights/*`, `partner-metric-*`, `product-events.ts` |
| SEO/RSS | `seo/*`, `rss/*`, `site.ts` |
| UI helpers | `cn.ts`, `validation.ts`, `auth-form-validation.ts`, `browser-password.ts`, `return-to.ts` |

`src/lib`의 평면 파일은 접두사가 도메인을 나타낸다. 디렉터리로 옮기는 순수 재배치는 [보류](../plans/tech-debt.md#보류-대규모-재배치타입-생성공용-프레임워크)했으므로 파일을 찾을 때 접두사로 검색한다.

| 접두사 | 도메인 |
| --- | --- |
| `partner-*` | 제휴처 공개 표시, 협력사 포털·플랜·결제·지표 |
| `admin-*` | 관리자 권한·보안·대시보드·알림 운영 |
| `member-*` | 회원 계정·인증·프로필·가져오기 |
| `graduate-*` | 수료생 인증·파일 |
| `mm-*`, `mattermost-*` | Mattermost 직접 연동·디렉터리·Sender |
| `product-*`, `partner-metric-*`, `log-insights/` | 제품 이벤트·지표 |
| `image-*`, `image-upload/`, `image-proxy/` | 이미지 업로드·프록시 |

## Caching and revalidation

- `(site)` layout은 `dynamic = "force-dynamic"`으로 세션 상태를 매 요청 반영한다. 하위 공개 페이지는 효과가 없는 page 단위 `revalidate`·`generateStaticParams`를 선언하지 않고, 공개 데이터 캐시는 아래 `unstable_cache` 계층이 담당한다.
- 관리자 Server Action의 partners/categories 무효화 헬퍼(`_actions/shared-helpers.ts`)는 `updateTag`로 즉시 만료한다. Route Handler·cron은 `updateTag`를 쓸 수 없으므로 `revalidateTag(tag, "max")`를 유지한다.
- `revalidatePath(pattern, "page" | "layout")`는 route group을 포함한 파일 경로(`/(site)/events/[slug]`)로 매칭되므로 group을 빼면 아무 페이지도 무효화하지 않는다. `tests/revalidate-typed-path-contract.test.mts`가 실제 route 파일과의 일치를 고정한다.
- partner Supabase repository는 `unstable_cache`와 `public_cache_versions`를 함께 사용한다.
- `public_cache_versions`는 partners/categories scope 변경 시 cache key를 바꾸는 기준이다.
- sitemap은 dynamic이며 partner 목록 조회 실패 시 정적 경로(홈·앱 설치·쇼케이스 허브)와 모든 캠퍼스 entry만 반환하는 fail-soft 구조다. 조회에 성공하면 공개 제휴가 없는 캠퍼스는 캠퍼스 페이지 noindex와 같은 규칙으로 빠진다.
- 서비스 워커(`public/sw.js`)는 버전 캐시에 오프라인 안내 페이지만 두고 데이터 응답은 캐시하지 않는다. 기준은 [PWA/installed app](../requirements/non-functional.md#pwainstalled-app)을 따른다.
- image proxy/cache helper는 외부/스토리지 이미지 응답과 blur/cache 최적화를 보조한다.

## Event/logging architecture

세부 기준은 [event-logging.md](./event-logging.md)를 따른다.

- product analytics: page view, partner click/detail, filter/search/sort, push, certification, suggest 등.
- admin audit: 관리자 CRUD, push send, partner portal action, review moderation 등.
- auth security: member/admin/partner auth, Mattermost code/sender 안전 이벤트, password reset/change, access blocked 등.
- partner metric rollups: event_logs를 기반으로 partner별 total/hour/day/weekday metric과 unique visitor를 집계한다.

## Error handling

- UI form은 field error, form error, inline message, toast를 구분한다.
- route/action boundary에서는 request body/form data를 검증하고 user-safe message를 반환한다.
- 서버 내부 error는 console/log에 세부 context를 남기되 사용자 응답에는 민감 정보를 포함하지 않는다.
- cron과 notification 발송은 partial failure summary를 반환하고, 가능한 경우 본 기능 실패로 확산하지 않는다.

## Current architectural gaps

- 직접 `.from(` 호출 파일이 124개 남아 있다(증가 금지 기준). members·promotions 같은 공유 엔티티는 아직 저장소 인터페이스가 없다.
- 관리자 server action은 여러 파일로 나뉘었지만 여전히 protected route 하위에 도메인별 액션이 집중되어 있다.
- public/partner/admin 알림 API가 audience별로 나뉘어 있어 정책은 명확하지만 공통 envelope/에러 shape는 더 표준화할 여지가 있다.
- UI 컴포넌트는 많이 분해되었지만 일부 page orchestration과 data preparation이 같은 파일에 남아 있다.
