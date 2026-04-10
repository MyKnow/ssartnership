# TODO

정렬 기준: 영향 범위 × 위험도 × 구현 효과. 위에 있는 항목일수록 먼저 처리한다.

최종 점검: 2026-04-10

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
   대상: `src/app/api/mm/login/route.ts`, `src/app/api/mm/request-code/route.ts`, `src/app/api/mm/verify-code/route.ts`, `src/app/api/mm/reset-password/route.ts`, `src/app/api/mm/change-password/route.ts`
   이유: 계정 + IP 기반 throttle, 실패 지연, 과도한 에러 노출 억제가 아직 더 필요하다.
   완료: `member_auth_attempts` 기반 공통 throttle을 추가하고, 실패마다 지연을 넣었으며, 계정 존재 여부와 내부 오류 메시지 노출을 줄였다.

10. [x] 인증 코드와 QR 서명용 암호학적 난수 및 시크릿 분리
    대상: `src/lib/mm-verification.ts`, `src/lib/certification-qr.ts`, `src/lib/hmac.js`
    이유: `Math.random` 기반 코드 생성은 바꾸는 편이 안전하고, 용도별 secret도 분리하는 편이 좋다.
    완료: 인증 코드는 `crypto.randomInt`로 바꾸고, 해시는 전용 `MM_VERIFICATION_SECRET` 우선 사용으로 분리했다.

11. [x] 관리자 로그 조회 및 CSV export의 메모리 사용량 줄이기
   대상: `src/lib/log-insights.ts`, `src/app/api/admin/logs/export/route.ts`
   완료: export는 선택된 로그 그룹만 읽고, CSV는 스트림으로 내보내도록 바꿨다.

12. [x] MM 디렉토리 및 회원 동기화의 순차 처리 줄이기
   대상: `src/lib/mm-directory.ts`, `src/lib/mm-member-sync.ts`
   완료: year 단위 작업을 병렬화하고, 결과 병합은 기존 우선순위를 유지하도록 정리했다.

13. [ ] 제휴 업체 전용 포털 분리
   대상: `src/app/partner/**`, `src/lib/partner-*.ts`, `src/lib/activity-logs.ts`, `src/app/admin/(protected)/actions.ts`
   이유: 제휴 업체가 자기 업체에 관련된 로그와 기능만 볼 수 있는 전용 페이지를 두면, admin과 권한을 분리하면서 외부 파트너용 UX를 따로 설계할 수 있다.

14. [ ] 제휴 업체 정적 이미지 저장
   대상: `src/lib/repositories/*`, `src/components/PartnerImageCarousel.tsx`, `src/components/PartnerCardForm.tsx`, `src/app/api/image/route.ts`, storage 관련 레이어
   이유: 제휴 업체 이미지를 정적 저장/서빙하면 외부 링크 의존과 로딩 변동성을 줄이고, 캐시 효율과 안정성을 높일 수 있다.

## 유지 규칙

- 완료한 항목은 `[ ]`를 `[x]`로 바꾼다.
- 범위가 커지거나 더 좋은 대안이 생기면 항목 설명을 업데이트한다.
- 새로운 발견은 위 순서에 맞춰 다시 삽입한다.
