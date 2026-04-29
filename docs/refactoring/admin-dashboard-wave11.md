# Admin Dashboard Wave 11

## 목표
- 큰 화면에서 회원 관리 차트의 시계열 해상도 선택 UI를 더 대시보드답게 분리한다.

## 반영 내용
- `xl` 이상에서는 회원 유입 추이 차트 왼쪽에 `일별 / 주별 / 월별 / 연별` 선택 전용 카드를 배치했다.
- 모바일과 태블릿에서는 기존 상단 탭 구조를 유지했다.
- 차트 본문과 해상도 선택부를 분리해, 넓은 화면에서 시선 이동과 조작 밀도를 개선했다.

## 제외 범위
- 로그 조회 차트의 범위 선택 UI는 이번 wave에서 별도 카드로 분리하지 않았다.

## 검증
- `npx eslint src/components/admin/AdminMemberTrendChart.tsx`
- `npm run build`
