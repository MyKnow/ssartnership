# 06. 데이터 모델

작성 기준일: 2026-07-09

기준 소스는 `supabase/schema.sql`과 `supabase/migrations/**`이다.

## 도메인별 테이블

### Public partner directory

| Table | 역할 |
| --- | --- |
| `categories` | 제휴 카테고리 key/label/description/color |
| `public_cache_versions` | public partner/category cache busting scope |
| `partner_companies` | 협력사 회사/브랜드 소유 단위 |
| `partner_brand_profiles` | 회사별 브랜드 프로필 |
| `partners` | 실제 제휴 서비스/매장/혜택 |
| `partner_company_branches` | 회사 지점 |
| `partner_offer_branches` | 제휴와 지점 연결 |

주요 partner 필드:

- `visibility`: `public`, `confidential`, `private`
- `benefit_visibility`: `public`, `eligible_only`
- `campus_slugs`: `seoul`, `gumi`, `daejeon`, `busan-ulsan-gyeongnam`, `gwangju`
- `applies_to`: `staff`, `student`, `graduate`
- `benefit_action_type`, `benefit_action_link`, `reservation_link`, `inquiry_link`
- `period_start`, `period_end`, `conditions`, `benefits`, `images`, `thumbnail`, `tags`

### Partner accounts and portal

| Table | 역할 |
| --- | --- |
| `partner_accounts` | 협력사 로그인 계정, 초기 설정, reset 상태 |
| `partner_account_companies` | 계정과 회사 연결 |
| `partner_auth_attempts` | 협력사 인증 throttle/audit |
| `partner_change_requests` | 협력사 정보 변경 요청 |
| `partner_plan_upgrade_requests` | 플랜 업그레이드 요청 |
| `partner_brand_plan_events` | 플랜 변경 이벤트 |
| `partner_billing_profiles` | 협력사 정산/세금계산서 프로필 |
| `partner_billing_invoices` | 협력사 청구서 |
| `partner_billing_payments` | 입금/결제 기록 |
| `partner_tax_documents` | 세금 관련 문서 상태 |

### Partner registration

| Table | 역할 |
| --- | --- |
| `partner_registration_attempts` | 협력사 등록 rate limit/throttle |
| `partner_registration_requests` | 외부 협력사 등록 신청 본문 |
| `partner_registration_benefit_groups` | 신청서 내 혜택 그룹 |
| `partner_registration_branches` | 신청서 내 지점 목록 |

### Members and policy

| Table | 역할 |
| --- | --- |
| `members` | SSAFY 회원, 인증/권한/프로필/정책 상태 |
| `member_auth_attempts` | 회원 인증 시도 |
| `mm_user_directory` | 직접 Mattermost 디렉터리 snapshot 및 최신 MM ID 연결 |
| `mattermost_sender_credentials` | 기수별 AES-GCM 암호화 Sender 후보/활성 credential metadata |
| `mattermost_sender_test_attempts` | Sender 테스트 rate limit/audit state |
| `mattermost_verification_codes` | direct DM 가입·재설정 코드 hash와 delivery 상태 |
| `member_email_challenges` | 이메일 변경·MM 장애 복구 코드 hash |
| `password_reset_attempts` | 비밀번호 재설정 시도 |
| `policy_documents` | 약관/개인정보/마케팅 문서 버전 |
| `member_policy_consents` | 회원별 정책 동의 기록 |
| `ssafy_cycle_settings` | 기준 기수/연도/월 설정 |
| `ssafy_cohort_card_themes` | 기수 인증 카드 테마 |

### Reviews, favorites, coupons, ads

| Table | 역할 |
| --- | --- |
| `partner_reviews` | 제휴 리뷰 |
| `partner_review_reactions` | 리뷰 reaction |
| `partner_favorites` | 회원별 즐겨찾기 |
| `ad_campaigns` | 광고 캠페인 |
| `ad_coupons` | 광고/제휴 쿠폰 |
| `ad_coupon_redemptions` | 쿠폰 사용 기록 |

### Promotion/events

| Table | 역할 |
| --- | --- |
| `promotion_events` | 이벤트 메타/노출 기간 |
| `promotion_slides` | 홈 프로모션 슬라이드 |
| `event_reward_draws` | 이벤트 리워드 추첨 회차 |
| `event_reward_winners` | 이벤트 리워드 당첨자 |

### Notifications and push

