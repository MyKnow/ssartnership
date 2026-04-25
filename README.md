# SSARTNERSHIP

SSARTNERSHIP는 SSAFY 구성원을 위한 제휴 혜택 플랫폼입니다.  
서울 지역 제휴 업체 정보를 빠르게 확인하고, Mattermost 기반 인증으로 교육생/운영진 신원을 확인할 수 있습니다.

핵심 목표는 다음 두 가지입니다.

- 제휴 정보를 공개 페이지에서 빠르게 탐색할 수 있게 하기
- SSAFY 구성원만 접근해야 하는 기능은 Mattermost 인증과 관리자 도구로 안전하게 운영하기

## 핵심 기능

### 공개 사용자 기능

- 카테고리별 제휴 업체 조회
- 검색 및 정렬
  - 현재 제휴 우선
  - 등록순
  - 종료일 임박순
- 제휴 업체 상세 페이지
  - 혜택
  - 이용 조건
  - 태그
  - 이미지 캐러셀
  - 지도 / 예약 / 문의 정보
  - 공유 링크 복사
- 공개 / 대외비 / 비공개 제휴 상태 지원
- 제휴 기간 외 상세 조회 허용, 예약/문의 링크 비노출
- 반응형 UI, 다크 모드, PWA 설치 지원
- RSS, sitemap, robots, SEO 메타데이터 제공

### 회원 기능

- Mattermost 기반 회원가입 / 로그인
- 가입 대상
  - 14기 교육생
  - 15기 교육생
  - 운영진
- Mattermost DM 인증코드 발송
- 임시 비밀번호 재설정
- 비밀번호 강제 변경 플로우
- 약관 / 개인정보 수집·이용 동의 버전 관리
- 교육생 / 운영진 인증 카드
- 공개 QR 검증 페이지
- Web Push 구독 및 알림 설정

### 관리자 기능

- 관리자 로그인
- 카테고리 CRUD
- 제휴 업체 CRUD
- 기수 관리
  - 기준 기수 / 기준 연도 / 기준 월 수정
  - 조기 시작
  - 자동 계산 복구
  - 현재 학생 / 수료생 / 운영진 범위 확인
- 회원 조회 / 수정 / 삭제
- 회원 수동 추가
  - 기수 선택
  - MM ID 리스트 입력
  - 임시 비밀번호 발송
  - 강제 비밀번호 변경 상태 저장
- 회원 백필 실행
- 로그 조회 및 상세 확인
- Mock 미리보기
- 공지 Push 발송
- 신규 제휴 / 종료 예정 제휴 자동 알림

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
    (site)/                공개 사용자 화면
    admin/                 관리자 화면
    api/                   인증, 제휴, 로그, cron, 알림 API
    auth/                  로그인, 회원가입, 약관 동의, 비밀번호 변경
    legal/                 공개 약관 / 개인정보 문서
  components/
    admin/                 관리자 전용 컴포넌트
    analytics/             분석 이벤트 컴포넌트
    auth/                  인증 / 약관 동의 UI
    certification/         인증 카드 및 QR
    legal/                 정책 문서 렌더링
    ui/                    공용 UI 컴포넌트
  lib/
    repositories/          Repository 패턴
    mattermost.ts          Mattermost 연동
    mm-directory.ts        MM 유저 디렉토리 조회 / 동기화
    mm-member-sync.ts      회원 프로필 동기화
    member-manual-add.ts   관리자 수동 회원 추가
    policy-documents.ts    약관 버전 / 동의 상태 계산
    user-auth.ts           사용자 세션
    auth.ts                관리자 세션

supabase/
  schema.sql              기준 스키마
  migrations/             기준 migration

tests/
  mm-profile-csv.test.mts Mattermost 닉네임 파서 테스트
  ssafy-cycle-simulation.test.mts 기수 / 수료생 시뮬레이션 테스트

docs/
  performance/            성능 측정 문서
  security/               보안 정리 문서
```

## 로컬 실행

```bash
npm install
npm run dev
```

개발 서버:

```text
http://localhost:3000
```

## CI 사전 점검

GitHub Actions와 동일한 Linux/amd64 lockfile 해석 차이로 `npm ci`가 깨질 수 있습니다. 특히 macOS에서 의존성을 갱신했으면 아래 순서로 먼저 확인합니다.

```bash
npm run check:lockfile
npm run ci:local
```

- `check:lockfile`: Docker 기반 Linux/amd64 기준 lockfile canonical 여부 확인
- `ci:local`: `npm ci`, lint, build, Storybook test까지 한 번에 검증

`check:lockfile`은 Docker Desktop이 실행 중이어야 합니다.

## 환경 변수

`.env.example`를 기준으로 `.env`를 구성합니다.

주요 그룹은 다음과 같습니다.

- 관리자 인증
  - `ADMIN_ID`
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_SECRET`
  - `ADMIN_ALLOWED_IPS` (선택)
  - `ADMIN_BASIC_AUTH_USERNAME` / `ADMIN_BASIC_AUTH_PASSWORD` (선택)
