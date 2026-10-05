---
title: 07. API와 외부 연동
type: architecture
status: current
authority: descriptive
last_verified: 2026-10-05
---

# 07. API와 외부 연동

route 목록의 정본은 `src/app/**/route.ts` 파일 자체다. 이 문서는 개별 route를 손으로 나열하지 않고 접두사별 책임과 보호 방식만 기록한다. 정확한 목록은 아래 명령으로 확인한다.

```bash
find src/app -name route.ts | sed -E 's#^src/app##; s#/route\.ts$##; s#/\([^)]+\)##g' | sort
```

## Route handler 지도

2026-10-05 `dev` 기준 route handler는 125개다(페이지 `page.tsx`는 제외).

| 접두사 | 개수 | 책임 | 보호 |
| --- | --- | --- | --- |
| `/api/admin/*` | 28 | 로그 조회·export, 회원 아바타·비밀번호 재설정·프로필 사진, 회원 가져오기, 가입 승인 신청 이미지, 수료생 인증 파일, 관리자 알림·푸시 구독, 알림 템플릿, 쿠폰 코드 업로드, 리뷰 moderation | 관리자 세션과 resource/action 권한 |
| `/api/mm/*` | 13 | Mattermost DM 코드 발급·검증, 가입·가입 사진, 비밀번호 변경·재설정 완료, 동의, 탈퇴, 프로필 동기화, 인증 QR token, 아바타, 로그아웃. `/api/mm/login`은 화면에서 호출하지 않는 레거시 로그인 경로다. | 회원 세션 또는 짧은 인증 완료 세션, same-origin |
| `/api/auth/login` | 1 | 회원 로그인(로그인 폼이 호출) | 레이트리밋, same-origin |
| `/api/member/*`, `/api/member-password-action/*` | 7 | 이메일 등록·변경 코드, Mattermost 장애 시 이메일 복구 세션, 관리자 발급 비밀번호 설정·재설정 | 회원 세션 또는 단기 복구·작업 토큰 |
| `/api/graduate-verification/*` | 9 | 수료생 신청·이메일 인증·업로드 서명·계정 설정·비밀번호 재설정·철회 | HttpOnly 신청 세션과 HMAC |
| `/api/certification/*` | 4 | 인증 카드 사진 업로드 서명·확정, QR token 기반 아바타 | 회원 세션 또는 서명 token |
| `/api/partners/*` | 6 | 즐겨찾기, 리뷰 CRUD·reaction, 혜택 사용 확인, 홈 상태 | 회원 세션(공개 읽기 제외) |
| `/api/partner/*` | 10 | 협력사 비밀번호 변경·재설정, 초기 설정, 사업자 상태 조회, 리뷰 moderation, 알림·푸시 구독 | 협력사 세션 또는 초기 설정 token |
| `/api/notifications/*`, `/api/push/*` | 10 | 회원 알림함·설정, 푸시 구독, 관리자 푸시 미리보기·발송·로그 삭제 | 회원 세션, 관리자 발송은 관리자 권한 |
| `/api/coupons/*`, `/api/coupon-issues/*` | 2 | 쿠폰 발급과 발급 ID 기반 사용 확인. 쿠폰 ID를 직접 사용하는 레거시 경로는 폐기됐다. | 회원 세션 |
| `/api/uploads/images/*` | 2 | 공용 이미지 업로드 서명·완료 | 업로드 세션과 quota |
| `/api/wallet/*` | 6 | Apple Wallet 발급·폐기, Apple web service(기기 등록·변경 serial·pass·log), 공개 검증 아바타 | 회원 세션 또는 Apple 인증 token. 기능은 현재 비활성 |
| `/api/cron/*` | 12 | 익명화, 로그·쇼케이스 개인정보 파기, 업로드·수료생 파일·수동 가져오기 정리, 프로모션 정리, 결제 상태, 만료 제휴 알림, Sender 상태, RSS, Wallet 조정 | `CRON_SECRET` Bearer |
| `/api/events/product`, `/api/web-vitals` | 2 | 제품 이벤트와 Web Vitals 수집 | 크기·속도 제한, 계약 검증 |
| `/api/image`, `/api/health`, `/api/suggest` | 3 | 이미지 프록시, liveness, 제휴 제안 | 공개(프록시는 내부망 차단, 제안은 레이트리밋) |
| `/api/e2e/mock/reset`, `/auth/mock` | 2 | E2E·mock profile 전용 상태 초기화와 mock 로그인 | 명시적 mock·E2E 환경 변수 없으면 거절 |
| 그 밖의 페이지 인접 route | 7 | `/admin/session`(회원 세션 기반 관리자 세션 bridge), `/partner/logout`, 관리자·등록 엑셀 템플릿과 이벤트 보상 export, `/rss.xml` | 각 화면의 세션 규칙 |

