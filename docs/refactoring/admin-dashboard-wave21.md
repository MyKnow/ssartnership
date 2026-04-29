# Admin Dashboard Wave 21

## 목표
- 회원/로그 시계열 카드에서 남는 세로 여백을 줄이고 실제 차트가 더 많은 공간을 차지하도록 조정한다.

## 반영 내용
- 차트 바깥의 상하 padding을 줄였다.
- 대신 실제 플롯 영역 높이를 크게 늘려 카드 안의 대부분 세로 공간을 그래프가 사용하게 했다.
- 좌우 내부 padding도 소폭 줄여 선과 포인트가 더 넓게 퍼지도록 조정했다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx`
- `npm run build`
