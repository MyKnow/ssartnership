# TODO

정렬 기준: 영향 범위 × 위험도 × 구현 효과. 위에 있는 항목일수록 먼저 처리한다.

최종 점검: 2026-07-05

## 공개 readiness 보완 (Issue #55)

- [x] SSAFY Verify Server API Production env 등록
- [ ] Production 재배포 후 Verify profile-sync 라이브 스모크
- [x] GitHub Actions 공개 readiness gate 추가
- [x] 공개 저장소용 `SECURITY.md` responsible disclosure 정책 추가
- [x] 파트너 상세 대표 이미지 LCP/CLS 개선
- [x] `main` 브랜치 보호 규칙과 required status checks 적용
- [ ] 관리자 edge perimeter hardening 값 확정: `ADMIN_ALLOWED_IPS` 또는 Basic Auth
- [ ] Vercel legacy Mattermost env 제거: 명시 승인 후 `MM_*`, `NEXT_PUBLIC_MATTERMOST_DM_URL` 삭제
- [ ] SSAFY Verify notification status/recovery 결과를 delivery log에 주기적으로 반영
- [x] SSAFY Verify User Auth/Server API request-response trace 로그 추가
- [x] 비밀번호 재설정 completion token URL query 노출 제거
- [x] auth/security log raw exception redaction 적용
- [ ] 회원/파트너 session mutation route same-origin guard 전체 적용

주의: 관리자 IP allowlist와 Basic Auth는 운영자 접속을 잠글 수 있어 값 확정 후 적용한다.
legacy Mattermost env 제거는 예전 직접 연동 배포로 롤백할 수 없게 만들 수 있어 별도 승인 후 적용한다.

1. [x] 공개 레이아웃의 세션 및 정책 조회 비용 줄이기
   대상: `src/app/(site)/layout.tsx`, `src/lib/user-auth.ts`, `src/lib/policy-documents.ts`
   이유: 모든 공개 요청마다 `members`와 `policy_documents`를 기다리므로 TTFB와 skeleton 지속 시간이 길어진다.
   완료: required policy 조회를 캐시하고, member 조회와 policy 조회를 병렬화했다.

2. [x] 공개 홈의 초기 응답 경로에서 세션/푸시 조회와 client hydration 비용 줄이기
   대상: `src/app/(site)/page.tsx`, `src/components/HomeContent.tsx`, `src/components/HomePushOptInBannerGate.tsx`, `src/components/HomeView.tsx`, `src/components/PushOptInBanner.tsx`
   이유: 홈은 세션 확인 뒤 파트너 목록과 push preferences를 기다리고, 화면 자체도 client component 비중이 높아 첫 콘텐츠와 상호작용 가능 시점이 늦어진다.
   완료: 홈 shell(hero/header)과 push opt-in을 서버 경계로 분리하고, 카테고리/파트너 조회를 `HomeContent` 서버 컴포넌트 뒤로 늦춰 초기 응답을 먼저 내보내게 했다.

3. [x] 홈 스켈레톤 DOM 및 애니메이션 비용 줄이기
   대상: `src/app/(site)/loading.tsx`, `src/components/loading/SitePageSkeletons.tsx`, `src/components/ui/Skeleton.tsx`
   이유: `SiteHeader` + hero + filter + 6개 카드 구조는 모바일 저사양 기기에서 불필요하게 무겁고, `animate-pulse`가 그 비용을 더 키운다.
   완료: 로딩 헤더를 정적 스켈레톤으로 바꾸고, 홈 스켈레톤은 3개 카드와 섹션 단위 pulse로 줄였다.

