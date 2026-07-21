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
- `member_update`
- `member_delete`
- `push_send`
- `push_log_delete`
- `partner_portal_immediate_update`
- `partner_portal_change_request_submit`
- `partner_portal_change_request_cancel`
- `partner_portal_review_hide`
- `partner_portal_review_restore`

제휴처 자체 삭제는 현재 지원하지 않습니다. 기존에 남아 있는 관련 감사 로그는 이력 보존을 위해 삭제하지 않습니다.

### 3. Auth Security
인증/보안 추적용 로그입니다.

예시:
- `member_login`
- `member_logout`
- `member_signup_complete`
- `mattermost_code_issue`
- `mattermost_code_verify`
- `mattermost_sender_test`
- `member_email_recovery`
- `member_password_reset`
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
- `event_id`: 제품 이벤트의 클라이언트 생성 UUID. 재전송되어도 한 번만 저장한다.
- `schema_version`: 제품 이벤트 payload 계약 버전
- `occurred_at`, `recorded_at`: 클라이언트 발생 시각과 서버 기록 시각
- `request_id`: 같은 요청에서 생성된 감사·보안·제품 이벤트를 연결하는 UUID
- `actor_type`: `guest`, `member`, `admin`, `partner`, `system`
- `actor_id`: 회원 UUID, 관리자 ID, 협력사 계정 ID
- `path`: 이벤트가 발생한 경로
- `referrer`: 이전 경로 또는 참조 URL
- `target_type`: 대상 엔터티 유형
- `target_id`: 대상 엔터티 ID
- `properties`: 추가 메타데이터 JSON
- `user_agent`, `ip_address`, `created_at`

## 제품 이벤트 수집 계약

- 브라우저는 `event_id`, `schema_version`, `occurred_at`을 포함한 단일 이벤트 envelope만 `/api/events/product`로 보낸다.
- 이 endpoint는 페이지 조회·클릭 등 **클라이언트 텔레메트리 전용 이벤트**만 받는다. 쿠폰 사용, 푸시 구독 변경, 리뷰 작성처럼 서버가 확인한 업무 이벤트는 해당 서버 route/action에서 기록한다.
- 이벤트별 허용 `properties`와 `target_type`·`target_id` 조합을 검증한다. 알 수 없는 `properties` key는 저장하지 않는다.
- 요청 본문은 12 KiB를 넘길 수 없다. `Content-Length` fast-fail 뒤에도 stream을 누적 읽어 한도를 넘는 즉시 취소한다. `properties`는 최종 저장 직전에도 깊이·항목 수·문자열 길이·전체 크기 제한을 거친다.
- 요청 본문을 읽기 전에 Vercel 원본 전달 IP(`x-vercel-forwarded-for` 우선) 기준 ingress 제한을 적용하고, 계약 검증 뒤에는 IP·세션·이벤트별 제한을 한 번 더 적용한다. 이 제한은 프로세스 로컬 best-effort 보호 장치이며 Vercel WAF/분산 rate limit을 대체하지 않는다.
- `event_logs.event_id`의 partial unique index와 `ingest_product_event()` RPC가 원자적으로 동작한다. 신규 row가 실제로 insert될 때만 기존 trigger가 rollup을 증가시키므로, 별도 rollup fallback을 두지 않는다.
- endpoint의 `202` 응답은 비동기 처리 접수 결과다. 제품 텔레메트리는 일부 유실을 허용하며, 정산·쿠폰 사용 같은 정확한 업무 수치는 브라우저 이벤트로 계산하지 않는다.

## 데이터 최소화와 redaction

- 모든 `event_logs`, `admin_audit_logs`, `auth_security_logs` 저장 직전에는 공통 recursive sanitizer를 적용한다.
- key 이름은 camelCase/snake_case 등을 정규화해 `password`, `secret`, `token`, `authorization`, `cookie`, `session`, `credential`, `api_key`, `private_key`, `client_secret`, raw `code`를 redaction한다. `reasonCode`, `errorCode` 같은 안정적인 코드 값은 유지한다.
- `path`와 `referrer`는 query string과 hash를 저장하지 않는다. `/verify/:token`, setup link, QR avatar token 경로는 각각 `[token]` route template으로 정규화한다.
- 인증·보안 예외의 원문 메시지는 저장하지 않고, 안정적인 reason/error code를 사용한다.

## 이벤트 명명 규칙
- 소문자 스네이크 케이스 사용
- 동사보다 `대상_행위` 형태 우선
- 하나의 이벤트는 하나의 의도만 표현
- 집계에 필요한 값만 `properties`에 저장

## 기록 금지 항목
다음 값은 로그에 남기지 않습니다.
- 비밀번호 원문
- 인증 토큰 원문
- 세션 토큰
- 푸시 키 원문 중복 저장
- 제휴 제안 본문 전체 자유서술 텍스트
- 필요 이상의 민감식별자

## Mattermost 직접 연동 보안 추적

direct Mattermost 흐름은 `auth_security_logs.properties`에 안정적인 상태 코드만 남긴다.

- 대상: Sender 후보 테스트/활성화, DM 코드 발급·검증, 사용자·디렉터리 조회, 프로필/사진 동기화, lifecycle 미해결, 기수별 알림 실패, 이메일 복구
- 저장 위치: `auth_security_logs.properties`와 필요한 최소 관리자 audit row
- 허용 요약: generation, stage, safe error code, delivery result, request id, masked/hashed 대상 식별자
- 금지: Sender 로그인 ID/비밀번호, AES ciphertext/nonce/auth tag, Mattermost session token, DM code 원문, raw Mattermost response
- Verify 전용 trace는 7일 안정화 기간에 과거 데이터로만 보존하며 새 이벤트를 만들지 않는다.

## 운영 원칙
- 로깅 실패가 본 기능 실패로 이어지지 않게 처리
- 기본 조회를 위해 `created_at`, `event_name`, `actor_id`, `target_id` 인덱스 유지
- 상세 집계는 원본 로그를 기준으로 이후 별도 집계 테이블 또는 뷰로 확장

## 보존 및 파기 정책

- `event_logs`, `admin_audit_logs`, `auth_security_logs`, `push_message_logs`, `push_delivery_logs`의 원본은 생성일로부터 1년간 보존한다.
- `platform_active_identities`, `partner_metric_rollups`, DAU·WAU·MAU 등 집계 데이터는 회원 ID, IP, user-agent, session ID를 포함하지 않는 통계 형태로 장기 보존한다.
- `partner_benefit_usages`는 로그가 아닌 혜택 사용 원장으로 취급하며, 정산·분쟁 대응에 필요한 기간 동안 보존한다. 기본 보존기간은 1년이다.
- 1년이 지난 원본 로그와 회원 연결형 혜택 사용 원장은 Vercel cron의 `/api/cron/purge-expired-operational-logs`가 보존 hold가 없는 행만 파기한다.
- 보안 사고·분쟁·법령상 보존 사유가 발생하면 `log_retention_holds`에 대상 로그 그룹과 기간, 사유, 만료 시각을 등록한 뒤 원본을 예외 보존한다.
- 파기 작업은 서비스 역할 전용 Supabase RPC로 수행하며, 파기 결과 자체는 `admin_audit_logs`에 건수만 남긴다.
- 보존기간 이후에도 원본이 필요한 경우에는 사건별 hold로 관리하고, 무기한 보존을 기본값으로 두지 않는다.
