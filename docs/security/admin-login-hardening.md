---
title: 관리자 로그인 보안 강화
type: security-policy
status: current
authority: normative
---

# 관리자 로그인 보안 강화

Updated: 2026-10-05

## 현재 관리자 인증 모델

- 별도 관리자 ID/비밀번호 로그인은 없다. `/admin/login`은 `/auth/login?returnTo=%2Fadmin`으로 영구 리디렉션한다.
- 관리자는 회원 계정으로 로그인한 뒤 `/admin/session` 브리지에서 관리자 세션(`admin_session`)을 발급받는다. 브리지는 활성 관리자 프로필이 있고 비밀번호 변경이 필요하지 않은 회원에게만 발급한다.
- 관리자 승격은 회원 탈퇴·이메일 바인딩과 같은 민감 작업으로 보고 같은 최근 인증 규칙(`src/lib/member-recent-auth.ts`)을 쓴다. 브리지는 회원 세션의 자격 확인 시각(`authenticatedAt`)이 최근 10분 이내일 때만 발급한다. 아니면 회원·관리자 쿠키를 모두 지우고 `/auth/login?returnTo=<관리자 경로>`로 보내 다시 로그인하게 한다. 7일 회원 세션으로 관리자 권한을 조용히 얻거나 연장하지 못하게 하는 장치이며, `authenticatedAt`이 없는 이전 토큰도 거부한다.
- 관리자 세션은 계정 활성 상태, 비밀번호 변경 필요 여부, `permission_version` 일치를 요청마다 다시 확인한다.

## 발생 배경

- 과거 `/admin/login`(당시 독립 관리자 로그인 화면)에 반복적인 공격 시도가 관측됐다.
- 확인된 payload 유형에는 SQLi 스타일 문자열, NoSQL operator 스타일 파라미터명, reflected XSS 탐색이 포함됐다.
- 검토한 로그 기준 관리자 탈취나 성공적인 비정상 로그인은 확인되지 않았다.

## 당시 코드 수준 확인 사항

1. `/admin/login`은 `dangerouslySetInnerHTML`을 사용하지 않았으므로 직접적인 reflected XSS 실행은 확인되지 않았다.
2. 기존 페이지는 임의의 `error`, `id` query string을 받아 `id`를 form에 다시 표시할 수 있었다.
3. 관리자 credential 검증은 SQL/NoSQL backend를 거치지 않으므로 관측된 SQLi/NoSQL payload가 현재 경로에서 직접 악용되지는 않았다.
4. 관리자 throttling이 IP 중심이라 민감 로그인 페이지 기준으로는 약했다.
5. 관리자 page view analytics가 raw query string을 포함할 수 있어 공격 payload가 로그에 중복 저장될 수 있었다.
6. protected admin page와 admin API의 비인가 접근 기록이 일관적이지 않았다.

## 적용한 보완

- 독립 관리자 로그인 화면을 없애고 회원 로그인과 세션 브리지로 일원화했다. 로그인 시도 제한은 회원 로그인 throttle(IP·계정 식별자)을 따른다.
- 의심스러운 query param과 잘못된 form shape은 차단된 security event로 기록한다.
- protected admin page와 admin API는 비인가 접근 시 `admin_access` blocked event를 남긴다.
- 관리자 page view analytics는 query string을 저장하지 않는다.
- 선택적 edge 보호를 환경 변수로 추가했다.
  - `ADMIN_ALLOWED_IPS`
  - `ADMIN_BASIC_AUTH_USERNAME`
  - `ADMIN_BASIC_AUTH_PASSWORD`
- 선택적 basic auth 비교는 timing-safe 방식으로 수행한다.
- IP allowlist 대상은 `/admin` 화면 전체와 `/api/admin`, `/api/push/admin`이다. Basic Auth challenge는 관리자 API(`/api/admin`, `/api/push/admin`)에만 적용하고, 관리자 화면은 회원 세션 브리지가 인증을 맡는다.
- 관리자 세션 기본 TTL은 7일에서 12시간으로 줄였다.
  - `ADMIN_SESSION_TTL_HOURS`로 조정할 수 있다.
  - 허용 범위는 1~24시간이며, 잘못된 값은 기본 12시간으로 처리한다.
  - 관리자 세션이 만료되면 브리지가 다시 최근 인증을 요구하므로 관리자는 TTL마다 비밀번호로 다시 로그인한다.

## 권장 운영 설정

1. 관리자 IP 대역이 안정적이면 `ADMIN_ALLOWED_IPS`를 설정한다. 이 값은 신뢰 프록시 기준 클라이언트 IP가 앱에 전달될 때만 의미가 있다.
2. 관리자 API 앞에 두 번째 gate를 두려면 `ADMIN_BASIC_AUTH_USERNAME`, `ADMIN_BASIC_AUTH_PASSWORD`를 설정한다.
3. 네트워크 지원이 가능하면 공개 경로보다 VPN 또는 내부 접근 계층을 우선한다.
4. 관리자 세션 탈취가 의심되면 `ADMIN_SESSION_SECRET`를 회전해 모든 관리자 세션을 무효화하고, 해당 회원 계정은 로그아웃(모든 기기 세션 무효화) 뒤 비밀번호를 바꾼다.
5. 반복 공격이 관측되면 엣지 프록시에서 알려진 abusive IP 차단과 admin path 접근 축소를 검토한다.

## 남은 트레이드오프

- React escaping이 reflected XSS 위험을 낮추지만, 보완은 그 동작에만 의존하지 않도록 입력과 query를 제한한다.
- IP allowlist와 Basic Auth는 해당 env가 설정되기 전까지 비활성이다.
- 런타임 env 변경은 앱 컨테이너를 다시 시작해야 적용된다. 적용 후 `/api/admin/*`가 Basic Auth 미제공 요청에 401 challenge를 반환하는지 확인한다.
- 관리자 권한은 회원 인증 강도에 묶인다. MFA가 필요해지면 관리자 전용 OTP를 덧붙이기보다 회원 인증 자체를 외부 IdP/OIDC 또는 WebAuthn으로 강화하는 편이 현재 구조에 맞다.
- 관리자 세션은 발급 후 최대 TTL 동안 유효하므로, 회원 자격 확인 시점부터 관리자 권한이 유지될 수 있는 최대 시간은 TTL에 최근 인증 창(10분)을 더한 값이다.