4. [x] 파트너 상세 이미지 캐러셀의 수동 조작 응답성 개선
   대상: `src/app/(site)/partners/[id]/page.tsx`, `src/components/PartnerImageCarousel.tsx`, `src/lib/image-cache.ts`, `src/app/api/image/route.ts`, `next.config.ts`
   이유: 자동 전환은 데스크톱 전용이지만 수동 클릭 후에도 타이머가 계속 돌 수 있고, 새 포커스 이미지는 `/api/image` + `next/image` 경로로 다시 fetch/decode해야 해서 체감 반응이 늦다.
   완료: 이미지를 전부 preload하고, 준비 전에는 스켈레톤을 띄우도록 바꿔 수동 전환 시 로딩 체감을 줄였다.

5. [x] 인증 페이지 진입 시 동기화 작업 분리/지연 처리
   대상: `src/app/(site)/certification/page.tsx`, `src/components/certification/CertificationProfileSync.tsx`, `src/app/api/mm/profile-sync/route.ts`, `src/lib/mm-member-sync.ts`
   이유: Mattermost 사용자/이미지 동기화가 첫 화면 표시 경로에 들어와 route load를 늘린다.
   완료: 인증 화면은 기존 member 데이터를 바로 렌더하고, profile sync는 마운트 후 지연된 백그라운드 POST로 분리했다.

6. [x] `/api/image` SSRF 및 DNS rebinding 방어 강화
   대상: `src/app/api/image/route.ts`, `src/lib/image-proxy.ts`, `tests/image-proxy.test.mts`
   이유: 공용 이미지 프록시라 공격면이 크고, 현재의 localhost/IP literal 차단만으로는 내부 자원 접근을 충분히 막지 못한다.
   완료: DNS lookup으로 공용 IP만 선택하고, 그 IP로 직접 연결하도록 바꿔 rebinding 경로를 차단했다.

7. [x] QR 검증 경로의 토큰 노출 차단
   대상: `src/app/(site)/verify/[token]/page.tsx`, `src/components/analytics/AnalyticsEventOnMount.tsx`, `src/components/analytics/RoutePageViewTracker.tsx`, `src/lib/product-events.ts`, `src/lib/product-event-path.ts`, `src/app/api/events/product/route.ts`, `src/lib/activity-logs.ts`
   이유: 현재 분석 이벤트에 경로가 그대로 실리면 민감한 QR 토큰이 로그로 전파될 수 있다.
   완료: QR 검증 경로와 page_view 경로를 `/verify/[token]`으로 정규화하고, 서버 수신 시에도 같은 정규화를 적용했다.

8. [x] `user_session` 및 `admin_session` 검증 예외 처리 일원화
   대상: `src/lib/user-auth.ts`, `src/lib/auth.ts`, `src/lib/hmac.js`
   이유: malformed cookie에서 예외가 터지지 않도록 길이 체크와 실패 처리를 공통화해야 한다.
   완료: HMAC 검증 공통 헬퍼를 추가해 길이 불일치 시 예외 없이 실패 처리하도록 맞췄다.

9. [x] 멤버 인증 API brute-force 완화
   대상: `src/app/api/mm/login/route.ts`, `src/app/api/mm/reset-password/complete/route.ts`, `src/app/api/mm/change-password/route.ts`, `src/app/api/ssafy/verify-token/route.ts`, `src/app/api/ssafy/reset-password/route.ts`
   이유: 계정 + IP 기반 throttle, 실패 지연, 과도한 에러 노출 억제가 아직 더 필요하다.
   완료: `member_auth_attempts` 기반 공통 throttle을 추가하고, 실패마다 지연을 넣었으며, 계정 존재 여부와 내부 오류 메시지 노출을 줄였다.

10. [x] QR 서명과 reset 세션용 암호학적 서명 분리
    대상: `src/lib/certification-qr.ts`, `src/lib/reset-password-session.ts`, `src/lib/hmac.js`
    이유: 용도별 서명 payload와 secret fallback을 분리해 토큰 오남용 범위를 줄이는 편이 좋다.
    완료: 구성원 QR과 비밀번호 재설정 completion token을 각각 HMAC 서명으로 검증하며, 비밀번호 재설정은 SSAFY Verify 확인 후 짧은 만료 token만 발급한다.

