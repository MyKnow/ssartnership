# TODO

정렬 기준: 영향 범위 × 위험도 × 구현 효과. 위에 있는 항목일수록 먼저 처리한다.

최종 점검: 2026-04-09

1. [ ] 공개 레이아웃의 세션 및 정책 조회 비용 줄이기
   대상: `src/app/(site)/layout.tsx`, `src/lib/user-auth.ts`, `src/lib/policy-documents.ts`
   이유: 모든 공개 요청마다 `members`와 `policy_documents`를 기다리므로 TTFB와 skeleton 지속 시간이 길어진다.

2. [ ] 공개 홈의 초기 응답 경로에서 세션/푸시 조회와 client hydration 비용 줄이기
   대상: `src/app/(site)/page.tsx`, `src/lib/push.ts`, `src/components/HomeView.tsx`, `src/components/PartnerCardView.tsx`, `src/components/SiteHeader.tsx`
   이유: 홈은 세션 확인 뒤 파트너 목록과 push preferences를 기다리고, 화면 자체도 client component 비중이 높아 첫 콘텐츠와 상호작용 가능 시점이 늦어진다.

3. [ ] 홈 스켈레톤 DOM 및 애니메이션 비용 줄이기
   대상: `src/app/(site)/loading.tsx`, `src/components/loading/SitePageSkeletons.tsx`, `src/components/ui/Skeleton.tsx`
   이유: `SiteHeader` + hero + filter + 6개 카드 구조는 모바일 저사양 기기에서 불필요하게 무겁고, `animate-pulse`가 그 비용을 더 키운다.

4. [ ] 파트너 상세 이미지 캐러셀의 수동 조작 응답성 개선
   대상: `src/components/PartnerImageCarousel.tsx`, `src/lib/image-cache.ts`, `src/app/api/image/route.ts`, `next.config.ts`
   이유: 자동 전환은 데스크톱 전용이지만 수동 클릭 후에도 타이머가 계속 돌 수 있고, 새 포커스 이미지는 `/api/image` + `next/image` 경로로 다시 fetch/decode해야 해서 체감 반응이 늦다.

5. [ ] 인증 페이지 진입 시 동기화 작업 분리/지연 처리
   대상: `src/app/(site)/certification/page.tsx`, `src/lib/mm-member-sync.ts`
   이유: Mattermost 사용자/이미지 동기화가 첫 화면 표시 경로에 들어와 route load를 늘린다.

6. [ ] `/api/image` SSRF 및 DNS rebinding 방어 강화
   대상: `src/app/api/image/route.ts`
   이유: 공용 이미지 프록시라 공격면이 크고, 현재의 localhost/IP literal 차단만으로는 내부 자원 접근을 충분히 막지 못한다.

7. [ ] QR 검증 경로의 토큰 노출 차단
   대상: `src/app/(site)/verify/[token]/page.tsx`, `src/lib/product-events.ts`, `src/app/api/events/product/route.ts`
   이유: 현재 분석 이벤트에 경로가 그대로 실리면 민감한 QR 토큰이 로그로 전파될 수 있다.

8. [ ] `user_session` 및 `admin_session` 검증 예외 처리 일원화
   대상: `src/lib/user-auth.ts`, `src/lib/auth.ts`
   이유: malformed cookie에서 예외가 터지지 않도록 길이 체크와 실패 처리를 공통화해야 한다.

9. [ ] 멤버 인증 API brute-force 완화
   대상: `src/app/api/mm/login/route.ts`, `src/app/api/mm/request-code/route.ts`, `src/app/api/mm/verify-code/route.ts`, `src/app/api/mm/reset-password/route.ts`, `src/app/api/mm/change-password/route.ts`
   이유: 계정 + IP 기반 throttle, 실패 지연, 과도한 에러 노출 억제가 아직 더 필요하다.

10. [ ] 인증 코드와 QR 서명용 암호학적 난수 및 시크릿 분리
    대상: `src/lib/mm-verification.ts`, `src/lib/certification-qr.ts`
    이유: `Math.random` 기반 코드 생성은 바꾸는 편이 안전하고, 용도별 secret도 분리하는 편이 좋다.

11. [ ] 관리자 로그 조회 및 CSV export의 메모리 사용량 줄이기
    대상: `src/lib/log-insights.ts`, `src/app/api/admin/logs/export/route.ts`
    이유: 로그가 커질수록 전체를 읽어서 다시 집계하는 구조가 응답 지연과 메모리 증가로 이어진다.

12. [ ] MM 디렉토리 및 회원 동기화의 순차 처리 줄이기
    대상: `src/lib/mm-directory.ts`, `src/lib/mm-member-sync.ts`
    이유: 현재는 year/member 단위로 순차 호출이 많아서 cron 시간이 길어지고 Mattermost API 부하도 커진다.

## 유지 규칙

- 완료한 항목은 `[ ]`를 `[x]`로 바꾼다.
- 범위가 커지거나 더 좋은 대안이 생기면 항목 설명을 업데이트한다.
- 새로운 발견은 위 순서에 맞춰 다시 삽입한다.
