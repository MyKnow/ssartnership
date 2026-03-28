# SSARTNERSHIP

SSAFY 서울 캠퍼스 교육생을 위한 제휴 혜택 플랫폼입니다.  
카테고리별 제휴 업체를 조회하고, 상세 페이지에서 혜택, 이용 조건, 예약/문의 링크, 이미지까지 확인할 수 있습니다.  
운영진은 Admin 페이지에서 카테고리와 제휴 업체를 관리하고, 교육생은 Mattermost 기반 인증으로 로그인 및 교육생 인증 카드를 사용할 수 있습니다.

## 핵심 기능

- 카테고리별 제휴 업체 조회
- 검색 및 정렬
  - 현재 제휴 우선
  - 등록순
  - 종료일 마감순
- 파트너 상세 페이지
  - 혜택
  - 이용 조건
  - 태그
  - 이미지 캐러셀
  - 예약/문의 링크
  - 공유 링크 복사
- 제휴 기간 외 카드 비활성화 오버레이
- 반응형 UI 및 다크 모드
- 제휴 제안 폼
  - 이메일 발송
  - 제출 확인 모달
  - 홈 리다이렉트 + 토스트
- Admin 기능
  - 로그인
  - 관리 홈 분기
  - 카테고리 CRUD
  - 제휴 업체 CRUD
  - 회원 조회/수정/삭제
  - 이미지 URL 추가/정렬/삭제
- 교육생 인증 기능
  - MM 아이디 기반 회원가입/로그인
  - Mattermost DM 인증코드 발송
  - 임시 비밀번호 재발급
  - 비밀번호 변경 강제 플로우
  - 교육생 인증 카드 표시
  - 공개 QR 검증 페이지
- PWA / 알림 기능
  - 홈 화면 설치 지원
  - 로그인 회원 대상 Web Push 구독 설정
  - 전체 공지 수동 발송
  - 신규 제휴 등록 시 자동 알림
  - 제휴 종료 7일 전 자동 알림

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase
- Mattermost API
- Vercel Analytics / Speed Insights
- Nodemailer
- Web Push (VAPID)

## 프로젝트 구조

```text
src/
  app/
    (site)/                사용자 화면
    admin/                 관리자 화면
    api/                   인증, 제안, 이미지 프록시 API
    auth/                  로그인/회원가입/비밀번호 변경
  components/
    admin/                 관리자 전용 컴포넌트
    auth/                  인증 관련 컴포넌트
    certification/         교육생 인증 카드
    ui/                    공용 UI 컴포넌트
  lib/
    repositories/          Repository 패턴
    mattermost.ts          MM 연동
    user-auth.ts           사용자 세션
    auth.ts                관리자 세션
    validation.ts          공통 검증 유틸

supabase/
  schema.sql              기본 스키마

docs/
  maintenance-audit.md    유지보수/리팩터링 로그
```

## 로컬 실행

```bash
npm install
npm run dev
```

기본 개발 서버:

```bash
http://localhost:3000
```

## 환경 변수

`.env.example`을 기준으로 `.env`를 구성합니다.

```env
# Admin credentials
ADMIN_ID=admin
ADMIN_PASSWORD=change-me
ADMIN_SESSION_SECRET=replace-with-long-random-string

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Data source
# NEXT_PUBLIC_DATA_SOURCE=mock

# Suggest mail
NAVER_SMTP_USER=your-naver-id@naver.com
NAVER_SMTP_PASS=your-naver-smtp-password
SUGGEST_NOTIFY_EMAIL=your-naver-id@naver.com

# Mattermost
MM_BASE_URL=https://meeting.ssafy.com
MM_SENDER_LOGIN_ID=myknow
MM_SENDER_PASSWORD=change-me
MM_TEAM_NAME=s15public
MM_STUDENT_CHANNEL=off-topic

# User session
USER_SESSION_SECRET=replace-with-long-random-string
CERTIFICATION_QR_SECRET=replace-with-long-random-string

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=replace-with-vapid-public-key
VAPID_PRIVATE_KEY=replace-with-vapid-private-key
VAPID_SUBJECT=mailto:myknow00@naver.com
CRON_SECRET=replace-with-long-random-string

# Site URL
NEXT_PUBLIC_SITE_URL=https://ssartnership.myknow.xyz
```

