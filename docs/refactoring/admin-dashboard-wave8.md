# Admin Dashboard Wave 8

## 목표
- `/admin` 운영 화면의 남은 기능성 개편을 마무리한다.
- 중복된 운영 경로를 통합하고, 로그/회원/협력사 화면의 실사용성을 높인다.

## 반영 내용
- `/admin/style-guide` 경로를 제거했다.
- 회원 관리에 현재 필터 기준 월별 회원 유입 꺾은선 차트를 추가했다.
- 리뷰 관리에서 `companyId=all` 같은 sentinel 값이 UUID 필터로 흘러 들어가던 버그를 수정했다.
- 로그 조회에서 다음을 반영했다.
  - 조회 범위 활동량 시각화를 막대에서 꺾은선으로 변경
  - 그룹별 2000건 상한 제거
  - 브랜드 이름 lookup 및 링크 아웃 추가
  - 회원 이름/MM 식별자에서 회원 상세 페이지로 새 탭 이동 추가
- 회원 상세 조회 페이지 `/admin/members/[memberId]`를 추가했다.
- 브랜드 관리 카드의 가로 overflow를 줄이기 위해 메트릭 그리드와 카드 폭 처리를 조정했다.
- 협력사 관리를 협력사/협력사 계정 탭 뷰로 분리했다.
- 알림 전송과 알림센터를 `/admin/push` 안의 탭 구조로 통합하고, `/admin/notifications`는 통합 화면으로 리다이렉트한다.
- 관리자 내비게이션과 관리 홈 진입 카드도 통합 구조에 맞게 정리했다.

## 제외 범위
- 로그 조회의 `oldest/actor/ip` 정렬을 DB-side RPC로 내리는 작업은 이번 wave 범위에 포함하지 않았다.
- 삭제된 style guide 관련 보조 컴포넌트 정리는 실제 import가 남지 않는 선에서만 처리하고, 완전한 dead code 청소는 별도 cleanup wave로 넘긴다.

## 검증
- `npx eslint 'src/app/admin/(protected)/members/page.tsx' 'src/app/admin/(protected)/members/[memberId]/page.tsx' 'src/app/admin/(protected)/companies/page.tsx' 'src/app/admin/(protected)/push/page.tsx' 'src/app/admin/(protected)/notifications/page.tsx' 'src/app/admin/(protected)/page.tsx' src/components/admin/AdminCompanyWorkspace.tsx src/components/admin/AdminMemberTrendChart.tsx src/components/admin/AdminPushManager.tsx src/components/admin/notification-center/AdminNotificationCenter.tsx src/components/admin/admin-navigation.ts src/components/admin/partner-manager/AdminPartnerListItem.tsx src/components/admin/logs/AdminLogsPanels.tsx src/components/admin/logs/AdminLogsExplorer.tsx src/components/admin/logs/types.ts src/components/admin/logs/selectors.ts src/components/admin/AdminLogsManager.stories.tsx src/components/admin/logs/AdminLogsExplorer.stories.tsx src/lib/admin-reviews.ts src/lib/log-insights.ts src/lib/log-insights/data.ts src/lib/log-insights/paging.ts src/lib/log-insights/shared.ts tests/unit/admin-reviews.test.ts tests/log-insights-paging.test.mts tests/e2e/fixtures/routes.ts`
- `node --import ./tests/alias-register.mjs --test tests/log-insights-paging.test.mts`
- `npx vitest run tests/unit/admin-reviews.test.ts`
- `npm run build`
- `npm run build-storybook`
