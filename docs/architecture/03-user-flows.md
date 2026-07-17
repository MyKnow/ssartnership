# 03. 사용자 흐름

작성 기준일: 2026-07-09

최종 교정일: 2026-07-17

## 제휴 탐색 흐름

1. 방문자가 `/`에 진입한다.
2. root layout은 theme/toast/PWA/analytics provider를 준비한다.
3. `(site)` layout은 회원 세션을 확인하고 필수 약관/강제 비밀번호 변경 상태를 먼저 처리한다.
4. 홈은 header session, 회원 year/campus, 프로모션 슬라이드를 서버에서 조회한다.
5. `HomeContent`는 category/partner repository를 통해 제휴 목록을 렌더한다.
6. 사용자는 캠퍼스, 카테고리, 검색, 정렬, audience 기준으로 제휴를 탐색한다.
7. 제휴 카드 클릭 시 `/partners/[id]`로 이동한다.
8. 상세 페이지는 공개 범위와 기간을 확인한다.
9. 공개 제휴는 누구나 상세를 볼 수 있고, 대외비 제휴는 회원 로그인이 필요하며, 비공개 제휴는 상세 접근이 차단된다.
10. 혜택 노출 범위가 `eligible_only`이면 비로그인 또는 적용 대상이 아닌 회원에게 혜택/조건/예약 링크를 마스킹한다.

## 캠퍼스별 탐색 흐름

1. 사용자가 `/campuses/[campus]`에 진입한다.
2. campus slug는 `seoul`, `gumi`, `daejeon`, `busan-ulsan-gyeongnam`, `gwangju` 중 하나여야 한다.
3. 캠퍼스는 partner의 명시적 `campusSlugs`를 우선 사용하고, 없으면 location 패턴으로 추론한다.
4. 캠퍼스 페이지는 해당 캠퍼스와 일치하는 제휴만 보여준다.
5. SEO sitemap은 캠퍼스 페이지를 weekly changefreq로 포함한다.

## 회원 가입과 직접 Mattermost 흐름

1. 사용자가 `/auth/signup`에서 가입을 시작한다.
2. 대상 기수의 active Sender가 direct Mattermost DM으로 6자리 코드를 보낸다.
3. 서버는 team `s{generation}public`과 `town-square` membership 및 최신 MM ID를 확인한다.
4. 코드 hash만 10분 보관하고 1회 소비·5회 검증·재전송 제한을 적용한다.
5. 가입 가능 대상은 현재 cycle 및 운영진 기준을 따른다.
6. `members`와 `mm_user_directory` 연결을 저장하되 campus/track 같은 외부 claim은 새로 채우지 않는다.
7. 필수 정책 동의가 필요한 경우 `member_policy_consents`를 갱신한다.
8. `user_session` HMAC httpOnly 쿠키를 발급하고 `/auth/signup/complete` 또는 returnTo로 이동한다.

## 회원 로그인과 정책/비밀번호 강제 흐름

1. 사용자가 `/auth/login`에서 Mattermost username/password로 로그인한다.
2. 서버 route는 request body를 검증하고 throttle/auth security log를 적용한다.
3. 비밀번호 검증 성공 시 `user_session`을 발급한다.
4. 회원 row의 `must_change_password`가 true이면 `(site)` layout에서 `/auth/change-password`로 보낸다.
5. 필수 정책 버전이 session snapshot보다 새롭거나 동의가 부족하면 `/auth/consent`로 보낸다.
6. 동의/비밀번호 변경 완료 후 원래 returnTo로 돌아간다.

## 비밀번호 재설정 흐름

회원:

1. `/auth/reset`에서 대상 기수 Sender의 Mattermost DM 코드를 요청한다.
2. `/api/mm/code/issue`, `/api/mm/code/verify`가 코드를 검증하고 reset completion cookie를 발급한다.
3. `/api/mm/reset-password/complete`가 새 비밀번호를 저장한다.
4. MM이 일시적으로 불가하고 기존 비밀번호를 알면 `/auth/recover-email`의 15분 제한 세션에서 이메일 로그인을 연결한다.
5. 기존 비밀번호도 모르면 기존 회원 복구 수료증 신청을 통해 관리자 명시 선택 후 초기 설정 메일을 받는다.

파트너:

1. `/partner/reset`에서 login id/email 기반 재설정을 요청한다.
2. `/api/partner/reset-password`가 계정을 찾고 임시 비밀번호/메일 발송을 처리한다.
3. `partner_session` 발급 후 `mustChangePassword`가 있으면 `/partner/change-password`로 이동한다.

## 인증 카드와 QR 검증 흐름

