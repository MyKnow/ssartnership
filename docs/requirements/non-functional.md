---
title: 09. 비기능 기준선
type: requirement
status: current
authority: normative
---

# 09. 비기능 기준선

작성 기준일: 2026-07-09

## Performance

관련 문서: [성능 지식](../performance/index.md)

현재 기준:

- Next.js App Router 기반 server rendering과 client component를 혼합한다.
- public partner/category 조회는 `unstable_cache`와 `public_cache_versions` 기반 versioned cache를 사용한다. 캐시 태그는 `src/lib/cache-tags.ts`, revalidate 창은 `src/lib/cache-ttl.ts`의 상수만 쓰고 값(태그 문자열·초)은 캐시 계약이므로 바꾸지 않는다.
- 요청 안에서 같은 데이터를 여러 번 읽는 경계(회원 대상 스냅샷, 파트너 포털 회사 요약, 쇼케이스 이벤트·공개 프로젝트, 회원 게이트 정책 버전)는 React `cache()`로 요청 단위 메모이즈한다. 회원 게이트는 정책 본문 없이 활성 버전만 읽고, 서명 세션의 동의 스냅샷이 최신이면 동의 이력을 읽지 않는다.
- 공개 홈·캠퍼스 인기도는 지표 롤업만 읽고 `event_logs` 원본 재집계 fallback을 쓰지 않는다. 롤업이 비어 있으면 조회수 0으로 정렬한다.
- `(site)` layout은 세션 강제 처리 때문에 dynamic이므로 공개 페이지는 page 단위 `revalidate`를 선언하지 않는다.
- selector 분리 작업이 진행되어 홈, 관리자 회원, 관리자 로그의 검색/필터/정렬 계산은 pure selector로 이동되어 있다.
- partner metric은 event log 원본을 기반으로 rollup table과 unique visitor table에 집계된다.
- Lighthouse는 `npm run perf:lighthouse`로 production build 이후 실행한다.

성능 리팩토링 시 우선 보존할 것:

- 공개 제휴 목록/상세의 SEO와 캐시 무효화.
- admin/partner 화면의 초기 로딩 skeleton.
- 대량 로그/회원/리뷰 목록의 pagination/filter selector.
- image proxy/cache, Next Image remote pattern, AVIF/WebP 포맷.

## Security

관련 문서: [보안 지식](../security/index.md)

현재 기준:

