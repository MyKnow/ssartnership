# Service Role 접근 경계

## 목적

Supabase service role key는 RLS를 우회할 수 있으므로 서버 전용 코드에서만 사용한다. 이 문서는 이 저장소에서 service role 사용이 허용되는 경계와 새 코드를 추가할 때 확인해야 할 규칙을 고정한다.

## 기본 원칙

- service role key는 클라이언트 컴포넌트, 브라우저 번들, public env에 절대 노출하지 않는다.
- route handler, server action, repository, cron job에서만 `getSupabaseAdminClient()`를 사용할 수 있다.
- service role 접근은 항상 명시적인 실행 맥락 뒤에 둔다.
  - 관리자 맥락: `requireAdmin()` 또는 `ensureAdminApiAccess()`
  - 회원 맥락: signed member session 확인
  - 파트너 맥락: partner session 확인과 연결 회사/브랜드 권한 확인
  - cron 맥락: admin session 또는 `CRON_SECRET`
  - 공개 읽기 맥락: 공개 projection만 반환하는 repository/helper
- mutation route는 cookie 인증에만 의존하지 않고 same-origin 또는 CSRF 성격의 요청 검증을 함께 적용한다.
- 로그, metric, cache version 같은 부가 기록 실패는 가능한 한 사용자 요청 실패로 전파하지 않는다.

## 허용되는 사용 범위

### 관리자 화면과 관리자 API

- `/admin` protected route, admin server action, admin API는 service role 사용 전에 관리자 세션을 확인한다.
- 파일 업로드, XLSX 파싱, 알림 발송, 이벤트 관리처럼 데이터 범위가 넓은 기능은 handler/action 경계에서 guard를 먼저 호출한다.
- admin basic auth는 선택적 추가 gate이며, 비교는 timing-safe 방식으로 수행한다.

### 회원 API와 인증 흐름

- 회원별 알림, 즐겨찾기, 리뷰, 정책 동의, 인증 상태 변경은 signed member session이 있어야 한다.
- 브라우저 cookie를 사용하는 mutation은 `Origin` 또는 same-origin `Referer`를 확인한다.
- 리뷰 미디어는 signed upload URL 발급 시 선언값을 검증하고, 저장/수정 직전에 Storage object metadata를 다시 검증한다.

### 파트너 포털

- 파트너 계정 route/action은 partner session을 확인하고, 해당 계정이 접근 가능한 회사/브랜드인지 검증한다.
- 초기 설정 token route는 token 자체 검증 외에도 same-origin form submit을 요구한다.
- 파트너 변경 요청은 요청자 계정 식별자를 감사 이력에 남긴다.

### Cron과 운영 자동화

- cron route는 admin session 또는 `CRON_SECRET` 없이는 실행하지 않는다.
- cron 내부에서 service role을 쓰더라도 입력 범위와 side effect를 route에서 제한한다.

### 공개 읽기와 repository

- 홈, 캠퍼스, 제휴 상세 같은 공개 화면은 repository를 통해 공개 가능한 필드만 반환한다.
- `visibility`, `benefitVisibility`, 대상자 판단처럼 공개 범위를 바꾸는 규칙은 domain helper를 거친다.
- 비공개 혜택 정보가 SEO metadata, structured data, public cache payload로 새지 않게 한다.

### 로그, metric, 캐시 보조 기능

- product event log, audit log, metric rollup, cache version 조회는 service role을 사용할 수 있다.
- 사용자 UX와 직접 관련 없는 로그 기록은 throttle 또는 비동기 처리하고, 실패해도 핵심 요청을 막지 않는다.
- RLS/revoke 상태는 `tests/security-schema.test.mts`에서 schema snapshot 기준으로 회귀 검사한다.

## 새 service role 사용 체크리스트

- 이 코드가 서버 전용 파일인가?
- 실행 전에 admin/member/partner/cron/public-read 중 어떤 맥락인지 명확한가?
- mutation이면 same-origin 또는 CSRF 성격 검증이 있는가?
- 반환 데이터가 현재 사용자에게 허용된 필드로 제한되는가?
- 실패가 사용자 요청을 막아야 하는 핵심 작업인가, 아니면 로깅/metric처럼 분리할 수 있는 작업인가?
- 민감 테이블을 새로 추가했다면 RLS enable, anon/authenticated revoke, schema regression test 목록을 함께 갱신했는가?