- Supabase
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Mattermost
  - `MM_BASE_URL`
  - `MM_STUDENT_CHANNEL`
  - `MM_SENDER_LOGIN_ID_14`
  - `MM_SENDER_PASSWORD_14`
  - `MM_TEAM_NAME_14`
  - `MM_STUDENT_CHANNEL_14`
  - `MM_SENDER_LOGIN_ID_15`
  - `MM_SENDER_PASSWORD_15`
  - `MM_TEAM_NAME_15`
  - `MM_STUDENT_CHANNEL_15`
- 사용자 세션 / QR
  - `USER_SESSION_SECRET`
  - `CERTIFICATION_QR_SECRET`
- 제휴 제안 메일
  - `NAVER_SMTP_USER`
  - `NAVER_SMTP_PASS`
  - `SUGGEST_NOTIFY_EMAIL`
- Web Push / Cron
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`
  - `CRON_SECRET`
- 사이트 URL / SEO
  - `NEXT_PUBLIC_SITE_URL`
- 목업 스위치
  - `NEXT_PUBLIC_DATA_SOURCE=mock` (선택)

환경 변수 예시는 [.env.example](/Users/myknow/coding/ssartnership/.env.example)에 있습니다.

## Supabase 설정

- 스키마 변경은 항상 `supabase/migrations`에 먼저 기록합니다.
- `main`으로 merge하기 전에 migration이 누락되지 않았는지 확인합니다.
- `main`을 제외한 브랜치 push 시 GitHub Actions가 production 데이터를 preview로 미러링한 뒤 migration을 적용합니다.
- Lighthouse 성능 체크는 release 스크립트에서만 실행합니다.
- 이 워크플로를 위해 GitHub Secrets에 다음 값을 넣습니다.
  - `SUPABASE_PRODUCTION_DB_URL`
  - `SUPABASE_PRODUCTION_URL`
  - `SUPABASE_PRODUCTION_SERVICE_ROLE_KEY`
  - `SUPABASE_PREVIEW_DB_URL`
  - `SUPABASE_PREVIEW_URL`
- `SUPABASE_PREVIEW_SERVICE_ROLE_KEY`
- `SUPABASE_PREVIEW_ANON_KEY`
- `*_DB_URL` 값은 Supabase 대시보드에서 복사한 percent-encoded PostgreSQL 연결 문자열을 사용합니다.
- 로컬 또는 CI에서 동일한 동기화 로직을 재사용하려면 `npm run sync:preview`를 실행합니다.

`schema.sql`에는 현재 기준 테이블, 정책 문서 v1, MM 유저 디렉토리, Push 관련 스키마, 제휴 업체 `이용 조건` 스키마가 포함되어 있습니다.

주의:

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용입니다.
- `members`, `mm_verification_codes`, `member_policy_consents`, `mm_user_directory`, `push_*` 테이블은 서비스 롤 기준으로만 다룹니다.

## 회원 / 인증 모델

### 식별 기준

- 최종 식별자는 `mm_user_id`입니다.
- `mm_username`은 변경 가능한 스냅샷 값으로만 취급합니다.
- 회원가입 이후 주요 API는 `mm_user_id` 기준으로 동작합니다.

### 기수 체계

- `14`: 14기 교육생
- `15`: 15기 교육생
- `0`: 운영진
- 1월은 1학기 시작, 7월은 2학기 시작입니다.
- 현재 기수는 `ssafy_cycle_settings`의 앵커 기준과 날짜를 함께 사용해 계산합니다.
- `staff`, `student`, `graduate`는 저장값이 아니라 현재 날짜와 기수 기준으로 파생됩니다.
- 2027년 7월 기준 예시
  - `18기`: 1학기 교육생
  - `17기`: 2학기 교육생
  - `16기 이하`: 수료생

운영진은 `members.staff_source_year`에 어느 기수 팀에서 확인된 계정인지 함께 저장합니다.

기수 기준을 조정하거나 조기 시작을 적용하려면 관리자 화면의 `기수 관리`를 사용합니다.

### Mattermost 유저 디렉토리

- `mm_user_directory` 테이블에 유저 스냅샷을 저장합니다.
- 보관 값
  - `mm_user_id`
  - `mm_username`
  - `display_name`
  - `campus`
  - `is_staff`
  - `source_years`
  - `synced_at`
- 회원가입 / 로그인 / 재설정은 이 디렉토리를 먼저 조회하고, 없으면 Mattermost live API로 fallback 합니다.

### 닉네임 파싱

- 반 / 팀코드는 더 이상 저장하지 않습니다.
- 중요 값은 다음만 유지합니다.
  - 이름
  - 캠퍼스
  - 운영진 여부
- 운영진 추정 역할명, 창업 캠퍼스, 14기/15기 다양한 닉네임 패턴을 지원합니다.

## Mattermost 인증 플로우

### 회원가입

1. 사용자가 기수 또는 운영진을 선택합니다.
2. 입력한 MM ID(username)를 `mm_user_directory`에서 먼저 찾습니다.
3. 못 찾으면 선택한 조건으로 Mattermost API fallback 조회를 수행합니다.
   - 14기: 14기 교육생만
   - 15기: 15기 교육생만
   - 운영진: 14기 / 15기 전체 중 운영진만
4. 대상이 확인되면 운영용 계정이 DM으로 인증코드를 발송합니다.
5. 사용자가 인증코드를 입력하면 회원가입을 완료합니다.
6. 가입 시 최신 이용약관 / 개인정보 동의 버전도 함께 저장합니다.
7. 기수별 허용 범위는 관리자 `기수 관리` 설정을 따른 뒤, 그 기준으로 signup / backfill / 디렉토리 조회가 동작합니다.

시뮬레이션 검증은 다음 명령으로 실행할 수 있습니다.

```bash
npm run test:ssafy-cycle
```

### 로그인

1. `mm_username`으로 디렉토리 조회
2. 필요 시 live fallback
3. DB에서 `mm_user_id`로 회원 조회
4. 비밀번호 검증
5. 최신 약관 미동의 시 `/auth/consent`로 리다이렉트

### 비밀번호 재설정

- 가입된 회원만 가능
- 운영진은 `staff_source_year`를 기준으로 적절한 팀 / 발신 계정을 선택합니다.

주의:

- 운영용 MM 계정은 대상 팀의 `view_team` 권한과 대상 채널의 `read_channel` 권한이 있어야 합니다.
- private / invite-only 팀이거나 운영 계정이 팀 멤버가 아니면 팀 조회 단계에서 403이 날 수 있습니다.
- 14기 / 15기 발신 계정은 분리하는 편이 안전합니다.

## 약관 / 개인정보 동의

- 필수 동의
  - 서비스 이용약관
  - 개인정보 수집·이용 동의
- 마케팅 / 수신 동의는 회원가입 단계에서 받지 않고, 별도 알림 설정 단계에서 처리합니다.
- 정책 문서는 `policy_documents`에서 버전 관리합니다.
- 회원 동의 이력은 `member_policy_consents`에 저장합니다.
- 회원의 동의 버전이 없거나 오래되면 로그인 이후 동의 화면으로 보냅니다.

공개 문서:

- [/legal/service](/Users/myknow/coding/ssartnership/src/app/legal/[kind]/page.tsx)
- [/legal/privacy](/Users/myknow/coding/ssartnership/src/app/legal/[kind]/page.tsx)

## 관리자 운영 포인트

- 회원 관리는 기수 / 캠퍼스 중심입니다.
- 반 단위 관리 / 반 단위 Push는 제거되었습니다.
- 관리자 페이지에서 다음 작업을 할 수 있습니다.
  - 회원 수동 추가
  - 백필 실행
  - 로그 상세 조회
  - 제휴 공개 상태 수정
  - Push 발송
  - Mock 미리보기

회원 수동 추가는 다음 흐름으로 동작합니다.

1. 기수 선택
2. MM ID 리스트 입력
3. 대상 사용자 조회
4. 임시 비밀번호 발송
5. `must_change_password=true` 저장
6. 성공 / 실패 수 요약 표시

DM 발송 실패 시에는 비밀번호 / 생성 상태를 롤백합니다.

## 제휴 상태와 노출 정책

- `공개`
  - 누구나 카드 / 상세 조회 가능
- `대외비`
  - 로그인하지 않은 사용자는 강한 블러, 클릭 차단, 상세 직접 접근 시 홈 리다이렉트
  - 로그인한 인증 회원은 일반 공개 카드처럼 조회 가능
- `비공개`
  - 모든 사용자에게 블러
  - 상세 직접 접근 차단

또한 제휴 기간이 아니면:

- 상세 페이지 조회는 가능
- 지도는 조회 가능
- 예약 / 문의 링크는 UI와 서버 payload 모두에서 숨김

## 성능 / 캐시 / Cron

- 공개 제휴 목록은 캐시를 사용합니다.
- 관리자 변경 후 관련 캐시를 무효화합니다.
- MM 유저 디렉토리는 Vercel cron으로 하루 1회 동기화합니다.
- 제휴 종료 예정 알림도 하루 1회 실행합니다.

[vercel.json](/Users/myknow/coding/ssartnership/vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/push-expiring-partners",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/member-sync",
      "schedule": "0 0 * * *"
    }
  ]
}
```

