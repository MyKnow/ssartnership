# Admin Dashboard Refactor Wave 3

## 목표
- `/admin` 전반에서 콘텐츠가 더 넓은 작업 폭을 사용할 수 있게 한다.
- 공용 `Container` 규칙은 유지하면서, 관리자 영역에만 더 큰 최대 폭을 적용한다.
- 기존 라우트, 기능, 데이터 로직, 페이지 내부 구조는 바꾸지 않는다.

## 반영 내용
- `Container`에 admin 전용 `dashboard` 크기 옵션을 추가했다.
- 글로벌 레이아웃 토큰에 `--grid-dashboard` 최대 폭을 추가했다.
- `AdminShellView`의 모바일/데스크톱 헤더와 본문 컨테이너를 모두 `dashboard` 폭으로 전환했다.
- 그 결과 `/admin` 하위 화면이 태블릿 이상에서 더 넓은 본문 영역을 사용하게 됐다.

## 의도적으로 미룬 범위
- public 사이트의 `page`, `wide` 컨테이너 폭은 건드리지 않았다.
- 각 관리자 화면 내부 컴포넌트의 열 비율이나 카드 배치는 이번 wave에서 다시 조정하지 않았다.
- `/admin/push`, `/admin/companies`, `/admin/notifications` 같은 후속 화면의 개별 레이아웃 리디자인은 다음 wave로 넘긴다.

## 검증
- `npx eslint src/components/ui/Container.tsx src/components/admin/AdminShellView.tsx` 통과
- `npm run build` 통과
