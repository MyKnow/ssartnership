# 02. 정보 구조와 라우트 맵

작성 기준일: 2026-07-09

최종 교정일: 2026-07-10

page route의 기계 판독 기준은 `src/lib/mock/scenarios/route-inventory.ts`다. 2026-07-09 기준선은 62개였으며, 이번 IA 분리에서 `/admin/partner-requests`, `/admin/categories` 두 canonical route가 추가되어 구현 완료 시 64개가 된다.

| routeKind | 의미 |
| --- | --- |
| `canonical` | 메뉴와 제품 링크가 가리키는 고유 목적지 |
| `conditional` | token, 권한, 다중 회사 등 특정 상태에서만 렌더되는 흐름 |
| `compat-redirect` | 구 URL을 canonical 목적지로 연결하는 호환 경로 |
| `mock-only` | 개발·합성 데이터 확인 전용, 제품 내비게이션 비노출 |

## 상위 App Router 구조

| 영역 | 경로 | 역할 |
| --- | --- | --- |
| Root | `src/app/layout.tsx` | 전역 metadata, theme, toast, PWA provider, Vercel Analytics/Speed Insights |
| Public site | `src/app/(site)` | 홈, 캠퍼스, 제휴 상세, 이벤트, 제안, 인증 카드, 알림, 쿠폰 |
| Auth | `src/app/auth` | 회원 로그인, 가입, SSAFY Verify callback, 정책 동의, 비밀번호 재설정/변경 |
| Admin | `src/app/admin` | 관리자 로그인, setup, protected 운영 화면 |
| Partner | `src/app/partner` | 파트너 로그인, setup, dashboard, 파트너사/제휴처/플랜/알림/지원 |
| Legal | `src/app/legal/[kind]` | 약관/개인정보/마케팅 문서 버전 조회 |
| API | `src/app/api` | 인증, 알림, 제휴, 리뷰, Push, cron, image proxy, 로그 |
| SEO/runtime files | `src/app/sitemap.ts`, `robots.ts`, `manifest.ts`, `rss.xml/route.ts`, `icon.tsx` | 검색엔진, PWA, RSS, 아이콘 |

## Public site routes

| Route | Source | 목적 |
| --- | --- | --- |
| `/` | `(site)/page.tsx` | 홈, 프로모션 슬라이드, 카테고리별 제휴 탐색 |
| `/campuses/[campus]` | `(site)/campuses/[campus]/page.tsx` | 캠퍼스별 제휴 목록 |
| `/partners/[id]` | `(site)/partners/[id]/page.tsx` | 제휴 상세, 혜택/조건/연락처/리뷰/쿠폰 |
| `/events/[slug]` | `(site)/events/[slug]/page.tsx` | 이벤트 랜딩 |
| `/events/[slug]/winner-form` | `(site)/events/[slug]/winner-form/page.tsx` | 이벤트 당첨자 입력 폼 |
| `/suggest` | `(site)/suggest/page.tsx` | 제휴 제안 |
| `/support/bug-report` | `(site)/support/bug-report/page.tsx` | 버그/문의 제보 |
| `/verify/[token]` | `(site)/verify/[token]/page.tsx` | 인증 QR 검증 |
| `/certification` | `(site)/certification/page.tsx` | 회원 인증 카드 |
| `/notifications` | `(site)/notifications/page.tsx` | 회원 알림함 |
| `/coupons` | `(site)/coupons/page.tsx` | 회원 쿠폰 지갑 |
| `/partner-registration` | `(site)/partner-registration/page.tsx` | 파트너사와 제휴처 등록 신청 |

## Auth routes

| Route | Source | 목적 |
| --- | --- | --- |
| `/auth/login` | `auth/login/page.tsx` | 회원 로그인 |
| `/auth/signup` | `auth/signup/page.tsx` | SSAFY Verify 기반 회원가입 시작 |
| `/auth/signup/complete` | `auth/signup/complete/page.tsx` | 회원가입 완료 |
| `/auth/ssafy` | `auth/ssafy/page.tsx` | SSAFY Verify callback 처리 |
| `/auth/reset` | `auth/reset/page.tsx` | 비밀번호 재설정 시작 |
| `/auth/reset/complete` | `auth/reset/complete/page.tsx` | 재설정 완료 토큰 처리 |
| `/auth/change-password` | `auth/change-password/page.tsx` | 강제/자발 비밀번호 변경 |
| `/auth/consent` | `auth/consent/page.tsx` | 필수 정책 동의 |