Cron 실행 일정의 정본은 `deploy/self-host-operations/production-cron/schedules.json`이다. Wallet 조정 Cron은 기능과 함께 비활성이다.

## External integrations

### Supabase

- PostgreSQL schema와 migration을 관리한다.
- server side에서는 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 사용한다.
- `NEXT_PUBLIC_SUPABASE_URL`은 image remote pattern 등 public 용도만 선택적으로 사용한다.
- 운영 DB·Storage는 PVE의 자체 호스팅 Supabase 구성(PostgreSQL·PostgREST·Storage·Kong)이다. 클라우드 Supabase는 운영 경로가 아니다.
- Production→Preview 사본은 `scripts/self-host-environments/cli.mjs prepare-copy`가 격리 복원본에서 비밀번호·자격증명을 정제한 뒤 만든다. `member_profile_images`와 private `member-profile-images` 객체는 유지해 Preview에서도 실제 프로필 사진을 표시한다.
- Apple Wallet pass와 device registration은 `member_wallet_passes`, `member_wallet_pass_revisions`, `apple_wallet_device_registrations`, `member_wallet_pass_operations` 및 service-role 전용 RPC(`issue_member_wallet_pass`, `revoke_member_wallet_pass`, `register_apple_wallet_device`, `unregister_apple_wallet_device`, `list_updated_apple_wallet_passes`)로 관리한다.

### Mattermost

- `MattermostClient`는 로그인, 사용자·채널 조회, DM 생성·발송, avatar 조회, logout을 서버에서만 수행한다.
- `MM_BASE_URL`은 서버 전용이며 MM 세션 토큰은 요청 메모리에서만 유지한다.
- 기수별 Sender credential은 `mattermost_sender_credentials`에 AES-256-GCM으로 저장한다. key env는 `MM_SENDER_CREDENTIALS_KEY_V1`, 활성 키 버전 env는 `MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION`이다.
- Sender 후보는 운영 화면에서 테스트 DM 성공 뒤에만 active가 되며, team/channel은 `s{generation}public`과 `town-square` 상수로 계산한다.
- 상세 기준은 [Mattermost 직접 연동 전환](../decisions/ADR-0001-direct-mattermost-integration.md)을 따른다.

### SMTP

