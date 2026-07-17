# SSAFY Verify External API Delegation Plan

> 역사 문서입니다. 2026-07-17에 Verify runtime을 제거하고 직접 Mattermost 연동으로 전환했습니다. 현재 운영 기준은 [Mattermost 직접 연동 전환](./mattermost-direct-reversion.md)을 따릅니다.

## 목적

SSArtnership이 직접 보유한 Mattermost 계정 조회, 프로필 동기화, DM 발송 책임을 SSAFY Verify로 위임한다. 우리 서비스는 SSAFY Verify가 승인한 사용자 식별자와 프로필 스냅샷을 소비하고, Mattermost 토큰과 발송 로직은 장기적으로 보유하지 않는 방향을 목표로 한다.

## 현재 판단

- 회원가입 또는 최초 SSAFY Verify 연결 시에는 `ssafy.verify`, `ssafy.affiliation`, `ssafy.name`, `ssafy.profile_image`, `ssafy.role`, `ssafy.mattermost_id`를 요청한다. `ssafy.track`은 Hosted User Auth client 허용 scope가 동기화되기 전까지 요청하지 않는다.
- 비밀번호 재설정 등 본인 재확인 플로우에서는 `ssafy.verify`, `ssafy.mattermost_id`만 요청한다.
- 본인 재확인은 Verify 응답의 Mattermost user id가 기존 회원의 `mm_user_id`와 같은지만 대조한다.
- 프로필 이미지는 Verify `picture` URL을 `members.avatar_url`에 저장하고, 기존 base64 아바타는 fallback으로 유지한다.
- 트랙 정보가 Verify profile 응답에 제공되면 `ssafy_track`, `ssafy_track_name`을 `members.ssafy_track`, `members.ssafy_track_name`에 nullable로 저장한다. 권한/검색/분기 기준은 표시명이 아니라 slug인 `ssafy_track`을 우선한다.
- `ssafy.affiliation`은 기수/캠퍼스/지역만 제공한다고 가정하며, `floor`, `classroom`, `classLeader`, `classCaNames`, `class_leader`, `class_ca_names` 계열 값은 저장하지 않는다.
- Server API v1은 Hosted User Auth client와 분리된 confidential credential로 호출한다.
- Server API credential이 설정되지 않으면 Mattermost DM, 디렉터리 lookup, 프로필 동기화 기능은 직접 Mattermost fallback 없이 실패한다.
- SSArtnership 런타임은 Mattermost base URL, team name, sender credential, raw Mattermost 응답을 보유하지 않는다.

## SSAFY Verify 제공 Server API

### 1. 프로필 스냅샷 API

- 목적: SSArtnership이 직접 Mattermost API를 호출하지 않고 최신 사용자 프로필을 조회한다.
- 제공 경로: `GET /v1/ssafy-members/{sub}/profile`, `GET /v1/mattermost-users/{mattermost_user_id}/profile`
- 식별자: SSAFY Verify `sub` 우선, 필요 시 `ssafy_mattermost_user_id` 보조.
- 응답 필드: 승인된 scope 안에서만 이름, 프로필 이미지, 기수, 캠퍼스, 지역, 트랙, 역할, 운영진 여부, Mattermost user id를 반환한다.
- 요구사항: client별 scope 승인, request id, 안정적인 에러 코드, rate limit, audit log.

### 2. 디렉터리 lookup / 프로필 이벤트

- 목적: 하루 1회 직접 Mattermost batch sync 의존도를 낮추고, username/cohort 기반 lookup과 변경 이벤트로 스냅샷을 갱신한다.
- 제공 경로: `GET /v1/mattermost-users?username={username}&cohort={cohort}`, `POST /v1/mattermost-users/{mattermost_user_id}/sync`, `GET /v1/profile-events`.
- 요구사항: request id, 안정적인 에러 코드, rate limit, audit log, 이벤트 cursor 멱등 처리.

### 3. Mattermost DM 알림 API

- 목적: SSArtnership이 Mattermost bot token을 보유하지 않고 Verify를 통해 DM을 발송한다.
- 제공 경로: `POST /v1/notifications/mattermost`, `POST /v1/notifications/mattermost/batch`.
- 수신자 식별: `sub` 또는 `ssafy_mattermost_user_id`.
- 발송 방식: 승인된 template 또는 purpose 기반 발송을 우선하고, raw free-form 메시지는 제한한다.
- 요구사항: 최대 25명 batch, idempotency key, 발송 rate limit, template 승인, abuse 방지, request id, audit log, 실패 사유 코드.

### 4. 알림 상태 조회 API

- 목적: 이벤트 알림과 인증 안내 메시지의 성공, 실패, 재시도 상태를 추적한다.
- 제공 경로: `GET /v1/notifications/{notification_id}`, `GET /v1/notifications?campaign_id=...`.
- 요구사항: queued, sent, failed, retrying 등 안정적인 상태 값과 실패 코드 제공.

## 전환 현황