## Admin routes

| Route | Source | 목적 |
| --- | --- | --- |
| `/admin/login` | `admin/login/page.tsx` | 통합 `/auth/login` 호환 redirect |
| `/admin/session` | `admin/session/route.ts` | 회원 세션 기반 admin session bridge |
| `/admin/setup/[token]` | `admin/setup/[token]/page.tsx` | 현재 `/admin` 진입 흐름 호환 redirect |
| `/admin/denied` | `admin/denied/page.tsx` | 접근 거부 안내 |
| `/admin` | `admin/(protected)/page.tsx` | 관리자 대시보드 |
| `/admin/admins` | `admin/(protected)/admins/page.tsx` | 관리자 계정/권한 관리 |
| `/admin/advertisement` | `admin/(protected)/advertisement/page.tsx` | 광고/쿠폰 패키지 관리 |
| `/admin/companies` | `admin/(protected)/companies/page.tsx` | 파트너사/계정 관리 |
| `/admin/cycle` | `admin/(protected)/cycle/page.tsx` | SSAFY 기수 설정 |
| `/admin/event` | `admin/(protected)/event/page.tsx` | 이벤트 관리 |
| `/admin/event/[slug]` | `admin/(protected)/event/[slug]/page.tsx` | 이벤트 상세 운영 |
| `/admin/logs` | `admin/(protected)/logs/page.tsx` | product/admin/auth 로그 조회 |
| `/admin/members` | `admin/(protected)/members/page.tsx` | 회원 목록/관리 |
| `/admin/members/[memberId]` | `admin/(protected)/members/[memberId]/page.tsx` | 회원 상세/보안 로그 |
| `/admin/members/mock` | `admin/(protected)/members/mock/page.tsx` | 회원 mock 미리보기 anchor redirect (`mock-only`) |
| `/admin/notifications` | `admin/(protected)/notifications/page.tsx` | 관리자 `내 알림`과 수신 설정 |
| `/admin/partner-registrations` | `admin/(protected)/partner-registrations/page.tsx` | 파트너사·제휴처 등록 신청 검토 |
| `/admin/partners` | `admin/(protected)/partners/page.tsx` | 제휴처 목록/관리 |
| `/admin/partner-requests` | `admin/(protected)/partner-requests/page.tsx` | 제휴처 변경 요청 검토 |
| `/admin/categories` | `admin/(protected)/categories/page.tsx` | 제휴처 카테고리 관리 |
| `/admin/partners/new` | `admin/(protected)/partners/new/page.tsx` | 제휴 신규 생성 |
| `/admin/partners/[partnerId]` | `admin/(protected)/partners/[partnerId]/page.tsx` | 제휴 상세 편집/리뷰/변경 이력 |
| `/admin/promotions` | `admin/(protected)/promotions/page.tsx` | `/admin/advertisement` 호환 redirect |
| `/admin/push` | `admin/(protected)/push/page.tsx` | 알림 `발송 관리`와 결과 로그 |
| `/admin/reviews` | `admin/(protected)/reviews/page.tsx` | 리뷰 관리 |

## Partner portal routes

| Route | Source | 목적 |
| --- | --- | --- |
| `/partner/login` | `partner/login/page.tsx` | 파트너 로그인 |
| `/partner/logout` | `partner/logout/route.ts` | 파트너 로그아웃 |
| `/partner/reset` | `partner/reset/page.tsx` | 파트너 비밀번호 재설정 |
| `/partner/change-password` | `partner/change-password/page.tsx` | 파트너 비밀번호 변경 |
| `/partner/setup` | `partner/setup/page.tsx` | setup 합성 데모 목록 (`mock-only`) |
| `/partner/setup/[token]` | `partner/setup/[token]/page.tsx` | 초기 설정 |
| `/partner` | `partner/page.tsx` | 파트너사 선택 또는 dashboard 진입 |
| `/partner/account` | `partner/account/page.tsx` | 전역 파트너 계정 정보 (`canonical`) |
| `/partner/notifications` | `partner/notifications/page.tsx` | 전역 파트너 내 알림 (`canonical`) |
| `/partner/plans` | `partner/plans/page.tsx` | 회사별 플랜 화면 호환 redirect |
| `/partner/support` | `partner/support/page.tsx` | 전역 파트너 지원 요청 (`canonical`) |
| `/partner/services/[partnerId]` | `partner/services/[partnerId]/page.tsx` | 회사별 제휴처 상세 호환 redirect |
| `/partner/services/[partnerId]/request` | `partner/services/[partnerId]/request/page.tsx` | 회사별 제휴처 상세 변경 영역 호환 redirect |
| `/partner/companies/[companyId]` | `partner/companies/[companyId]/page.tsx` | 회사 dashboard |
| `/partner/companies/[companyId]/account` | `partner/companies/[companyId]/account/page.tsx` | 전역 계정 화면으로 `companyId` 보존 redirect |
| `/partner/companies/[companyId]/notifications` | `partner/companies/[companyId]/notifications/page.tsx` | 전역 알림 화면으로 `companyId` 보존 redirect |
| `/partner/companies/[companyId]/plans` | `partner/companies/[companyId]/plans/page.tsx` | 회사 플랜 |
| `/partner/companies/[companyId]/support` | `partner/companies/[companyId]/support/page.tsx` | 전역 지원 화면으로 `companyId` 보존 redirect |
| `/partner/companies/[companyId]/services/[partnerId]` | `partner/companies/[companyId]/services/[partnerId]/page.tsx` | 회사 scope 제휴처 상세·변경 요청 |
| `/partner/companies/[companyId]/services/new` | `partner/companies/[companyId]/services/new/page.tsx` | 파트너사 신규 제휴처 신청 |