11. [x] 관리자 로그 조회 및 CSV export의 메모리 사용량 줄이기
   대상: `src/lib/log-insights.ts`, `src/app/api/admin/logs/export/route.ts`
   완료: export는 선택된 로그 그룹만 읽고, CSV는 스트림으로 내보내도록 바꿨다.

12. [x] MM 디렉토리 및 회원 동기화의 순차 처리 줄이기
   대상: `src/lib/mm-directory.ts`, `src/lib/mm-member-sync.ts`
   완료: year 단위 작업을 병렬화하고, 결과 병합은 기존 우선순위를 유지하도록 정리했다.

13. [x] 협력사 전용 포털 분리
   대상: `supabase/schema.sql`, `supabase/migrations/*`, `src/app/partner/**`, `src/lib/partner-*.ts`, `src/lib/activity-logs.ts`, `src/app/admin/(protected)/actions.ts`
   이유: 협력사가 여러 브랜드를 소유하고, 그 아래 여러 관리 계정을 가질 수 있어야 한다. 협력사 / 브랜드 / account 구조를 먼저 깔고, 그 위에 전용 포털과 승인 흐름을 얹으면 admin과 권한을 분리하면서 외부 협력사용 UX를 단계적으로 만들 수 있다.
   세부 단계:
   13-1. [x] 협력사 / 브랜드 / account 스키마 초안 확정
      완료: `partner_companies`, `partners.company_id`, `partner_accounts`, `partner_account_companies`, `partner_auth_attempts`와 관련 migration을 먼저 추가했다.
   13-2. [x] 관리자에서 협력사 담당자 이메일 발급 및 협력사 연결
      대상: `src/app/admin/(protected)/actions.ts`, `src/app/admin/(protected)/partners/**`, `src/lib/partner-*.ts`
      목표: 협력사를 생성할 때 담당자 이메일과 협력사-계정 연결을 함께 만들 수 있어야 한다.
      완료: 관리자 제휴 폼에서 협력사 선택/생성, 담당자 이메일 입력, 포털 계정 생성 및 협력사-계정 연결까지 저장되도록 묶었다.
   13-3. [x] 초기 설정 페이지에서 이메일 인증 및 비밀번호 설정
      대상: `src/app/partner/setup/**`, `src/app/api/partner/**`, `src/lib/partner-auth-*.ts`
      목표: 담당자가 링크로 들어와 이메일 소유를 확인하고 초기 비밀번호를 직접 설정하게 한다.
      완료: mock 데모 목록과 토큰별 설정 페이지/API를 붙여 이메일 코드 확인과 초기 비밀번호 설정을 바로 테스트할 수 있게 했다.
   13-4. [x] 협력사 포털 로그인 및 세션 분리
      대상: `src/app/partner/login/**`, `src/app/partner/layout.tsx`, `middleware.ts`, `src/lib/partner-session.ts`
      목표: 협력사 계정은 관리자/일반 사용자 세션과 분리된 경계에서만 접근하게 한다.
      완료: `/partner` 진입 시 세션이 없으면 로그인으로 보내고, 별도 `partner_session` 쿠키와 로그인 서버 액션, rate limit, 보안 로그를 붙였다.
   13-5. [x] 소속 브랜드 조회와 수치형 로그만 노출
      대상: `src/app/partner/**`, `src/lib/activity-logs.ts`, `src/lib/partner-dashboard.ts`
      목표: 협력사는 자신이 소유한 여러 브랜드의 정보와 조회수/클릭수 같은 집계 수치만 볼 수 있게 한다.
      완료: `/partner` 대시보드를 협력사별 브랜드 카드로 바꾸고, raw 로그 대신 조회수/카드 클릭/지도 클릭/예약/문의 집계만 보여주게 했다.
   13-6. [x] 브랜드 정보 수정 시 승인/취소 흐름 추가
      대상: `src/app/partner/**`, `src/app/admin/(protected)/actions.ts`, `src/lib/partner-change-requests.ts`
      목표: 혜택, 이용 조건, 적용 대상 같은 민감한 항목은 변경 요청으로 저장하고, 나의 승인 후에만 반영되게 한다.
      완료: 브랜드 상세 페이지에서 편집 모드로 변경 요청을 만들고, 관리자 대기열에서 승인/거절/취소를 처리하게 바꿨다.
   13-7. [x] 비밀번호 재설정 메일과 초기 비밀번호 재발급
      대상: `src/app/api/partner/**`, `src/lib/partner-mail.ts`, `src/lib/partner-auth-*.ts`
      목표: 비밀번호를 잊었을 때 초기 비밀번호가 포함된 재설정 메일을 보낼 수 있게 한다.
      완료: 로그인 페이지와 공통 Header/Footer에 재설정/변경 진입점을 추가하고, 이메일 인증 기반 임시 비밀번호 발급 후 임시 비밀번호 로그인 시 강제 변경되도록 `/partner` 경로를 차단했다.
   13-8. [x] 관리자 페이지에서 협력사 계정 및 권한 관리
      대상: `src/app/admin/(protected)/**`, `src/components/admin/**`, `src/lib/partner-*.ts`
      목표: 내가 협력사 계정 상태, 권한, 연결된 협력사와 브랜드를 한 곳에서 관리할 수 있어야 한다.
      완료: `admin/partners`에 협력사 계정 관리 섹션을 추가해 로그인 아이디, 표시명, 활성 상태, 강제 비밀번호 변경 여부와 협력사별 권한을 수정할 수 있게 했다.
   13-9. [x] 협력사 리스트 CRUD
      대상: `src/app/admin/(protected)/companies/**`, `src/components/admin/AdminCompanyManager.tsx`, `src/app/admin/(protected)/actions.ts`
      완료: 관리자 홈에서 협력사 관리 카드와 브랜드 관리 카드를 분리하고, 협력사 전용 페이지에서 협력사 목록 생성/수정/삭제와 담당자 계정 연결 현황을 관리할 수 있게 했다.

