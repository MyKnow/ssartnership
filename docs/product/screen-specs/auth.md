# 회원 인증 화면 계약

작성 기준일: 2026-07-10

<!-- screen-contract: auth.login -->
## `/auth/login` — 회원·관리자 로그인

- 목표·위계: 로그인 목적 → 아이디/비밀번호 → 로그인 → 가입·재설정 순이며 현재의 단일 권장 경로를 유지한다.
- 액션·흐름: primary는 로그인, 보조는 회원가입과 비밀번호 재설정이다. 보호 화면에서 안전한 `returnTo`와 함께 진입하고 동의·비밀번호 변경 또는 원래 화면으로 이탈한다.
- 경계·상태: FE/BE 공용 검증, rate limit, HMAC session 경계를 유지한다. 기본, validation error, 인증 실패, 제출 중, 잠금/제한, 이미 로그인 상태를 제공한다.
- 반응형·분석: 모바일과 데스크톱 모두 단일 form column을 유지한다. `login_attempt`, `login_success`, 분류된 실패 코드만 기록하고 자격 증명은 기록하지 않는다.
- 수용 기준: 외부 `returnTo`를 거부하고 첫 오류 focus, 중복 제출 차단, 사용자 안전 오류 문구가 동작한다.

<!-- screen-contract: auth.reset -->
## `/auth/reset` — 회원 비밀번호 재설정 시작

- 목표·위계: 재설정 안내 → SSAFY 인증 시작 → 복구 안내 순이다.
- 액션·흐름: primary는 SSAFY Verify 재설정 시작, 보조는 로그인 복귀다. 로그인 화면에서 진입하고 검증 후 `/auth/reset/complete`로 분기한다.
- 경계·상태: SSAFY Verify와 reset session을 서버에서 검증한다. 기본, 외부 인증 이동 중, 검증 실패, rate limit, 이미 로그인 상태를 제공한다.
- 반응형·분석: 인증 단계와 개인정보 안내를 한 열로 표시한다. `password_reset_start`, 결과 분류만 기록한다.
- 수용 기준: 계정 존재 여부를 오류로 노출하지 않고 재사용·만료 callback을 거부하며 실패 시 다시 시작할 수 있다.

<!-- screen-contract: auth.signup -->
## `/auth/signup` — SSAFY 회원가입 시작

- 목표·위계: 가입 가치 → SSAFY 인증 조건 → 인증 시작 → 정책 링크 순이다.
- 액션·흐름: primary는 SSAFY Verify 가입 시작, 보조는 로그인이다. 공개 헤더에서 진입하고 callback·완료·필수 동의로 이어진다.
- 경계·상태: 외부 Verify 요청과 callback state를 서버에서 서명·검증한다. 기본, 인증 이동 중, 중복 회원, 검증 실패, rate limit을 제공한다.
- 반응형·분석: 모바일 우선 단일 CTA와 간결한 정책 안내를 쓴다. `signup_start`, `signup_verify_result`, `signup_complete`를 기록한다.
- 수용 기준: return path와 state 위조를 거부하고 가입 실패가 로그인·재시도 경로를 명확히 안내하며 개인정보를 analytics에 넣지 않는다.

## conditional 인증 화면

`/auth/consent`, `/auth/change-password`, `/auth/signup/complete`, `/auth/reset/complete`, `/auth/ssafy`는 독립 메뉴 목적지가 아니다. 각각 필수 동의, 비밀번호 변경, 가입 완료, 재설정 완료, 외부 callback 상태에서만 진입하며 성공하면 검증된 `returnTo` 또는 canonical 화면으로 이동한다. 토큰·세션이 없거나 만료되면 흐름 시작점으로 복구한다.
