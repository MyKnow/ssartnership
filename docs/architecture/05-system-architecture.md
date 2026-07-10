# 05. 시스템 아키텍처

작성 기준일: 2026-07-09

## 계층 구조

```text
Browser
  -> Next.js App Router page/layout/client component
  -> Server Component / Server Action / Route Handler
  -> src/lib domain service/helper/repository interface
  -> mock repository or Supabase repository
  -> Supabase PostgreSQL / Storage
  -> external services: SSAFY Verify, SMTP, Web Push, NTS business status, Vercel
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

`src/lib/repositories/index.ts`는 환경에 따라 mock 또는 Supabase 구현을 선택한다.

| Interface | Mock 구현 | Supabase 구현 | 역할 |
| --- | --- | --- | --- |
| `PartnerRepository` | `mock/partner-repository.mock.ts` | `supabase/partner-repository.supabase.ts` | category/partner 목록과 상세 |
| `NotificationRepository` | `mock/notification-repository.mock.ts` | `supabase/notification-repository.supabase.ts` | 회원 알림 생성/조회/읽음/삭제 |
| `PartnerFavoriteRepository` | `mock/partner-favorite-repository.mock.ts` | `supabase/partner-favorite-repository.supabase.ts` | 즐겨찾기 count/member state |
| `PartnerReviewRepository` | `mock/partner-review-repository.mock.ts` | `supabase/partner-review-repository.supabase.ts` | 리뷰 CRUD/reaction/moderation |
| `AdPackageRepository` | `mock/ad-package-repository.mock.ts` | `supabase/ad-package-repository.supabase.ts` | 광고 캠페인/쿠폰/사용 |

전환 규칙:

- `NEXT_PUBLIC_DATA_SOURCE=mock`이면 mock 구현을 사용한다.
- Supabase env가 없으면 mock 구현으로 fallback한다.
- `NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE`는 partner portal mock 여부만 별도로 override한다.
- repository method는 raw DB row가 아니라 domain model을 반환한다.
- Supabase row-to-domain mapping은 Supabase repository 근처에 둔다.

## Supabase access

- 서버 코드는 `getSupabaseAdminClient()`를 통해 service role 기반 query를 수행한다.
- service role key는 서버 전용 환경 변수이며 public bundle에 노출하지 않는다.
- public data 조회도 서버에서 domain model로 변환한 뒤 UI에 전달한다.
- 모든 주요 테이블은 RLS가 enable되어 있다.
- storage는 partner media, review media, promotion slides, avatar/image proxy 등에서 사용된다.

## Session/auth boundary

| Session | Cookie | Secret | TTL | 주요 payload |
| --- | --- | --- | --- | --- |
| 회원 | `user_session` | `USER_SESSION_SECRET` | 7일 | userId, issuedAt, expiresAt, mustChangePassword, policy consent snapshot |
| 관리자 | `admin_session` | `ADMIN_SESSION_SECRET` | admin security config | adminId, loginId, permissionVersion |
| 협력사 | `partner_session` | `PARTNER_SESSION_SECRET` fallback `USER_SESSION_SECRET` | 7일 | accountId, loginId, displayName, companyIds, mustChangePassword |

공통 원칙:

- 모두 HMAC signed token을 httpOnly, sameSite=lax, production secure cookie로 저장한다.
- token signature, raw secret, password 원문은 로그에 남기지 않는다.
- 관리자 session은 account active, mustChangePassword, permissionVersion mismatch 시 무효 처리된다.
- 협력사 session은 companyIds가 비어 있거나 비정상 값이면 무효 처리된다.

## Domain service/helper 배치

| 도메인 | 주요 파일 |
| --- | --- |
| 인증/세션 | `user-auth.ts`, `auth.ts`, `partner-session.ts`, `partner-auth/*`, `request-guards.ts` |
| SSAFY Verify | `ssafy-verify/*`, `mattermost/*`, `mm-directory/*`, `mm-member-sync/*` |
| 제휴 | `partner-visibility.ts`, `partner-benefit-visibility.ts`, `partner-audience.ts`, `partner-utils.ts`, `home-partner-*` |
| 협력사 포털 | `partner-portal*.ts`, `partner-change-requests/*`, `partner-dashboard*`, `partner-plan-*`, `partner-billing*` |
| 리뷰 | `partner-reviews.ts`, `review-validation.ts`, `review-media*.ts`, review repository |
| 알림/Push | `notifications/shared.ts`, `notification-preferences.ts`, `push/*`, `admin-notification-*`, `partner-notifications*` |
| 로그/메트릭 | `activity-logs.ts`, `log-insights/*`, `partner-metric-*`, `product-events.ts` |
| SEO/RSS | `seo/*`, `rss/*`, `site.ts` |
| UI helpers | `cn.ts`, `validation.ts`, `auth-form-validation.ts`, `browser-password.ts`, `return-to.ts` |

## Caching and revalidation

- 홈 page는 `revalidate = 300`으로 선언되어 있다.
- `(site)` layout은 `dynamic = "force-dynamic"`으로 세션 상태를 매 요청 반영한다.
- partner Supabase repository는 `unstable_cache`와 `public_cache_versions`를 함께 사용한다.
- `public_cache_versions`는 partners/categories scope 변경 시 cache key를 바꾸는 기준이다.
- sitemap은 dynamic이며 partner 목록 조회 실패 시 홈/캠퍼스 entry만 반환하는 fail-soft 구조다.
- image proxy/cache helper는 외부/스토리지 이미지 응답과 blur/cache 최적화를 보조한다.

## Event/logging architecture

세부 기준은 [event-logging.md](./event-logging.md)를 따른다.

- product analytics: page view, partner click/detail, filter/search/sort, push, certification, suggest 등.
- admin audit: 관리자 CRUD, push send, partner portal action, review moderation 등.
- auth security: member/admin/partner auth, SSAFY Verify trace, password reset/change, access blocked 등.
- partner metric rollups: event_logs를 기반으로 partner별 total/hour/day/weekday metric과 unique visitor를 집계한다.

## Error handling

- UI form은 field error, form error, inline message, toast를 구분한다.
- route/action boundary에서는 request body/form data를 검증하고 user-safe message를 반환한다.
- 서버 내부 error는 console/log에 세부 context를 남기되 사용자 응답에는 민감 정보를 포함하지 않는다.
- cron과 notification 발송은 partial failure summary를 반환하고, 가능한 경우 본 기능 실패로 확산하지 않는다.

## Current architectural gaps

- 일부 partner portal 초기 설정 repository는 `UnconfiguredPartnerPortalRepository` façade가 남아 있고, 실제 production data flow는 개별 helper/Supabase query로 흩어져 있다.
- 관리자 server action은 여러 파일로 나뉘었지만 여전히 protected route 하위에 도메인별 액션이 집중되어 있다.
- public/partner/admin 알림 API가 audience별로 나뉘어 있어 정책은 명확하지만 공통 envelope/에러 shape는 더 표준화할 여지가 있다.
- UI 컴포넌트는 많이 분해되었지만 일부 page orchestration과 data preparation이 같은 파일에 남아 있다.