14. [x] 제휴 업체 정적 이미지 저장
   대상: `src/lib/repositories/*`, `src/components/PartnerImageCarousel.tsx`, `src/components/PartnerCardForm.tsx`, `src/app/api/image/route.ts`, storage 관련 레이어
   이유: 제휴 업체 이미지를 정적 저장/서빙하면 외부 링크 의존과 로딩 변동성을 줄이고, 캐시 효율과 안정성을 높일 수 있다.
   완료: 썸네일과 갤러리를 분리하고, 로컬 업로드/드래그앤드롭/URL 입력 후 크롭한 `webp` 파일을 `partner-media` storage로 일괄 저장하도록 바꿨다.

15. [x] 리뷰/즐겨찾기/알림센터 확장
   대상: `src/lib/reviews/**`, `src/components/review/**`, `src/components/home-view/selectors.ts`, `src/lib/partner-dashboard.ts`, `src/lib/admin-notification-ops.ts`, `src/app/admin/**`, `src/app/partner/**`, `src/components/notifications/**`
   이유: 리뷰 반응, 브랜드 즐겨찾기, 홈 인기 정렬, 카드 메트릭, Admin/Partner 전용 알림센터를 한 흐름으로 묶어 사용성, 재방문, 운영 효율을 같이 올린다.
   세부 단계:
   15-1. [x] 리뷰 추천/비추천
      대상: `src/lib/repositories/partner-review-repository.ts`, `src/app/api/partners/[id]/reviews/**`, `src/components/admin/reviews/**`
      목표: 리뷰별 추천/비추천 1회 반응과 취소를 처리하고, 리뷰 목록/상세/관리자 화면에 집계값을 노출한다.
   15-2. [x] 홈 정렬을 인기 많은 순으로 변경
      대상: `src/components/home-view/selectors.ts`, `src/components/HomeView.tsx`, `src/app/(site)/page.tsx`
      목표: 즐겨찾기·리뷰·조회수 기반 가중치 점수를 기본 정렬로 쓰고, 정렬 옵션에 `인기 많은 순`을 추가한다.
   15-3. [x] 브랜드 즐겨찾기
      대상: `src/lib/repositories/*`, `src/app/api/partners/[id]/favorite/**`, `src/components/partner/**`, `src/components/home-view/**`
      목표: 회원별 브랜드 즐겨찾기/해제와 상태 동기화를 제공한다.
   15-4. [x] 카드 메트릭 노출
      대상: `src/lib/partner-dashboard.ts`, `src/app/(site)/partners/**`, `src/components/partner/**`
      목표: 카드에 즐겨찾기 수, 리뷰 수, 뷰어십 수를 보여주고 홈 정렬과 같은 집계 소스를 쓴다.
   15-5. [x] Admin 알림센터
      대상: `src/app/admin/**`, `src/components/admin/**`, `src/lib/admin-notification-ops.ts`
      목표: `/admin/notifications` 별도 페이지에서 발송 결과, 실패, 예약/즉시 발송, 대상자 요약을 조회한다.
   15-6. [x] Partner 알림센터
      대상: `src/app/partner/**`, `src/components/partner/**`, `src/lib/repositories/notification-repository.*`
      목표: `/partner/notifications` 별도 페이지에서 공지, 운영 알림, 승인/반려, 정산/리뷰 알림을 조회한다.

