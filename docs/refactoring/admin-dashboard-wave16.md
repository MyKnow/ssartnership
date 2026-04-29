# Admin Dashboard Wave 16

## 목표
- 관리자 시계열 차트에서 포인트 hover/click 시 해당 지점의 값과 의미를 차트 근처 버블로 바로 읽을 수 있게 한다.

## 반영 내용
- 공통 `AdminTimeseriesChart`에 포인트 기반 플로팅 버블 오버레이를 추가했다.
- hover 시 해당 지점 좌표를 따라 버블이 나타나고, click 시에는 그 지점을 고정 선택한다.
- 차트 전체 hover 대신 각 포인트의 hit area에서 직접 이벤트를 받아, 실제 hover 시 버블이 안정적으로 뜨도록 조정했다.
- 버블 안에는 현재 구간과 `renderSummary`가 제공하는 각 항목의 값/의미를 함께 표시한다.
- 기존 상단 요약 영역은 유지해, 버블과 상단 요약이 같은 선택 상태를 공유하도록 맞췄다.

## 제외 범위
- 버블 닫기 버튼이나 다중 포인트 비교 기능은 이번 wave에 포함하지 않았다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx`
- `npm run build`