- 제휴 제안 알림, 협력사 비밀번호 재설정, 지원 메일에 사용한다.
- 주요 env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SUGGEST_NOTIFY_EMAIL`
- legacy fallback: `NAVER_SMTP_USER`, `NAVER_SMTP_PASS`
- TLS legacy fallback: `SMTP_TLS_MIN_DH_SIZE`, `SMTP_TLS_CIPHERS`

### Web Push

- VAPID 기반 browser push를 사용한다.
- 주요 env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- 회원, 관리자, 협력사 subscription table/API가 분리되어 있다.

### Apple Wallet / APNs

- 상세 제품 계약은 [Apple Wallet 회원 인증 패스 MVP](../specs/301-apple-wallet-member-pass/spec.md)를 따른다.
- `/certification`에서 발급 전 기존 필수 게이트 우선순위(`비밀번호 변경 -> 필수 약관 동의 -> 본인 사진 -> 원래 목적지`)를 그대로 적용한다.
- Pass Type ID certificate, private key, Apple WWDR certificate, Wallet master key는 모두 서버 전용 env에서만 읽는다.
- `APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64`는 정확히 32바이트인 장기 Wallet master key다. APNs token 암호화, device identifier hash, QR 서명, ApplePass 인증은 고정된 서로 다른 HMAC-SHA256 context로 subkey를 파생한다. 설치 수명 중 이 키는 불변이며 회전은 저장 token 재암호화·기기 재등록·패스 재발급을 포함한 별도 migration이다.
- Apple Wallet이 활성화되면 `NEXT_PUBLIC_SITE_URL`의 명시적인 공개 HTTPS origin이 필수며 fallback을 사용하지 않는다.
- 공개 검증 경로(`/wallet/verify/[token]`, `/api/wallet/apple/avatar/[token]`)는 `no-store`, `noindex`와 opaque signed token을 사용하고 token 원문을 analytics 식별자나 로그 key로 남기지 않는다.
- Apple device library identifier는 Wallet master key에서 용도 분리한 HMAC-SHA256 subkey로 hash한다. APNs push token도 별도의 암호화 subkey로 보호한 뒤 `apple_wallet_device_registrations`에 저장한다. master key 회전은 저장 token 재암호화와 기기 hash 재생성·재등록, 기존 패스 재발급 계획이 필요한 별도 작업이다.
- 일일 조정 Cron(`/api/cron/reconcile-apple-wallet-passes`)이 설치된 active pass를 재검사한다. Wallet 기능과 이 timer는 현재 비활성이다. 표시 정보만 달라졌고 자격·동의가 유효하면 새 snapshot revision을 저장하고, 자격 또는 동의가 무효하면 credential을 폐기한 뒤 APNs update를 보낸다. QR 검증은 cron 주기와 무관하게 현재 상태를 즉시 확인한다.
- APNs가 일시 실패한 설치 pass는 active·revoked 상태 모두 다음 cron에서 재시도하며, 성공 상태의 revoked pass만 조정 큐에서 빠진다.
- Apple의 `passesUpdatedSince` 목록 커서는 canonical pass의 `updated_at`만 사용한다. 기기 등록·해제 RPC가 registration과 pass 시각을 같은 트랜잭션에서 함께 갱신하므로 필터·정렬·응답 커서가 한 시계를 공유한다.

### NTS business status

- 협력사 결제/등록 과정에서 사업자 상태조회에 사용한다.
- 주요 env: `NTS_BUSINESS_STATUS_SERVICE_KEY`
- fallback env: `DATA_GO_KR_SERVICE_KEY`
- 상호/대표자/주소 자동 채움이 아니라 휴업/폐업 상태와 과세유형 확인 용도다.

### 자체 호스팅 배포

- Production은 `main`, Preview는 `dev` branch 기준이다. 각 branch의 이미지 workflow가 exact-SHA 이미지를 게시하고 환경별 수신기가 앱만 교체한다. 절차는 [격리 CI·배포·유지보수](../operations/runbooks/self-host-ci-maintenance.md)를 따른다.
- 공개 사이트 Web Vitals는 `/api/web-vitals` 자체 수집 경로로 보낸다. Vercel Analytics·Speed Insights는 PVE 이전 뒤 로드되지 않는다.
- CI workflow는 `Public Readiness`(위험 등급별 검증)와 이미지 게시 workflow가 중심이고 Storybook·Visual은 수동 workflow다.

## Environment variable groups

필수·선택 값과 오류 코드의 정본은 `deploy/self-host/runtime-env.mjs`, 예시는 `.env.example`과 `deploy/self-host/runtime.env.example`이다. 아래 표는 그룹 안내다.

| 그룹 | 주요 env |
| --- | --- |
| 관리자 | `ADMIN_SESSION_SECRET`, `ADMIN_ALLOWED_IPS`, `ADMIN_BASIC_AUTH_USERNAME`, `ADMIN_BASIC_AUTH_PASSWORD`(관리자 계정과 비밀번호는 DB `admin_accounts`에 있다) |
| 회원 세션/QR/HMAC | `USER_SESSION_SECRET`, `CERTIFICATION_QR_SECRET`, `MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET`, `MEMBER_EMAIL_VERIFICATION_HMAC_SECRET`, `GRADUATE_VERIFICATION_HMAC_SECRET` |
| 협력사 | `PARTNER_SESSION_SECRET`, billing bank envs |
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, 서버 내부 전송용 `SUPABASE_INTERNAL_URL`, optional `NEXT_PUBLIC_SUPABASE_URL` |
| Data source·실행 모드 | `NEXT_PUBLIC_DATA_SOURCE`, `NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE`, `SELF_HOST_MODE` |
| Mattermost | `MM_BASE_URL`, `MM_SENDER_CREDENTIALS_KEY_V1`, `MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION` |
| SMTP | `SMTP_*`, `NAVER_SMTP_*`, `SUGGEST_NOTIFY_EMAIL` |
| Web Push/Cron | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` |
| Apple Wallet | `APPLE_WALLET_ENABLED`, `APPLE_WALLET_TEAM_ID`, `APPLE_WALLET_PASS_TYPE_ID`, `APPLE_WALLET_ORGANIZATION_NAME`, `APPLE_WALLET_CERTIFICATE_BASE64`, `APPLE_WALLET_PRIVATE_KEY_BASE64`, `APPLE_WALLET_PRIVATE_KEY_PASSPHRASE`, `APPLE_WALLET_WWDR_CERTIFICATE_BASE64`, `APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64`, `NEXT_PUBLIC_SITE_URL` |
| SEO | `NEXT_PUBLIC_SITE_URL` |

## API design constraints

- 사용자 입력은 route/action boundary에서 검증한다.
- password, token, session, service role key, client secret은 응답/로그에 포함하지 않는다.
- admin/partner/member audience별 API는 서로 다른 session guard를 사용한다.
- cron route는 `CRON_SECRET`을 기준으로 보호한다.
- multipart/media upload는 sign route와 cleanup route를 분리해 실패 복구를 가능하게 한다.
- 같은 UI form을 변경할 때 FE 검증과 BE 검증은 동일 helper/schema 또는 동일 규칙 모듈을 사용해야 한다.
