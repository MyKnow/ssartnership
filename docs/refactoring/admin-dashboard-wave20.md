# Admin Dashboard Wave 20

## 목표
- 관리자 시계열 차트의 hover 버블이 실제로 보이도록 위치 계산을 안정화한다.

## 반영 내용
- 버블 좌표를 `recharts`의 임시 좌표가 아니라 차트 크기, 포인트 index, 값 스케일 기준으로 직접 계산하도록 변경했다.
- 포인트의 y 위치가 차트 절반보다 아래면 위쪽, 위면 아래쪽에 버블을 띄우도록 분기했다.
- 차트 상하 여백과 내부 패딩을 늘려 버블이 카드 경계에서 잘리지 않게 조정했다.
- 리사이즈 이후에도 hover/selection 버블 위치가 다시 맞춰지도록 보정했다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx`
- `npm run build`
