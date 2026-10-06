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

### 리뷰와 가입 이미지의 재시도·정리

2026-10-06 업로드 정합성 변경은 `image-upload/repository.supabase.ts`와 리뷰 API가 공용 업로드 세션을 통해 파일의 수명을 관리하도록 한다.

- 리뷰 생성·수정 요청은 일부 연결 실패, 중복 요청, 저장 응답 유실, 수정 뒤 요약 조회 실패에도 최종 파일을 직접 삭제하지 않는다. 같은 작성자·제휴처·리뷰 ID의 생성 재요청은 이미지 목록이 달라도 최초 저장 리뷰를 반환한다.
- 미사용 리뷰 첨부는 업로드 서명 때 정한 2시간 만료를 유지하며, 매시간 실행하는 `cleanup-image-uploads`가 정리한다. 참조 중인 리뷰는 숨김·논리 삭제 상태도 포함해 파일을 보존한다. 기존 리뷰의 레거시 URL은 그대로 유지할 수 있지만 새 URL은 소유자·리소스·만료·연결 상태를 확인한 업로드여야 한다.
- DB의 리뷰 참조 검증과 `claim_image_upload_cleanup`은 같은 업로드 세션 행을 잠근다. 정리 작업이 먼저 비연결 상태를 확정하면 뒤늦은 리뷰 저장은 거절된다. DB 정리 권한을 받은 객체만 삭제하고, 실제 claim 시각·상태·실패 코드가 일치할 때만 만료를 확정한다.
- 파일 삭제나 상태 저장 실패는 다음 주기에 재시도하며 Cron은 실패 건수를 기록하고 5xx를 반환한다. 정리가 확정된 모든 업로드의 삭제 표식은 늦게 완료된 Storage 쓰기를 회전식으로 다시 정리한다. 비리뷰 `attached` 세션의 보존 기간은 바꾸지 않으며, 명시적 폐기 또는 연결 전 만료로 정리 권한을 얻은 세션만 대상이다. 처리 중 정규화 파일 경로도 함께 정리한다. Storage와 DB는 별도 트랜잭션이므로 외부 장애·작업 적체 중 절대적인 삭제 완료 시간을 보장하지 않는다.
- 정리 RPC는 한 번에 최대 100행을 잠근다. 일반 만료·미사용 리뷰 첨부·삭제 표식 재점검에 처리량을 나누고 `updated_at, id` 순서로 순환한다. 삭제 표식은 최소 1시간 간격으로 다시 검사하며, 원장이 남아 있는 동안 제한된 정리 부하가 계속 발생한다. 대상이 누적되면 재점검 간격도 길어질 수 있으므로 매회 전체 원장을 순회하거나 영구 실패 항목만 반복하지 않는다.
- 이미 연결된 리뷰 파일의 확실한 부재는 이미지 필드의 재업로드 안내로 반환한다. Storage SDK의 `statusCode=NoSuchKey`도 HTTP 상태와 함께 확인하며, 권한 거절·제공자 장애·시간 초과·불명확한 응답은 503으로 유지한다. 만료된 첨부는 같은 작성자의 같은 리뷰가 이미 참조할 때만 재사용한다. 아직 참조되지 않은 만료 첨부나 연결 확인 후 저장 시점에 만료된 첨부는 재업로드 필드 오류로 복구한다. 이 조회는 삭제 권한을 부여하지 않으며 최종 참조 허용 여부는 DB가 다시 확인한다.
- 가입 승인 신청은 기존 승인 대기 만료 기간을 유지한다. 중복 또는 결과를 모르는 INSERT 뒤 업로드를 임의로 폐기하지 않으며, 승인 신청이나 회원 사진 원장이 참조하는 업로드는 정리할 수 없다. 직접 가입을 되돌릴 때는 회원 참조 삭제가 확인된 다음에 업로드 폐기를 요청한다.

이 변경의 최초 배포는 리뷰 쓰기 중단과 구버전 요청 종료를 확인한 뒤 migration·새 앱·정리 작업을 함께 적용해야 한다. 구버전 앱에는 Storage 직접 삭제 경로가 있으므로 새 버전과 쓰기 요청을 동시에 처리하면 안 된다. 구버전으로 되돌릴 때도 리뷰 쓰기를 중단한다. Preview 사본 교체는 기존 앱 중지 구간에서 이 순서를 적용한다.

### Mattermost

- `MattermostClient`는 로그인, 사용자·채널 조회, DM 생성·발송, avatar 조회, logout을 서버에서만 수행한다.
- `MM_BASE_URL`은 서버 전용이며 MM 세션 토큰은 요청 메모리에서만 유지한다.
- 기수별 Sender credential은 `mattermost_sender_credentials`에 AES-256-GCM으로 저장한다. key env는 `MM_SENDER_CREDENTIALS_KEY_V1`, 활성 키 버전 env는 `MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION`이다.
- Sender 후보는 운영 화면에서 테스트 DM 성공 뒤에만 active가 되며, team/channel은 `s{generation}public`과 `town-square` 상수로 계산한다.
- 조회·로그인·DM 채널 생성 요청은 timeout 시 1회 재시도하고, DM 게시는 중복 발송을 막기 위해 재시도하지 않는다.
- 런타임 Sender health는 로그인 단계 실패와 timeout·장애·rate limit·잘못된 응답만 반영한다. 로그인 뒤 대상 작업의 403과 요청 거부(400·422 등)는 대상별 문제라 Sender를 차단하지 않으며, Sender 자체 점검은 `mattermost-sender-health` cron이 맡는다.
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
- 모든 발송은 `src/lib/push/web-push-client.ts`의 `sendWebPush`(구독 신뢰 검증 + 10초 소켓 타임아웃)를 거친다. 404/410과 신뢰 검증 실패만 구독을 비활성화하고 timeout·5xx는 구독을 유지한다.
- 관리자·협력사 운영 알림 푸시는 `sendOperationalPushDeliveries` 하나를 대상별 설정(구독 테이블·소유자 컬럼·템플릿 키·delivery 테이블)으로 공유한다.
- 브라우저 구독은 회원·관리자·협력사 설정 화면이 같은 헬퍼로 기존 구독을 재사용하고 VAPID 공개키가 바뀐 경우에만 교체한다.
- 푸시 구독 이벤트 로그(`event_logs.target_id`)에는 endpoint URL을 남기지 않고 구독 UUID만 기록한다.

