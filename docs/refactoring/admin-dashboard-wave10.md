# Admin Dashboard Wave 10

## 목표
- 로그 조회 활동량 차트를 회원 관리 차트와 같은 인터랙션 구조로 통일한다.
- 관리자 화면 시계열 차트의 높이, hover/click 요약 패턴, 점 선택 동작을 공통화한다.

## 반영 내용
- `AdminTimeseriesChart` 공통 컴포넌트를 추가했다.
- 회원 관리 유입 추이 차트는 공통 시계열 컴포넌트를 사용하도록 정리했다.
- 로그 조회 활동량 차트도 공통 시계열 컴포넌트를 사용하도록 교체했다.
- 로그 차트에서 hover/click 시 선택 구간의 전체/사용자 이벤트/관리자 감사/인증·보안 건수를 상단 요약 영역에서 바로 확인할 수 있게 했다.
- 회원/로그 차트 모두 동일한 압축 높이와 축 라벨 밀도를 사용하도록 맞췄다.

## 제외 범위
- 로그 조회 범위 프리셋 자체를 일/주/월/연 탭 구조로 재구성하는 작업은 이번 wave에 포함하지 않았다.
- 활동량 요약 클릭 시 자동 재조회 동작은 기존 하단 범위 버튼을 유지하고, 차트 자체는 요약 중심 상호작용까지만 통일했다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx src/components/admin/AdminMemberTrendChart.tsx src/components/admin/logs/AdminLogsPanels.tsx`
- `npm run build`
