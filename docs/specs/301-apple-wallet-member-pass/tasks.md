---
title: Apple Wallet 회원 인증 패스 작업과 증거
type: task-list
status: active
authority: descriptive
last_verified: 2026-08-29
issue: https://github.com/MyKnow/ssartnership/issues/301
---

# Apple Wallet 회원 인증 패스 작업과 증거

이 목록은 2026-08-29 `dev`의 저장소 상태와 Issue #301의 열린 체크리스트를 대조한 재개 지점이다. 외부 provider나 실제 기기 상태는 저장소 코드만으로 완료 처리하지 않는다.

## 저장소 구현

- [x] Wallet credential·device registration migration과 schema 계약
- [x] mock/Supabase `WalletPassRepository`와 service 경계
- [x] 발급·재발급·폐기, 현재 자격, QR verification token
- [x] Apple pass payload·서명 설정·device token 용도 분리
- [x] PassKit device registration/update web service routes
- [x] `/certification` 발급·상태·폐기 UI와 Storybook 상태
- [x] reconciliation cron, APNs retry, Preview sync 격리
- [x] Node 계약 테스트와 360/820/1366 visual baseline 자산

근거 경로는 `src/lib/wallet/**`, `src/lib/repositories/*wallet*`, `src/app/api/wallet/**`, `src/components/certification/AppleWalletPass*`, `supabase/migrations/20260811*` 이후 Wallet migration, `tests/*wallet*`과 `tests/apple-wallet-*`다.

## 외부 준비와 실제 기기

- [ ] Apple Developer Program 상태와 발급 주체 명칭 확인
- [ ] Pass Type ID, certificate/private key, WWDR certificate 준비
- [ ] Apple 제공 한국어 Wallet badge license·asset 준비
- [ ] Preview에 server-only 환경을 설정하고 실제 `.pkpass` 생성 확인
- [ ] 실제 iPhone에서 추가·삭제·재추가·정보 변경·폐기 후 scan 확인
- [ ] Samsung Wallet Business Account/파트너 신청 상태 기록
- [ ] 운영 승인 뒤 Production 활성화 여부 결정

## 완료 조건

저장소 검증만으로 Issue #301을 닫지 않는다. 실제 provider 준비, Preview 통합, iPhone 파일럿, 운영 승인 증거가 Issue에 기록되고 Production 또는 명시적으로 수락된 Preview-only 결과가 확정돼야 완료다.
