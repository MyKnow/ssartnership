# Mattermost 직접 연동 전환

작성 기준일: 2026-07-17
관련 작업: [Issue #155](https://github.com/MyKnow/ssartnership/issues/155)

## 결정

SSAFY Verify runtime과 사용자 UI는 제거하고, 회원 인증·프로필 동기화·운영 알림을 서비스 내부의 Mattermost 직접 어댑터로 처리한다. 컷오버 이후 외부 Verify fallback은 제공하지 않는다.

직접 연동의 경계는 서버 전용 `MattermostClient`와 `MattermostSenderRepository`다. Mattermost 세션 토큰은 요청 메모리에서만 사용하고 로그, DB, API 응답, 브라우저 상태에 저장하지 않는다.

## Sender 운영

- 서버 env는 `MM_BASE_URL`, `MM_SENDER_CREDENTIALS_KEY_V1`, `MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION=1`만 사용한다. 기수별 로그인 ID·비밀번호 env는 사용하지 않는다.
- `/admin/cycle`의 Mattermost Sender 영역은 Super Admin 템플릿과 `mattermost_senders` 권한을 모두 요구한다.
- 로그인 ID와 비밀번호는 한 JSON payload로 AES-256-GCM 암호화해 `mattermost_sender_credentials`에 저장한다. nonce, auth tag, key version만 함께 저장하며 평문과 MM 토큰은 보존하지 않는다.
- 후보는 `pending`으로 저장된다. 이전 기수의 검증된 Sender 또는 현재 Super Admin의 연결된 MM ID에 테스트 DM을 성공한 뒤에만 `active`가 된다.
- 활성화는 원자적으로 기존 active를 `superseded`로 바꾸고 기존 ciphertext를 삭제한다. disabled·superseded·만료 후보도 ciphertext를 삭제한다.
- Sender 테스트 실패는 관리자·후보·IP 단위로 15분 3회까지 허용하고 30분 차단한다.
- team과 channel은 DB/UI 입력이 아니라 `s{generation}public` 및 `town-square` 상수로 계산한다.

## 회원 흐름

### 운영진·재학생 가입 및 비밀번호 재설정

1. 대상 기수의 활성 Sender가 Mattermost ID를 확인하고 DM으로 6자리 코드를 보낸다.
2. 코드의 HMAC hash만 저장한다. 코드는 10분 후 만료, 한 번만 소비 가능하며 5회 검증과 재전송 제한을 적용한다.
3. 가입·재설정 응답은 계정 존재 여부를 노출하지 않는다. Mattermost가 불가하면 자동 이메일 fallback을 하지 않는다.

### MM 장애 중 이메일 복구

기존 사이트 비밀번호를 아는 회원은 `/auth/recover-email`에서 비밀번호를 먼저 검증한다. 성공해도 로그인 세션은 발급하지 않고, `auth_session_version`에 묶인 15분 httpOnly 복구 세션만 발급한다. 그 안에서 새 이메일의 6자리 코드 소유를 확인하면 이메일 identity를 연결하고 이메일 로그인 세션으로 전환한다.

기존 비밀번호를 모르는 회원은 `/auth/signup/graduate?kind=recovery`로 수료증·사진 검토를 신청한다. 일반 수료생 신규 가입과 별도 `request_kind=existing_member_recovery`를 사용하며, 관리자는 승인 전에 기존 회원 ID를 명시적으로 선택해야 한다. 승인 RPC는 복구 종류에서는 새 `members` 행을 만들지 않고 선택한 회원에 이메일, 승인된 사진, 초기 비밀번호 설정 메일만 연결한다.

### 프로필과 lifecycle

- 프로필 동기화는 최신 `mm_user_id` 일치를 확인한 뒤 MM username, 표시명, 프로필 사진만 갱신한다. 캠퍼스·트랙·과거 claim은 덮어쓰지 않는다.
- `delete_at > 0`이라는 명시적인 비활성 표식이 있는 성공 조회만 lifecycle 전환을 허용한다. 학생은 `generation_completed`, 운영진은 `member_departed`로 바뀐다.
- 404, 401/403, 429, 5xx, timeout, 형식 오류는 모두 unresolved/운영 오류다. 회원 상태를 바꾸지 않는다.
- `mm_user_directory`, 회원-MM 연결, 이메일 identity, 사진 ledger와 기존 로컬 비밀번호는 보존한다.

## 알림과 수동 조회

- 가입/재설정 DM은 대상 기수의 active Sender를 사용한다.
- 관리자 알림은 수신자 기수 또는 `source_years`별 Sender를 선택한다. 해당 기수에 Sender가 없으면 그 수신자만 `sender_not_configured` 또는 안전한 실패 상태로 남긴다.
- 수동 회원 조회와 프로필 동기화는 해당 기수 Sender만 사용하며 실패 시 로컬 데이터를 변경하지 않는다.

## 보안과 데이터 정리

- sender credential, 코드, session/token, 비밀번호 평문은 로그·응답·브라우저 상태에 남기지 않는다.
- 민감 테이블은 RLS를 활성화하고 `anon`/`authenticated`의 전체 권한을 회수하며 service-role RPC만 실행한다.
- Verify runtime/UI/routes/env는 이번 전환에서 제거했다. 안정화 7일 동안 레거시 Verify 데이터는 읽지 않는 상태로 보존한다.
- 안정화가 끝난 뒤 별도 forward migration에서 `member_ssafy_verifications`, Verify 전용 claim/track 컬럼, provider 값, cron, 테스트를 제거한다. 이 삭제는 rollback 없는 데이터 정리이므로 안정화 검증 전에는 시행하지 않는다.

## 운영 확인

1. Preview와 Production에 sender key와 base URL을 설정한다.
2. 기수별 Sender를 운영 화면에서 테스트하고 active로 전환한다.
3. 신규 가입, 재설정, 수동 조회, 프로필 동기화, 기수별 알림을 Preview에서 확인한다.
4. MM 장애 시 이메일 복구와 기존 회원 복구가 새 회원을 만들지 않는지 확인한다.
5. 7일 안정화 이후 Verify 데이터 정리 Issue를 별도로 실행한다.
