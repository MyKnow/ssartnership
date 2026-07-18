# 07. API와 외부 연동

작성 기준일: 2026-07-09

## Internal API route map

### Admin APIs

| Method | Route | 목적 |
| --- | --- | --- |
| GET | `/api/admin/logs` | 관리자 로그 조회 |
| GET | `/api/admin/logs/export` | 관리자 로그 export |
| GET | `/api/admin/members/[id]/avatar` | 관리자 회원 avatar 조회 |
| GET/PATCH/DELETE | `/api/admin/notifications` | 관리자 notification 목록/일괄 처리 |
| PATCH/DELETE | `/api/admin/notifications/[id]` | 관리자 notification 단건 처리 |
| GET/POST | `/api/admin/notifications/preferences` | 관리자 notification preference |
| POST | `/api/admin/push/subscribe` | 관리자 push 구독 |
| POST | `/api/admin/push/unsubscribe` | 관리자 push 구독 해제 |

### Member/auth APIs

| Method | Route | 목적 |
| --- | --- | --- |
| POST | `/api/mm/login` | 회원 로그인 |
| POST | `/api/mm/logout` | 회원 로그아웃 |
| POST | `/api/mm/change-password` | 회원 비밀번호 변경 |
| POST | `/api/mm/consent` | 정책 동의 |
| POST | `/api/mm/delete` | 회원 삭제/탈퇴 |
| GET | `/api/mm/avatar` | 현재 회원 avatar |
| GET | `/api/mm/certification-token` | 인증 QR token |
| POST | `/api/mm/profile-sync` | 회원 프로필 동기화 |
| POST | `/api/mm/reset-password/complete` | 비밀번호 재설정 완료 |
| POST | `/api/mm/code/issue` | direct Mattermost DM 코드 발급 |
| POST | `/api/mm/code/verify` | direct Mattermost DM 코드 검증 |
| POST | `/api/mm/signup` | direct Mattermost 인증 가입 |
| POST | `/api/member/recovery/start` | 기존 사이트 비밀번호로 15분 이메일 복구 세션 발급 |
| POST | `/api/member/recovery/email/send` | 복구 세션의 이메일 코드 발송 |
| POST | `/api/member/recovery/email/verify` | 복구 이메일 코드 검증 및 이메일 로그인 전환 |
| GET | `/api/certification/avatar/[token]` | QR token 기반 avatar 조회 |

### Public/member feature APIs

| Method | Route | 목적 |
| --- | --- | --- |
| POST | `/api/events/product` | product analytics event 기록 |
| GET | `/api/image` | image proxy/cache |
| GET/PATCH/DELETE | `/api/notifications` | 회원 notification 목록/일괄 처리 |
| PATCH/DELETE | `/api/notifications/[id]` | 회원 notification 단건 처리 |
| POST | `/api/notifications/preferences` | 회원 notification preference |
| POST | `/api/partners/[id]/favorite` | 제휴 즐겨찾기 토글 |
| GET/POST | `/api/partners/[id]/reviews` | 리뷰 목록/생성 |
| PATCH/DELETE | `/api/partners/[id]/reviews/[reviewId]` | 리뷰 수정/삭제 |
| PATCH | `/api/partners/[id]/reviews/[reviewId]/reaction` | 리뷰 reaction |
| POST | `/api/partners/[id]/reviews/uploads/sign` | 리뷰 이미지 업로드 sign |
| POST | `/api/partners/[id]/reviews/uploads/cleanup` | 리뷰 이미지 cleanup |
| GET | `/api/partners/home-state` | 홈 partner state |
| POST | `/api/coupons/[couponId]/redeem` | 쿠폰 사용 |
| POST | `/api/suggest` | 제휴 제안 제출 |

### Push APIs

| Method | Route | 목적 |
| --- | --- | --- |
| POST | `/api/push/subscribe` | 회원 push 구독 |
| POST | `/api/push/unsubscribe` | 회원 push 구독 해제 |
| GET | `/api/push/subscriptions` | 회원 push 구독 목록 |
| POST | `/api/push/preferences` | 회원 push preference |
| POST | `/api/push/admin/preview` | 관리자 push preview |
| POST | `/api/push/admin/broadcast` | 관리자 push broadcast |
| DELETE | `/api/push/admin/logs/[id]` | push log 삭제 |

### Partner APIs

| Method | Route | 목적 |
| --- | --- | --- |
| POST | `/api/partner/change-password` | 협력사 비밀번호 변경 |
| POST | `/api/partner/reset-password` | 협력사 비밀번호 재설정 |
| GET/POST | `/api/partner/setup/[token]` | 초기 설정 context/complete |
| POST | `/api/partner/billing/business-status` | 사업자 상태 조회 |
| PATCH | `/api/partner/reviews/[reviewId]` | 협력사 리뷰 moderation |
| GET/PATCH/DELETE | `/api/partner/notifications` | 협력사 notification 목록/일괄 처리 |
| PATCH/DELETE | `/api/partner/notifications/[id]` | 협력사 notification 단건 처리 |
| GET/POST | `/api/partner/notifications/preferences` | 협력사 notification preference |
| POST | `/api/partner/push/subscribe` | 협력사 push 구독 |
| POST | `/api/partner/push/unsubscribe` | 협력사 push 구독 해제 |

