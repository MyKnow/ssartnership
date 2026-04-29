# Admin Dashboard Wave 18

## 목표
- 시계열 차트 상단 요약 카드를 제거하고, 버블 중심 상호작용으로 단순화한다.
- 포인트에 정확히 맞추지 않아도 주변 위치에서 hover 반응이 오도록 조정한다.
- 차트와 버블이 잘리지 않도록 상하 여백을 더 확보한다.

## 반영 내용
- 공통 `AdminTimeseriesChart`의 상단 요약 카드를 제거했다.
- hover/click 감지를 포인트 hit area가 아니라 차트의 active tooltip index 기반으로 되돌려, 비슷한 x 위치에서도 해당 지점이 선택되도록 정리했다.
- 차트 컨테이너 높이와 `pt/pb`, chart margin, 버블 offset을 확대해 버블과 선이 더 여유 있게 보이도록 조정했다.
- 버블은 기존처럼 구간 제목을 머리글로 두고, 본문에는 각 지표 값만 보여준다.

## 제외 범위
- 회원/로그별 버블 내용 구성 자체는 유지하고, 항목 종류만 각 화면 요구에 맞게 남겨두었다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx`
- `npm run build`
