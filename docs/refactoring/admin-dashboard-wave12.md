# Admin Dashboard Wave 12

## 목표
- 큰 화면에서 회원 차트 해상도 선택 카드의 시인성과 클릭 영역을 더 키운다.

## 반영 내용
- `xl` 이상 회원 차트 좌측 해상도 패널 폭을 확장했다.
- `일별 / 주별 / 월별 / 연별` 선택 카드를 2x2 그리드로 재배치했다.
- 각 카드의 최소 높이를 늘려, 넓은 화면에서 버튼이 지나치게 세로로 길고 좁게 보이던 문제를 줄였다.

## 제외 범위
- 로그 차트의 보조 선택 UI는 이번 wave에 포함하지 않았다.

## 검증
- `npx eslint src/components/admin/AdminMemberTrendChart.tsx`
- `npm run build`