## Supabase 설정

1. Supabase 프로젝트 생성
2. SQL Editor에서 [supabase/schema.sql](/Users/myknow/coding/ssartnership/supabase/schema.sql) 실행
3. 이미 운영 중인 DB라면 [supabase/migrations/20260328_push_notifications_mvp1.sql](/Users/myknow/coding/ssartnership/supabase/migrations/20260328_push_notifications_mvp1.sql)도 추가 적용
4. 서비스 롤 키와 URL을 `.env` 또는 Vercel 환경 변수에 등록

주의:

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용입니다.
- `members`, `mm_verification_codes`, `password_reset_attempts` 등 민감 테이블은 서비스 롤로만 접근합니다.

## Mattermost 인증 플로우

1. 사용자가 MM 아이디와 사이트 비밀번호를 입력합니다.
2. 서버가 Mattermost에서 해당 사용자가 교육생 채널에 속하는지 확인합니다.
3. 운영용 MM 계정이 해당 사용자에게 DM으로 인증코드를 보냅니다.
4. 사용자가 인증코드를 입력하면 회원가입이 완료됩니다.
5. 이후 로그인은 `MM 아이디 + 사이트 비밀번호` 조합으로 동작합니다.

## 주요 보안 포인트

- 관리자 세션과 사용자 세션은 HMAC 서명 + 만료 시각을 사용합니다.
- 관리자 로그인 시도는 rate limit 테이블로 제한합니다.
- 인증코드와 비밀번호 재설정 요청도 횟수 제한이 적용됩니다.
- 교육생 인증 QR은 짧은 만료시간의 서명 토큰으로 발급됩니다.
- Web Push 구독 정보는 서버 전용 테이블에 저장하고, 실패한 endpoint는 자동 비활성화합니다.
- Vercel cron이 종료 7일 전 알림을 하루 1회 실행합니다.
- 이미지 프록시는 내부망/사설 IP/비정상 프로토콜을 차단합니다.
- 관리자 액션은 카테고리 키, 색상값, 링크, 제휴 기간을 서버에서 다시 검증합니다.
- 외부 새 탭 링크는 `noopener noreferrer`를 강제합니다.
- 파트너 URL은 저장 전 정규화 및 필터링됩니다.

## 스크립트

```bash
npm run dev
npm run lint
npm run build
npm run start
npm run release -- patch
```

`release` 스크립트는 다음을 수행합니다.

- 워킹 트리 clean 상태 확인
- `npm version` 실행
- commit + tag 생성
- `git push`
- `git push --tags`

구현은 [scripts/release.sh](/Users/myknow/coding/ssartnership/scripts/release.sh)에 있습니다.

## 배포

Vercel 배포를 기준으로 구성되어 있습니다.

1. GitHub 저장소 연결
2. Vercel 프로젝트 생성
3. `.env` 값을 Vercel Environment Variables에 동일하게 등록
4. 배포 후 `NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 갱신

권장:

- Production 환경에서 `ADMIN_SESSION_SECRET`, `USER_SESSION_SECRET`는 최소 32자 이상 난수 사용
- `ADMIN_ID`, `ADMIN_PASSWORD`, `MM_SENDER_PASSWORD`, SMTP 계정 정보는 절대 클라이언트에 노출되지 않도록 관리

## 현재 상태

- `npm run lint` 통과
- `npx tsc --noEmit` 통과
- 내부 버튼 링크는 공통 `Button` 컴포넌트에서 클라이언트 라우팅을 사용합니다.
- 교육생 인증 카드는 공개 QR 검증 흐름과 Web Push 설정을 포함합니다.
- 관리자 데이터 수정은 상세 페이지 캐시까지 함께 무효화합니다.
- 신규 제휴 등록 시 자동 Web Push 알림을 발송합니다.

## 라이선스

CC BY-NC 4.0  
비상업적 목적에 한해 사용 가능합니다.
