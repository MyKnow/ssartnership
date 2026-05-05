# Partner Portal Activity Logs

## 목표
- `/partner` 하위 포털 행위를 기존 관리자 로그 조회에서 추적 가능하게 만든다.
- 별도 로그 테이블을 추가하지 않고 `event_logs`, `admin_audit_logs`, `auth_security_logs`를 그대로 사용한다.
- `/admin/logs`에서 파트너 포털 관련 로그만 모아볼 수 있는 필터를 제공한다.

## 반영 내용
- 협력사 포털 로그인, 로그아웃, 초기 설정, 비밀번호 변경 로그의 주체를 `partner` 계정으로 기록하도록 정리했다.
- 즉시 수정, 변경 요청 제출/취소, 리뷰 숨김/복구를 `partner_portal_*` 감사 액션으로 기록한다.
- 파트너 포털 페이지 조회는 기존 `page_view`의 `properties.area = "partner"`와 `/partner` 경로를 기준으로 묶는다.
- 관리자 로그 탐색 필터에 `파트너 포털` 가상 그룹을 추가했다.
- `partner_portal_*`, `partner_*`, `/partner` 경로, `area = partner` 로그를 같은 필터에서 볼 수 있게 했다.

## 검증 기준
- 파트너 포털 행위가 기존 로그 테이블에 저장된다.
- `/admin/logs`의 로그 그룹에서 `파트너 포털`을 선택하면 포털 관련 로그만 표시된다.
- 기존 사용자/관리자/보안 로그 그룹은 실제 테이블 그룹 기준을 유지한다.