## 주요 보안 포인트

- 관리자 세션과 사용자 세션은 서명 + 만료 시각을 사용합니다.
- 관리자 로그인은 입력 검증, suspicious parameter 탐지, IP/계정 기준 rate limit을 적용합니다.
- 관리자 경로는 필요 시 IP allowlist 또는 Basic Auth로 한 번 더 제한할 수 있습니다.
- 인증코드 / 비밀번호 재설정 요청은 횟수 제한이 적용됩니다.
- 교육생 인증 QR은 짧은 만료시간의 서명 토큰으로 발급됩니다.
- 이미지 프록시는 내부망 / 사설 IP / 비정상 프로토콜을 차단합니다.
- 외부 링크는 `noopener noreferrer`를 강제합니다.
- Web Push 구독 정보는 서버 전용 테이블에 저장하고 실패한 endpoint는 비활성화합니다.

## 스크립트

```bash
npm run dev
npm run lint
npm run build
npm run storybook
npm run build-storybook
npm run test-storybook
npm run start
npm run test:mm-profile
npm run release -- patch
```

### Storybook

공용 UI primitives와 실제 도메인 컴포넌트를 함께 검증할 수 있도록 Storybook을 구성했습니다.

```bash
npm run storybook
```

- 기본 포트는 `6006`
- light/dark toolbar 지원
- Tailwind v4 글로벌 스타일과 App Router 문맥을 함께 로드
- 현재 포함 스토리: `Button`, `Badge`, `Card`, `Input`, `Select`, `Tabs`, `PartnerReviewCard`

