# SSARTNERSHIP

SSARTNERSHIP는 SSAFY 구성원을 위한 제휴 혜택 플랫폼입니다.  
서울 지역 제휴 업체 정보를 빠르게 확인하고, Mattermost 직접 연동으로 교육생/운영진 신원을 확인할 수 있습니다.

핵심 목표는 다음 두 가지입니다.

- 제휴 정보를 공개 페이지에서 빠르게 탐색할 수 있게 하기
- SSAFY 구성원만 접근해야 하는 기능은 Mattermost DM 인증과 관리자 도구로 안전하게 운영하기

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

- Mattermost 디렉터리 기반 회원 로그인
- Mattermost DM 6자리 코드 기반 회원가입 / 비밀번호 재설정 인증
- 가입 대상
  - 14기 교육생
  - 15기 교육생
  - 운영진
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
  - Super Admin 전용 Mattermost Sender 암호화 등록·테스트·활성화
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
- Mattermost API (서버 전용 Sender registry)
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
    mattermost/            직접 Mattermost API client
    mattermost-senders/    Sender 암호화 registry / 권한 / 회전
    mm-directory.ts        Mattermost 디렉터리 조회 / 동기화
    member-mattermost-profile-sync.ts  회원의 명시적 MM 프로필 동기화
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

- `check:lockfile`: Docker가 있으면 Linux/amd64 기준 lockfile canonical 여부 확인, 없으면 `npm@10`으로 lockfile 재생성 후 비교
- `ci:local`: `npm ci`, lint, build, Storybook test까지 한 번에 검증

`check:lockfile`은 Docker Desktop이 있으면 Linux/amd64 기준으로 검증하고, 없으면 `npm@10`으로 package-lock을 다시 생성해 비교합니다.

## 환경 변수

`.env.example`에는 서비스 런타임에 필요한 운영 변수만 둡니다. Preview 동기화, Mock 전환, 일회성 스크립트와 레거시 호환 변수는 CI 또는 해당 운영 문서에서만 관리합니다.

주요 그룹은 다음과 같습니다.

- 관리자 인증
  - `ADMIN_SESSION_SECRET`
  - `ADMIN_BASIC_AUTH_USERNAME` / `ADMIN_BASIC_AUTH_PASSWORD` (Production `/admin` edge gate)
  - 관리자 계정과 비밀번호는 Supabase `admin_accounts`에 저장하며 환경변수로 관리하지 않음
- Supabase
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Mattermost Sender registry (서버 전용)
  - `MM_BASE_URL`
  - `MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION`
  - `MM_SENDER_CREDENTIALS_KEY_V1`
  - Sender 로그인 ID와 비밀번호는 환경변수가 아니라 `/admin/cycle`의 Super Admin 화면에서 암호화해 등록
- 사용자 세션 / QR
  - `USER_SESSION_SECRET`
  - `PARTNER_SESSION_SECRET`
  - `CERTIFICATION_QR_SECRET`
  - `MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET`
  - `MEMBER_EMAIL_VERIFICATION_HMAC_SECRET`
  - `GRADUATE_VERIFICATION_HMAC_SECRET`
- 파트너 계좌이체 결제
  - `PARTNER_BILLING_BANK_NAME`
  - `PARTNER_BILLING_BANK_ACCOUNT`
  - `PARTNER_BILLING_ACCOUNT_HOLDER`
  - `NTS_BUSINESS_STATUS_SERVICE_KEY`
