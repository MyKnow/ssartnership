# 01. 현행 서비스 개요

작성 기준일: 2026-07-09

최종 교정일: 2026-07-17

## 서비스 목적

SSARTNERSHIP, 제품명 "싸트너십"은 SSAFY 구성원을 위한 제휴 혜택 플랫폼이다. 서울 캠퍼스와 역삼역 인근 제휴처 탐색에서 시작했지만, 현재 구현은 서울, 구미, 대전, 부울경, 광주 캠퍼스를 모두 다룰 수 있는 구조다.

핵심 목적은 다음과 같다.

- SSAFY 구성원이 제휴 혜택을 빠르게 탐색하고 이용할 수 있게 한다.
- SSAFY 구성원에게만 보여야 하는 혜택은 직접 Mattermost 연동과 로컬 회원 세션으로 보호한다.
- 관리자와 지역 운영자가 제휴처, 회원, 리뷰, 이벤트, 알림을 운영할 수 있게 한다.
- 파트너사가 파트너 포털에서 제휴처 정보, 변경 요청, 플랜, 알림, 지원 요청을 관리할 수 있게 한다.
- 빠른 MVP 출시와 낮은 운영 비용을 유지하면서 향후 Supabase/API 전환, UI 개선, 성능 개선이 가능하도록 한다.

## 사용자군

| 사용자군 | 현재 주요 목적 | 인증/권한 |
| --- | --- | --- |
| 비회원 방문자 | 공개 제휴 목록/상세, 캠퍼스 페이지, 이벤트, 약관, 제안/버그 신고 조회 | 없음 |
| SSAFY 회원 | 대외비 제휴 확인, 혜택 조건 조회, 리뷰/즐겨찾기/쿠폰/알림/인증 카드 이용 | `user_session` HMAC httpOnly 쿠키 |
| 관리자 | 회원/제휴/회사/리뷰/로그/알림/이벤트/기수/권한 운영 | `admin_session` HMAC httpOnly 쿠키, 권한 매트릭스 |
| 지역 제휴 관리자 | 배정 캠퍼스의 제휴처와 회사 운영 | 관리자 권한 + campus scope |
| 파트너 계정 | 파트너사/제휴처/변경 요청/리뷰/플랜/알림/지원 관리 | `partner_session` HMAC httpOnly 쿠키 |
| 시스템/cron | 회원 동기화, RSS, 알림, 프로모션 만료, 결제 배치 | `CRON_SECRET`, 서버 전용 환경 변수 |
| 외부 서비스 | Mattermost, Supabase, SMTP, Web Push, 공공데이터포털, Vercel | 서비스별 credential |

## 핵심 도메인

- 제휴 디렉터리: 카테고리, 캠퍼스, 공개 범위, 적용 대상, 혜택 노출 범위, 기간, 이미지, 지도/예약/문의 링크.
- 회원 인증: 기수별 Mattermost Sender DM 코드 가입/재설정, 로컬 비밀번호·이메일 로그인 복구, 정책 동의, 강제 비밀번호 변경, 인증 카드/QR.
- 관리자 운영: 대시보드, 회원, 회사, 제휴, 리뷰, 로그, 알림, Push, 이벤트, 광고, 기수, 관리자 권한.
- 파트너 포털: 로그인, 초기 설정, 파트너사 선택, 제휴처 상세, 변경 요청, 리뷰 관리, 플랜 업그레이드, 알림/지원.
- 리뷰/반응: 회원 리뷰 작성/수정/삭제, 이미지 업로드, reaction, 관리자/파트너 숨김/복구.
- 광고/쿠폰/프로모션: 광고 캠페인, 쿠폰 발급/사용, 홈 프로모션 슬라이드, 이벤트 리워드.
- 알림/Push: 회원, 관리자, 파트너 대상 notification, push subscription, delivery log, operational notification.
- 로그/메트릭: product analytics, admin audit, auth security, partner metric rollups, unique visitor.

## 현재 기술 스택

| 영역 | 구현 |
| --- | --- |
| Framework | Next.js `16.2.6`, App Router |
| Runtime/UI | React `19.2.3`, TypeScript `^5` |
| Styling | Tailwind CSS v4, custom CSS token, Pretendard webfont |
| Data | Supabase JS `^2.99.0`, Supabase PostgreSQL |
| Hosting/Analytics | Vercel, Vercel Analytics `^2.0.1`, Speed Insights `^2.0.0` |
| Auth primitives | HMAC signed httpOnly cookies, Mattermost DM code HMAC, AES-256-GCM sender credential, password hashes |
| Forms/validation | Zod `^4.4.3`, shared validation helpers |
| Charts | Recharts `^3.8.1` |
| Motion | Framer Motion `^12.38.0` |
| Icons | Heroicons, lucide-react, react-icons |
| Media | Next Image, Supabase Storage, image proxy/cache helpers, image crop components |
| Push | `web-push`, VAPID |
| Email | Nodemailer |
| QR | `qrcode` |
| Test/QA | Node test runner, Playwright, Storybook 10, Vitest Storybook project, Lighthouse script |

## 실행 모드

- 기본 개발 서버: `npm run dev` -> `next dev --webpack`
- production build: `npm run build`
- app start: `npm run start`
- mock data switch: `NEXT_PUBLIC_DATA_SOURCE=mock`
- partner portal mock override: `NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE=mock`
- Supabase 사용 조건: `SUPABASE_URL`과 anon 또는 service role key가 존재하고 data source가 mock이 아닐 때 repository가 Supabase 구현을 사용한다.

## 현재 구조상 중요한 사실

- public site는 `src/app/(site)/layout.tsx`에서 세션을 확인하고 약관 동의 또는 비밀번호 변경이 필요하면 리다이렉트한다.
- admin protected page는 `src/app/admin/(protected)/layout.tsx`에서 `requireAdminPageAccess`를 통과해야 렌더된다.
- partner portal layout은 `getPartnerSession()`과 회사 summary를 서버에서 가져와 `PartnerPortalShellView`에 주입한다.
- repository pattern은 public partner, notification, favorite, review, ad package에 적용되어 있고 mock/Supabase 구현을 같은 인터페이스 뒤에 둔다.
- 일부 파트너 포털 초기 설정 repository는 현재 façade가 남아 있으며, 실제 범위/권한/대시보드 데이터는 별도 helper와 Supabase query로 처리된다.
- 모든 주요 Supabase 테이블은 RLS가 켜져 있으나, 앱 서버는 service role admin client를 통해 서버 경계에서 필요한 데이터 접근을 수행한다.
- SEO surface는 metadata, canonical, sitemap, robots, RSS, JSON-LD를 포함한다.
