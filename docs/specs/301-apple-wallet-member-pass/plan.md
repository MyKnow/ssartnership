---
title: Apple Wallet 회원 인증 패스 기술 계획
type: implementation-plan
status: active
authority: normative
last_verified: 2026-08-29
issue: https://github.com/MyKnow/ssartnership/issues/301
---

# Apple Wallet 회원 인증 패스 기술 계획

## 시스템 경계

- `WalletPassRepository`: credential, revision, 폐기, device registration을 영속화하며 mock과 Supabase가 같은 계약을 제공한다.
- `WalletPassService`: 현재 회원 자격, 표시 snapshot, 상태 전이, idempotency를 담당한다.
- `AppleWalletPassAdapter`: payload, asset, manifest, 서명, `.pkpass` 패키징만 담당한다.
- Apple web service routes: device 등록·해제, 변경 serial 조회, 최신 pass 다운로드를 Apple 규격으로 제공한다.
- 공개 verify route: QR token을 검증하고 현재 회원 상태를 다시 조회한다.

UI와 route는 raw Supabase query를 사용하지 않고 service/repository 경계를 통한다. 실제 구현 근거는 `src/lib/wallet/**`, `src/lib/repositories/*wallet*`, `src/app/api/wallet/**`, 관련 migrations와 tests다.

## 데이터와 상태

- credential: `active | revoked`
- installation: `pending | installed | removed`
- sync: `pending | synced | failed`

한 회원·플랫폼에는 하나의 canonical credential만 활성화한다. 설치 여부는 device registration의 관찰 결과이며 회원 자격과 섞지 않는다. 폐기 후 재발급은 새 credential과 새 QR public ID를 만들고 이전 QR은 영구 무효로 남긴다.

발급·재발급·폐기는 idempotency key와 request fingerprint로 중복 실행을 막는다. snapshot과 현재 자격을 분리해 Wallet 표시가 늦게 갱신돼도 QR 검증이 현재 상태를 반환하게 한다.

## Key와 token 경계

- Pass Type ID certificate, private key, WWDR certificate, Wallet master key는 서버 전용 환경 변수에서만 읽는다.
- `APPLE_WALLET_ENABLED=true`이면 명시적인 공개 HTTPS `NEXT_PUBLIC_SITE_URL`이 필수다.
- `APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64`는 정확히 32바이트인 장기 master key다.
- APNs push token 암호화, device identifier hash, QR 서명, Apple `authenticationToken`은 서로 다른 고정 context로 HMAC-SHA256 subkey를 파생한다.
- 설정 오류에는 환경 변수 이름만 포함하고 key/token/provider 원문은 포함하지 않는다.

master key는 설치 수명 동안 불변으로 운용한다. 회전은 저장 token 재암호화, device identifier 재생성 또는 재등록, 기존 pass 폐기, 새 credential 발급과 실제 기기 전환을 포함하는 별도 migration으로 수행한다.

## 운영과 복구

- 인증서의 `notBefore` 이전과 `notAfter` 이후에는 발급·web service를 막고, 만료 30일 이내면 health/config 경계에서 경고한다.
- 유효한 PassKit 인증을 통과한 unregister 대상이 이미 없으면 `200` no-op으로 처리한다. malformed serial, authorization, pass type은 거절한다.
- Preview sync는 Production Wallet 테이블을 복사하지 않고 Preview-local Wallet 테이블만 transaction 안에서 백업·복원한다. schema가 빠져 있으면 sync를 중단한다.
- register/unregister/sync는 집계 가능한 outcome과 reason code만 남긴다.
- APNs 전달이 일시 실패하면 active/revoked 설치를 다음 조정에서 재시도하고, 성공한 revoked pass는 대상에서 제외한다.
- 일일 조정 작업은 설치된 active pass의 자격·동의·snapshot을 재검사해 revision 또는 revoke로 수렴시킨다.
- `APPLE_WALLET_ENABLED=false`는 신규 발급을 중단하지만 기존 QR 검증과 회원 폐기는 유지한다.

## 외부 준비와 rollout

Apple Developer Program, Pass Type ID, certificate/private key, WWDR certificate가 필요하다. 계정 소유자는 출시 전 Apple Wallet Marketing Artwork License에 동의하고 Apple 제공 한국어 SVG 배지를 사용한다. 인증서가 없으면 mock과 서명 전 계약은 검증할 수 있지만 실제 `.pkpass` 설치 완료를 주장하지 않는다.

Samsung Wallet은 Business Account와 파트너 신청 상태만 기록하고, 계정 정보·약관·CAPTCHA는 계정 소유자가 직접 처리한다.

rollout은 local 계약 검증 → Preview 환경 설정·통합 → 실제 iPhone 파일럿 → 운영 승인 순서다. Production 활성화는 Issue #301의 별도 승인 경계를 따른다.

## 검증

- token 변조·열거·폐기·재발급, eligibility, state transition 단위 테스트
- mock/Supabase repository와 SQL migration 계약 테스트
- route 인증·idempotency·safe error·PassKit web service 테스트
- pass payload/manifest/signature와 device token 암호화 테스트
- 로그인·회원 필수 게이트·Preview sync 격리 회귀 테스트
- Storybook 및 360/820/1366 visual baseline
- 실제 iPhone 추가·삭제·재추가·업데이트·폐기 후 scan

현재 작업 상태와 증거는 [tasks.md](./tasks.md)에만 기록한다.
