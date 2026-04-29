# Admin Dashboard Refactor Wave 6

## 목표
- 아직 대시보드형 정리가 덜 된 `/admin` 운영 도구 화면군을 공통 셸 문법에 맞춰 재구성한다.
- 각 페이지에 `ShellHeader + 요약 지표 + 메인 작업 영역 + 보조 패널` 구조를 적용한다.
- 내부 manager와 서버 로직은 유지하고, 페이지 레벨 정보 구조와 레이아웃만 손본다.

## 반영 내용
- `push`, `notifications`, `companies`, `cycle`, `advertisement`, `event`, `event/[slug]`, `partners/new` 화면에 요약 지표와 메인/보조 영역 구조를 추가했다.
- `companies`는 협력사 운영과 계정 관리를 좌우 분리된 운영 화면으로 재배치했다.
- `push`, `notifications`, `advertisement`는 기존 대형 manager/editor를 직접 카드로 감싸지 않고, 상위 섹션 제목과 보조 패널을 붙여 대시보드 셸에 맞췄다.
- `event`와 `event/[slug]`는 상태 요약과 편집/가이드 분리를 통해 운영 개요와 실행 작업의 위계를 분명히 했다.
- `partners/new`는 생성 폼과 입력 가이드를 분리해 상세 편집 페이지처럼 보이던 구성을 신규 생성 워크플로우 쪽으로 정리했다.

## 의도적으로 미룬 범위
- `partners/[partnerId]`, `members/mock`, `style-guide`는 이미 상대적으로 정리된 상태라 이번 wave에서 큰 구조를 다시 바꾸지 않았다.
- `promotions`는 `/admin/advertisement`로 리다이렉트만 수행하는 별칭 경로라 별도 UI 작업을 하지 않았다.
- manager 내부 카드 레이아웃이나 탭 interaction 자체는 이번 wave 범위에서 제외했다.

## 검증
- `npx eslint` 대상 파일 통과
- `npm run build` 통과
