# Admin Dashboard Wave 22

## 목표
- 회원 유입 추이 시계열 차트의 버블 표시와 세로 공간 활용을 다시 안정화한다.

## 반영 내용
- 버블 좌표 계산을 hover state에 묶지 않고 렌더 시점에 직접 계산하도록 정리했다.
- `ResizeObserver` 의존을 제거하고 `window resize` 기반 측정으로 바꿔, 브라우저 런타임 호환성을 높였다.
- y축 domain에 데이터 범위보다 넓은 패딩을 주어 차트가 카드의 세로 공간을 더 많이 사용하도록 조정했다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx src/components/admin/AdminMemberTrendChart.tsx`
- `npm run build`
