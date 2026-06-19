# SSAFY Verify External API Delegation TODO

## 목적

SSArtnership이 직접 보유한 Mattermost 계정 조회, 프로필 동기화, DM 발송 책임을 SSAFY Verify로 위임한다. 우리 서비스는 SSAFY Verify가 승인한 사용자 식별자와 프로필 스냅샷을 소비하고, Mattermost 토큰과 발송 로직은 장기적으로 보유하지 않는 방향을 목표로 한다.

## 현재 판단

- 회원가입 또는 최초 SSAFY Verify 연결 시에는 `ssafy.verify`, `ssafy.affiliation`, `ssafy.name`, `ssafy.profile_image`, `ssafy.role`, `ssafy.mattermost_id`를 요청한다.
- 비밀번호 재설정 등 본인 재확인 플로우에서는 `ssafy.verify`, `ssafy.mattermost_id`만 요청한다.
- 본인 재확인은 Verify 응답의 Mattermost user id가 기존 회원의 `mm_user_id`와 같은지만 대조한다.
- 프로필 저장 스키마 확장과 주기적 동기화는 별도 작업으로 분리한다.

## SSAFY Verify에 요청할 외부 API

### 1. 프로필 스냅샷 API

- 목적: SSArtnership이 직접 Mattermost API를 호출하지 않고 최신 사용자 프로필을 조회한다.
- 예시: `GET /v1/me/profile` 또는 `GET /v1/users/{sub}/profile`
- 식별자: SSAFY Verify `sub` 우선, 필요 시 `ssafy_mattermost_user_id` 보조.
- 응답 필드: 승인된 scope 안에서만 이름, 프로필 이미지, 기수, 캠퍼스, 지역, 역할, 운영진 여부, Mattermost user id를 반환한다.
- 요구사항: client별 scope 승인, request id, 안정적인 에러 코드, rate limit, audit log.

### 2. 프로필 변경 Webhook

- 목적: 하루 1회 batch sync에 의존하지 않고 이름, 프로필 이미지, 역할 변경을 반영한다.
- 이벤트 예시: `user.profile.updated`, `user.affiliation.updated`, `user.role.updated`.
- 요구사항: 서명 검증, replay 방지 timestamp, event id 멱등성, 재시도 정책, 실패 로그 조회.

### 3. Mattermost DM 알림 API

- 목적: SSArtnership이 Mattermost bot token을 보유하지 않고 Verify를 통해 DM을 발송한다.
- 예시: `POST /v1/notifications/mattermost`.
- 수신자 식별: `sub` 또는 `ssafy_mattermost_user_id`.
- 발송 방식: 승인된 template 또는 purpose 기반 발송을 우선하고, raw free-form 메시지는 제한한다.
- 요구사항: 발송 rate limit, template 승인, abuse 방지, request id, audit log, 실패 사유 코드.

### 4. 알림 상태 조회 API

- 목적: 이벤트 알림과 인증 안내 메시지의 성공, 실패, 재시도 상태를 추적한다.
- 예시: `GET /v1/notifications/{notification_id}`.
- 요구사항: queued, sent, failed, retrying 등 안정적인 상태 값과 실패 코드 제공.

## 전환 TODO

- [x] Phase 1: 회원가입/최초 연결 scope와 재인증 scope를 분리한다.
- [ ] Phase 2: SSArtnership 회원 프로필 저장 범위를 결정하고 Supabase schema를 확장한다.
- [ ] Phase 3: SSAFY Verify 프로필 스냅샷 API 또는 webhook 계약이 확정되면 프로필 동기화를 전환한다.
- [ ] Phase 4: Mattermost DM 발송을 SSAFY Verify 알림 API로 전환한다.
- [ ] Phase 5: 더 이상 필요 없는 Mattermost 직접 호출 코드와 관련 env를 삭제한다.

## 보안 요구사항

- 프로필 조회와 알림 발송은 별도 scope로 분리한다.
  - 예시: `ssafy.profile.sync`, `ssafy.notify.dm`, `ssafy.notify.event`.
- 사용자 동의, 철회, client별 승인 목록을 Verify에서 추적한다.
- SSArtnership은 Mattermost bot token, 관리자 token, 사용자 DM 채널 생성 권한을 장기 보유하지 않는다.
- 모든 API와 webhook은 request id와 audit event를 제공한다.
- 에러 응답은 사용자 존재 여부나 내부 Mattermost 권한 정보를 과도하게 노출하지 않는다.

## 미결정 사항

- `ssafy_mattermost_user_id`가 기존 `members.mm_user_id`와 항상 같은 값인지 Verify 측 계약 확인이 필요하다.
- 프로필 이미지는 외부 URL을 그대로 저장할지, SSArtnership에서 캐시할지 결정해야 한다.
- 사용자 상호작용 없이 주기적 프로필 조회를 허용할 경우 offline grant 또는 server-to-server 권한 모델이 필요하다.
- DM 알림은 자유문이 아니라 목적별 template으로 제한할지 결정해야 한다.
