# 04. 기능 인벤토리

작성 기준일: 2026-07-09

최종 교정일: 2026-07-17. 사용자 용어는 [화면 계약 용어 기준](../product/screen-specs/terminology.md)을 따르며, 유지·통합·제거 판정은 [기능 점수표](../product/screen-specs/feature-scoring.md)를 따른다.

## Public discovery

| 기능 | 현재 구현 | 주요 데이터/규칙 |
| --- | --- | --- |
| 홈 제휴 탐색 | `HomeContent`, `HomeView`, `PartnerFilters`, `PartnerCardView` | categories, partners, favorite count, review count, audience |
| 캠퍼스 페이지 | `/campuses/[campus]`, `campuses.ts` | 명시 campus slugs 우선, location fallback |
| 제휴 상세 | `/partners/[id]`, `_page/*` | visibility, benefit visibility, period, contacts, coupons, reviews |
| 프로모션 | `PromotionCarousel`, `promotions/events.ts` | authenticated/year/campus audience |
| 공유/연락 | `ShareLinkButton`, `ContactCopyRow`, detail contact section | map/reservation/inquiry/benefit action links |
| PWA 설치/스크롤 | `PwaProvider`, `PwaInstallButton`, `ScrollToTopFab`, manifest | standalone display, viewport fit |

## Authentication/member

| 기능 | 현재 구현 | 주요 데이터/규칙 |
| --- | --- | --- |
| 회원 로그인 | `/api/mm/login`, `LoginForm`, `user-auth.ts` | HMAC session, auth attempts, user-safe errors |
| 회원가입 | `/auth/signup`, `/api/mm/code/*`, `/api/mm/signup` | 기수별 Sender, MM ID, 코드 HMAC, members |
| Sender 운영 | `/admin/cycle`, `MattermostSenderManager` | AES-GCM credential registry, Super Admin 이중 권한, 테스트 DM |
| 비밀번호 재설정 | `/auth/reset`, `/api/mm/code/*`, `/api/mm/reset-password/complete` | direct DM code, reset session, auth security log |
| MM 장애 이메일 복구 | `/auth/recover-email`, `/api/member/recovery/*` | 기존 비밀번호, 15분 제한 세션, 이메일 코드 |
| 비밀번호 변경 | `/auth/change-password`, `/api/mm/change-password` | current/new password validation |
| 정책 동의 | `/auth/consent`, `/api/mm/consent`, `policy-documents.ts` | active required policy versions |
| 프로필 동기화 | `/api/mm/profile-sync`, cron member sync | 최신 Mattermost ID, 표시명/username/사진만 갱신 |
| 회원 탈퇴/삭제 | `/api/mm/delete` | session and member cleanup |
| 인증 카드 | `/certification`, `CertificationView`, `certification-qr.ts` | QR token, avatar route |

## Admin operations

| 기능 | 현재 구현 | 주요 데이터/규칙 |
| --- | --- | --- |
| 관리자 인증 | `auth.ts`, `admin-access.ts`, `/admin/session` | admin session, permission version |
| 관리자 권한 | `admin-permissions.ts`, `/admin/admins` | resource/action matrix, templates |
| 대시보드 | `/admin`, dashboard count RPC/helpers | admin dashboard counts |
| 회원 관리 | `/admin/members`, member actions, manual add | members, admin scope, security logs |
| 제휴처 관리 | `/admin/partners`, `/admin/partners/new`, partner actions | partners, media, branches |
| 제휴처 변경 요청 | `/admin/partner-requests`, change request actions | partner change requests, before/after diff |
| 제휴처 카테고리 | `/admin/categories`, category actions | categories, 연결 제휴처 수 |
| 회사/계정 관리 | `/admin/companies`, account actions, partner support helpers | partner_companies, accounts, setup links |
| 등록 신청 검토 | `/admin/partner-registrations` | registration requests/groups/branches |
| 리뷰 관리 | `/admin/reviews`, admin review manager | hidden/deleted/moderation actor |
| 로그 조회 | `/admin/logs`, log insight helpers | event_logs, admin_audit_logs, auth_security_logs |
| 발송 관리 | `/admin/push`, push manager | subscriptions, message logs, preview/broadcast |
| 내 알림 | `/admin/notifications` | admin notification preferences/deliveries |
| 이벤트 운영 | `/admin/event`, `/admin/event/[slug]` | promotion events, reward draws/winners |
| 광고/쿠폰 | `/admin/advertisement`, ad package manager | campaigns, coupons, redemptions |
| 기수 설정 | `/admin/cycle` | ssafy_cycle_settings, mattermost_sender_credentials |
| 홈 프로모션 구 URL | `/admin/promotions` -> `/admin/advertisement` | compat redirect |