| Table | 역할 |
| --- | --- |
| `push_preferences` | 회원 push preference |
| `notifications` | 회원 대상 notification 원본 |
| `member_notifications` | 회원별 notification 수신/읽음/삭제 |
| `notification_deliveries` | 회원 notification provider delivery |
| `push_subscriptions` | 회원 browser push subscription |
| `push_message_logs` | push message 발송 로그 |
| `push_delivery_logs` | push delivery 대상 로그 |
| `admin_notification_preferences` | 관리자 알림 preference |
| `admin_push_subscriptions` | 관리자 push subscription |
| `admin_notifications` | 관리자 notification |
| `admin_notification_recipients` | 관리자 notification recipient |
| `admin_notification_deliveries` | 관리자 notification delivery |
| `partner_notification_preferences` | 협력사 알림 preference |
| `partner_push_subscriptions` | 협력사 push subscription |
| `partner_notifications` | 협력사 notification |
| `partner_notification_recipients` | 협력사 notification recipient |
| `partner_notification_deliveries` | 협력사 notification delivery |
| `operational_notification_dedupes` | 운영 알림 중복 방지 |

### Logs, metrics, admin security

| Table | 역할 |
| --- | --- |
| `event_logs` | product analytics 원본 |
| `partner_metric_rollups` | partner metric 집계 |
| `partner_metric_unique_visitors` | partner unique visitor 집계 |
| `admin_audit_logs` | 관리자 조작 감사 로그 |
| `auth_security_logs` | 인증/보안 로그 |
| `admin_login_attempts` | 관리자 로그인 시도 |
| `suggestion_attempts` | 제휴 제안 throttle |
| `admin_accounts` | 관리자 계정 |
| `admin_permissions` | 관리자 resource/action 권한 |
| `admin_permission_templates` | 관리자 권한 template |

## 주요 RPC/function

| Function | 역할 |
| --- | --- |
| `infer_partner_campus_slugs` | location 기반 campus slug 추론 |
| `set_partnership_updated_at` | partner/category update timestamp |
| `sync_basic_partner_plan_dates` | basic partner plan date 동기화 |
| `bump_public_cache_version` | public cache scope version 증가 |
| `bump_partners_public_cache_version` | partners cache version 증가 |
| `bump_categories_public_cache_version` | categories cache version 증가 |
| `get_admin_review_counts` | 관리자 리뷰 count |
| `get_admin_dashboard_counts` | 관리자 dashboard count |
| `get_admin_logs_page` | 관리자 로그 페이지 조회 |
| `get_partner_review_visibility_counts` | 제휴별 리뷰 visibility count |
| `get_member_visible_review_count_in_range` | 회원 리뷰 count/range |
| `get_partner_favorite_counts` | partner favorite count bulk 조회 |
| `get_partner_review_counts` | partner review count bulk 조회 |
| `partner_metric_visitor_key` | metric unique visitor key |
| `apply_partner_metric_event_rollups` | metric rollup 적용 |
| `apply_partner_metric_event` | 단일 metric event 적용 |
| `reconcile_partner_metric_rollups` | metric rollup 재조정 |
| `sync_partner_metric_rollups_from_event_logs` | event log 기반 metric 동기화 |
| `bump_admin_permission_version` | 관리자 권한 version 증가 |
| `ensure_active_privileged_admin_exists` | privileged admin 보존 guard |
| `ensure_single_member_super_admin` | member super admin 제약 |
| `set_ad_campaigns_updated_at` | ad campaign timestamp |
| `set_ad_coupons_updated_at` | ad coupon timestamp |
| `set_event_reward_draws_updated_at` | event reward draw timestamp |
| `set_event_reward_winners_updated_at` | event reward winner timestamp |

## RLS and indexes

- `schema.sql` 기준 주요 application table은 모두 row level security가 enable되어 있다.
- public read policy가 `categories`, `partners` 등에 정의되어 있다.
- 앱 서버는 대부분 service role admin client를 사용하므로 API/server action 경계 검증이 필수 방어선이다.
- 성능상 중요한 index는 partner/category lookup, registration status, member display/year/campus, event log pagination/filter, admin audit/auth security logs, review/favorite counts, notification delivery, billing status, promotion periods에 존재한다.

## 마이그레이션 시 보존해야 하는 상태값

- partner visibility: `public`, `confidential`, `private`
- partner visibility state: 기간 만료는 저장값이 아니라 `period_start/end`와 현재 시각으로 계산한다.
- benefit visibility: `public`, `eligible_only`
- audience: `staff`, `student`, `graduate`
- campus slug: `seoul`, `gumi`, `daejeon`, `busan-ulsan-gyeongnam`, `gwangju`
- admin permission resource/action: `admin-permissions.ts`의 상수와 DB row가 일치해야 한다.
- notification audience별 table 분리: member/admin/partner notification을 섞지 않는다.
- password/session/token 원문은 DB와 로그에 저장하지 않는다.