## Legal/SEO routes

| Route | Source | 목적 |
| --- | --- | --- |
| `/legal/[kind]` | `legal/[kind]/page.tsx` | `service`, `privacy`, `marketing` 정책 문서 버전 조회 |
| `/sitemap.xml` | `sitemap.ts` | 홈, 캠퍼스, 공개 제휴 상세 sitemap |
| `/robots.txt` | `robots.ts` | `/admin`, `/api` 크롤링 차단 |
| `/manifest.webmanifest` | `manifest.ts` | PWA manifest |
| `/rss.xml` | `rss.xml/route.ts` | RSS feed |

## Route handlers outside `/api`

| Method | Route | 목적 |
| --- | --- | --- |
| GET | `/admin/session` | 회원 세션이 있는 사용자의 admin session bridge |
| GET | `/partner/logout` | partner session 제거 후 이동 |
| GET | `/rss.xml` | RSS XML 반환 |
| GET | `/partner-registration/template` | 파트너사·제휴처 등록 템플릿 다운로드 |
| GET | `/partner-registration/branches/template` | 지점 등록 템플릿 다운로드 |
| GET | `/admin/event/signup-reward/rewards/export` | 이벤트 리워드 export |
| GET | `/admin/partners/new/template` | 관리자 제휴 생성 템플릿 다운로드 |

## Page route 분류

아래 목록은 route group을 제거한 실제 URL 기준이다. 구현 중 route가 추가·삭제되면 inventory와 이 목록을 같은 변경에서 갱신한다.

### `canonical` — 42개

- 공개·회원: `/`, `/campuses/[campus]`, `/certification`, `/coupons`, `/events/[slug]`, `/legal/[kind]`, `/notifications`, `/partner-registration`, `/partners/[id]`, `/suggest`, `/support/bug-report`
- 인증: `/auth/login`, `/auth/reset`, `/auth/signup`
- 관리자: `/admin`, `/admin/admins`, `/admin/advertisement`, `/admin/categories`, `/admin/companies`, `/admin/cycle`, `/admin/event`, `/admin/event/[slug]`, `/admin/logs`, `/admin/members`, `/admin/members/[memberId]`, `/admin/notifications`, `/admin/partner-registrations`, `/admin/partner-requests`, `/admin/partners`, `/admin/partners/[partnerId]`, `/admin/partners/new`, `/admin/push`, `/admin/reviews`
- 파트너: `/partner/account`, `/partner/companies/[companyId]`, `/partner/companies/[companyId]/plans`, `/partner/companies/[companyId]/services/[partnerId]`, `/partner/companies/[companyId]/services/new`, `/partner/login`, `/partner/notifications`, `/partner/reset`, `/partner/support`

### `conditional` — 11개

`/events/[slug]/winner-form`, `/verify/[token]`, `/auth/change-password`, `/auth/consent`, `/auth/reset/complete`, `/auth/signup/complete`, `/auth/ssafy`, `/admin/denied`, `/partner`, `/partner/change-password`, `/partner/setup/[token]`

### `compat-redirect` — 9개

`/admin/login`, `/admin/promotions`, `/admin/setup/[token]`, `/partner/companies/[companyId]/account`, `/partner/companies/[companyId]/notifications`, `/partner/companies/[companyId]/support`, `/partner/plans`, `/partner/services/[partnerId]`, `/partner/services/[partnerId]/request`

