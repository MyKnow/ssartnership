# Admin Dashboard Refactor Wave 5

## 목표
- `/admin` 전반의 좌우 여백을 줄이고, 데스크톱에서 가능한 한 넓은 작업 폭을 사용하게 한다.
- public 페이지 컨테이너 규칙은 유지하고, 관리자 셸에만 full-width 규칙을 적용한다.
- 기존 기능, 라우트, 내부 컴포넌트 구조는 바꾸지 않는다.

## 반영 내용
- `Container`의 `dashboard` 크기를 `max-width` 제한 없는 full-width 컨테이너로 전환했다.
- `dashboard` 전용 좌우 padding을 더 얇게 조정해, 가장자리 안전 여백만 남기고 작업 폭을 넓혔다.
- 더 이상 쓰지 않는 `--grid-dashboard` 글로벌 토큰을 제거했다.
- 그 결과 `/admin` 하위 모든 페이지가 셸 기준으로 좌우 여백 없이 더 넓은 영역을 사용하게 됐다.

## 의도적으로 미룬 범위
- 개별 화면 내부 카드나 테이블의 열 구성 자체는 이번 wave에서 다시 설계하지 않았다.
- public 사이트의 `page`/`wide` 컨테이너 규칙은 변경하지 않았다.
- `/admin` 내부 각 화면의 미세한 spacing 조정은 후속 wave로 넘긴다.

## 검증
- `npx eslint src/components/ui/Container.tsx`
- `npm run build`
