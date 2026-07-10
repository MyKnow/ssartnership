# 10. 리팩토링/마이그레이션 준비도

작성 기준일: 2026-07-09

최종 교정일: 2026-07-10

## 반드시 보존해야 하는 동작

- 비회원은 공개 제휴와 공개 혜택만 볼 수 있다.
- 대외비 제휴는 회원 로그인 후 상세 조회가 가능하다.
- 비공개 제휴는 public surface에서 상세 접근이 불가능하다.
- 기간 만료 제휴는 public/confidential이어도 상세 접근에서 제외된다.
- `eligible_only` 혜택은 비로그인 또는 적용 대상이 아닌 회원에게 조건/혜택/링크를 마스킹한다.
- `(site)` layout은 필수 정책 동의와 강제 비밀번호 변경을 우선 처리한다.
- 회원/관리자/파트너 session cookie는 분리되어야 한다.
- 관리자 권한은 resource/action matrix와 permissionVersion 불일치 무효화를 유지해야 한다.
- 파트너 session의 company scope 밖 파트너사/제휴처 접근은 차단해야 한다.
- 리뷰 hidden/deleted 상태와 관리자/파트너 moderation actor를 보존해야 한다.
- Preview sync는 production password material을 복사하지 않아야 한다.
- sitemap/robots/RSS/canonical metadata는 public SEO surface에서 유지되어야 한다.

## 리팩토링 우선순위 후보

| Priority | 영역 | 이유 |
| --- | --- | --- |
| P0 | public partner query/render boundary | 홈/상세가 핵심 traffic surface이고 SEO/캐시/권한이 동시에 걸려 있다. |
| P0 | auth/session/SSAFY Verify | 보안과 가입 전환에 직접 영향이 있다. |
| P0 | admin/partner permission boundary | 운영 실수와 데이터 노출 위험이 크다. |
| P1 | partner portal repository 정리 | façade와 helper/Supabase query가 섞인 현재 구조를 일관된 repository/service 경계로 맞출 필요가 있다. |
| P1 | notification API 표준화 | member/admin/partner audience별 API가 분리되어 있어 공통 error/envelope/permission 기준을 정리할 여지가 있다. |
| P1 | UI shell/route skeleton 정리 | public/admin/partner shell의 loading/error/empty 기준을 더 일관되게 만들 수 있다. |
| P2 | docs/Storybook coverage | 시각 회귀와 컴포넌트 contract를 더 넓힐 수 있다. |

## 마이그레이션 전 체크리스트

### Product/UX

- `02-information-architecture.md`의 route 목록과 실제 route가 일치하는지 확인한다.
- `03-user-flows.md`의 흐름별 성공/실패/복구 상태를 새 구현에서 재현한다.
- `08-ui-ux-baseline.md`의 mobile, tablet, desktop 기준 screenshot QA를 수행한다.
- Korean text overflow, button wrapping, chip wrapping, dense admin layout을 확인한다.

### Data/API

- `06-data-model.md`의 table/state/value를 새 schema로 매핑한다.
- partner visibility/benefit visibility/audience/campus slug enum을 깨지 않는다.
- auth/admin/partner session과 password reset/setup token을 새 runtime에서 동일 보안 수준으로 구현한다.
- service role 사용 지점과 RLS/authorization 경계를 새 architecture에 맞게 재검토한다.
- API route method와 response shape가 외부 client 또는 E2E fixture에 쓰이는지 확인한다.

### Performance

- public partner/category cache invalidation 전략을 정한다.
- 홈과 상세 page의 dynamic/static/revalidate 정책을 명확히 한다.
- image optimization, remotePatterns, storage image URL, blur/cache helper를 대체할 계획을 세운다.
- admin logs/member/reviews list의 pagination/filter cost를 측정한다.

### Security

