# 이벤트 로깅 기준

## 목적
- 사용자 행동 집계
- 관리자 조작 이력 추적
- 인증/보안 이벤트 추적
- 이후 통계/대시보드 확장 기반 확보

## 로그 그룹

### 1. Product Analytics
사용자 사용성 집계용 로그입니다.

예시:
- `page_view`
- `partner_card_click`
- `partner_detail_view`
- `category_filter_change`
- `search_execute`
- `sort_change`
- `partner_map_click`
- `reservation_click`
- `inquiry_click`
- `share_link_copy`
- `push_settings_view`
- `push_subscribe`
- `push_unsubscribe_device`
- `push_unsubscribe_all`
- `push_preference_change`
- `suggest_submit`
- `pwa_install_click`
- `certification_view`
- `certification_qr_open`
- `certification_qr_verify`
- `/partner` 하위 `page_view`는 `properties.area = "partner"`로 남기며 관리자 로그에서 파트너 포털 필터로 모아본다.

### 2. Admin Audit
관리자 조작 추적용 로그입니다.

예시:
- `login`
- `logout`
- `category_create`
- `category_update`
- `category_delete`
- `partner_create`
- `partner_update`
- `partner_delete`
- `member_update`
- `member_delete`
- `push_send`
- `push_log_delete`
- `partner_portal_immediate_update`
- `partner_portal_change_request_submit`
- `partner_portal_change_request_cancel`
- `partner_portal_review_hide`
- `partner_portal_review_restore`

### 3. Auth Security
인증/보안 추적용 로그입니다.

예시:
- `member_login`
- `member_logout`
- `member_signup_code_request`
- `member_signup_complete`
- `member_password_reset`
- `member_password_change`
- `member_delete`
- `admin_login`
- `partner_login`
- `partner_logout`
- `partner_initial_setup`
- `partner_password_reset`
- `partner_password_change`

## 공통 필드
- `actor_type`: `guest`, `member`, `admin`, `partner`, `system`
- `actor_id`: 회원 UUID, 관리자 ID, 협력사 계정 ID
- `path`: 이벤트가 발생한 경로
- `referrer`: 이전 경로 또는 참조 URL
- `target_type`: 대상 엔터티 유형
- `target_id`: 대상 엔터티 ID
- `properties`: 추가 메타데이터 JSON
- `user_agent`, `ip_address`, `created_at`

## 이벤트 명명 규칙
- 소문자 스네이크 케이스 사용
- 동사보다 `대상_행위` 형태 우선
- 하나의 이벤트는 하나의 의도만 표현
- 집계에 필요한 값만 `properties`에 저장

## 기록 금지 항목
다음 값은 로그에 남기지 않습니다.
- 비밀번호 원문
- 인증코드 원문
- 세션 토큰
- 푸시 키 원문 중복 저장
- 제휴 제안 본문 전체 자유서술 텍스트
- 필요 이상의 민감식별자

## 운영 원칙
- 로깅 실패가 본 기능 실패로 이어지지 않게 처리
- 기본 조회를 위해 `created_at`, `event_name`, `actor_id`, `target_id` 인덱스 유지
- 상세 집계는 원본 로그를 기준으로 이후 별도 집계 테이블 또는 뷰로 확장
