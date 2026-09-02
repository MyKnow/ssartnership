---
title: 기능 명세 인덱스
type: index
status: current
authority: normative
last_verified: 2026-08-29
---

# 기능 명세 인덱스

## Artifact 역할

- `spec.md`: 사용자가 얻는 결과, WHAT/WHY, 범위, 불변조건, 수용 기준
- `plan.md`: 기존 시스템을 존중하는 기술 설계, 데이터·API·운영·검증 방법
- `tasks.md`: 현재 구현을 재개할 수 있는 순서와 완료 증거

기존 시스템 전체를 소급 명세하지 않는다. 계획된 다중 surface, 데이터 모델, 인증·보안 또는 아키텍처 변경부터 이 구조를 사용한다. 작은 수정은 Issue와 집중 검증으로 충분하다.

## 현재 기능

- [Apple Wallet 회원 인증 패스](./301-apple-wallet-member-pass/spec.md) — Issue #301, active
- [관리자 콘솔 계약](./205-admin-console/spec.md) — implemented current contract
- [수료생 증명서·프로필 사진 인증](./graduate-verification/spec.md) — implemented current contract