1. 로그인 회원이 `/certification`에 접근한다.
2. 서버는 회원 세션과 프로필을 조회하고 인증 카드 UI를 렌더한다.
3. QR은 `CERTIFICATION_QR_SECRET` 기반 token을 사용한다.
4. 외부 검증자는 `/verify/[token]`에 접근한다.
5. 검증 페이지는 token 유효성, 만료, 회원 상태를 확인하고 성공/실패 화면을 보여준다.
6. avatar 이미지는 `/api/certification/avatar/[token]` 또는 `/api/mm/avatar` 경로에서 안전하게 제공된다.

## 리뷰/즐겨찾기/쿠폰 흐름

1. 회원이 제휴 상세에서 리뷰 목록을 본다.
2. `/api/partners/[id]/reviews`는 리뷰 목록 조회와 생성 요청을 처리한다.
3. 이미지 업로드는 sign route와 cleanup route를 통해 review media storage와 연결된다.
4. 리뷰 수정/삭제는 `/api/partners/[id]/reviews/[reviewId]`에서 처리한다.
5. reaction은 `/api/partners/[id]/reviews/[reviewId]/reaction`에서 처리한다.
6. 즐겨찾기는 `/api/partners/[id]/favorite`로 토글한다.
7. 쿠폰은 `/coupons`와 `/api/coupons/[couponId]/redeem`을 통해 회원 사용 한도와 전체 사용 한도를 확인한다.

## 파트너사·제휴처 등록 신청 흐름

1. 외부 파트너사가 `/partner-registration`에서 신청서를 작성한다.
2. 프론트엔드 검증과 서버 action 검증이 같은 규칙 계열을 따른다.
3. 템플릿 다운로드 route는 본점/지점 등록용 Excel 양식을 제공한다.
4. 신청 데이터는 `partner_registration_requests`, benefit groups, branches에 저장된다.
5. 관리자는 `/admin/partner-registrations`에서 신청을 검토하고 회사/계정/제휴로 전환한다.
6. 필요한 경우 초기 설정 링크와 이메일을 발급한다.

## 파트너 포털 흐름

1. 파트너 담당자는 `/partner/setup/[token]`에서 초기 설정을 완료하거나 `/partner/login`으로 로그인한다.
2. 로그인 성공 시 `partner_session`에 account id, login id, display name, company ids, mustChangePassword가 저장된다.
3. layout은 session의 company ids로 회사 summary를 조회한다.
4. 회사가 여러 개면 회사 선택 view를 거친다.
5. 파트너사 dashboard는 제휴처 목록, metric, 알림, 플랜, 지원 entry point를 제공한다.
6. 제휴처 상세에서 파트너 담당자는 공개 정보, 메트릭, 리뷰, pending request를 확인한다.
7. 변경 요청은 immediate change와 approval required change로 나뉘며, pending request가 있으면 중복 제출을 제한한다.
8. 리뷰 숨김/복구 같은 moderation은 partner actor로 audit/security log를 남긴다.

## 관리자 운영 흐름

1. 관리자는 `/auth/login` 또는 `/admin/login` 경로에서 인증한다.
2. `admin_session`은 admin id, login id, permission version을 담는다.
3. `requireAdminPageAccess`와 `requireAdminPermission`이 page/API/server action 경계에서 접근을 검사한다.
4. 권한 resource는 members, reviews, logs, brands, companies, notifications, home_ads, events, cycles, admin_management로 구분된다.
5. 관리자는 제휴 CRUD, 카테고리 CRUD, 회사/계정/초기설정 링크, 회원 수동 추가, 기수 설정, 리뷰 moderation, Push 발송, 이벤트 리워드, 로그 조회를 수행한다.
6. 관리자 작업은 admin audit log 또는 auth security log에 남긴다.
7. 로그 조회 화면은 product/admin/auth 로그를 filter/export할 수 있게 설계되어 있다.

## 알림과 Push 흐름

1. 회원/관리자/파트너는 각 알림 preference와 push subscription을 등록한다.
2. 일반 회원 route는 `/api/notifications`, 관리자 route는 `/api/admin/notifications`, 파트너 route는 `/api/partner/notifications`를 사용한다.
3. Push 구독은 audience별로 `/api/push/*`, `/api/admin/push/*`, `/api/partner/push/*`에 나뉜다.
4. 관리자 수동 발송은 `/api/push/admin/broadcast`와 preview route를 거친다.
5. cron route는 종료 예정 제휴, 회원 sync, RSS, billing, expired promotion archive를 처리한다.
6. 발송 실패는 본 기능 실패로 확산하지 않는 방향으로 요약 로그와 delivery log에 남긴다.