16. [ ] SSAFY Verify 전환 후속
   대상: `src/app/api/ssafy/verify-token/route.ts`, `src/lib/ssafy-verify/**`, `src/app/auth/**`, `src/app/api/mm/login/route.ts`, `src/app/api/mm/reset-password/**`, `src/app/api/mm/change-password/route.ts`, `src/lib/mattermost/**`, `src/lib/mm-member-sync/**`
   이유: User Auth와 Server API 위임은 dev에서 동작하지만, 기존 서비스 식별자와 프로필 이미지 저장 모델은 여전히 MM ID/base64 중심이다. Verify가 제공하는 profile URL 계약과 SSARTNERSHIP 저장 방식을 맞춰 신규 가입 후 인증 카드/프로필 UX까지 완성해야 한다.
   세부 단계:
   16-1. [x] SSAFY Verify Mattermost ID 매핑 검증
      완료: Server API profile의 `ssafy_mattermost_user_id`를 기존 `members.mm_user_id`와 매칭하는 기준으로 사용하고, sibling User Auth client scope 기준 profile 응답을 Verify 측에서 수정해 검증했다.
   16-2. [x] SSAFY Verify 기반 신규 회원 온보딩
      완료: 기존 회원이 없으면 Verify Server API profile로 가입 세션을 만들고, 비밀번호/약관 입력 후 `members` row를 생성한다. 이미 가입된 사용자는 로그인 페이지로 되돌린다.
   16-3. [ ] 기존 MM ID + 사이트 비밀번호 로그인 전환
      목표: `/api/mm/login`, 비밀번호 재설정, 비밀번호 변경을 SSAFY Verify 로그인/세션 모델로 대체하고, 비밀번호 해시 보존/삭제 정책을 정한다.
   16-4. [x] Mattermost 알림 및 프로필 동기화 Server API 위임
      완료: DM 발송, 디렉터리 lookup, profile-events, 프로필/아바타 동기화를 SSAFY Verify Server API로 위임하고 직접 Mattermost env와 클라이언트 호출을 제거했다.
   16-5. [x] Verify profile image URL 저장/렌더링 전환
      완료: Verify profile의 `picture` URL을 absolute URL로 정규화해 `members.avatar_url`에 저장하고, 회원가입/인증 카드/관리자 회원 화면에서 기존 base64 fallback과 함께 렌더링한다.
   16-6. [x] 임시 진단 UI 제거와 운영 로그 중심 디버깅 정착
      완료: 일반 사용자 화면에는 stable error message만 보여주고, provider diagnostic은 서버 보안 로그와 명시적 `SSAFY_VERIFY_DEBUG_ERRORS=1` 환경에서만 확인한다.
   16-7. [x] SSAFY Verify API request/response 추적 로그
      완료: User Auth token exchange와 Server API profile/directory/sync/profile-events/notification/status 호출을 `ssafy_verify_api_trace`로 요약 저장하고, token/code/secret/raw provider 응답은 redaction한다.
   16-8. [ ] Verify notification delivery status 동기화
      목표: `GET /v1/notifications/{notification_id}`와 campaign status 조회 결과를 SSARTNERSHIP delivery log/recovery view에 주기적으로 반영한다.
   16-9. [x] 비밀번호 재설정 completion token 서버 상태 전환
      목표: `/auth/reset/complete?token=...` query 전달을 제거하고, HttpOnly short-lived cookie 또는 server-owned reset transaction id로 재설정 완료 권한을 전달한다.
      완료: SSAFY Verify 재인증 API는 completion token을 JSON으로 반환하지 않고 HttpOnly short-lived cookie로 설정하며, 완료 API는 same-origin JSON 요청과 cookie token만 검증하고 성공 시 cookie를 폐기한다.
   16-10. [ ] session mutation same-origin guard 정착
      목표: 회원/파트너 session mutation route에는 공통 same-origin guard를 적용한다. auth/security logs의 raw exception message는 `logAuthSecurity` 경계에서 redaction하도록 완료했다.

