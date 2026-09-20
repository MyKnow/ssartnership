---
title: 접근과 혜택의 공유 정책
type: product-contract
status: current
authority: normative
---

# 접근과 혜택의 공유 정책

기존 계약을 연결하는 정본이다. 자격·기간·사용 한도나 승인 요건을 새로 정하지 않는다. 정책 충돌은 Issue에서 판단하며 구현에 맞춰 조용히 완화하지 않는다.

## POL-access-001 — 접근과 혜택 노출

공개 제휴 상세, 대외비 상세의 회원 인증, 비공개 상세 차단을 구분한다. `eligible_only` 혜택은 비로그인·비대상 회원에게 혜택·조건·예약 링크를 노출하지 않는다. 공개 SEO·캐시도 같은 공개 경계를 지킨다. 회사별 파트너 권한이나 관리자 범위를 회원 자격과 혼합하지 않는다.

## POL-access-002 — 필수 단계와 복귀

필수 게이트는 비밀번호 → 약관 → 이메일 → 사진 순서로 필요한 항목을 처리한다. 원래 목적지는 내부 안전 경로만 허용하며 완료한 게이트로 무한 복귀하지 않는다. 대상별 예외는 공용 판정 구현과 관련 회귀 테스트가 설명한다.

## 대표 흐름의 추적표

| 요구 | 화면·흐름 | 구현 | 검증 방법 |
| --- | --- | --- | --- |
| REQ-discovery-001 탐색 조건과 복귀 보존 | [FLOW-discovery-001](../user-flows.md#flow-discovery-001), `public.home` | [홈 상태](../../../src/lib/home-partner-state.ts) | [검색·뒤로가기 E2E](../../../tests/e2e/home-partners.spec.ts), [상태 테스트](../../../tests/home-partner-state.test.mts) |
| REQ-discovery-002 허용 범위만 공개 | [상세 화면](../screen-specs/public-and-member.md), POL-access-001 | [혜택 노출](../../../src/lib/partner-benefit-visibility.ts) | [혜택 노출 테스트](../../../tests/partner-benefit-visibility.test.mts), [공개 경계](../../../tests/partner-visibility.test.mts) |
| REQ-discovery-003 인증 뒤 안전 복귀 | [인증 화면](../screen-specs/auth.md), POL-access-002 | [게이트](../../../src/lib/member-required-gates.ts) | [게이트 조합](../../../tests/member-required-gates.test.mts), [인증 E2E](../../../tests/e2e/auth-ops.spec.ts) |

테스트 경로는 실행 성공 증거가 아니다. 실행 커밋·환경·결과는 [작업 기록](../../specs/documentation-architecture/tasks.md)에 남긴다. Mock 테스트로 실회원·실DB·실제 외부 발송을 증명하지 않는다.
