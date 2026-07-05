# Project Completeness Audit 2026-06-24

## 범위

- 기준 Issue: [#54](https://github.com/MyKnow/ssartnership/issues/54) `프로젝트 전반 UI/UX·기능·성능 보완 순회`
- 기준 브랜치: `dev`의 `281f72d` 이후 문서 점검 브랜치
- 점검 목적: 이미 공개 상태인 repository와 배포 서비스가 현재 상태 그대로 운영/홍보 가능한지 판정하고, 남은 보완을 실행 가능한 단위로 정리한다.
- 운영 데이터 변경: 문서 점검 자체는 변경하지 않는다. SSAFY Verify live smoke는 명시 env를 켠 경우에만 `@myknow` 단일 대상으로 수행한다.

## 판정

현재 기준 `Blocker`는 확인되지 않았다.

다만 보안과 성능/운영 확장성 `High` 항목이 확인되어 최종 판정은 `High 수정 후 공개 홍보`다. 저장소를 즉시 비공개로 돌리거나 secret 회전을 해야 할 근거는 발견하지 못했지만, 실제 사용자/로그/파트너 데이터가 늘어나는 런칭 전에는 아래 High PR을 먼저 처리한다.

- SSAFY Verify Server API 위임은 구현과 기본 회귀 테스트가 완료됐다.
- 회원가입, 디렉터리 lookup, profile sync, Mattermost 알림 발송은 직접 Mattermost credential 없이 SSAFY Verify Server API 경계로 이동했다.
- GitHub Actions의 Public Readiness gate는 lint, typecheck, test, build, audit, e2e를 포함한다.
- Chromatic publish workflow는 Storybook 무료 한도 소진으로 자동 실행에서 제외되어 실패 루프가 멈춘 상태다.

## Severity Findings

### Blocker

없음.

### High

1. 비밀번호 재설정 완료 토큰이 URL query로 노출된다. `2026-07-05 완료`
   - [src/app/api/ssafy/reset-password/route.ts](/Users/myknow/coding/ssartnership/src/app/api/ssafy/reset-password/route.ts)는 SSAFY Verify 재인증 후 reset completion token을 발급한다.
   - 2026-06-24 당시 [src/components/auth/ResetPasswordForm.tsx](/Users/myknow/coding/ssartnership/src/components/auth/ResetPasswordForm.tsx)는 이 token을 `/auth/reset/complete?token=...`로 넘기고, [src/app/auth/reset/complete/page.tsx](/Users/myknow/coding/ssartnership/src/app/auth/reset/complete/page.tsx)는 query token을 읽었다.
   - 이 token은 bearer 성격이고 payload에 `memberId`, `mmUserId`, `mmUsername`이 포함됐다. 브라우저 history, 로그, referrer, 화면 공유로 새면 비밀번호 재설정 권한이 노출될 수 있었다.
   - 조치: query token 대신 HttpOnly short-lived cookie 또는 server-owned reset transaction id로 전환하고, reset 완료 시 즉시 폐기한다.
   - 2026-07-05 업데이트: HttpOnly short-lived cookie 방식으로 전환했고, 완료 API는 same-origin JSON 요청과 cookie token만 검증하며 성공 시 cookie를 폐기한다.

2. 관리자 회원 화면이 page load마다 큰 범위의 회원/푸시 설정 데이터를 반복 조회한다. `2026-07-05 완료`
   - [src/app/admin/(protected)/members/page.tsx](/Users/myknow/coding/ssartnership/src/app/admin/(protected)/members/page.tsx)는 옵션용 `members(year,campus)` 전체 조회, 알림 필터별 `push_preferences` 반복 조회, trend chart용 `members(created_at)` 전체 조회를 같은 요청에서 수행한다.
   - 페이지 크기도 `10, 50, 100, 500`을 허용해 운영 데이터가 늘면 관리자 화면 TTFB와 DB 부하가 빠르게 커진다.
   - 조치: 옵션/차트/목록 query를 분리하고, trend는 DB-side aggregate 또는 bounded range로 바꾸며, 500 page size는 제거하거나 명시 export 기능으로 분리한다.
   - 2026-07-05 업데이트: 500명 page size 옵션을 제거하고, 옵션/추이 조회를 최근 5,000건 상한으로 제한했다. 회원 상세 보안 로그는 25/50/100건 URL pagination으로 전환했다.

3. 관리자 로그 화면 기본 진입이 `24h` 전체 로그를 그룹별 상한 없이 읽어 요약을 만든다. `2026-07-05 완료`
   - [src/app/admin/(protected)/logs/page.tsx](/Users/myknow/coding/ssartnership/src/app/admin/(protected)/logs/page.tsx)는 기본 진입부터 `getAdminLogsPageData({ preset: "24h" })`를 호출한다.
   - [src/lib/log-insights/shared.ts](/Users/myknow/coding/ssartnership/src/lib/log-insights/shared.ts)의 `PAGE_MAX_LOG_ROWS_PER_GROUP`과 `SUMMARY_MAX_LOG_ROWS_PER_GROUP`가 `null`이라 로그량 증가 시 수천~수만 row가 메모리로 모일 수 있다.
   - 조치: 화면 기본 로딩은 bounded page로 제한하고, summary는 DB-side aggregate 또는 별도 lightweight endpoint로 전환한다.
   - 2026-07-05 업데이트: fallback row 수집 상한을 page 5,000건, summary 3,000건으로 설정하고 500건 page size 옵션을 제거했다. DB summary/page RPC가 있으면 기존 aggregate 경로를 우선 사용한다.

4. 공개 홈이 전체 파트너/즐겨찾기/인기 지표를 선계산한 뒤 클라이언트 경계로 넘긴다. `2026-07-05 완료`
   - [src/components/HomeContent.tsx](/Users/myknow/coding/ssartnership/src/components/HomeContent.tsx)는 전체 파트너 목록, favorite counts, 사용자 favorite state, popularity metrics를 계산한다.
   - [src/components/HomeView.tsx](/Users/myknow/coding/ssartnership/src/components/HomeView.tsx)는 실제 초기 노출 12개와 달리 전체 배열을 client state/filter/sort 대상으로 받는다.
   - 조치: 초기 목록 pagination 또는 server filtering을 우선하고, popularity/favorite state는 보이는 목록 기준 또는 lazy hydration으로 좁힌다.
   - 2026-07-05 업데이트: 홈 초기 응답은 24개 카드 범위만 favorite/popularity state를 계산하고, 이후 보이는 카드는 same-origin `/api/partners/home-state`에서 ID 상한을 둔 lazy hydration으로 보강한다.

5. 인증서 화면이 `avatar_base64`를 포함한 member row를 클라이언트로 전달한다. `2026-07-05 완료`
   - [src/app/(site)/certification/page.tsx](/Users/myknow/coding/ssartnership/src/app/(site)/certification/page.tsx)는 `avatar_base64`를 select하고, [CertificationView.tsx](/Users/myknow/coding/ssartnership/src/components/certification/CertificationView.tsx)는 data URL로 렌더링한다.
   - Verify `picture` URL 계약이 도입된 뒤에도 큰 base64 fallback이 페이지 payload와 렌더 비용을 키울 수 있다.
   - 조치: 인증서 화면은 URL/thumbnail 중심으로 전달하고, base64 fallback은 서버 route 또는 migration cleanup으로 격리한다.
   - 2026-07-05 업데이트: 인증서/QR 검증 page props에서 `avatar_base64`를 제거하고, legacy base64 fallback은 `/api/mm/avatar` 및 `/api/certification/avatar/[token]` route 내부로만 제한했다.

### Medium

1. Production live smoke 최신 결과가 문서화되어야 한다.
   - `npm run test:ssafy-verify:live`는 기본 CI에서 제외되어 있어 운영자가 의도적으로 실행해야 한다.
   - `SSAFY_VERIFY_SMOKE_SEND_MM=1`을 켜면 실제 Mattermost DM이 발송되므로, 실행 날짜와 대상자를 이 문서 또는 Issue #54에 남겨야 한다.

2. 관리자 edge perimeter 설정은 운영값 확정이 남았다.
   - 코드와 `.env.example`은 `ADMIN_ALLOWED_IPS`, `ADMIN_BASIC_AUTH_USERNAME`, `ADMIN_BASIC_AUTH_PASSWORD`를 지원한다.
   - 운영에서 둘 다 비워두면 앱 레벨 관리자 로그인과 rate limit에만 의존한다.
   - 관리자 접속 IP가 불안정하면 Basic Auth를 우선 적용하고, 안정적인 IP 대역이 생기면 allowlist를 추가한다.

3. Vercel legacy Mattermost env 제거 여부가 운영 콘솔에서 확인되어야 한다.
   - 코드와 문서 예시는 `MM_*`, `NEXT_PUBLIC_MATTERMOST_DM_URL`을 더 이상 요구하지 않는다.
   - Vercel에 예전 Mattermost token/base URL이 남아 있으면 실사용은 되지 않더라도 secret sprawl이 된다.
   - 삭제 전에는 직접 Mattermost 연동으로 rollback할 수 없다는 점을 확인해야 한다.

4. SSAFY Verify notification delivery status/recovery 반영이 아직 완결되지 않았다. `2026-07-05 완료`
   - 발송 자체는 Verify Server API에 위임됐다.
   - `GET /v1/notifications/{notification_id}`와 `GET /v1/notifications?campaign_id=...` 결과를 SSARTNERSHIP delivery log에 주기적으로 반영하는 작업은 `Phase 4b`로 남겨둔다.
   - 2026-07-05 업데이트: Verify provider campaign/notification/idempotency/status를 `notification_deliveries`에 저장하고, `/api/cron/ssafy-verify-notification-status` Vercel cron이 campaign status를 조회해 delivery row와 notification metadata를 갱신한다.

5. 기존 사이트 비밀번호 로그인 모델은 아직 남아 있다.
   - 신규 가입은 SSAFY Verify 기반으로 동작하지만 로그인은 `mm_username` + 사이트 비밀번호를 유지한다.
   - 완전한 SSO 제품 경험을 목표로 하면 `/api/mm/login`, 비밀번호 재설정, 비밀번호 변경의 장기 정책을 다시 정해야 한다.

6. 파트너 알림센터 summary 문구와 실제 계산 범위가 다르다. `2026-07-05 완료`
   - 변경 요청, 리뷰, 감사 로그를 최근 일부만 모아 summary를 만들지만 UI는 전체 알림처럼 읽힌다.
   - 조치: 최근 N건 기준이라고 명시하거나, 실제 total aggregate를 별도 계산한다.
   - 2026-07-05 업데이트: 알림센터에 현재 화면에 불러온 최근 알림 기준이라는 안내와 저장 알림/변경 요청/리뷰/운영 로그별 로드 범위를 고정 노출한다.

7. 파트너 상세 접근 실패 UX가 홈 redirect로 흐른다. `2026-07-05 완료`
   - 잘못된 ID나 접근 불가 대상에서 `notFound()` 또는 명시적 게이트 UI 대신 홈으로 이동하면 공유 링크 오류와 SEO/운영 분석이 흐려진다.
   - 조치: public 404, 비공개/권한 제한 상태, 삭제 상태를 분리해 표시한다.
   - 2026-07-05 업데이트: 잘못된 ID/비공개/삭제 대상은 파트너 상세 전용 404 화면으로 처리하고, confidential 대상은 기존 로그인 안내 gate를 유지한다.

8. 회원 상세 로그 조회가 계정 단위로 최대 5000건을 한 번에 전달한다. `2026-07-05 완료`
   - 계정 활동이 누적되면 상세 페이지 payload와 클라이언트 탐색 비용이 커진다.
   - 조치: 회원 상세 보안 로그도 pagination/filter를 기본값으로 둔다.
   - 2026-07-05 업데이트: 회원 상세 보안 로그를 25/50/100건 단위 URL pagination으로 전환했다.

9. `auth_security_logs`에 일부 raw exception message가 남고 CSV export로 전파될 수 있다. `2026-07-05 완료`
   - SSAFY Verify trace 자체는 redaction되지만 다른 auth 흐름의 `error.message`가 그대로 properties에 저장되는 경로가 있다.
   - 조치: auth/security log sink 또는 호출부에서 allowlisted error code/message만 보존하고 raw provider/DB exception은 내부 console 또는 request id로만 연결한다.
   - 2026-07-05 업데이트: `logAuthSecurity` 경계에서 `reason: "exception"`의 `message`를 `redacted_exception`으로 치환한다.

10. 일부 cookie/session 기반 mutation에 same-origin guard가 빠져 있다. `2026-07-05 완료`
   - JSON + SameSite=Lax + CORS 기본값 때문에 즉시 치명적이진 않지만, trust-boundary 문서의 기준과 맞지 않는다.
   - 조치: 회원/파트너 session mutation route에 공통 same-origin 또는 CSRF 성격 검증 helper를 적용한다.
   - 2026-07-05 업데이트: 회원 로그인/로그아웃/탈퇴/약관/비밀번호/프로필 sync, 파트너 비밀번호/리뷰 moderation, SSAFY Verify 가입/재설정 callback route에 same-origin guard를 적용했다.

### Low

1. README의 인증/환경 설명은 계속 동기화가 필요하다.
   - 인증 모델은 Verify 위임 상태를 반영하지만, 최종 식별자가 여전히 `mm_user_id` 중심임을 명확히 유지해야 한다.
   - SMTP 환경 변수 설명은 generic SMTP를 기준으로 두고 Naver SMTP는 fallback으로만 설명한다.

2. Storybook visual regression은 비용상 manual publish로만 남아 있다.
   - 로컬 release gate는 `build-storybook`과 `test-storybook`을 포함한다.
   - 외부 visual snapshot 자동화는 무료 한도 회복 또는 대체 도구 도입 전까지 보류한다.

3. 성능 수치는 Verify 전환 이후 다시 측정해야 한다.
   - 홈 shell split, partner image preload, certification profile sync 지연 처리 후 실제 Production Lighthouse 또는 Speed Insights 재측정이 필요하다.

4. 테스트 범위가 #54의 실제 브라우저 플로우를 충분히 덮지 못한다.
   - 현재 E2E는 홈/공개 상세 중심이고, signup/login/reset/certification/notifications/admin/partner portal의 실제 route, cookie, 권한, redirect 상호작용 회귀는 부족하다.

5. SSAFY Verify trace 로그에는 recipient 식별자 요약이 남는다.
   - token/secret 원문은 저장하지 않지만, `sub`, Mattermost ID, username, cohort는 admin-only 로그에 남는다.
   - `auth_security_logs` 보존 기간과 `logs:read` 권한 범위를 좁게 유지한다.

## Evidence

### GitHub / CI

- Open umbrella issue: [#54](https://github.com/MyKnow/ssartnership/issues/54)
- Completed candidate issues:
  - [#48](https://github.com/MyKnow/ssartnership/issues/48) MM 코드 본인인증 플로우 제거
  - [#50](https://github.com/MyKnow/ssartnership/issues/50) SSAFY Verify 프로필 scope 확장과 외부 API 위임 TODO
  - [#52](https://github.com/MyKnow/ssartnership/issues/52) SSAFY Verify Server API 위임 전환
  - [#53](https://github.com/MyKnow/ssartnership/issues/53) SSAFY Verify 기반 신규 회원가입 흐름 구현
  - [#59](https://github.com/MyKnow/ssartnership/issues/59) SSAFY Verify API request/response 추적 로그 보강
- Recent merged PRs:
  - [#60](https://github.com/MyKnow/ssartnership/pull/60) `feat: SSAFY Verify API 추적 로그 추가`
  - [#58](https://github.com/MyKnow/ssartnership/pull/58) `ci: Chromatic 자동 실행 비활성화`
  - [#57](https://github.com/MyKnow/ssartnership/pull/57) `chore: 공개 readiness 보완 production 승격`
  - [#56](https://github.com/MyKnow/ssartnership/pull/56) `chore: 공개 readiness 보완`
- Recent Actions 상태:
  - `Public Readiness`: dev/main 최신 push 성공
  - `Verify Node Lockfile`: dev/main 최신 push 성공
  - `Publish Storybook`: workflow_dispatch 전용이며 active workflow 목록에서 제외됨

### Code / Tests

- Direct Mattermost credential 제거 회귀: [tests/ssafy-verify-full-delegation.test.mts](/Users/myknow/coding/ssartnership/tests/ssafy-verify-full-delegation.test.mts)
- 기존 MM 인증번호 endpoint 제거 회귀: [tests/mm-code-verification-removal.test.mts](/Users/myknow/coding/ssartnership/tests/mm-code-verification-removal.test.mts)
- SSAFY Verify trace redaction: [tests/ssafy-verify-token-trace.test.mts](/Users/myknow/coding/ssartnership/tests/ssafy-verify-token-trace.test.mts)
- Public Readiness workflow 회귀: [tests/public-readiness.test.mts](/Users/myknow/coding/ssartnership/tests/public-readiness.test.mts)
- Live smoke entrypoint: [tests/live/ssafy-verify-live-smoke.test.mts](/Users/myknow/coding/ssartnership/tests/live/ssafy-verify-live-smoke.test.mts)

### 2026-06-24 Live Smoke

- `SSAFY_VERIFY_LIVE_SMOKE=1 npm run test:ssafy-verify:live`: pass
  - target: `@myknow`
  - directory lookup / profile / sync / profile-events 확인
  - masked Mattermost id: `iiss***pb9y`
  - campus: `서울`
  - cohort: `15`
  - avatar URL: present
- 단건 Mattermost DM smoke: pass
  - endpoint: `POST /v1/notifications/mattermost`
  - target: `@myknow` 1명
  - campaign id: `ssartnership.readiness-mqrr5ic2`
  - notification id: `notify_36ff3e17-eebc-416d-80e8-ffdd55e6264f`
  - status: `sent`

## Issue 정리

| Issue | 상태 판단 | 조치 |
| --- | --- | --- |
| #48 | closeable | 구현/테스트 근거가 충분하므로 comment 후 close |
| #50 | closeable | scope 분리와 외부 API TODO 문서화 완료, comment 후 close |
| #52 | closeable | Server API 위임 핵심 완료, `Phase 4b`만 #54에 잔류 |
| #53 | closeable | 신규 회원가입 flow 완료, comment 후 close |
| #59 | closeable | PR #60으로 trace logging 완료, 운영 runbook은 #54 후속 |
| #54 | keep open | 잔여 운영/문서/성능 sweep umbrella |

## 남은 PR Split

1. `docs/project-completeness-audit`: 이 문서와 이벤트 로깅/운영 TODO 동기화.
2. `fix/reset-password-server-state`: 완료. reset completion token을 URL query에서 제거하고 HttpOnly short-lived server state로 전환.
3. `perf/admin-observability-bounds`: 완료. `/admin/members` query 상한과 회원 상세 보안 로그 pagination, `/admin/logs` fallback bounded loading을 적용.
4. `perf/public-home-boundary`: 완료. 홈 favorite/popularity state를 초기 24개와 현재 보이는 카드 lazy hydration으로 제한.
5. `perf/certification-media`: 완료. 인증서 avatar payload를 URL/thumbnail 중심으로 전환하고 base64 inline fallback 격리.
6. `fix/session-mutation-origin-guard`: 완료. 회원/파트너 session mutation route에 same-origin guard 확대 적용.
7. `fix/partner-notification-summary`: 완료. 파트너 알림센터 summary가 최근 알림 윈도우 기준임을 UI에 명시.
8. `chore/production-env-cleanup`: Vercel legacy Mattermost env 제거 확인, 관리자 perimeter 운영값 적용.
9. `feat/ssafy-notification-status-sync`: 완료. Verify notification status/recovery 결과를 delivery log와 notification metadata에 반영.
10. `test/flow-coverage`: signup/login/reset/certification/notifications/admin login/partner login E2E와 핵심 integration 보강.
11. `refactor/member-auth-model`: 사이트 비밀번호 로그인 유지/폐기 정책 확정 후 구현.

## 권장 검증 명령

```bash
npm run check:lockfile
node --import ./tests/alias-register.mjs --test \
  tests/public-readiness.test.mts \
  tests/ssafy-verify-full-delegation.test.mts \
  tests/ssafy-verify-server-api.test.mts \
  tests/ssafy-verify-token-trace.test.mts \
  tests/mm-code-verification-removal.test.mts

# 조회 / profile / sync / profile-events 실호출
SSAFY_VERIFY_LIVE_SMOKE=1 npm run test:ssafy-verify:live

# 실제 Mattermost 발송까지 확인할 때만 사용한다.
SSAFY_VERIFY_LIVE_SMOKE=1 SSAFY_VERIFY_SMOKE_SEND_MM=1 npm run test:ssafy-verify:live
```

## 운영자 체크리스트

- [ ] Production live smoke 실행 결과를 Issue #54에 기록한다.
- [ ] `ADMIN_ALLOWED_IPS` 또는 Basic Auth 운영값을 확정한다.
- [ ] Vercel Production/Preview에서 legacy Mattermost env 잔존 여부를 확인하고 제거한다.
- [ ] 완료된 이슈 #48, #50, #52, #53, #59를 comment 후 close한다.
- [x] Verify notification status/recovery sync를 별도 PR로 진행한다.
- [ ] Verify 전환 후 Production 성능을 재측정한다.