정적 산출물이 필요하면 아래를 사용합니다.

```bash
npm run build-storybook
```

스토리 기반 컴포넌트 테스트는 아래로 실행합니다.

```bash
npm run test-storybook
```

### release 스크립트

`release` 스크립트는 다음을 수행합니다.

- `main` 외 브랜치: `npm version` 실행 후 commit + push
- `main` 브랜치: 현재 `package.json` 버전 기준 annotated tag 생성 후 push

한 줄 메시지:

```bash
npm run release -- patch "feat: 운영진 지원과 MM 닉네임 파싱 확장"
```

여러 줄 메시지:

```bash
npm run release -- patch <<'EOF'
feat: 운영진 지원과 MM 닉네임 파싱 확장

- 운영진 year=0 지원
- MM 닉네임 파싱 보강
EOF
```

구현은 [scripts/release.sh](/Users/myknow/coding/ssartnership/scripts/release.sh)에 있습니다.

주의:

- `main` 브랜치에서는 태그와 푸시만 수행하므로 작업 트리가 깨끗해야 합니다.
- `main` 외 브랜치에서는 태그를 만들지 않습니다.
- 작업 트리가 비어 있어도 `patch`, `minor`, `major`를 선택하면 버전 업데이트로 릴리즈할 수 있습니다.
- 작업 트리가 비어 있는 상태에서 `no update`를 선택하면 종료됩니다.

## 배포

Vercel 배포를 기준으로 구성되어 있습니다.

1. GitHub 저장소 연결
2. Vercel 프로젝트 생성
3. `.env` 값을 Vercel Environment Variables에 등록
4. Supabase migration / schema 적용
5. 배포 후 `NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 갱신

권장:

- `ADMIN_SESSION_SECRET`, `USER_SESSION_SECRET`, `CERTIFICATION_QR_SECRET`, `CRON_SECRET`는 충분히 긴 난수 사용
- `SUPABASE_SERVICE_ROLE_KEY`, `MM_SENDER_PASSWORD_*`, SMTP 계정, VAPID private key는 절대 클라이언트에 노출되지 않도록 관리
- 운영 환경에서는 `ADMIN_ALLOWED_IPS` 또는 Basic Auth 중 최소 하나를 같이 두는 편이 안전

## 현재 상태

- `npm run lint` 통과
- `npm run test:mm-profile` 통과
- 회원가입 / 로그인 / 재설정 / 약관 동의 / 운영진 가입 흐름은 `mm_user_id` 중심으로 정리되어 있습니다.
- 공개 제휴 페이지는 SEO, sitemap, RSS, robots를 포함합니다.

## 라이선스

CC BY-NC 4.0  
비상업적 목적에 한해 사용 가능합니다.