### 이벤트 당첨 안내 재시도

- 추첨별 `event-reward:<draw-id>:winner-notice:v1` 키로 기존 캠페인 claim/finalize RPC를 사용한다. 발송 전에 캠페인 ID와 attempt token을 추첨에 연결하고 `updated_at` 비교로 선점한다. 결과 저장은 같은 token으로 제한하여 이전 실행이 최신 결과를 덮어쓰지 못하게 한다.
- 추첨 선점·완료 저장은 일치하는 추첨 ID의 반환 행으로 확인한다. 당첨자별 상태 저장도 모든 대상의 추첨 ID·회원 ID·상태를 확인한 뒤 추첨을 완료하며, 이미 `sent`인 행은 되돌리지 않는다. 빈 성공 응답은 저장 증거가 아니며 후속 기록 실패는 같은 원장으로 복구하여 외부 발송을 반복하지 않는다.
- Mattermost 수신자별 v2 delivery claim은 `claimed → sending → sent` 순서를 지킨다. 서버의 명시적인 거절과 게시 요청 전 실패만 재시도할 수 있다. timeout, 네트워크 유실, 모호한 응답, provider 성공 후 원장 저장 실패는 확인 대기로 남겨 재발송하지 않는다. 성공 게시물 ID는 같은 sent 행에 부가 기록하며 실패해도 sent를 되돌리지 않는다.
- 도달 판정은 수신자별 원장으로 한다. 외부 채널 시도가 있으면 외부 `sent`가 필요하고, 외부 시도가 없으면 `in_app/sent` 영수증이 필요하다. 빈 원장과 조회 실패를 발송 완료로 간주하지 않는다. 채널이 모두 제외된 미도달 대상은 이후 명시적인 재시도가 가능하다.
- 기존 당첨 안내 ID와 영수증은 보존한다. 이전 외부 발송의 결과를 확정할 수 없거나 영수증이 없으면 운영자가 결과를 확인하기 전까지 재발송하지 않는다. 새 MM 선점 RPC와 unique index 적용 후 기존 앱의 발송 작업을 중지·종료한 다음 새 앱으로 교체해야 한다. SQL 적용 및 운영자 확인은 로컬 테스트와 별도 검증이다.

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
- fallback env: `DATA_GO_KR_SERVICE_KEY`(폐기 예정 별칭, 읽을 때 경고)
- 상호/대표자/주소 자동 채움이 아니라 휴업/폐업 상태와 과세유형 확인 용도다.

### 배포·CI

- PVE 자체 호스팅이 유일한 운영 정본이다. `main`은 Production, `dev`는 원본 Preview 이미지로 배포된다([격리 CI·배포](../operations/runbooks/self-host-ci-maintenance.md)). Vercel 배포·Analytics·Speed Insights와 클라우드 Supabase 반출·Preview 동기화 도구는 RF-04(#537)에서 제거했다.
- 브라우저 성능은 [자체 호스팅 Web Vitals·Lighthouse 측정](../performance/measurements/web-vitals.md)으로만 확인한다.
- CI workflow는 change-aware public readiness, 교차 플랫폼 개발환경, 수동 Storybook, 자체 호스팅 이미지 발행과 공개 health 수동 확인을 담당한다.

## Environment variable groups

환경 변수 목록·그룹·분류(필수/build/선택/플랫폼/호환/폐기 예정/개발)의 정본은 `scripts/lib/env-manifest.mjs`다. `npm run check:env`와 `tests/env-manifest.test.mts`가 매니페스트, `src/`·`next.config.ts`의 env 읽기, `.env.example`, `deploy/self-host/runtime.env.example`의 drift를 막는다. 주요 그룹은 Supabase, 세션·HMAC, 관리자 edge 보호, Mattermost Sender, Cron·Web Push, 공개 build 값, 파트너 청구·사업자 상태, 이메일, Apple Wallet, 자체 호스팅 Web Vitals다. 폐기 예정 별칭(`NAVER_SMTP_*`, `DATA_GO_KR_SERVICE_KEY`)은 읽을 때 경고만 남기고 예시 파일에 두지 않는다.

## API design constraints

- 사용자 입력은 route/action boundary에서 검증한다.
- password, token, session, service role key, client secret은 응답/로그에 포함하지 않는다.
- admin/partner/member audience별 API는 서로 다른 session guard를 사용한다.
- cron route는 `CRON_SECRET`을 기준으로 보호한다.
- multipart/media upload는 sign route와 cleanup route를 분리해 실패 복구를 가능하게 한다.
- 같은 UI form을 변경할 때 FE 검증과 BE 검증은 동일 helper/schema 또는 동일 규칙 모듈을 사용해야 한다.
