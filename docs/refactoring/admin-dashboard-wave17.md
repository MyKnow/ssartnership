# Admin Dashboard Wave 17

## 목표
- 회원 유입 차트 요약 정보를 누적 대신 실제 구간 시작/종료 시각 중심으로 바꾼다.
- 시계열 차트 버블이 카드나 주변 UI에 잘리지 않도록 overflow/z-index 구조를 정리한다.

## 반영 내용
- 회원 유입 차트의 각 버킷에 시작 시각과 종료 시각 메타데이터를 추가했다.
- 회원 유입 차트 요약/버블은 `변화량`, `시작`, `종료`를 보여주도록 변경했다.
- 공통 시계열 차트 래퍼에 `overflow-y-visible`, 상위 z-index, 더 큰 버블 폭과 shadow를 적용했다.
- 회원 유입 차트 카드와 로그 활동량 카드도 `overflow-visible`로 조정해 버블이 잘리지 않도록 정리했다.

## 제외 범위
- 로그 활동량 차트의 항목 의미 자체는 유지하고, 구간 시작/종료 메타데이터는 이번 wave에 추가하지 않았다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx src/components/admin/AdminMemberTrendChart.tsx src/components/admin/logs/AdminLogsPanels.tsx`
- `npm run build`
