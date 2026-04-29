# Admin Dashboard Refactor Wave 2

## 목표
- `/admin/logs` 내부 탐색 UI를 새 대시보드 셸과 같은 밀도로 정리한다.
- 필터/검색/정렬을 보조 패널로 분리하고, 결과 목록을 메인 작업 영역으로 유지한다.
- 로그 데이터 로딩, 필터링, 페이지네이션 동작은 그대로 둔다.

## 반영 내용
- `AdminLogsExplorer`를 필터 패널 + 메인 결과 영역의 2단 레이아웃으로 재구성했다.
- 현재 범위와 페이지 정보를 별도 요약 박스로 올려 탐색 상태를 빠르게 읽을 수 있게 했다.
- 로그 카드의 properties 표시를 배지 나열에서 “속성 요약” 섹션으로 정리해 스캔성을 높였다.
- 기존 상세 보기, 검색, 그룹/행위/주체/상태/정렬, 페이지 이동 동작은 유지했다.

## 의도적으로 미룬 범위
- `/admin/push`, `/admin/companies`, `/admin/notifications`의 내부 레이아웃 개편은 후속 wave로 넘겼다.
- 로그 상세를 우측 고정 split-view로 바꾸는 수준의 interaction 재설계는 이번 wave에 포함하지 않았다.
- 로그 API, summary 집계, RPC, DB 쿼리 경로는 수정하지 않았다.

## 검증
- `npx eslint` 대상 파일 통과
- `npm run build` 통과
- `npm run build-storybook` 통과