- session secret, service role key, SSAFY Verify secret, SMTP credential, VAPID key, CRON_SECRET을 새 환경으로 안전하게 이전한다.
- auth security log와 admin audit log에서 민감 데이터가 새로 노출되지 않는지 확인한다.
- image proxy/upload sign, Push subscription, cron, partner billing API는 별도 보안 리뷰를 수행한다.
- Preview sync sanitizer가 새 schema에서도 password material을 제거하는지 검증한다.

### Operations

- `main`/`dev` branch와 Production/Preview 연결을 유지한다.
- migration ordering과 schema snapshot policy를 유지한다.
- GitHub Actions 또는 대체 CI에서 lockfile, public readiness, Storybook, preview sync 역할을 보존한다.
- release path가 `npm run release`를 대체한다면 version bump, Storybook gate, push behavior를 명시한다.

## 새 기술 스택으로 옮길 때의 의사결정 기록 대상

마이그레이션 중 아래 항목은 ADR 또는 이 문서 갱신으로 남긴다.

- Next.js App Router를 유지할지, Remix/Astro/SvelteKit/SPA 등으로 옮길지.
- Supabase를 유지할지, 별도 backend/API server/Postgres로 분리할지.
- server action을 REST/RPC API로 바꿀지.
- repository interface를 유지할지, query layer를 다른 패턴으로 대체할지.
- auth/session을 custom HMAC cookie에서 auth provider/session store로 바꿀지.
- Vercel hosting/analytics/speed insights를 유지할지.
- Tailwind v4/design token 체계를 유지할지.
- Storybook/Playwright/Node test runner를 유지할지.

## 검증 명령 기준

문서 기준선만 바뀐 경우:

```bash
find docs -maxdepth 3 -type f | sort
git diff --check
```

코드 리팩토링이 포함된 경우:

```bash
npx tsc --noEmit --pretty false
npx eslint <changed-files>
node --test tests/<focused-test>.test.mts
```

라우트, auth, public UX가 바뀐 경우:

```bash
npm run test:e2e
npm run build
```

DB가 바뀐 경우:

```bash
npm run validate:migrations
npm run test
```

UI가 바뀐 경우:

```bash
npm run build-storybook
npm run test-storybook
npm run test:visual
```

## IA/UI wave 관찰과 롤백

- 기준 구간은 배포 직전 30일, 비교 구간은 Preview 통합 검증을 통과해 Production에 배포된 시점부터 14일이다.
- `home_banner_click / 홈 page_view`, `partner_card_click / 홈·캠퍼스 page_view`, `(reservation_click + inquiry_click) / partner_detail_view`, `partner_registration_submit / /partner-registration page_view`를 같은 event catalog와 세션 중복 제거 규칙으로 비교한다.
- 비교 지표가 기준 대비 상대 `10%` 이상 하락하면 해당 UI wave의 배포 commit을 되돌리고 원인 분석 전 다음 wave 승격을 중단한다.
- 기준 구간 이벤트가 `0건`이면 상대 하락을 계산하지 않는다. 이 경우 14일 절대 전환과 오류율을 기록한 뒤 다음 배포부터 그 값을 기준선으로 사용한다.
- 2026-07-10 스냅샷의 표본·기능별 사용 근거는 `docs/product/screen-specs/feature-scoring.md`를 source of truth로 사용한다.

## 문서 갱신 규칙

- route가 추가/삭제/보호 정책 변경되면 `02`와 E2E fixture를 함께 갱신한다.
- 사용자 흐름이 바뀌면 `03`을 갱신한다.
- 화면 기능, 빈 상태, 실패 상태가 바뀌면 `04`와 `08`을 갱신한다.
- repository/service/auth/cache boundary가 바뀌면 `05`를 갱신한다.
- table/migration/state enum/RLS가 바뀌면 `06`을 갱신한다.
- API route, cron, env, 외부 연동이 바뀌면 `07`을 갱신한다.
- 성능/보안/SEO/운영 정책이 바뀌면 `09`를 갱신한다.
- 리팩토링 wave가 끝나면 이 문서의 우선순위와 보존 체크리스트를 현실에 맞게 조정한다.