- 제휴 제안 / 회원 이메일 인증 메일
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_SECURE`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SUGGEST_NOTIFY_EMAIL`
- Web Push / Cron
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`
  - `CRON_SECRET`
- 사이트 URL / SEO
  - `NEXT_PUBLIC_SITE_URL`

환경 변수 예시는 [.env.example](/Users/myknow/coding/ssartnership/.env.example)에 있습니다.

## 파트너 결제 운영 설정

### 사업자 상태조회 API 키 등록

사업자 상태조회는 공공데이터포털의 `국세청_사업자등록정보 진위확인 및 상태조회 서비스`를 사용합니다.

1. 공공데이터포털에 로그인합니다.
2. `국세청_사업자등록정보 진위확인 및 상태조회 서비스` 상세 페이지에서 활용신청을 진행합니다.
3. 승인 후 `마이페이지 > 데이터활용 > Open API > 활용신청 현황`에서 일반 인증키를 확인합니다.
4. 로컬은 `.env`, Vercel은 Project Settings의 Environment Variables에 `NTS_BUSINESS_STATUS_SERVICE_KEY`로 등록합니다.
5. Preview/Production에 각각 등록한 뒤 재배포합니다.

인코딩/디코딩 인증키는 모두 사용할 수 있습니다. 앱은 값에 `%`가 포함되어 있지 않으면 호출 시 URL 인코딩합니다. 이 API의 상태조회 응답은 휴업/폐업 상태와 과세유형 확인용입니다. 상호, 대표자명, 주소, 업태, 종목은 자동 채움 대상이 아니므로 파트너가 직접 입력해야 합니다.

### 관리자 입금 계좌 등록

계좌이체 플랜 결제에서 파트너에게 보여줄 관리자 입금 계좌는 서버 전용 환경변수로 관리합니다.

1. 로컬은 `.env`, Vercel은 Project Settings의 Environment Variables를 엽니다.
2. `PARTNER_BILLING_BANK_NAME`, `PARTNER_BILLING_BANK_ACCOUNT`, `PARTNER_BILLING_ACCOUNT_HOLDER`를 등록합니다.
3. 계좌 변경 시 Preview와 Production 값을 모두 갱신하고 재배포합니다.
4. 값이 비어 있으면 파트너 포털은 계좌를 노출하지 않고 “관리자가 입금 계좌를 안내”하는 문구를 표시합니다.

계좌번호와 API 키는 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 파트너 포털의 인증된 서버 렌더링 화면에서만 필요한 값만 내려줍니다.

## Supabase 설정

- 스키마 변경은 항상 `supabase/migrations`에 먼저 기록합니다.
- `main`으로 merge하기 전에 migration이 누락되지 않았는지 확인합니다.
- `dev` 브랜치 push 시 GitHub Actions가 production 데이터를 preview로 미러링한 뒤 migration을 적용합니다.
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
- `members`, `member_policy_consents`, `mm_user_directory`, `push_*` 테이블은 서비스 롤 기준으로만 다룹니다.

## 회원 / 인증 모델

### 핵심 원칙

- `members`는 공통 계정·프로필의 원장이다. 교육생, 수료생, 운영진을 별도 회원 테이블로 나누지 않는다.
- 교육생과 수료생의 핵심 분류값은 `generation`(기수)이다. 수료생의 이수/졸업 학기는 신규 신청·승인 판단에 사용하지 않는다.
- 운영진은 `generation = 0`으로 표현하고, 확인 원본 기수는 `staff_source_generation`에 보관한다.
- Mattermost, 수료생, 관리자 권한, 약관 동의는 모두 1:1 또는 이력 확장 테이블로 분리한다.
- `deleted_at`이 있는 회원은 즉시 로그인·권한·혜택 접근이 차단된다. 30일 후 개인정보와 비공개 파일을 익명화하지만, HMAC 식별자 예약과 필요한 감사 이력은 남긴다.

### 관계도

```mermaid
erDiagram
    MEMBERS ||--o| MM_USER_DIRECTORY : "nullable mattermost_account_id"
    MEMBERS ||--o| MEMBER_SSAFY_VERIFICATIONS : "SSAFY proof"
    MEMBERS ||--o| GRADUATE_PROFILES : "graduate extension"
    GRADUATE_VERIFICATION_REQUESTS ||--o| GRADUATE_PROFILES : "approved from"
    MEMBERS ||--o| ADMIN_PROFILES : "admin extension"

    MEMBERS ||--o{ MEMBER_PROFILE_IMAGES : "owns"
    GRADUATE_VERIFICATION_REQUESTS ||--o{ MEMBER_PROFILE_IMAGES : "submits"
    MEMBERS ||--o{ MEMBER_EMAIL_CHALLENGES : "verifies email"

    MEMBERS ||--o{ MEMBER_POLICY_CONSENTS : "accepts"
    POLICY_DOCUMENTS ||--o{ MEMBER_POLICY_CONSENTS : "versioned by"

    MEMBERS {
      uuid id PK
      integer generation "cohort; 0 = staff"
      integer staff_source_generation
      text email
      text email_normalized UK
      timestamptz email_verified_at
      text password_hash
      text display_name
      text campus
      uuid mattermost_account_id FK "nullable"
      uuid active_profile_image_id FK
      timestamptz deleted_at
      timestamptz anonymized_at
    }

    MM_USER_DIRECTORY {
      uuid id PK
      text mm_user_id UK
      text mm_username UK
      text display_name_snapshot
      text campus_snapshot
      boolean is_staff
      integer[] source_generations
      boolean is_active
      timestamptz last_seen_at
    }

    MEMBER_SSAFY_VERIFICATIONS {
      uuid member_id PK_FK
      text ssafy_sub UK
      timestamptz verified_at
      text track
      text track_name
    }

    GRADUATE_PROFILES {
      uuid member_id PK_FK
      uuid verification_request_id FK
      timestamptz verified_at
      text verification_source
    }

    ADMIN_PROFILES {
      uuid id PK
      uuid member_id FK
      text permission_template_key FK
      text[] managed_campus_slugs
      boolean is_active
      integer permission_version
    }

    MEMBER_PROFILE_IMAGES {
      uuid id PK
      uuid member_id FK
      uuid graduate_verification_request_id FK
      text storage_path
      text sha256
      text content_type "image/webp"
      text source
      text status
    }

    POLICY_DOCUMENTS {
      uuid id PK
      text kind
      integer version
      text content
      boolean is_active
    }

    MEMBER_POLICY_CONSENTS {
      uuid id PK
      uuid member_id FK
      uuid policy_document_id FK
      timestamptz agreed_at
    }
```

### 인증과 기수

- 로그인 식별자는 Mattermost 아이디 또는 **인증된 이메일**이다. 이메일은 `/certification`에서 6자리 코드로 등록·변경한다.
- `mm_username`은 로그인 입력과 디렉토리 조회에 쓰는 변경 가능한 외부 식별자다. 회원 테이블에서는 nullable FK만 보유하고, MM 세부값은 `mm_user_directory`가 보관한다.
- `member_ssafy_verifications`는 SSAFY pairwise subject, 검증 시각, 트랙 정보를 보관한다. 기존 `members.ssafy_*` 컬럼은 Preview 검증이 끝날 때까지 호환 목적으로만 함께 쓴다.
- 기수 계산은 `ssafy_cycle_settings`와 날짜를 사용한다. 예를 들어 `generation = 15`는 15기이며, 현재 시점에 따라 교육생·수료생 역할 표시는 파생한다.
- 반·강의실·반장·CA 등 운영에 불필요한 닉네임 파생값은 저장하지 않는다.

### 외부 프로필과 이미지

- Mattermost 프로필은 주기 Cron으로 덮어쓰지 않는다. 회원이 `/certification`에서 명시적으로 동기화할 때 이름·캠퍼스·사진을 즉시 반영하고 감사 로그를 남긴다.
- 외부 사진은 원본/데이터 URL을 보관하지 않는다. 서버에서 640×640 WebP로 정규화해 private `member-profile-images` 버킷에 저장하고, 권한을 확인하는 private 이미지 API로만 읽는다.

### 수료생·관리자·약관

- 수료생 승인 시 `members.email`을 검증 완료 상태로 만들고 `graduate_profiles`를 생성한다. 교육 시작 연·월로 계산한 `inferred_generation`만 사용하며, `completion_stage`는 레거시 이력 컬럼이다.
- 관리자 권한의 원천은 `admin_profiles.permission_template_key`와 템플릿이다. 현재 관리자 세션/감사 FK는 안전한 전환을 위해 회원 ID를 유지하며, Preview 검증 후 관리자 프로필 ID로 계약 전환한다.
- `policy_documents`는 버전 콘텐츠를 수정하지 않고 새 버전을 발행한다. `member_policy_consents`는 약관 동의 이력을 보존한다.

### 전환 순서

1. 확장: 새 테이블·FK·인덱스를 추가하고 기존 컬럼을 유지한다.
2. 백필 및 이중 쓰기: 기존 회원을 새 모델로 옮기고 신규 가입·승인·권한 변경도 두 모델에 쓴다.
3. Preview 검증: 로그인, 인증, 수료생 승인, 관리자 권한, 탈퇴 익명화, 이미지 접근을 검증한다.
4. 계약: 모든 reader가 새 모델만 사용한 뒤 레거시 MM/SSAFY/권한/약관 미러 컬럼을 별도 migration으로 제거한다.

## Mattermost 직접 인증과 Sender 운영

### 서버 환경과 Sender 등록

- 서버에는 `MM_BASE_URL`, `MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION`, `MM_SENDER_CREDENTIALS_KEY_V1`만 설정합니다.
- 기수별 Sender의 로그인 ID·비밀번호는 Super Admin이 `/admin/cycle`에서 입력하며, AES-256-GCM으로 암호화되어 저장됩니다. 평문, MM 세션 토큰, credential metadata는 브라우저와 로그에 노출하지 않습니다.
- 새 후보 Sender는 이전 활성 Sender 또는 Super Admin 연결 계정으로 테스트 DM을 보낸 뒤에만 활성화됩니다. 기수별 활성 Sender는 하나이고, 교체 성공 시 이전 ciphertext는 삭제됩니다.
- 팀과 채널은 코드에서 `s{generation}public`과 `town-square`로만 계산합니다.

### 회원가입·재설정

1. 사용자가 Mattermost ID와 기수를 입력하면 해당 기수의 활성 Sender가 DM으로 6자리 코드를 보냅니다.
2. 코드는 HMAC hash만 저장하며 10분 만료, 1회 소비, 5회 검증 제한, 재전송 제한을 적용합니다.
3. 회원가입은 검증된 immutable `mm_user_id`를 `mm_user_directory`에 연결하고 최신 약관 동의와 로컬 비밀번호를 저장합니다.
4. 비밀번호 재설정은 기존 연결 회원에만 짧은 HttpOnly 완료 세션을 발급합니다. 계정 존재 여부는 응답에서 구분하지 않습니다.
5. 직접 MM 조회·동기화·알림은 대상 기수 Sender만 사용하고, Sender가 없거나 MM API가 실패하면 이메일 자동 fallback을 하지 않습니다.

### 프로필과 lifecycle

- 프로필 동기화는 `mm_user_id` 일치를 강제하고 username, 표시명, 사진만 갱신합니다. 캠퍼스·트랙·기존 claim은 직접 MM 응답으로 덮어쓰지 않습니다.
- 성공한 사용자 조회에서만 명시적 `delete_at > 0`이면 교육생은 `generation_completed`, 운영진은 `member_departed`로 전환합니다. 404, timeout, 권한 오류, rate limit, 형식 오류는 회원 상태를 바꾸지 않습니다.

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
- MM 프로필은 회원이 `/certification`에서 명시적으로 동기화할 때 즉시 반영합니다.
- 탈퇴 후 30일이 지난 회원은 Vercel cron으로 익명화합니다.
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
      "path": "/api/cron/anonymize-deleted-members",
      "schedule": "40 0 * * *"
    },
    {
      "path": "/api/cron/purge-expired-operational-logs",
      "schedule": "50 0 * * *"
    }
  ]
}
```

## 주요 보안 포인트

- 관리자 세션과 사용자 세션은 서명 + 만료 시각을 사용합니다.
- 관리자 로그인은 입력 검증, suspicious parameter 탐지, IP/계정 기준 rate limit을 적용합니다.
- 관리자 경로는 필요 시 IP allowlist 또는 Basic Auth로 한 번 더 제한할 수 있습니다.
- 로그인, Mattermost DM 코드, 비밀번호 재설정 요청은 횟수 제한이 적용됩니다.
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

릴리즈 흐름에서는 `npm run build-storybook`과 `npm run test-storybook`을 커밋/푸시 전에 반드시 통과해야 합니다. Storybook 빌드가 실패하면 `npm run release`는 버전 업데이트, 커밋, 푸시를 진행하지 않습니다. Chromatic publish GitHub Actions는 무료 한도 소진으로 인한 외부 `UI Tests` pending을 피하기 위해 수동 실행 전용입니다.

### release 스크립트

`release` 스크립트는 다음을 수행합니다.

- `main` 외 브랜치: Lighthouse 선택 실행 후 Storybook build/test를 강제하고, 통과 시 `npm version` 실행 후 commit + push
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
- Storybook build/test가 실패하면 로컬 release 단계에서 차단되므로, 실패 원인을 먼저 수정한 뒤 다시 release를 실행해야 합니다.

## 배포

Vercel 배포를 기준으로 구성되어 있습니다.

1. GitHub 저장소 연결
2. Vercel 프로젝트 생성
3. `.env` 값을 Vercel Environment Variables에 등록
4. Supabase migration / schema 적용
5. 배포 후 `NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 갱신

권장:

- `ADMIN_SESSION_SECRET`, `USER_SESSION_SECRET`, `CERTIFICATION_QR_SECRET`, `CRON_SECRET`, `MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET`, `MEMBER_EMAIL_VERIFICATION_HMAC_SECRET`는 충분히 긴 난수 사용
- `SUPABASE_SERVICE_ROLE_KEY`, `MM_SENDER_CREDENTIALS_KEY_V1`, SMTP 계정, VAPID private key는 절대 클라이언트에 노출되지 않도록 관리
- 운영 환경에서는 `ADMIN_ALLOWED_IPS` 또는 Basic Auth 중 최소 하나를 같이 두는 편이 안전

## 현재 상태

- `npm run lint` 통과
- `npm run test:mm-profile` 통과
- 회원가입 / 로그인 / 재설정 / 약관 동의 / 운영진 권한 흐름은 `members` 공통 원장과 확장 프로필 모델로 전환 중입니다.
- Mattermost Sender registry와 직접 API 전환의 운영 절차는 관리자 기수 관리 화면과 Issue #155에 정리합니다.
- 공개 제휴 페이지는 SEO, sitemap, RSS, robots를 포함합니다.

## 라이선스

CC BY-NC 4.0  
비상업적 목적에 한해 사용 가능합니다.
