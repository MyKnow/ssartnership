# Admin Dashboard Refactor Wave 23

## 목표
- 회원 유입 추이 차트의 초기 버블 노출과 hover 좌표 정합성을 바로잡는다.

## 반영 내용
- 최초 로드 시에는 버블이 보이지 않도록 기본 active point 선택을 제거했다.
- hover/click에서 받은 Recharts의 실제 좌표를 사용해 버블 중심이 포인트 x축과 어긋나지 않게 정리했다.
- hovered state와 selected state를 분리해, hover가 우선이고 click은 고정 선택으로만 작동하게 유지했다.

## 검증
- `npx eslint src/components/admin/AdminTimeseriesChart.tsx` 통과
- 브라우저에서 `/admin/members`를 열어 초기 버블 비노출과 hover 버블 표시를 확인함