## Partner portal

| 기능 | 현재 구현 | 주요 데이터/규칙 |
| --- | --- | --- |
| 파트너 로그인 | `/partner/login`, `partner-auth/*`, `partner-session.ts` | partner_accounts, account_companies |
| 초기 설정 | `/partner/setup/[token]`, `/api/partner/setup/[token]` | setup token hash, password setup |
| 계정/비밀번호 | `/partner/account`, `/partner/change-password`, reset route | partner account auth/security |
| 회사 dashboard | `/partner/companies/[companyId]`, portal scope helpers | allowed company ids |
| 제휴처 상세 | `/partner/companies/[companyId]/services/[partnerId]` | change request context, metrics |
| 변경 요청 | 제휴처 상세의 변경 영역, request actions | immediate/approval request, media |
| 신규 제휴처 신청 | `/partner/companies/[companyId]/services/new` | partner branch/service request |
| 플랜 관리 | `/partner/companies/[companyId]/plans` | plan upgrade, billing invoice/payment |
| 리뷰 moderation | partner review API | partner actor hide/restore |
| 내 알림/Push | `/partner/notifications`, partner push routes | partner notification preferences/subscriptions |
| 지원 요청 | `/partner/support` | support mail/template, optional company context |

## Reviews, favorites, coupons

| 기능 | 현재 구현 | 주요 데이터/규칙 |
| --- | --- | --- |
| 리뷰 목록/요약 | `PartnerReviewSection`, review repository | rating sort/filter, hidden/deleted exclusion |
| 리뷰 작성/수정 | review form, review API | rating/title/body/images validation |
| 리뷰 이미지 | review media crop/uploader, upload sign/cleanup API | signed upload, storage cleanup |
| 리뷰 reaction | reaction API, helper | member-level reaction |
| 즐겨찾기 | favorite repository/API/button | member-partner unique favorite |
| 쿠폰 조회/사용 | coupon wallet, coupon redeem API | global/member limit, campaign linkage |

## Notifications and analytics

| 기능 | 현재 구현 | 주요 데이터/규칙 |
| --- | --- | --- |
| 회원 알림함 | `NotificationInbox`, `/api/notifications` | unread, mark read, delete |
| 관리자 알림 | `AdminNotificationCenter`, admin APIs | operational notification preferences |
| 파트너 알림 | `PartnerNotificationCenter`, partner APIs | company/account recipient |
| Push 설정 | `PushSettingsCard`, push device helpers | browser capability, VAPID |
| Product event | `AnalyticsEventOnMount`, `TrackedAnchor`, `/api/events/product` | event_logs, metric rollups |
| Admin audit | admin mutation audit helpers | actor/target/action |
| Auth security | auth log helpers | status, identifier, sanitized properties |

## Public support and legal

| 기능 | 현재 구현 | 주요 데이터/규칙 |
| --- | --- | --- |
| 제휴 제안 | `/suggest`, `SuggestForm`, `/api/suggest` | rate limit, SMTP notify |
| 버그 신고 | `/support/bug-report`, support templates | mail/template actions |
| 약관 문서 | `/legal/[kind]`, `PolicyDocumentView` | policy kind/version/active document |
| RSS | `/rss.xml`, cron RSS refresh | feed helper |
| SEO | metadata, sitemap, robots, campus/partner SEO helpers | canonical, dynamic fail-soft |

## Loading/error surfaces

- Root loading/error: `src/app/loading.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`.
- Site loading: `(site)/loading.tsx` and route-specific loading under campus, certification, notifications, partners, suggest, support, verify.
- Admin loading: `admin/loading.tsx`, protected loading, companies/cycle/logs/members/partners/push/reviews loading.
- Partner loading: `partner/loading.tsx`, setup/reset/login/change-password/support/services loading.
- Shared skeletons: `src/components/loading/AdminPageSkeletons.tsx`, `RoutePageSkeletons.tsx`, `SitePageSkeletons.tsx`.