17. [ ] 공개 운영 성능 high-risk 보완
   근거: `docs/operations/project-completeness-audit-2026-06-24.md`
   세부 단계:
   17-1. [ ] 관리자 회원 화면 query bounded loading
      목표: 옵션/목록/추이/푸시 필터 query를 분리하고, 500명 page size와 전체 `created_at` 스캔을 제거하거나 DB-side aggregate로 대체한다. 회원 상세 보안 로그도 pagination으로 전환한다.
   17-2. [ ] 관리자 로그 기본 진입 bounded loading
      목표: `/admin/logs` 기본 `24h` 진입에서 그룹별 무제한 row 수집을 막고, 요약은 DB-side aggregate 또는 lightweight endpoint로 분리한다.
   17-3. [ ] 공개 홈 server/client 경계 축소
      목표: 초기 노출 목록 기준 pagination/server filtering을 적용하고, favorite/popularity state를 전체 배열이 아니라 보이는 목록 중심으로 계산한다.
   17-4. [ ] 인증서 avatar payload 경량화
      목표: `avatar_base64` inline 전달을 URL/thumbnail 중심으로 바꾸고, base64 fallback은 서버 route 또는 migration cleanup으로 격리한다.
   17-5. [x] 파트너 알림센터 summary 의미 보정
      목표: summary가 최근 N건 기준이면 UI에 명시하고, 전체 통계가 필요하면 total aggregate를 별도로 계산한다.
      완료: 알림센터에 현재 화면에 불러온 최근 알림 기준이며 운영 데이터는 저장 알림 최근 30건, 변경 요청/리뷰/운영 로그 최근 20건 단위라는 안내를 고정 노출한다.
   17-6. [ ] 파트너 상세 접근 실패 UX 보정
      목표: 잘못된 ID/비공개/삭제 상태를 홈 redirect가 아니라 명시적 404 또는 접근 제한 화면으로 구분한다.

## 유지 규칙

- 완료한 항목은 `[ ]`를 `[x]`로 바꾼다.
- 범위가 커지거나 더 좋은 대안이 생기면 항목 설명을 업데이트한다.
- 새로운 발견은 위 순서에 맞춰 다시 삽입한다.
