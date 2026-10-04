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
- public partner/category 조회는 `unstable_cache`와 `public_cache_versions` 기반 versioned cache를 사용한다.
- 홈 page는 `revalidate = 300`으로 선언되어 있으나 `(site)` layout은 세션 강제 처리 때문에 dynamic이다.
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

- root metadata는 title, description, Open Graph, Twitter, keywords, manifest, RSS alternate를 포함한다.
- `site.ts`는 브랜드/캠퍼스/부트캠프/삼성/제휴/탐색 keyword 집합을 관리한다.
- `sitemap.ts`는 홈, 캠퍼스, 공개 접근 가능한 partner 상세를 포함한다.
- `robots.ts`는 `/admin`, `/api`를 모든 user agent에 disallow한다.
- partner/campus SEO helper가 canonical URL 조립을 담당한다.
- RSS feed는 `/rss.xml`로 제공된다.

리팩토링 시 보존할 것:

- `NEXT_PUBLIC_SITE_URL` 기반 canonical URL.
- sitemap partner entry의 공개 범위/기간 필터.
- `Yeti`, `Googlebot`, `*`에 대한 robots 정책.
- JSON-LD WebSite/Organization/ItemList 구조.

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
- Cloud Supabase Preview는 frozen 복구 기준선이며 Actions의 migration/sync 대상이 아니다(Issue #484). 자체 호스팅 Preview/Production DDL은 운영자가 검증 후 작성하는 `schema-approval.json`으로만 배포가 허용된다.
- migration은 forward-only, 실제 현재 시각 prefix, lexicographic order를 지켜야 한다.

## Observability

- 공개 사이트 Web Vitals는 자체 호스팅 수집 경로(`/api/web-vitals`)로 보낸다. Vercel Analytics와 Speed Insights는 PVE 이전 뒤 로드되지 않는다.
- product analytics는 `event_logs`에 저장된다.
- admin audit와 auth security log가 분리되어 있다.
- notification delivery와 push message/delivery log가 분리되어 있다.
- partner metric rollup은 event log 기반 집계로 관리된다.
- 운영 알림 dedupe table로 반복 알림을 제어한다.
