# 관리자 로그인 보안 강화

Updated: 2026-05-14

## 발생 배경

- `/admin/login`에 반복적인 공격 시도가 관측됐다.
- 확인된 payload 유형에는 SQLi 스타일 문자열, NoSQL operator 스타일 파라미터명, reflected XSS 탐색이 포함됐다.
- 검토한 로그 기준 관리자 탈취나 성공적인 비정상 로그인은 확인되지 않았다.

## 코드 수준 확인 사항

1. `/admin/login`은 `dangerouslySetInnerHTML`을 사용하지 않았으므로 직접적인 reflected XSS 실행은 확인되지 않았다.
2. 기존 페이지는 임의의 `error`, `id` query string을 받아 `id`를 form에 다시 표시할 수 있었다.
3. 관리자 credential 검증은 SQL/NoSQL backend를 거치지 않으므로 관측된 SQLi/NoSQL payload가 현재 경로에서 직접 악용되지는 않았다.
4. 관리자 throttling이 IP 중심이라 민감 로그인 페이지 기준으로는 약했다.
5. 관리자 page view analytics가 raw query string을 포함할 수 있어 공격 payload가 로그에 중복 저장될 수 있었다.
6. protected admin page와 admin API의 비인가 접근 기록이 일관적이지 않았다.

## 적용한 보완

- `error` query param은 고정 enum만 허용한다.
- `id` query param은 sanitize 후 허용된 관리자 identifier 형식일 때만 다시 표시한다.
- 의심스러운 query param과 잘못된 form shape은 차단된 security event로 기록한다.
- 관리자 ID 입력은 `A-Z a-z 0-9 . _ -` 기준 `3~64`자로 제한한다.
- 관리자 password 입력은 과도하게 크거나 control character가 포함된 payload를 거부한다.
- 관리자 throttling은 IP와 account identifier에 모두 적용한다.
- 실패한 로그인 시도에는 짧은 서버 지연을 부여한다.
- protected admin page와 admin API는 비인가 접근 시 `admin_access` blocked event를 남긴다.
- 관리자 page view analytics는 query string을 저장하지 않는다.
- 선택적 edge 보호를 환경 변수로 추가했다.
  - `ADMIN_ALLOWED_IPS`
  - `ADMIN_BASIC_AUTH_USERNAME`
  - `ADMIN_BASIC_AUTH_PASSWORD`
- 선택적 basic auth 비교는 timing-safe 방식으로 수행한다.
- 관리자 세션 기본 TTL은 7일에서 12시간으로 줄였다.
  - `ADMIN_SESSION_TTL_HOURS`로 조정할 수 있다.
  - 허용 범위는 1~24시간이며, 잘못된 값은 기본 12시간으로 처리한다.

## 권장 운영 설정

1. 관리자 IP 대역이 안정적이면 `ADMIN_ALLOWED_IPS`를 설정한다.
2. `/admin/login` 앞에 두 번째 gate를 두기 위해 `ADMIN_BASIC_AUTH_USERNAME`, `ADMIN_BASIC_AUTH_PASSWORD`를 활성화한다.
3. 네트워크 지원이 가능하면 public admin login page보다 VPN 또는 internal access layer를 우선한다.
4. 반복 공격이 관측되면 `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`를 회전한다.
5. 운영자 수가 늘어나면 env 기반 단일 관리자 로그인 대신 MFA를 지원하는 외부 IdP로 전환한다.
6. Vercel Firewall에서 알려진 abusive IP 차단과 admin path 접근 축소를 검토한다.

## 남은 트레이드오프

- React escaping이 `/admin/login`의 reflected XSS 위험을 낮추지만, 현재 보완은 그 동작에만 의존하지 않도록 입력과 query를 제한한다.
- IP allowlist와 Basic Auth는 해당 env가 설정되기 전까지 비활성이다.
- MFA는 현재 env 기반 단일 관리자 credential 모델과 맞지 않으므로 이번 패치에서 직접 구현하지 않았다.
- MFA가 필요해지는 시점에는 admin login 자체를 외부 IdP/OIDC로 교체하는 편이 현재 구조에 임시 OTP를 덧붙이는 것보다 안전하다.