- `next.config.ts`는 `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, production HSTS를 설정한다.
- 회원/관리자/협력사 session은 HMAC signed httpOnly cookie를 사용한다.
- service role key, Mattermost Sender AES key, SMTP password, VAPID private key, cron secret은 서버 전용 env로 유지한다.
- route/action boundary에서 request/form validation을 수행한다.
- admin permission은 resource/action matrix로 검사한다.
- auth/security event는 raw token/password/client secret 없이 sanitize해 기록한다.
- admin logs는 read-only 성격이 강하며 logs resource는 create/update/delete 권한이 강제로 false 처리된다.
- privileged admin 보존 DB function이 존재한다.

고위험 영역:

- Mattermost Sender credential 복호화, DM 코드, profile/directory/lifecycle 연동.
- password reset/change, initial setup token, session bridge.
- Supabase service role client 사용 경계.
- image proxy와 media upload sign/cleanup.
- Push subscription endpoint와 broadcast.
- cron endpoint와 `CRON_SECRET`.
- partner billing business status API key.

## Privacy and data minimization

- 비밀번호 원문, session token, auth token, client secret, push key 원문 중복 저장은 금지한다.
- Production→Preview 사본은 격리 복원본에서 비밀번호·자격증명 열을 교체하고 이메일을 마스킹하며 인증·발송·로그 테이블을 비운다. 프로필 사진 ledger와 private Storage 객체는 Preview 검증용으로 복사하므로 사본도 개인정보로 보호한다. 절차는 [Production/Preview 격리와 데이터 복사](../operations/runbooks/self-host-environments.md)를 따른다.
- 제휴 제안 자유서술 본문 전체를 로그에 남기지 않는다.
- Mattermost 오류는 안전한 코드만 요약하고, credential·MM session token·DM code 원문은 기록하지 않는다.
- avatar/image는 필요한 범위에서 tokenized route 또는 storage URL로 제공한다.

## SEO/discovery

현재 기준:

- root metadata는 title, description, keywords, manifest, RSS alternate와 기본 공유 이미지(`public/og-default.png`, 1200×630)를 쓰는 Open Graph·Twitter 카드를 포함한다. root는 canonical과 `og:url`을 선언하지 않는다. 하위 segment가 상속해 홈을 정본으로 가리키지 않게 하기 위해서다.
- 색인 대상 페이지는 자기 경로의 canonical(`createCanonicalAlternates`)과 `og:url`을 선언하고, 나머지 페이지는 `robots.index=false`로 둔다. `tests/seo-canonical-contract.test.mts`가 `(site)` 페이지 전체에서 둘 중 하나를 확인한다.
- 페이지가 `openGraph`를 선언하면 상위 값을 병합하지 않고 대체하므로 `createPageOpenGraph`로 사이트 기본값과 이미지를 함께 채운다. 크롤러가 SVG를 공유 이미지로 쓰지 않으므로 이벤트 hero는 1200×630 PNG(`shareImageSrc`)를 따로 지정한다. 공유 이미지는 `node scripts/generate-share-assets.mjs`로 다시 만든다.
- `site.ts`는 브랜드/캠퍼스/부트캠프/삼성/제휴/탐색 keyword 집합과 viewport·manifest가 함께 쓰는 테마 색(`SITE_THEME_COLOR_LIGHT`, `SITE_THEME_COLOR_DARK`)을 관리한다.
- `sitemap.ts`는 홈, `/install`, `/events/project-showcase`, 공개 제휴가 1건 이상인 캠퍼스, 공개 접근 가능한 partner 상세를 포함한다. 제휴 목록을 불러오지 못하면 캠퍼스를 모두 유지하고 partner URL만 생략한다.
- `robots.ts`는 `src/lib/seo/robots.ts`의 공용 목록으로 `/admin`, `/api`, `/auth`, `/partner/`(파트너 포털)를 모든 user agent에 disallow한다. 공개 제휴 상세 `/partners/*`와 `/partner-registration`은 허용한다. 파트너 포털 layout은 noindex다.
- 공개 제휴가 없는 캠퍼스 페이지, 체험 기간이 아닐 때의 쇼케이스 프로젝트 상세, 회원 전용 쇼케이스 화면은 noindex다.
- partner/campus SEO helper가 canonical URL 조립을 담당한다.
- RSS feed는 `/rss.xml`로 제공된다. 최근 등록된 공개 제휴 20건을 내보내고, 항목 `pubDate`는 제휴 등록 시각(`partners.created_at`)이다. 날짜를 모르는 항목은 `pubDate`를 생략하며 요청 시각으로 날짜를 만들지 않는다.

리팩토링 시 보존할 것:

- `NEXT_PUBLIC_SITE_URL` 기반 canonical URL.
- sitemap partner entry의 공개 범위/기간 필터.
- `Yeti`, `Googlebot`, `*`에 대한 robots 정책.
- JSON-LD WebSite/Organization/ItemList 구조.

## PWA/installed app

현재 기준:

- `manifest.ts`는 `id: "/"`, `display: "standalone"`과 라이트 테마 색을 background·theme 색으로 쓰고, 화면 방향을 고정하지 않는다. 다크 테마 색은 root viewport의 media query로 제공한다. manifest 아이콘은 `public/`의 192·512 PNG(512는 maskable 겸용)다.
- 브라우저·홈 화면 아이콘은 root metadata의 `icon.svg`, 192·512 PNG, 16/32/48 프레임 `favicon.ico`, `apple-touch-icon.png`(180×180)다. 파일 기반 아이콘(`src/app/**/icon.*`, `apple-icon.*`)은 이 설정을 덮어쓰므로 두지 않는다(`tests/metadata-routes.test.mts`).
- 서비스 워커 자동 등록은 Production 빌드의 Supabase 모드에서만 한다(`PwaProvider`). 푸시 설정을 켤 때는 환경과 관계없이 등록한다. mock E2E에는 자동 등록이 없으므로 오프라인 폴백과 push 처리는 `tests/service-worker.test.mts`가 `sw.js`를 직접 실행해 검증한다.
- `public/sw.js`는 푸시 알림과, 같은 출처 GET 내비게이션의 network-first만 처리한다. 네트워크 요청이 실패하면 설치 시 버전 캐시에 받아 둔 `public/offline.html`을 보여 주고, 데이터 응답은 캐시하지 않는다. `/admin`, `/api/` 내비게이션은 가로채지 않는다. 설치된 앱은 `sw.js`가 바뀌어야 새 오프라인 페이지를 받으므로 `offline.html`을 바꾸면 `sw.js`의 `CACHE_VERSION`을 올리고 테스트의 버전별 페이지 지문을 추가한다.
- `/sw.js`는 `Cache-Control: no-cache, no-store, must-revalidate`로 제공한다. `sw.js`, `offline.html`, `manifest.webmanifest`는 회원 게이트 리다이렉트를 거치지 않는다(`src/lib/pwa-shell.ts`).
- 서비스 워커 갱신 중 새 오프라인 페이지를 저장하지 못하면 마지막 정상 버전의 오프라인 캐시를 유지해 내비게이션 폴백으로 사용한다. 현재 버전의 정상 응답이 확인된 뒤에만 구버전 캐시를 정리하며, 다른 라이브러리·데이터 캐시를 폴백으로 사용하지 않는다.
- standalone 화면에서는 `html`, `body`의 `overscroll-behavior-y: none`으로 당겨서 새로고침을 막아 작성 중인 입력을 지킨다. 일반 브라우저 탭은 기본 동작을 유지한다.

## Accessibility

현재 명시된 접근성 도구:

- Storybook addon a11y가 설치되어 있다.
- form field error와 invalid 상태를 공용 input/password/policy field에서 다룬다.
- button/input/select/textarea 공용 primitive가 존재한다.
- reduced motion 대응은 디자인 시스템 문서에 명시되어 있다.

추가 확인이 필요한 영역:

- modal/lightbox/crop dialog focus trap.
- carousel keyboard navigation.
- admin dense table/list의 heading/landmark 구조.
- Push/PWA browser permission 안내의 screen reader 표현.

## Testing and QA

현재 scripts:

- `npm run test`: `test:node`(node:test helper·domain·소스 계약)와 `test:unit`(Vitest route/action) 전체.
- `npm run test:e2e`: Playwright.
- `npm run test-storybook`: Vitest Storybook project.
- `npm run build-storybook`: Storybook build.
- `npm run check:lockfile`: Linux/amd64 lockfile 검증.
- `npm run validate:migrations`: Supabase migration 검증.
- `npm run audit:security`: repository security audit script.
- `npm run verify:change`: 실제 diff 위험 등급에 맞춘 로컬 게이트(CI와 같은 분류기). `npm run ci:local`은 bootstrap 뒤 이 게이트를 실행한다.
- `npm run verify:release`: `dev`→`main` 승격 전 Production build와 전체 E2E. Storybook·Visual은 수동 검사다.

주요 테스트 범위:

- auth/form validation, direct Mattermost, sender credential, security hardening/schema.
- partner portal mock/scope/layout/metrics/service detail.
- partner reviews/favorites/counts/benefit visibility/action.
- notification center/routing/UI, push helpers.
- admin permissions/session/log loading/regional scope.
- 자체 호스팅 환경 사본 정제·CI 수신기·운영 timer 계약.
- E2E route smoke, home partners, auth ops.

## Deployment/operations

- 운영 정본은 PVE 자체 호스팅이다. `main` branch는 자체 호스팅 Production, `dev` branch는 자체 호스팅 Preview에 배포된다. Vercel과 클라우드 Supabase는 운영 경로가 아니다.
- 각 환경의 수신기는 해당 branch의 첫 성공 이미지 workflow가 만든 exact-SHA 앱 이미지만 적용하고 DDL은 적용하지 않는다.
- planned work는 typed branch에서 시작하고 PR은 `dev` 대상으로 만든다.
- `npm run release`가 기본 release path다.
- GitHub Actions: `Public Readiness`(변경 위험 등급별 검증), `Self-host Preview Images`·`Self-host Production Images`(이미지 게시), 수동 `Storybook and Visual Baselines` 등. 현재 목록은 `.github/workflows/`가 정본이다.
- Cloud Supabase Preview는 동결된 이전 원본일 뿐 복구 경로가 아니며([리팩토링 기본 결정 D1](../plans/active/refactor-program-2026-10.md#기본-결정)), Actions의 migration/sync 대상도 아니다(Issue #484). 자체 호스팅 Preview/Production DDL은 운영자가 검증 후 작성하는 `schema-approval.json`으로만 배포가 허용된다.
- migration은 forward-only, 실제 현재 시각 prefix, lexicographic order를 지켜야 한다.

## Observability

- 공개 사이트 Web Vitals는 자체 호스팅 수집 경로(`/api/web-vitals`)로 보낸다. Vercel Analytics와 Speed Insights는 PVE 이전 뒤 로드되지 않는다.
- product analytics는 `event_logs`에 저장된다.
- admin audit와 auth security log가 분리되어 있다.
- notification delivery와 push message/delivery log가 분리되어 있다.
- partner metric rollup은 event log 기반 집계로 관리된다.
- 운영 알림 dedupe table로 반복 알림을 제어한다.
