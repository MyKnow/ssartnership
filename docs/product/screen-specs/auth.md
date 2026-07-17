# 회원 인증 화면 계약

작성 기준일: 2026-07-17

<!-- screen-contract: auth.login -->
## `/auth/login` — 회원·관리자 로그인

- 목표·위계: 로그인 목적 → 아이디/비밀번호 → 로그인 → 가입·재설정 순이다.
- 액션·흐름: 일반 로그인은 기존 사이트 비밀번호 또는 검증된 이메일을 사용한다. 필요 시 강제 비밀번호 변경·정책 동의·원래 `returnTo`로 이어진다.
- 경계·상태: FE/BE 공용 검증, rate limit, HMAC session 경계를 유지한다. 기본, validation error, 인증 실패, 제한, 이미 로그인 상태를 제공한다.
- 수용 기준: 외부 `returnTo`를 거부하고 첫 오류 focus, 중복 제출 차단, 자격 증명 비노출을 보장한다.

<!-- screen-contract: auth.reset -->
## `/auth/reset` — 비밀번호 재설정 시작

- 목표·위계: 대상 기수 안내 → Mattermost DM 코드 → 새 비밀번호 설정 → 복구 경로 순이다.
- 액션·흐름: 운영진·재학생은 대상 기수의 active Sender가 보낸 6자리 DM 코드를 사용한다. Mattermost가 불가해도 자동 이메일 fallback은 하지 않는다.
- 경계·상태: 코드는 HMAC hash만 보관하고 10분 만료, 1회 소비, 5회 검증 제한과 재전송 제한을 적용한다. 계정 존재 여부는 응답으로 노출하지 않는다.
- 수용 기준: MM sender가 없거나 실패하면 안전한 일반 오류를 표시하고, 기존 비밀번호가 있는 회원에게는 이메일 로그인 복구를 안내한다.

<!-- screen-contract: auth.signup -->
## `/auth/signup` — 회원가입 시작

- 목표·위계: 가입 유형 → Mattermost DM 인증 또는 수료생 증명서 인증 → 정책 링크 순이다.
- 액션·흐름: 운영진·재학생은 direct Mattermost DM 코드로 가입한다. 수료생 신규 가입과 기존 회원 복구는 서로 다른 진입 링크와 request kind를 사용한다.
- 경계·상태: 서버가 기수별 Sender, MM ID, 팀/채널 membership를 확인한다. password/token/code/sender credential은 UI와 로그에 노출하지 않는다.
- 수용 기준: 신규 가입은 기존 회원을 덮어쓰지 않고, 기존 회원 복구는 관리자의 명시적 회원 선택 없이는 승인되지 않는다.

<!-- screen-contract: auth.graduate-verification -->
## `/auth/signup/graduate` — 수료생 인증 및 기존 회원 복구 신청

- 목표·위계: 이메일 인증 → 교육 정보 → 수료증/사진 → 검토 상태 순이다.
- 액션·흐름: 기본은 `graduate_signup`이며 승인 시 새 수료생 계정을 만든다. `?kind=recovery`는 `existing_member_recovery`로 신청하고, 관리자가 기존 회원 ID를 명시적으로 선택한 경우에만 이메일과 초기 비밀번호 설정 메일을 연결한다.
- 경계·상태: 신청 종류는 이메일 challenge와 httpOnly application session에 함께 바인딩한다. 같은 종류의 open 신청은 중복할 수 없고, 복구 승인 RPC는 새 `members` 행을 만들지 않는다.
- 수용 기준: 이메일·수료증·사진 검증 실패는 안전한 메시지로 안내하며, resubmission 링크도 최초 신청 종류를 유지한다.

<!-- screen-contract: auth.member-email-recovery -->
## `/auth/recover-email` — MM 장애 중 이메일 로그인 복구

- 목표·위계: 기존 사이트 비밀번호 확인 → 제한 복구 세션 → 이메일 등록 → 6자리 코드 → 이메일 로그인 전환 순이다.
- 액션·흐름: 기존 로컬 비밀번호가 맞으면 15분짜리 httpOnly 복구 세션만 발급한다. 이메일 코드를 성공적으로 검증한 뒤에만 일반 이메일 로그인 세션을 발급한다.
- 경계·상태: 복구 세션은 `auth_session_version`에 바인딩되고, 코드 HMAC hash만 저장하며 10분 만료·5회 검증 제한을 적용한다. 다른 회원과 탈퇴 예약 이메일은 연결하지 않는다.
- 수용 기준: 비밀번호 확인 단계에서는 정상 로그인 세션을 만들지 않으며, 만료·코드 오류·중복 이메일은 재시도 가능한 안전한 오류로 표시한다.

## conditional 인증 화면

`/auth/consent`, `/auth/change-password`, `/auth/signup/complete`, `/auth/reset/complete`, `/auth/graduate/setup`은 독립 메뉴 목적지가 아니다. 각각 필수 동의, 비밀번호 변경, 가입 완료, 재설정 완료, 이메일 설정 토큰이 있을 때만 진입하며 성공하면 검증된 `returnTo` 또는 canonical 화면으로 이동한다. 토큰·세션이 없거나 만료되면 흐름 시작점으로 복구한다.
