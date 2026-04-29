# Admin Dashboard Wave 15

## 목표
- 관리자 시계열 차트 구현을 직접 그린 SVG에서 라이브러리 기반으로 전환해 유지보수 비용을 낮춘다.

## 반영 내용
- `recharts`를 도입했다.
- 공통 `AdminTimeseriesChart`를 `recharts` 기반으로 재작성했다.
- 회원 유입 차트와 로그 활동량 차트는 기존 상호작용 규약을 유지한 채 라이브러리 구현으로 전환됐다.
- 반응형 높이, hover/click 선택, 상단 요약 영역 동기화는 그대로 유지했다.

## 제외 범위
- 차트 선택 시 로그 범위를 자동 재조회하는 추가 동작은 이번 wave에 포함하지 않았다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx src/components/admin/AdminMemberTrendChart.tsx src/components/admin/logs/AdminLogsPanels.tsx`
- `npm run build`