Query 호환 규칙으로 `/admin/partners?tab=requests`는 `/admin/partner-requests`, `tab=categories|category`는 `/admin/categories`로 서버 redirect한다. `tab=plans`는 기존 플랜 운영을 보존하는 conditional legacy 상태이며 메뉴의 독립 목적지로 취급하지 않는다.

목적지가 사용자나 데이터와 무관한 `/admin/login`, `/admin/promotions`, `/admin/setup/[token]`, 관리자 legacy tab과 회사 ID가 URL에 고정된 전역 파트너 경로는 영구 redirect를 사용한다. 반면 `/partner/plans`, `/partner/services/[partnerId]`, `/partner/services/[partnerId]/request`는 로그인 세션의 회사 권한과 현재 제휴처 연결을 조회해 목적지를 정하므로 브라우저에 다른 계정의 회사 경로가 영구 캐시되지 않도록 임시 redirect를 유지한다.

### `mock-only` — 2개

`/admin/members/mock`, `/partner/setup`

## 사용자군별 내비게이션 맵

| 사용자군 | 진입점 | 메뉴 그룹 | 목적지 | 권한 |
| --- | --- | --- | --- | --- |
| 비회원 | public header, event link, 검색 | 이벤트 | `/`, `/events/[slug]` | 공개 |
| 비회원 | public header, 홈 첫 viewport | 혜택 찾기 | `/`, `/campuses/[campus]`, `/partners/[id]` | visibility가 공개 가능한 제휴처 |
| 비회원 | footer, 제휴 CTA | 참여·지원 | `/partner-registration`, `/suggest`, `/support/bug-report`, `/legal/[kind]` | 공개, 제출 경계 rate limit |
| SSAFY 회원 | 사용자 메뉴 | 내 활동 | `/certification`, `/coupons`, `/notifications` | member session |
| SSAFY 회원 | 이벤트/제휴처 CTA | 참여·이용 | `/events/[slug]`, `/partners/[id]` | member eligibility를 서버에서 재검증 |
| 파트너 | 로그인 후 shell | 홈·제휴처 | `/partner`, `/partner/companies/[companyId]`, 회사별 services | partner session + company scope |
| 파트너 | 모바일 하단 메뉴 | 알림 | `/partner/notifications` | 접근 가능한 company audience |
| 파트너 | 더보기/sidebar | 플랜·계정·지원 | 회사별 plans, `/partner/account`, `/partner/support` | partner session, plans는 company scope |
| 관리자 | 로그인 후 shell | 운영 홈 | `/admin` | admin session + dashboard read |
| 관리자 | 운영 메뉴 | 회원·제휴 운영 | members, partners, partner-requests, categories, companies | resource/action + campus scope |
| 관리자 | 운영 메뉴 | 이벤트·콘텐츠 | event, advertisement, reviews | resource/action + campus scope |
| 관리자 | 개인/운영 메뉴 | 내 알림·발송 관리·로그 | notifications, push, logs | 각 notification/log permission |
| 최고 관리자 | 시스템 메뉴 | 계정·기수 | admins, cycle | global admin permission |

공개 header 1차 메뉴는 `이벤트`, `혜택 찾기`, `캠퍼스`다. 인증, 쿠폰, 알림, 계정 작업은 사용자 메뉴로 이동한다. 파트너 모바일 메뉴는 `홈`, `제휴처`, `알림`, `더보기` 네 개로 제한한다.

## Protected route 기준

`tests/e2e/fixtures/routes.ts`가 smoke/redirect 기대값의 기준이다.

- 회원 보호: `/certification`, `/coupons`, `/notifications`는 비로그인 시 `/auth/login`으로 이동한다.
- 파트너 보호: `/partner`, `/partner/notifications`, `/partner/plans`, `/partner/support`, `/partner/companies/*`, `/partner/services/*`는 비로그인 시 `/partner/login`으로 이동한다.
- 관리자 보호: `/admin`과 대부분의 `/admin/*` protected 화면은 비인증 상태에서 `/auth/login`으로 이동한다. 회원 세션이 있으면 `/admin/session`을 거쳐 관리자 세션 bridge를 시도한다.
- `(site)` layout은 로그인된 회원에게 필수 약관 동의 또는 강제 비밀번호 변경이 필요하면 각각 `/auth/consent`, `/auth/change-password`로 보낸다.
