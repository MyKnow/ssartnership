# 전역 최적화 프로그램

## 운영 원칙
- wave 단위로 진행한다.
- 각 wave 종료 시 `npm run lint`, `npx tsc --noEmit`, 관련 핵심 테스트, 문서 `Status`를 갱신한다.
- 리팩토링과 명백한 버그 수정만 허용한다.
- 기능 정책 변경은 하지 않는다.

## 백로그

### OPT-001
- ID: `OPT-001`
- Priority: `P0`
- Category: `maintainability`
- Targets: `src/lib/push.ts`, `src/components/admin/AdminPushManager.tsx`, `src/components/push/PushSettingsCard.tsx`
- Current Problem: push 도메인 로직, 관리자 발송 UI, 개인 알림 설정 UI가 각각 과도한 책임을 갖고 있고, 파싱/발송/상태 계산/표시 로직이 한 파일에 몰려 있다.
- Planned Change: push 도메인을 payload builder, audience resolver, preferences/subscriptions service, log service, send orchestration으로 나누고, admin/settings UI는 form state, log filtering, render section, browser capability helper로 분리한다.
- Validation: `npm run lint`, `npx tsc --noEmit`, push 관련 핵심 테스트 추가 또는 기존 발송/설정 경로 회귀 검증
- Status: `pending`

### OPT-002
- ID: `OPT-002`
- Priority: `P0`
- Category: `maintainability`
- Targets: `src/components/partner/PartnerServiceDetailView.tsx`, `src/components/admin/PartnerChangeRequestQueue.tsx`, `src/components/partner/PartnerChangeRequestForm.tsx`
- Current Problem: partner/admin 양쪽에서 diff 렌더, pending UI, action bar, metadata 구성이 중복되고, 변경 요청 관련 화면 책임이 과도하게 크다.
- Planned Change: diff presentation primitive, metadata section, immediate/approval tabs, contact popup/action bar를 공용 단위로 추출하고 각 화면은 orchestration만 남긴다.
- Validation: `npm run lint`, `npx tsc --noEmit`, `node --test tests/partner-portal.mock.test.mts`
- Status: `pending`

### OPT-003
- ID: `OPT-003`
- Priority: `P0`
- Category: `maintainability`
- Targets: `src/lib/partner-auth.ts`, `src/app/api/mm/verify-code/route.ts`, `src/app/api/mm/request-code/route.ts`, `src/app/api/mm/reset-password/route.ts`
- Current Problem: auth 도메인에서 request parsing, throttle, Mattermost resolution, session/policy handling, response mapping이 한 파일에 섞여 있다.
- Planned Change: auth helper, request parser, domain command, response mapper로 분리하고 API route는 orchestration만 남긴다.
- Validation: `npm run lint`, `npx tsc --noEmit`, MM auth 관련 핵심 테스트
- Status: `pending`

### OPT-004
- ID: `OPT-004`
- Priority: `P1`
- Category: `maintainability`
- Targets: `src/lib/mock/partner-portal.ts`, `src/components/PartnerImageCarousel.tsx`, `src/components/PartnerCardView.tsx`
- Current Problem: mock/public UI에 큰 단위 파일이 남아 있어 유지보수성과 회귀 범위가 크다.
- Planned Change: mock store/service helpers, carousel interaction helpers, partner card display primitives로 분해한다.
- Validation: `npm run lint`, `npx tsc --noEmit`, 기존 mock portal 테스트
- Status: `pending`

### OPT-005
- ID: `OPT-005`
- Priority: `P1`
- Category: `performance`
- Targets: admin/client list screens 전반
- Current Problem: 클라이언트 컴포넌트에서 검색 인덱스 생성과 대량 리스트 전처리가 렌더마다 반복되는 구간이 남아 있다.
- Planned Change: selector를 pure module로 이동하고, 검색 인덱스/정렬 전처리를 입력 변화 기준으로 제한하며, 화면별 무거운 `useMemo` 의존성을 줄인다.
- Validation: selector unit test, 렌더 영향 확인, lint/tsc
- Status: `pending`

### OPT-006
- ID: `OPT-006`
- Priority: `P1`
- Category: `ux`
- Targets: admin/partner/auth form 흐름 전반
- Current Problem: 입력 오류와 네트워크 오류를 inline recovery로 처리하는 기준이 화면마다 완전히 통일되지 않았다.
- Planned Change: field error, form error, inline message, toast 사용 기준을 정리하고 복구 가능한 실패는 입력 유지 + inline message로 통일한다.
- Validation: 주요 create/update/login/reset 흐름 수동 회귀 + 관련 테스트
- Status: `pending`

### OPT-007
- ID: `OPT-007`
- Priority: `P1`
- Category: `seo`
- Targets: `src/app/sitemap.ts`, `src/app/robots.ts`, canonical/meta 구성 전반
- Current Problem: sitemap/robots는 기본 동작은 되지만 lastmod 안정성, canonical 일관성, 검색엔진 친화적 fallback 점검이 더 필요하다.
- Planned Change: sitemap/robots/canonical 경로를 재점검하고, 동적 실패 시 fail-soft와 안정적인 메타 구성을 강화한다.
- Validation: 정적 검증, production URL 출력 점검, Search Console 재검토 기준 문서화
- Status: `pending`

### OPT-008
- ID: `OPT-008`
- Priority: `P1`
- Category: `ops`
- Targets: cron/manual broadcast/notification 운영 경로
- Current Problem: cron partial failure, 환경 변수 준비 상태, 운영 로그/알림 회복 경로가 문서화와 코드 양쪽에서 더 정리될 여지가 있다.
- Planned Change: 배치 실패 격리, 환경 점검, 운영 로그/알림 가시성을 보강하고 관련 fallback을 표준화한다.
- Validation: cron route 회귀, 운영 로그 확인 기준, lint/tsc
- Status: `pending`