2026-07-05 기준 코드 전환은 완료했다. 남은 사항은 Production live smoke, Vercel legacy env 제거 여부 확인, Verify template 정책 확정처럼 운영자 또는 외부 서비스 확인이 필요한 항목이다.

- [x] Phase 1: 회원가입/최초 연결 scope와 재인증 scope를 분리한다.
- [x] Phase 2a: SSAFY Verify Server API client, token cache, safe error mapping, Mattermost ID 정책을 추가한다.
- [x] Phase 2b: SSArtnership 회원 프로필 이미지 URL 저장을 위해 Supabase schema를 확장한다.
- [x] Phase 3: SSAFY Verify 프로필 스냅샷 API와 profile-events를 이용해 프로필 동기화를 전환한다.
- [x] Phase 4a: 관리자 Mattermost DM 발송을 Verify batch notification API로 위임할 수 있게 한다.
- [x] Phase 4b: 발송 상태 조회/recovery 결과를 SSArtnership delivery log에 주기적으로 반영한다.
- [x] Phase 5: 더 이상 필요 없는 Mattermost 직접 호출 코드와 관련 env를 삭제한다.

## 보안 요구사항

- 프로필 조회와 알림 발송은 별도 scope로 분리한다.
  - 예시: `ssafy.profile.sync`, `ssafy.notify.dm`, `ssafy.notify.event`.
- 사용자 동의, 철회, client별 승인 목록을 Verify에서 추적한다.
- SSArtnership은 Mattermost bot token, 관리자 token, 사용자 DM 채널 생성 권한을 장기 보유하지 않는다.
- 모든 API와 webhook은 request id와 audit event를 제공한다.
- 에러 응답은 사용자 존재 여부나 내부 Mattermost 권한 정보를 과도하게 노출하지 않는다.

## 구현 메모

- `SSAFY_VERIFY_SERVER_CLIENT_ID`, `SSAFY_VERIFY_SERVER_CLIENT_SECRET`이 설정된 경우 `src/lib/admin-notification-ops-delivery.ts`는 Verify Server API batch endpoint만 사용한다.
- batch는 Verify 계약에 맞춰 최대 25명씩 나누고, target별로 `ssartnership:{notificationId}:mm:{chunk}:{targetIndex}` 형식의 idempotency key를 보낸다.
- Verify Server API 에러는 `error_code`, `message`, `request_id`만 내부 delivery error message로 보존하며 raw Mattermost 응답은 소비하지 않는다.
- 디렉터리 lookup, profile-events, 회원 프로필 동기화, 수동 회원 추가 임시 비밀번호 DM은 모두 Verify Server API를 호출한다.
- 회원가입/재인증 UI는 일반 사용자에게 request id나 provider diagnostic을 직접 붙여 보여주지 않는다. 상세 진단은 `auth_security_logs.properties`와 명시적 `SSAFY_VERIFY_DEBUG_ERRORS=1` 환경에서만 확인한다.
- SSAFY Verify User Auth와 Server API 호출은 `ssafy_verify_api_trace` 인증/보안 이벤트로 요약 저장한다. request/response 원문 대신 safe key, scope, status, request id, error code, notification id, profile payload shape만 보존하며 token, code, client secret, verification token, raw Mattermost response는 저장하지 않는다.
- Verify Mattermost 발송은 `notification_deliveries`에 `provider='ssafy_verify'`, provider campaign/notification/idempotency/status를 저장한다. `/api/cron/ssafy-verify-notification-status`는 `CRON_SECRET` 또는 관리자 세션으로만 실행되며, Vercel cron에서 매일 campaign status를 조회해 delivery row와 notification metadata의 `verifyStatusSync` 요약을 갱신한다.
- 실제 SSAFY Verify Server API 점검은 `npm run test:ssafy-verify:live`로 분리한다. 기본 테스트와 CI는 외부 API나 Mattermost DM을 호출하지 않고, `SSAFY_VERIFY_LIVE_SMOKE=1`일 때만 directory lookup/profile/sync/profile-events를 호출한다. `SSAFY_VERIFY_SMOKE_SEND_MM=1`을 추가로 설정한 경우에만 `@myknow` lookup 결과의 Mattermost user id로 batch DM smoke test를 발송한다.

## 운영 확인 사항

- Verify `picture`는 URL 계약으로 확정되었고, SSArtnership은 issuer 기준 absolute URL로 정규화한 뒤 `members.avatar_url`에 저장한다. 기존 `avatar_content_type`/`avatar_base64`는 과거 데이터와 fallback을 위해 유지한다.
- Verify `ssafy_track`, `ssafy_track_name`은 scope 승인과 트랙 규칙 매칭 상태에 따라 `null`일 수 있다. SSArtnership은 이를 인증 실패로 보지 않고 회원 row의 nullable metadata로만 보존한다.
- 사용자 상호작용 없이 주기적 프로필 조회를 허용할 경우 offline grant 또는 server-to-server 권한 모델이 필요하다.
- DM 알림은 자유문이 아니라 목적별 template으로 제한할지 결정해야 한다.
