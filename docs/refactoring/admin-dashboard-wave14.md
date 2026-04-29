# Admin Dashboard Wave 14

## 목표
- 관리자 시계열 차트가 모바일에서 지나치게 압축되어 보이던 문제를 완화한다.

## 반영 내용
- 공통 `AdminTimeseriesChart`의 SVG 렌더링 높이를 반응형으로 조정했다.
- 모바일에서는 차트 높이를 더 크게 유지하고, `sm` 이상부터 점진적으로 압축되도록 변경했다.
- 데스크톱에서 맞춘 고정 높이 기조는 유지하면서, 모바일 가독성만 보완했다.

## 제외 범위
- 시계열 요약 영역의 모바일 배치 자체는 이번 wave에서 변경하지 않았다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx`
- `npm run build`