### Cron APIs

| Method | Route | 목적 |
| --- | --- | --- |
| GET | `/api/cron/archive-expired-promotions` | 만료 promotion archive |
| GET | `/api/cron/member-sync` | 회원/디렉터리 동기화 |
| GET | `/api/cron/partner-billing` | 협력사 billing batch |
| GET | `/api/cron/push-expiring-partners` | 종료 예정 제휴 push |
| GET | `/api/cron/rss` | RSS refresh |

## External integrations

### Supabase

- PostgreSQL schema와 migration을 관리한다.
- server side에서는 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 사용한다.
- `NEXT_PUBLIC_SUPABASE_URL`은 image remote pattern 등 public 용도만 선택적으로 사용한다.
- Preview sync는 production data를 preview로 복사하되 member password material과 legacy `members.avatar_base64`만 제거한다. `member_profile_images`와 private `member-profile-images` 객체는 유지해 Preview에서도 실제 프로필 사진을 표시한다.

### Mattermost

- `MattermostClient`는 로그인, 사용자·채널 조회, DM 생성·발송, avatar 조회, logout을 서버에서만 수행한다.
- `MM_BASE_URL`은 서버 전용이며 MM 세션 토큰은 요청 메모리에서만 유지한다.
- 기수별 Sender credential은 `mattermost_sender_credentials`에 AES-256-GCM으로 저장한다. key env는 `MM_SENDER_CREDENTIALS_KEY_V1`, 활성 키 버전 env는 `MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION`이다.
- Sender 후보는 운영 화면에서 테스트 DM 성공 뒤에만 active가 되며, team/channel은 `s{generation}public`과 `town-square` 상수로 계산한다.
- 상세 기준은 [Mattermost 직접 연동 전환](./mattermost-direct-reversion.md)을 따른다.

### SMTP

- 제휴 제안 알림, 협력사 비밀번호 재설정, 지원 메일에 사용한다.
- 주요 env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SUGGEST_NOTIFY_EMAIL`
- legacy fallback: `NAVER_SMTP_USER`, `NAVER_SMTP_PASS`
- TLS legacy fallback: `SMTP_TLS_MIN_DH_SIZE`, `SMTP_TLS_CIPHERS`

### Web Push

- VAPID 기반 browser push를 사용한다.
- 주요 env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- 회원, 관리자, 협력사 subscription table/API가 분리되어 있다.

### NTS business status

- 협력사 결제/등록 과정에서 사업자 상태조회에 사용한다.
- 주요 env: `NTS_BUSINESS_STATUS_SERVICE_KEY`
- fallback env: `DATA_GO_KR_SERVICE_KEY`
- 상호/대표자/주소 자동 채움이 아니라 휴업/폐업 상태와 과세유형 확인 용도다.

### Vercel

- Production은 `main`, Preview는 `dev` branch 기준이다.
- Analytics와 Speed Insights가 root layout에 포함된다.
- CI workflow는 lockfile, preview sync, public readiness, Storybook을 검증한다.

## Environment variable groups

| 그룹 | 주요 env |
| --- | --- |
| 관리자 | `ADMIN_ID`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `ADMIN_ALLOWED_IPS`, `ADMIN_BASIC_AUTH_USERNAME`, `ADMIN_BASIC_AUTH_PASSWORD` |
| 회원 세션/QR | `USER_SESSION_SECRET`, `CERTIFICATION_QR_SECRET` |
| 협력사 | `PARTNER_SESSION_SECRET`, billing bank envs |
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, optional `NEXT_PUBLIC_SUPABASE_URL` |
| Data source | `NEXT_PUBLIC_DATA_SOURCE`, `NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE` |
| Preview sync | `PREVIEW_TEST_MEMBER_USERNAME`, `PREVIEW_TEST_MEMBER_PASSWORD` |
| Mattermost | `MM_BASE_URL`, `MM_SENDER_CREDENTIALS_KEY_V1`, `MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION` |
| SMTP | `SMTP_*`, `NAVER_SMTP_*`, `SUGGEST_NOTIFY_EMAIL` |
| Web Push/Cron | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` |
| SEO | `NEXT_PUBLIC_SITE_URL` |

## API design constraints

- 사용자 입력은 route/action boundary에서 검증한다.
- password, token, session, service role key, client secret은 응답/로그에 포함하지 않는다.
- admin/partner/member audience별 API는 서로 다른 session guard를 사용한다.
- cron route는 `CRON_SECRET`을 기준으로 보호한다.
- multipart/media upload는 sign route와 cleanup route를 분리해 실패 복구를 가능하게 한다.
- 같은 UI form을 변경할 때 FE 검증과 BE 검증은 동일 helper/schema 또는 동일 규칙 모듈을 사용해야 한다.
