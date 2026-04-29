# Admin Dashboard Wave 13

## 목표
- 회원/로그 시계열 차트의 상단 요약 영역 높이가 해상도나 구간 라벨 길이에 따라 흔들리지 않게 고정한다.

## 반영 내용
- 공통 `AdminTimeseriesChart` 요약 영역에 최소 높이를 부여했다.
- 구간 라벨은 한 줄 truncate 처리하고 `title` 속성으로 전체 값을 확인할 수 있게 했다.
- 각 요약 셀에도 최소 높이를 적용해 해상도 전환 시 카드 전체 높이가 변하지 않도록 정리했다.

## 제외 범위
- 차트 본문 SVG 높이와 좌측 해상도 선택 카드 레이아웃은 이번 wave에서 변경하지 않았다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx`
- `npm run build`
