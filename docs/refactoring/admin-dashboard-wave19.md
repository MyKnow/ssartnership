# Admin Dashboard Wave 19

## 목표
- 관리자 시계열 차트 hover 감지를 다시 안정적으로 복구한다.

## 반영 내용
- `recharts`의 hover index 계산이 동작하도록 숨김 `Tooltip`을 다시 연결했다.
- 차트는 `activeTooltipIndex`와 `activeCoordinate`를 기준으로 근처 x 위치에서도 hover/click이 반응하도록 유지했다.
- 기존 버블 중심 UX와 여백 구조는 그대로 두고, hover 상태 계산만 복구했다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx`
- `npm run build`

## 참고
- 이 세션에서는 Playwright 브리지 확장이 없어 브라우저 실기 검증은 수행하지 못했다.
